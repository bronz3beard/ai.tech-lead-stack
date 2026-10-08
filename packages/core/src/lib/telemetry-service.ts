import type { AnalyticsEvent } from '@prisma/client';
import { displayLabel } from './labels';
import { prisma } from './prisma';
import { normalizeProjectName, normalizeSkillName } from './trace-utils';
import { MODEL_CATALOG, providerOf } from './ai/model-registry';
import { estimateCostUsd } from './ai/reflexion/pricing';

/**
 * What a telemetry row measures. Only `llm_generation` rows carry a cost:
 * - skill_invocation: a skill/workflow file was served (MCP get_skill(s), chat workflow load).
 *   The LLM call runs on the agent's own subscription, so TLS never sees its tokens.
 * - llm_generation: an LLM call this stack made and saw usage for.
 * - tool_call: any other tool execution.
 * - loop_step: a reflexion phase marker that made no LLM call.
 */
export type TelemetryKind =
  | 'skill_invocation'
  | 'llm_generation'
  | 'tool_call'
  | 'loop_step';

export interface RecordEventParams {
  skillName: string;
  kind: TelemetryKind;
  projectName?: string;
  model?: string;
  agent?: string;
  duration: number;
  status: 'SUCCESS' | 'ERROR';
  error?: string;
  promptTokens?: number;
  completionTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  /** True when the token counts came from a provider response, not an estimate. */
  usageFromProvider?: boolean;
  userEmail?: string;
  /** Groups events into one session: chat id, loop run id, or MCP session id. */
  sessionId?: string | null;
  gitBranch?: string | null;
  prNumber?: number | null;
  /** Defaults to 'test' under Jest, else TLS_TELEMETRY_ENV, else 'production'. */
  environment?: string;
  metadata?: Record<string, unknown>;
  actorType?: string | null;
  autonomy?: string | null;
  loopRunId?: string | null;
  loopPhase?: string | null;
  teamRole?: string | null;
}

function resolveEnvironment(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.NODE_ENV === 'test') return 'test';
  return process.env.TLS_TELEMETRY_ENV || 'production';
}

function resolveProvider(modelId: string): string | null {
  if (modelId === 'unknown-model') return null;
  try {
    return providerOf(modelId);
  } catch {
    return null;
  }
}

/**
 * Maps a caller-supplied model string to a catalog id. Agents sometimes pass
 * their own name ("Cursor", "Jules") as the model; those move to `agent`.
 */
function resolveModel(params: { model?: string; agent?: string }) {
  const originalModel = params.model || 'unknown-model';
  let validatedModel = originalModel;
  let validatedAgent = params.agent || 'unknown-agent';
  let invalidModelValue: string | undefined;
  let isRecognizedModel = false;

  // 1. First try exact catalog id match (or label match)
  const exactMatch = MODEL_CATALOG.find(
    (m) => m.id === originalModel || m.label === originalModel
  );

  if (exactMatch) {
    validatedModel = exactMatch.id;
    isRecognizedModel = true;
  } else if (originalModel !== 'unknown-model') {
    // 2. Normalize: lowercase, trim, strip trailing date/version suffix (e.g. -20260101, @preview)
    const normalized = originalModel
      .toLowerCase()
      .trim()
      .replace(/(-[0-9]{8}|@preview)$/, '');
    const normalizedMatch = MODEL_CATALOG.find(
      (m) => m.id === normalized || m.label.toLowerCase() === normalized
    );

    if (normalizedMatch) {
      validatedModel = normalizedMatch.id;
      isRecognizedModel = true;
    } else {
      // 3. Accept it as a REAL model id if it matches a known provider prefix
      const isProviderPrefix = /^(claude-|gemini-|gpt-|o[1-9])/i.test(originalModel);
      const isLocalModel =
        process.env.LOCAL_MODEL_NAME && originalModel === process.env.LOCAL_MODEL_NAME;

      if (isProviderPrefix || isLocalModel) {
        validatedModel = originalModel;
        isRecognizedModel = true;
      }
    }
  }

  if (!isRecognizedModel && originalModel !== 'unknown-model') {
    // Re-route agents like "Antigravity", "Jules", "Cursor" to agent field if agent is missing
    if (!params.agent || params.agent === 'unknown-agent' || params.agent === 'unknown') {
      validatedAgent = originalModel;
    }
    invalidModelValue = originalModel;
    validatedModel = 'unknown-model';
  }

  return { validatedModel, validatedAgent, invalidModelValue };
}

/**
 * Cost for an llm_generation row; every other kind is null, never a guess.
 * `costIsEstimate` is false only for provider-reported usage priced at an exact rate.
 */
function resolveCost(params: RecordEventParams, modelId: string) {
  if (params.kind !== 'llm_generation') {
    return { totalCost: null, costIsEstimate: true, pricingFallback: false };
  }
  const estimate = estimateCostUsd({
    modelId,
    inputTokens: params.promptTokens ?? 0,
    outputTokens: params.completionTokens ?? 0,
    cacheReadTokens: params.cacheReadTokens,
    cacheWriteTokens: params.cacheWriteTokens,
  });
  if (!estimate) {
    return { totalCost: null, costIsEstimate: true, pricingFallback: true };
  }
  return {
    totalCost: estimate.costUsd,
    costIsEstimate: !(params.usageFromProvider && estimate.exactPrice),
    pricingFallback: !estimate.exactPrice,
  };
}

async function resolveUserId(userEmail?: string): Promise<string | null> {
  if (!userEmail || userEmail === 'anonymous' || userEmail === 'unknown') return null;
  try {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch (authError) {
    console.error('[Telemetry] User lookup failed, continuing anonymously:', authError);
    return null;
  }
}

export class TelemetryService {
  private static instance: TelemetryService;

  private constructor() {}

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  /**
   * Records one telemetry event to Postgres, the single source of truth for the dashboards.
   */
  async recordEvent(params: RecordEventParams): Promise<AnalyticsEvent | null> {
    const normalizedSkill = normalizeSkillName(params.skillName);
    const normalizedProject = normalizeProjectName(params.projectName);
    const { validatedModel, validatedAgent, invalidModelValue } = resolveModel(params);

    const promptTokens = params.promptTokens ?? 0;
    const completionTokens = params.completionTokens ?? 0;
    const { totalCost, costIsEstimate, pricingFallback } = resolveCost(params, validatedModel);

    try {
      const eventData = {
        skillName: normalizedSkill,
        kind: params.kind,
        userId: await resolveUserId(params.userEmail),
        projectName: normalizedProject,
        model: displayLabel(validatedModel),
        agent: displayLabel(validatedAgent),
        provider: resolveProvider(validatedModel),
        duration: params.duration,
        status: params.status,
        error: params.error ?? null,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cacheReadTokens: params.cacheReadTokens ?? null,
        cacheWriteTokens: params.cacheWriteTokens ?? null,
        reasoningTokens: params.reasoningTokens ?? null,
        totalCost,
        costIsEstimate,
        sessionId: params.sessionId ?? null,
        gitBranch: params.gitBranch ?? null,
        prNumber: params.prNumber ?? null,
        environment: resolveEnvironment(params.environment),
        metadata: {
          ...params.metadata,
          ...(invalidModelValue && { invalidModel: invalidModelValue }),
          ...(pricingFallback && { pricingFallback: true }),
          llmCall: params.kind === 'llm_generation',
          userEmail: params.userEmail,
          projectName: normalizedProject,
        },
        actorType: params.actorType,
        autonomy: params.autonomy,
        loopRunId: params.loopRunId,
        loopPhase: params.loopPhase,
        teamRole: params.teamRole,
      };

      // Make the Postgres write resilient with a retry
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const event = await prisma.analyticsEvent.create({ data: eventData });
          console.error(
            `[Telemetry] Recorded ${params.kind} ${normalizedSkill} (ID: ${event.id}, Status: ${params.status})`
          );
          return event;
        } catch (err) {
          lastError = err;
          console.warn(`[Telemetry] Postgres create attempt ${attempt} failed: ${String(err)}`);
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100)); // exponential backoff
          }
        }
      }
      throw lastError ?? new Error('Failed to create AnalyticsEvent after retries');
    } catch (dbError) {
      console.error('[Telemetry] CRITICAL: Failed to log to Postgres:', dbError);
      return null;
    }
  }
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
