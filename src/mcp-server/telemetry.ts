import { Langfuse } from 'langfuse';
import { langfuseLabel } from '../lib/langfuse-labels';
import { isSkillTrace, normalizeProjectName, normalizeSkillName } from '../lib/trace-utils';
import { UserResolver } from './user-resolver';
import { prisma } from '../lib/prisma';

export interface LangfuseMetadata {
  skillName: string;
  projectId?: string;
  projectName: string;
  environment: 'dev' | 'prod' | 'local';
  userEmail?: string;
  userName?: string;
  userRole?: string;
  model?: string;
  agent?: string;
  error?: string;
  stack?: string;
  duration?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface ITelemetry {
  withAnalytics<T>(
    skillName: string,
    projectName: string | undefined,
    model: string | undefined,
    agent: string | undefined,
    skillCost: string | undefined,
    executeCallback: () => Promise<T>,
    overrides?: { userEmail?: string, userRole?: string }
  ): Promise<T>;
}

/**
 * Telemetry handles all Langfuse tracing and metrics.
 * Enforces SRP by delegating identity resolution to UserResolver.
 */
export class Telemetry implements ITelemetry {
  private langfuse: Langfuse | null = null;
  private isConfigured = false;
  private userResolver: UserResolver;

  constructor() {
    this.userResolver = new UserResolver();
    
    // Initialize Langfuse only if the keys are actually provided
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

    if (publicKey && secretKey && publicKey !== 'placeholder' && secretKey !== 'placeholder') {
      this.langfuse = new Langfuse({ publicKey, secretKey, baseUrl });
      this.isConfigured = true;
    }
  }

  /**
   * Wraps an execution logic with Langfuse telemetry.
   */
  async withAnalytics<T>(
    skillName: string,
    projectName: string | undefined,
    model: string | undefined,
    agent: string | undefined,
    skillCost: string | undefined,
    executeCallback: () => Promise<T>,
    overrides?: { userEmail?: string, userRole?: string }
  ): Promise<T> {
    const normalizedSkill = normalizeSkillName(skillName);
    const startTime = Date.now();
    
    if (isSkillTrace(undefined, normalizedSkill)) {
      return executeCallback();
    }

    const userEmail = overrides?.userEmail || this.userResolver.getUserEmail();
    const userRole = overrides?.userRole || 'DEVELOPER'; // Defaulting to DEVELOPER if not provided via API override
    const userName = this.userResolver.getUserName();
    const resolvedModel = langfuseLabel(model);
    const resolvedAgent = langfuseLabel(agent);
    const normalizedProject = normalizeProjectName(projectName);

    const metadata: LangfuseMetadata = {
      skillName: normalizedSkill,
      projectName: normalizedProject,
      environment: 'local',
      userEmail,
      userName,
      userRole,
      model: resolvedModel,
      agent: resolvedAgent,
      version: '1.0.0',
      cwd: /*turbopackIgnore: true*/ process.cwd(),
      budgetedCost: skillCost || 'unknown',
    };

    if (resolvedModel.toLowerCase().includes('gpt-4')) {
      console.error(`[Telemetry] Trace ${skillName} using model: ${resolvedModel}. If this is incorrect, check IDE settings.`);
    }

    let trace: any = null;
    if (this.isConfigured && this.langfuse) {
      trace = this.langfuse.trace({
        name: `skill:${normalizedSkill}`,
        userId: userEmail,
        metadata,
        tags: [normalizedProject, resolvedModel, normalizedSkill, userRole],
      });
    }

    let status = 'success';
    let errorMessage: string | undefined;
    let completionTokens = 0;
    let promptTokens = Math.ceil(JSON.stringify(metadata).length / 4) + 100;

    try {
      const result = await executeCallback();
      const outputStr = typeof result === 'string' ? result : JSON.stringify(result);
      completionTokens = Math.ceil(outputStr.length / 4);

      if (trace) {
        trace.generation({
          name: `generation:${normalizedSkill}`,
          model: resolvedModel,
          output: outputStr,
          metadata: { ...metadata, project: normalizedProject },
          usage: {
            completionTokens,
            promptTokens,
          },
        });

        trace.update({ output: `Skill ${skillName} executed successfully.` });
      }
      return result;
    } catch (error: unknown) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      if (trace) {
        trace.update({
          output: `Error executing skill ${skillName}: ${errorMessage}`,
          metadata: { ...metadata, error: errorMessage, stack: errorStack },
        });
      }
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      
      // Log to Postgres
      try {
        let userIdToLog: string | null = null;
        if (userEmail && userEmail !== 'anonymous') {
          const userExists = await prisma.user.findUnique({
            where: { email: userEmail },
          });
          if (userExists) {
            userIdToLog = userExists.id;
          }
        }

        await prisma.analyticsEvent.create({
          data: {
            skillName: normalizedSkill,
            userId: userIdToLog,
            projectName: normalizedProject,
            model: resolvedModel,
            agent: resolvedAgent,
            duration,
            status: status.toUpperCase(),
            error: errorMessage,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            totalCost: 0,
            langfuseTraceId: trace?.id || null,
            metadata: { ...metadata, projectName: normalizedProject, userEmail } as any,
          },
        });
      } catch (dbError) {
        console.error('[Telemetry] Failed to log analytics to Postgres:', dbError);
      }

      await this.flushWithRetry(skillName);
    }
  }

  private async flushWithRetry(skillName: string) {
    if (!this.langfuse) return;
    for (let i = 0; i < 3; i++) {
      try {
        await this.langfuse.flushAsync();
        break;
      } catch (error) {
        if (i === 2) {
          console.error(`[Telemetry] Final flush attempt failed for ${skillName}:`, error);
        } else {
          await new Promise(r => setTimeout(r, 500 * (i + 1)));
        }
      }
    }
  }
}
