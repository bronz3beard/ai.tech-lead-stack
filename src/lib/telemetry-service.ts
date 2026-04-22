import { Langfuse } from 'langfuse';
import { langfuseLabel } from './langfuse-labels';
import { prisma } from './prisma';
import { normalizeProjectName, normalizeSkillName } from './trace-utils';

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
  private langfuse: Langfuse | null = null;
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
        this.langfuse = new Langfuse({
          publicKey: this.publicKey,
          secretKey: this.secretKey,
          baseUrl: this.baseUrl,
        });
        this.isConfigured = true;
        const projectShort = this.publicKey.split('-')[1] || 'unknown';
        console.log(
          `[Telemetry] Service successfully configured for project ${projectShort}`
        );
        return true;
      } catch (err) {
        console.error('[Telemetry] Failed to initialize Langfuse client:', err);
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
  }) {
    this.ensureConfigured();

    const normalizedSkill = normalizeSkillName(params.skillName);
    const normalizedProject = normalizeProjectName(params.projectName);
    const resolvedModel = langfuseLabel(params.model || 'unknown-model');
    const resolvedAgent = langfuseLabel(params.agent || 'unknown-agent');

    const promptTokens = params.promptTokens || 0;
    const completionTokens = params.completionTokens || 0;

    // Estimate total cost based on GPT-4o pricing
    const inputCost = (promptTokens / 1_000_000) * 5.0;
    const outputCost = (completionTokens / 1_000_000) * 15.0;
    const totalCost = Number((inputCost + outputCost).toFixed(6));

    // 1. Log to Langfuse (Async)
    let langfuseTraceId: string | null = null;
    if (this.isConfigured && this.langfuse) {
      try {
        const trace = this.langfuse.trace({
          name: `skill:${normalizedSkill}`,
          userId: params.userEmail,
          metadata: {
            ...params.metadata,
            projectName: normalizedProject,
            model: resolvedModel,
            agent: resolvedAgent,
          },
          tags: [normalizedProject, resolvedModel, normalizedSkill],
        });

        langfuseTraceId = trace.id;

        trace.generation({
          name:
            params.status === 'ERROR'
              ? `error:${normalizedSkill}`
              : `generation:${normalizedSkill}`,
          model: resolvedModel,
          statusMessage: params.error,
          usage: {
            promptTokens,
            completionTokens,
          },
          metadata: params.metadata,
        });

        this.langfuse.flushAsync().catch(() => {});
      } catch (err) {
        console.error('[Telemetry] Langfuse logging failed:', err);
      }
    }

    // 2. Log to Postgres
    try {
      console.log(
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
            console.log(
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

      console.log(`[Telemetry] Attempting database recording for event...`);
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
          ...params.metadata,
          userEmail: params.userEmail,
          projectName: normalizedProject,
          estimatedCost: totalCost,
        },
      };

      console.log(
        `[Telemetry] Persistence Payload:`,
        JSON.stringify(eventData, null, 2)
      );

      const event = await prisma.analyticsEvent.create({
        data: eventData,
      });

      console.log(
        `[Telemetry] Successfully recorded event to DB: ${normalizedSkill} (ID: ${event.id}, Status: ${params.status})`
      );

      // Async enrichment: Fetch actual usage from Langfuse if possible
      if (langfuseTraceId) {
        console.log(
          `[Telemetry] Triggering async enrichment for trace ${langfuseTraceId}...`
        );
        this.enrichEvent(event.id, langfuseTraceId).catch((err) => {
          console.error('[Telemetry] Enrichment failed:', err);
        });
      }

      return event;
    } catch (dbError: any) {
      console.error(
        '[Telemetry] CRITICAL: Failed to log to Postgres:',
        dbError
      );
      // Log more details if it's a Prisma error
      if (dbError.code) {
        console.error(`[Telemetry] Prisma Error Code: ${dbError.code}`);
      }
      return null;
    }
  }

  /**
   * Fetches supplemental data from Langfuse API and updates the Postgres record.
   * Falling back to previous estimation if Langfuse provides empty counts.
   */
  private async enrichEvent(eventId: string, traceId: string) {
    if (!this.isConfigured || !this.publicKey || !this.secretKey) return;

    try {
      // Small delay to allow Langfuse processing (though most usage is sent in generation)
      await new Promise((r) => setTimeout(r, 2000));

      const authHeader = `Basic ${Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64')}`;
      const response = await fetch(
        `${this.baseUrl}/api/public/traces/${traceId}`,
        {
          headers: { Authorization: authHeader },
        }
      );

      if (!response.ok) return;

      const traceDetails = await response.json();

      // Attempt to extract usage from any of the generations associated with this trace
      // In a more complex scenario, we'd sum all generations, but for a skill trace, there's usually one primary.
      const generations =
        traceDetails.observations?.filter(
          (o: any) => o.type === 'GENERATION'
        ) || [];

      let enrichedPromptTokens = 0;
      let enrichedCompletionTokens = 0;
      let enrichedTotalCost = 0;

      for (const gen of generations) {
        enrichedPromptTokens += gen.usage?.promptTokens || 0;
        enrichedCompletionTokens += gen.usage?.completionTokens || 0;
        enrichedTotalCost += gen.usage?.totalCost || 0;
      }

      if (enrichedPromptTokens > 0 || enrichedCompletionTokens > 0) {
        await prisma.analyticsEvent.update({
          where: { id: eventId },
          data: {
            promptTokens: enrichedPromptTokens,
            completionTokens: enrichedCompletionTokens,
            totalTokens: enrichedPromptTokens + enrichedCompletionTokens,
            totalCost: enrichedTotalCost > 0 ? enrichedTotalCost : undefined,
            metadata: {
              enrichedAt: new Date().toISOString(),
              langfuseCost: enrichedTotalCost,
            },
          },
        });
        console.log(
          `[Telemetry] Enriched event ${eventId} with actual Langfuse data.`
        );
      }
    } catch (err) {
      console.warn('[Telemetry] Enrichment suppressed:', err);
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

export const telemetryService = TelemetryService.getInstance();
