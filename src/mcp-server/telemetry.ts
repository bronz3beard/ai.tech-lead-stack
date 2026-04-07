import { Langfuse } from 'langfuse';
import { langfuseLabel } from '../lib/langfuse-labels';
import { isSkillTrace, normalizeProjectName } from '../lib/trace-utils';
import { UserResolver } from './user-resolver';

export interface LangfuseMetadata {
  skillName: string;
  projectId?: string;
  projectName: string;
  environment: 'dev' | 'prod' | 'local';
  userEmail?: string;
  userName?: string;
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
    executeCallback: () => Promise<T>
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
    executeCallback: () => Promise<T>
  ): Promise<T> {
    if (!this.isConfigured || !this.langfuse || isSkillTrace(undefined, skillName)) {
      return executeCallback();
    }

    const userEmail = this.userResolver.getUserEmail();
    const userName = this.userResolver.getUserName();
    const resolvedModel = langfuseLabel(model);
    const resolvedAgent = langfuseLabel(agent);
    const normalizedProject = normalizeProjectName(projectName);

    const metadata: LangfuseMetadata = {
      skillName,
      projectName: normalizedProject,
      environment: 'local',
      userEmail,
      userName,
      model: resolvedModel,
      agent: resolvedAgent,
      version: '1.0.0',
      cwd: process.cwd(),
      budgetedCost: skillCost || 'unknown',
    };

    if (resolvedModel.toLowerCase().includes('gpt-4')) {
      console.error(`[Telemetry] Trace ${skillName} using model: ${resolvedModel}. If this is incorrect, check IDE settings.`);
    }

    const trace = this.langfuse.trace({
      name: `skill:${skillName}`,
      userId: userEmail,
      metadata,
      tags: [normalizedProject, resolvedModel, skillName],
    });

    try {
      const result = await executeCallback();
      const outputStr = typeof result === 'string' ? result : JSON.stringify(result);

      trace.generation({
        name: `generation:${skillName}`,
        model: resolvedModel,
        output: outputStr,
        metadata: { ...metadata, project: normalizedProject },
        usage: {
          completionTokens: Math.ceil(outputStr.length / 4),
          promptTokens: Math.ceil(JSON.stringify(metadata).length / 4) + 100,
        },
      });

      trace.update({ output: `Skill ${skillName} executed successfully.` });
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      trace.update({
        output: `Error executing skill ${skillName}: ${errorMessage}`,
        metadata: { ...metadata, error: errorMessage, stack: errorStack },
      });
      throw error;
    } finally {
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
