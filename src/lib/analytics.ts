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

    const isLangfuseConfigured = !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY !== 'placeholder');

    let trace: any = null;
    if (isLangfuseConfigured) {
      trace = langfuse.trace({
        name: skillName,
        userId: context.userId || 'anonymous',
        metadata: {
          input,
          model: resolvedModel,
          agent: resolvedAgent,
          projectId: context.projectId,
          projectName: context.projectName,
          userEmail: context.userId,
        },
        tags: context.projectName ? [context.projectName] : [],
      });
    }

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

      if (trace) {
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
      }
      return output;
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : String(error);
      if (trace) {
        trace.update({
          metadata: { error: errorMessage },
        });
      }
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      if (isLangfuseConfigured) {
        try {
          await langfuse.flushAsync();
        } catch (flushError) {
          console.error('Failed to flush Langfuse:', flushError);
        }
      }

      const totalTokens = promptTokens + completionTokens;
      const totalCost = 0;

      try {
        let userIdToLog: string | null = null;
        if (context.userId && context.userId !== 'anonymous') {
          const userExists = await prisma.user.findUnique({
            where: { email: context.userId },
          });

          if (userExists) {
            userIdToLog = userExists.id;
          }
        }

        await prisma.analyticsEvent.create({
          data: {
            skillName,
            userId: userIdToLog,
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
            langfuseTraceId: trace?.id || null,
            metadata: {
              input: input as any,
              model: resolvedModel,
              agent: resolvedAgent,
              projectName: context.projectName,
              userEmail: context.userId,
            },
          },
        });
      } catch (dbError) {
        console.error('Failed to log analytics to Postgres:', dbError);
      }
    }
  };
}
