import { Langfuse } from 'langfuse-node';
import { langfuseLabel } from '@/lib/langfuse-labels';
import { prisma } from '@/lib/prisma';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});

export async function withAnalytics<T, U>(
  skillName: string,
  context: { userId?: string; model?: string; agent?: string; projectId?: string; projectName?: string },
  skill: (input: T) => Promise<U>
) {
  return async (input: T): Promise<U> => {
    const resolvedModel = langfuseLabel(context.model);
    const resolvedAgent = langfuseLabel(context.agent);

    const trace = langfuse.trace({
      name: skillName,
      userId: context.userId || 'anonymous',
      metadata: { 
        input, 
        model: resolvedModel, 
        agent: resolvedAgent,
        projectId: context.projectId,
        projectName: context.projectName 
      },
      tags: context.projectName ? [context.projectName] : [],
    });

    const startTime = Date.now();
    let status = 'success';
    let errorMessage: string | undefined;
    let completionTokens = 0;
    let promptTokens = 500;

    try {
      const output = await skill(input);
      const outputStr =
        typeof output === 'string' ? output : JSON.stringify(output);

      completionTokens = Math.ceil(outputStr.length / 4);

      // Track a generation to ensure Langfuse can calculate/display token costs
      trace.generation({
        name: `generation:${skillName}`,
        model: resolvedModel,
        output: outputStr,
        usage: {
          completionTokens,
          promptTokens,
        },
      });

      trace.update({ output: outputStr });
      return output;
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : String(error);
      trace.update({
        metadata: { error: errorMessage },
      });
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      await langfuse.flushAsync();

      const totalTokens = promptTokens + completionTokens;
      const totalCost = 0;

      if (context.userId && context.userId !== 'anonymous') {
        try {
          const userExists = await prisma.user.findUnique({
            where: { email: context.userId },
          });

          if (userExists) {
             await prisma.analyticsEvent.create({
              data: {
                skillName,
                userId: userExists.id,
                projectId: context.projectId,
                projectName: context.projectName,
                model: resolvedModel,
                agent: resolvedAgent,
                duration,
                status,
                error: errorMessage,
                promptTokens,
                completionTokens,
                totalTokens,
                totalCost,
                langfuseTraceId: trace.id,
                metadata: { 
                  input: input as any, 
                  model: resolvedModel, 
                  agent: resolvedAgent,
                  projectName: context.projectName 
                },
              },
            });
          }
        } catch (dbError) {
          console.error('Failed to log analytics to Postgres:', dbError);
        }
      }
    }
  };
}
