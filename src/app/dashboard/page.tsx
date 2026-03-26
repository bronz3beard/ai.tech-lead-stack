import {
  DashboardContent,
  TraceData,
} from '@/components/dashboard/DashboardContent';
import { authOptions } from '@/lib/auth';
import { langfuseLabel } from '@/lib/langfuse-labels';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { isSkillTrace } from '@/lib/trace-utils';
import pMap from 'p-map';
import { fetchAllPages } from '@/lib/langfuse-api';

interface LangfuseTrace {
  id: string;
  name?: string;
  timestamp: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
  status?: string;
  totalCost?: number;
  usage?: {
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
  };
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  tags?: string[];
  observations?: LangfuseObservation[];
}

interface LangfuseObservation {
  id: string;
  traceId: string;
  type: string;
  name?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

async function getUserMetrics(userId: string): Promise<TraceData[]> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey || publicKey === 'placeholder') {
    console.warn('Langfuse API keys are not configured or still placeholders');
    return [];
  }

  const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

  try {
    const queryParams = new URLSearchParams({ userId });
    console.log(`Fetching all traces for user: ${userId}`);

    const allTraces = await fetchAllPages<LangfuseTrace>(
      baseUrl,
      '/api/public/traces',
      queryParams,
      authHeader
    );

    // Filter out skeletal SKILL traces before processing
    const traces = allTraces.filter(t => !isSkillTrace(t.name, t.metadata?.skillName as string | undefined));

    console.log(`Successfully fetched ${traces.length} filtered traces for ${userId} (skipped ${allTraces.length - traces.length} SKILL traces)`);

    // Fetch observations for each trace to get the model and agent
    const tracesWithObservations = await pMap(
      traces,
      async (t) => {
        try {
          const obsUrl = `${baseUrl}/api/public/observations?traceId=${t.id}`;
          const obsResponse = await fetch(obsUrl, {
            headers: { Authorization: authHeader },
            next: { revalidate: 60 },
          });
          if (obsResponse.ok) {
            const obsData = await obsResponse.json();
            return { ...t, observations: (obsData.data as LangfuseObservation[]) || [] };
          }
        } catch (e) {
          console.error(`Error fetching observations for trace ${t.id}:`, e);
        }
        return { ...t, observations: [] };
      },
      { concurrency: 10 }
    );

    return tracesWithObservations.map((t) => {
      // Safely extract metadata
      const metadata = t.metadata || {};

      // Try to find model and agent in observations if not in metadata
      let model = metadata.model as string | undefined;
      let agent = metadata.agent as string | undefined;

      if (t.observations && t.observations.length > 0) {
        // Find the first observation that has a model (Langfuse observation types can be 'generation' or 'GENERATION')
        const generation = t.observations.find((o: LangfuseObservation) =>
          (o.type?.toLowerCase() === 'generation' || o.type === 'generation') && o.model
        );
        if (generation && !model) {
          model = generation.model;
        }
        // Check for agent in observation metadata if still not found
        if (!agent) {
          for (const obs of (t.observations as LangfuseObservation[])) {
             if (obs.metadata?.agent) {
               agent = obs.metadata.agent as string;
               break;
             }
          }
        }
      }

      return {
        id: t.id,
        name: t.name || 'unnamed-trace',
        timestamp: t.timestamp,
        sessionId: t.sessionId,
        // Ensure projectName is extracted correctly from metadata
        projectName: (metadata.projectName as string) || (metadata.projectId as string) || (t.tags?.[0] as string) || 'unknown',
        model: langfuseLabel(model),
        agent: langfuseLabel(agent),
        duration: t.duration,
        status: t.status,
        metadata: metadata,
        // Langfuse sometimes puts usage at the top level or inside usage object
        totalCost: t.totalCost || 0,
        totalTokens: t.totalTokens || t.usage?.totalTokens || 0,
        inputTokens:
          t.inputTokens || t.usage?.inputTokens || t.usage?.promptTokens || 0,
        outputTokens:
          t.outputTokens ||
          t.usage?.outputTokens ||
          t.usage?.completionTokens ||
          0,
      };
    });
  } catch (error) {
    console.error('Error fetching metrics from Langfuse:', error);
    return [];
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/signin');
  }

  const userEmail = session.user.email;
  if (!userEmail) {
    redirect('/signin');
  }

  const traces = await getUserMetrics(userEmail);

  return <DashboardContent traces={traces} titlePrefix="My Authenticated" />;
}
