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
      trace.update({ output: JSON.stringify(output) });
      return output;
    } catch (error) {
      trace.update({
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    } finally {
      await langfuse.flushAsync();
    }
  };
}
