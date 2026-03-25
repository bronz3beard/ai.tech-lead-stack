import { Langfuse } from 'langfuse-node';
import { langfuseLabel } from '@/lib/langfuse-labels';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || 'pk-lf-test',
  secretKey: process.env.LANGFUSE_SECRET_KEY || 'sk-lf-test',
  baseUrl: process.env.LANGFUSE_BASE_URL || 'http://localhost:3000',
});

export async function withAnalytics<T, U>(
  skillName: string,
  context: { userId?: string; model?: string; agent?: string },
  skill: (input: T) => Promise<U>
) {
  return async (input: T): Promise<U> => {
    // Detect Agent from environment if not provided
    let detectedAgent = context.agent;
    if (!detectedAgent || detectedAgent === 'unknown') {
      if (process.env.CURSOR_AGENT || process.env.CURSOR_TRACE_ID) {
        detectedAgent = 'Cursor';
      } else if (process.env.ANTIGRAVITY_AGENT || process.env.ANTIGRAVITY_WORKFLOW_ID) {
        detectedAgent = 'Antigravity';
      }
    }

    const resolvedModel = langfuseLabel(context.model);
    const resolvedAgent = langfuseLabel(detectedAgent);

    const trace = langfuse.trace({
      name: skillName,
      userId: context.userId || 'anonymous',
      metadata: { input, model: resolvedModel, agent: resolvedAgent },
    });

    try {
      const output = await skill(input);
      const outputStr =
        typeof output === 'string' ? output : JSON.stringify(output);

      // Track a generation to ensure Langfuse can calculate/display token costs
      trace.generation({
        name: `generation:${skillName}`,
        model: resolvedModel,
        output: outputStr,
        usage: {
          completionTokens: Math.ceil(outputStr.length / 4),
          promptTokens: 500,
        },
      });

      trace.update({ output: outputStr });
      return output;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      trace.update({
        metadata: { error: errorMessage },
      });
      throw error;
    } finally {
      await langfuse.flushAsync();
    }
  };
}
