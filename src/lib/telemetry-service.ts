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

  private constructor() {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl =
      process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

    if (
      publicKey &&
      secretKey &&
      publicKey !== 'placeholder' &&
      secretKey !== 'placeholder'
    ) {
      this.langfuse = new Langfuse({ publicKey, secretKey, baseUrl });
      this.isConfigured = true;
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
    const normalizedSkill = normalizeSkillName(params.skillName);
    const normalizedProject = normalizeProjectName(params.projectName);
    const resolvedModel = langfuseLabel(params.model);
    const resolvedAgent = langfuseLabel(params.agent);

    const promptTokens = params.promptTokens || 0;
    const completionTokens = params.completionTokens || 0;

    // Estimate total cost based on GPT-4o pricing
    const inputCost = (promptTokens / 1_000_000) * 5.00;
    const outputCost = (completionTokens / 1_000_000) * 15.00;
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
      let resolvedUserId: string | null = null;
      if (
        params.userEmail &&
        params.userEmail !== 'anonymous' &&
        params.userEmail !== 'unknown'
      ) {
        const user = await prisma.user.findUnique({
          where: { email: params.userEmail },
          select: { id: true },
        });
        if (user) {
          resolvedUserId = user.id;
        }
      }

      const event = await prisma.analyticsEvent.create({
        data: {
          skillName: normalizedSkill,
          userId: resolvedUserId, // null is allowed, undefined is not
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
          } as any,
        } as any, // Cast to any to bypass strict relation typing checks
      });
      console.log(
        `[Telemetry] Successfully recorded event: ${normalizedSkill} (ID: ${event.id}, Status: ${params.status})`
      );
    } catch (dbError) {
      console.error(
        '[Telemetry] Failed to log to Postgres:',
        dbError
      );
    }
  }
}

export const telemetryService = TelemetryService.getInstance();
