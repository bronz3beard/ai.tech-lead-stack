import { execSync } from 'child_process';
import { Langfuse } from 'langfuse';

export interface LangfuseMetadata {
  skillName: string;
  projectId?: string;
  projectName: string;
  environment: 'dev' | 'prod' | 'local';
  userEmail?: string;
  model?: string;
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
    executeCallback: () => Promise<T>
  ): Promise<T> {
    if (!this.isConfigured || !this.langfuse) {
      // If Langfuse isn't configured, just run the callback directly
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

    const metadata: LangfuseMetadata = {
      skillName,
      projectName: projectName ?? 'unknown',
      environment: 'local',
      userEmail: userEmail,
      model: model || 'unknown',
    };

    const trace = this.langfuse.trace({
      name: `skill:${skillName}`,
      userId: userEmail,
      metadata,
    });

    try {
      const result = await executeCallback();

      const outputStr =
        typeof result === 'string' ? result : JSON.stringify(result);

      // Track a generation to ensure Langfuse can calculate/display token costs
      trace.generation({
        name: `generation:${skillName}`,
        model: model || 'unknown',
        output: outputStr,
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
      // Flush events asynchronously
      await this.langfuse.flushAsync();
    }
  }
}
