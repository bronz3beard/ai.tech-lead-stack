import { execSync } from 'child_process';
import { Langfuse } from 'langfuse';
import { langfuseLabel } from '../lib/langfuse-labels';
import { isSkillTrace, normalizeProjectName } from '../lib/trace-utils';

export interface LangfuseMetadata {
  skillName: string;
  projectId?: string;
  projectName: string;
  environment: 'dev' | 'prod' | 'local';
  userEmail?: string;
  model?: string;
  agent?: string;
  error?: string;
  stack?: string;
  duration?: number;
  [key: string]: string | number | boolean | undefined;
}

export class Telemetry {
  private langfuse: Langfuse | null = null;
  private isConfigured = false;

  constructor() {
    // Initialize Langfuse only if the keys are actually provided (not the placeholders)
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
      this.langfuse = new Langfuse({
        publicKey,
        secretKey,
        baseUrl,
      });
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
    executeCallback: () => Promise<T>
  ): Promise<T> {
    if (!this.isConfigured || !this.langfuse || isSkillTrace(undefined, skillName)) {
      // If Langfuse isn't configured or it's a skeletal skill trace, just run the callback directly
      return executeCallback();
    }

    // Strictly get user email from GitHub CLI for dashboard parity
    let userEmail = 'unknown';
    try {
      // Primary: GitHub CLI (best for parity with GitHub OAuth)
      userEmail = execSync('gh api user -q .email', { stdio: 'pipe' })
        .toString()
        .trim();

      // If GH CLI returns nothing or empty, fallback to git config
      if (!userEmail || userEmail === 'null') {
         userEmail = execSync('git config --global user.email', { stdio: 'pipe' })
           .toString()
           .trim();
      }
    } catch {
      try {
        // Fallback: Git Config
        userEmail = execSync('git config --global user.email', { stdio: 'pipe' })
          .toString()
          .trim();
      } catch {
        // Fallback: Env variable
        userEmail = process.env.USER_EMAIL || 'unknown';
      }
    }

    const resolvedModel = langfuseLabel(model);
    const resolvedAgent = langfuseLabel(agent);
    const normalizedProject = normalizeProjectName(projectName);

    // Try to get user name for more context
    let userName = 'unknown';
    try {
      userName = execSync('git config --global user.name', { stdio: 'pipe' })
        .toString()
        .trim();
    } catch {
      // Ignore errors
    }

    const metadata: LangfuseMetadata = {
      skillName,
      projectName: normalizedProject,
      environment: 'local',
      userEmail: userEmail,
      userName: userName,
      model: resolvedModel,
      agent: resolvedAgent,
      version: '1.0.0',
    };

    // Log model override if it looks suspicious (e.g. gpt-4 when user says gemini)
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

      const outputStr =
        typeof result === 'string' ? result : JSON.stringify(result);

      // Track a generation to ensure Langfuse can calculate/display token costs
      trace.generation({
        name: `generation:${skillName}`,
        model: resolvedModel,
        output: outputStr,
        metadata: {
          ...metadata,
          project: normalizedProject,
        },
        usage: {
          completionTokens: Math.ceil(outputStr.length / 4),
          promptTokens: 500,
        },
      });

      trace.update({
        output: `Skill ${skillName} executed successfully.`,
      });

      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      trace.update({
        output: `Error executing skill ${skillName}: ${errorMessage}`,
        metadata: {
          ...metadata,
          error: errorMessage,
          stack: errorStack,
        },
      });
      throw error;
    } finally {
      // Flush events with retry logic to ensure data is sent even under load
      for (let i = 0; i < 3; i++) {
        try {
          await this.langfuse.flushAsync();
          break; // Success
        } catch (error) {
          if (i === 2) {
            console.error(`[Telemetry] Final flush attempt failed for ${skillName}:`, error);
          } else {
            console.warn(`[Telemetry] Flush attempt ${i + 1} failed for ${skillName}, retrying...`);
            await new Promise(r => setTimeout(r, 500 * (i + 1)));
          }
        }
      }
    }
  }
}
