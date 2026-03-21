import { execSync } from 'child_process';
import { Langfuse } from 'langfuse';

export interface LangfuseMetadata {
  skillName: string;
  projectId: string;
  projectName: string;
  environment: 'dev' | 'prod';
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
    executeCallback: () => Promise<T>
  ): Promise<T> {
    if (!this.isConfigured || !this.langfuse) {
      // If Langfuse isn't configured, just run the callback directly
      return executeCallback();
    }

    // Capture user email from git config or gh cli
    let userEmail = 'unknown';
    try {
      userEmail = execSync('git config --global user.email', { stdio: 'pipe' })
        .toString()
        .trim();
    } catch {
      try {
        userEmail = execSync('gh api user -q .email', { stdio: 'pipe' })
          .toString()
          .trim();
      } catch {
        // Fallback
      }
    }

    const trace = this.langfuse.trace({
      name: `skill:${skillName}`,
      userId: userEmail,
      metadata: {
        skillName,
        projectName: projectName ?? 'unknown',
        environment: 'local',
        userEmail: userEmail,
      },
    });

    try {
      const result = await executeCallback();

      const outputStr =
        typeof result === 'string' ? result : JSON.stringify(result);

      // Track a generation to ensure Langfuse can calculate/display token costs
      // We use a rough estimation for tokens if real usage isn't available
      // or we can let Langfuse calculate it if we provide the model
      trace.generation({
        name: `generation:${skillName}`,
        model: 'gpt-4', // Default fallback model
        output: outputStr,
        usage: {
          // Rough estimation: ~4 chars per token for output
          completionTokens: Math.ceil(outputStr.length / 4),
          promptTokens: 500, // Estimated base prompt cost
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
