import { Langfuse } from "langfuse-node";

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || "pk-lf-test",
  secretKey: process.env.LANGFUSE_SECRET_KEY || "sk-lf-test",
  baseUrl: process.env.LANGFUSE_BASE_URL || "http://localhost:3000",
});

export async function withAnalytics<T, U>(
  skillName: string,
  context: { userId?: string },
  skill: (input: T) => Promise<U>
) {
  return async (input: T): Promise<U> => {
    const trace = langfuse.trace({
      name: skillName,
      userId: context.userId || "anonymous",
      metadata: { input },
    });

    try {
      const output = await skill(input);
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

      // Track a generation to ensure Langfuse can calculate/display token costs
      trace.generation({
          name: `generation:${skillName}`,
          model: "gpt-4",
          output: outputStr,
          usage: {
              completionTokens: Math.ceil(outputStr.length / 4),
              promptTokens: 500,
          }
      });

      trace.update({ output: outputStr });
      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      trace.update({
        metadata: { error: errorMessage },
      });
      throw error;
    } finally {
      await langfuse.flushAsync();
    }
  };
}
