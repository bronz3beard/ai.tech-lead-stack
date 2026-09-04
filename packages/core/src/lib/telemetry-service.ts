import crypto from 'node:crypto';
import { langfuseSink } from './langfuse-sink';
import { langfuseLabel } from './langfuse-labels';
import { prisma } from './prisma';
import { normalizeProjectName, normalizeSkillName } from './trace-utils';
import { MODEL_CATALOG } from './ai/model-registry';

const PRICING_MAP: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75 },
  'gemini-3.1-pro': { input: 2, output: 12 },
};
const DEFAULT_PRICING = { input: 3, output: 15 };

export interface TelemetryMetadata {
  skillName: string;
  projectName: string;
  model?: string;
  agent?: string;
  userEmail?: string;
  userRole?: string;
  userName?: string;
  version?: string;
  environment?: string;
  [key: string]: any;
}

export class TelemetryService {
  private static instance: TelemetryService;
  private isConfigured = false;
  private publicKey: string | undefined = '';
  private secretKey: string | undefined = '';
  private baseUrl: string = '';

  private constructor() {
    this.configure();
  }

  /**
   * Internal configuration logic.
   * Can be called during construction or as a fallback if env vars
   * are loaded after initial singleton instantiation.
   */
  private configure(): boolean {
    // Only skip re-initialization if the Langfuse client is already instantiated.
    // Do NOT gate on isConfigured alone — env vars may arrive after the first configure() call.
    if (this.isConfigured) return true;

    this.publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    this.secretKey = process.env.LANGFUSE_SECRET_KEY;
    this.baseUrl =
      process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

    if (
      this.publicKey &&
      this.secretKey &&
      this.publicKey !== 'placeholder' &&
      this.secretKey !== 'placeholder'
    ) {
      try {
        this.isConfigured = true;
        const projectShort = this.publicKey.split('-')[1] || 'unknown';
        console.error(
          `[Telemetry] Service successfully configured for project ${projectShort}`
        );
        return true;
      } catch (err) {
        console.error('[Telemetry] Failed to initialize telemetry config:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Ensures the service is configured before recording an event.
   * Handles cases where the singleton is instantiated before environment variables are loaded.
   */
  private ensureConfigured() {
    if (!this.isConfigured) {
      this.configure();
    }
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  /**
   * Records a skill execution event to both Langfuse and Postgres.
   * Now attempts to enrich data from Langfuse using the trace status.
   */
  async recordEvent(params: {
    skillName: string;
    projectName?: string;
    model?: string;
    agent?: string;
    duration: number;
    status: 'SUCCESS' | 'ERROR';
    error?: string;
    promptTokens?: number;
    completionTokens?: number;
    userEmail?: string;
    metadata?: Record<string, any>;
    actorType?: string | null;
    autonomy?: string | null;
    loopRunId?: string | null;
    loopPhase?: string | null;
    teamRole?: string | null;
  }) {
    this.ensureConfigured();

    const normalizedSkill = normalizeSkillName(params.skillName);
    const normalizedProject = normalizeProjectName(params.projectName);

    // Validate Model against Catalog
    const originalModel = params.model || 'unknown-model';
    let validatedModel = originalModel;
    let validatedAgent = params.agent || 'unknown-agent';
    let invalidModelValue: string | undefined;

    const isRecognizedModel = MODEL_CATALOG.some(m => m.id === originalModel);
    if (!isRecognizedModel && originalModel !== 'unknown-model') {
      // Re-route agents like "Antigravity", "Jules", "Cursor" to agent field if agent is missing
      if (!params.agent || params.agent === 'unknown-agent' || params.agent === 'unknown') {
         validatedAgent = originalModel;
      }
      invalidModelValue = originalModel;
      validatedModel = 'unknown-model';
    }

    const resolvedModel = langfuseLabel(validatedModel);
    const resolvedAgent = langfuseLabel(validatedAgent);

    const promptTokens = params.promptTokens || 0;
    const completionTokens = params.completionTokens || 0;

    // Estimate total cost based on pricing map
    let inputRate = DEFAULT_PRICING.input;
    let outputRate = DEFAULT_PRICING.output;
    let pricingFallback = false;

    if (PRICING_MAP[validatedModel]) {
      inputRate = PRICING_MAP[validatedModel].input;
      outputRate = PRICING_MAP[validatedModel].output;
    } else if ((promptTokens > 0 || completionTokens > 0) && validatedModel !== 'unknown-model') {
      pricingFallback = true;
    }

    const inputCost = (promptTokens / 1_000_000) * inputRate;
    const outputCost = (completionTokens / 1_000_000) * outputRate;
    const totalCost = Number((inputCost + outputCost).toFixed(6));

    const finalMetadata = {
      ...params.metadata,
      ...(invalidModelValue && { invalidModel: invalidModelValue }),
      ...(pricingFallback && { pricingFallback: true }),
      llmCall: params.metadata?.llmCall !== undefined ? params.metadata.llmCall : true,
    };

    // 1. Generate Langfuse Trace ID (for deterministic association)
    const langfuseTraceId = crypto.randomUUID();

    // 2. Log to Postgres
    try {
      console.error(
        `[Telemetry] Starting Postgres recording for skill: ${normalizedSkill}`
      );

      let resolvedUserId: string | null = null;
      if (
        params.userEmail &&
        params.userEmail !== 'anonymous' &&
        params.userEmail !== 'unknown'
      ) {
        try {
          const user = await prisma.user.findUnique({
            where: { email: params.userEmail },
            select: { id: true },
          });
          if (user) {
            resolvedUserId = user.id;
            console.error(
              `[Telemetry] Resolved userId ${resolvedUserId} for email ${params.userEmail}`
            );
          } else {
            console.warn(
              `[Telemetry] No user found for email ${params.userEmail}`
            );
          }
        } catch (authError) {
          console.error(
            '[Telemetry] User lookup failed, continuing anonymously:',
            authError
          );
        }
      }

      console.error(`[Telemetry] Attempting database recording for event...`);
      const eventData = {
        skillName: normalizedSkill,
        userId: resolvedUserId,
        projectName: normalizedProject,
        model: resolvedModel,
        agent: resolvedAgent,
        duration: params.duration,
        status: params.status,
        error: params.error ?? null,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        totalCost: totalCost,
        langfuseTraceId,
        metadata: {
          ...finalMetadata,
          userEmail: params.userEmail,
          projectName: normalizedProject,
          estimatedCost: totalCost,
        },
        actorType: params.actorType,
        autonomy: params.autonomy,
        loopRunId: params.loopRunId,
        loopPhase: params.loopPhase,
        teamRole: params.teamRole,
      };

      console.error(
        `[Telemetry] Persistence Payload:`,
        JSON.stringify(eventData, null, 2)
      );

      // Make the Postgres write resilient with a retry
      let event: any;
      let lastError: any;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          event = await prisma.analyticsEvent.create({
            data: eventData,
          });
          break; // Success
        } catch (err) {
          lastError = err;
          console.warn(`[Telemetry] Postgres create attempt ${attempt} failed: ${String(err)}`);
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100)); // exponential backoff
          }
        }
      }

      if (!event) {
        throw lastError || new Error('Failed to create AnalyticsEvent after retries');
      }

      console.error(
        `[Telemetry] Successfully recorded event to DB: ${normalizedSkill} (ID: ${event.id}, Status: ${params.status})`
      );

      // Async enqueue to Langfuse sink
      try {
        langfuseSink.enqueue({
          traceId: langfuseTraceId,
          skillName: normalizedSkill,
          projectName: normalizedProject,
          model: resolvedModel,
          agent: resolvedAgent,
          duration: params.duration,
          status: params.status,
          error: params.error,
          promptTokens,
          completionTokens,
          totalCost: totalCost,
          userEmail: params.userEmail,
          metadata: finalMetadata,
          loopPhase: params.loopPhase,
          actorType: params.actorType,
          autonomy: params.autonomy,
          loopRunId: params.loopRunId,
          teamRole: params.teamRole,
        });
      } catch (sinkErr) {
        console.error('[Telemetry] Failed to enqueue to langfuse sink:', sinkErr);
      }
      return event;
    } catch (dbError: any) {
      console.error(
        '[Telemetry] CRITICAL: Failed to log to Postgres:',
        dbError
      );
      if (dbError.code) {
        console.error(`[Telemetry] Prisma Error Code: ${dbError.code}`);
      }
      return null;
    }
  }

}

/**
 * Higher-order utility to wrap skill execution with standardized telemetry.
 * Unified version that replaces legacy withAnalytics.
 */
export async function withAnalytics<T, U>(
  skillName: string,
  context: {
    userId?: string;
    model?: string;
    agent?: string;
    projectId?: string;
    projectName?: string;
    metadata?: Record<string, any>;
  },
  skill: (input: T) => Promise<U>
) {
  return async (input: T): Promise<U> => {
    const startTime = Date.now();
    let status: 'SUCCESS' | 'ERROR' = 'SUCCESS';
    let errorMessage: string | undefined;

    try {
      const output = await skill(input);

      // Fire-and-forget logging
      const duration = (Date.now() - startTime) / 1000;
      const outputStr =
        typeof output === 'string' ? output : JSON.stringify(output);
      const completionTokens = Math.ceil(outputStr.length / 4);
      const promptTokens = 500; // Baseline estimation

      telemetryService
        .recordEvent({
          skillName,
          projectName: context.projectName || context.projectId,
          model: context.model,
          agent: context.agent,
          duration,
          status,
          userEmail: context.userId,
          promptTokens,
          completionTokens,
          metadata: {
            ...context.metadata,
            input: typeof input === 'object' ? input : { value: input },
            source: 'chat-v2',
          },
        })
        .catch((err) =>
          console.error('[Telemetry] withAnalytics log failed:', err)
        );

      return output;
    } catch (error) {
      status = 'ERROR';
      errorMessage = error instanceof Error ? error.message : String(error);

      const duration = (Date.now() - startTime) / 1000;
      telemetryService
        .recordEvent({
          skillName,
          projectName: context.projectName || context.projectId,
          model: context.model,
          agent: context.agent,
          duration,
          status,
          error: errorMessage,
          userEmail: context.userId,
          metadata: {
            ...context.metadata,
            input: typeof input === 'object' ? input : { value: input },
            source: 'chat-v2-error',
          },
        })
        .catch((err) =>
          console.error('[Telemetry] withAnalytics error log failed:', err)
        );

      throw error;
    }
  };
}

/**
 * Lazy singleton accessor. Deferred until first use to avoid ESM hoisting
 * race conditions where this module evaluates before dotenv loads env vars.
 */
let _telemetryServiceInstance: TelemetryService | null = null;

export const telemetryService: Pick<TelemetryService, 'recordEvent'> = {
  recordEvent: (params) => {
    if (!_telemetryServiceInstance) {
      _telemetryServiceInstance = TelemetryService.getInstance();
    }
    return _telemetryServiceInstance.recordEvent(params);
  },
};
