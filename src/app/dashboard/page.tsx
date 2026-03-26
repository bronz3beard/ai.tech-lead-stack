import {
  DashboardContent,
  TraceData,
} from '@/components/dashboard/DashboardContent';
import { authOptions } from '@/lib/auth';
import { fetchAllPages } from '@/lib/langfuse-api';
import { langfuseLabel } from '@/lib/langfuse-labels';
import { isSkillTrace, normalizeProjectName } from '@/lib/trace-utils';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

interface LangfuseTrace {
  id: string;
  name?: string;
  timestamp: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
  status?: string;
  tags?: string[];
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

async function getUserMetrics(
  userId: string,
  options: { limit?: number; from?: string; to?: string } = {}
): Promise<TraceData[]> {
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
    if (options.from) queryParams.set('fromTimestamp', new Date(options.from).toISOString());
    if (options.to) queryParams.set('toTimestamp', new Date(options.to).toISOString());

    console.log(`Fetching traces for user: ${userId} with options:`, options);

    const allTraces = await fetchAllPages<LangfuseTrace>(
      baseUrl,
      '/api/public/traces',
      queryParams,
      authHeader,
      options.limit
    );

    // Filter out skeletal SKILL traces & map to Dashboard format
    return allTraces
      .filter((t) => !isSkillTrace(t.name, t.metadata?.skillName as string | undefined))
      .map((t) => {
        const metadata = t.metadata || {};
        const sources = [
          metadata.projectName,
          metadata.projectId,
          metadata.project,
          metadata.repo,
          ...(t.tags || []),
        ];

        let bestProjectName = 'unknown';
        for (const val of sources) {
          if (typeof val === 'string' && val !== 'unknown' && val.trim() !== '') {
            bestProjectName = normalizeProjectName(val);
            break;
          }
        }

        // Optimized: Extraction from metadata instead of observations
        const model = metadata.model as string | undefined;
        const agent = metadata.agent as string | undefined;

        return {
          id: t.id,
          name: t.name || 'unnamed-trace',
          timestamp: t.timestamp,
          sessionId: t.sessionId,
          projectName: bestProjectName,
          model: langfuseLabel(model),
          agent: langfuseLabel(agent),
          duration: t.duration,
          status: t.status,
          metadata: metadata,
          totalCost: t.totalCost || 0,
          totalTokens: t.totalTokens || t.usage?.totalTokens || 0,
          inputTokens: t.inputTokens || t.usage?.inputTokens || t.usage?.promptTokens || 0,
          outputTokens: t.outputTokens || t.usage?.outputTokens || t.usage?.completionTokens || 0,
        };
      });
  } catch (error) {
    console.error('Error fetching metrics from Langfuse:', error);
    return [];
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; from?: string; to?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/signin');
  }

  const userEmail = session.user.email;
  if (!userEmail) {
    redirect('/signin');
  }

  const { limit, from, to } = await searchParams;
  const parsedLimit = limit === 'all' ? undefined : parseInt(limit || '50', 10);

  const traces = await getUserMetrics(userEmail, {
    limit: parsedLimit,
    from,
    to,
  });

  return <DashboardContent traces={traces} titlePrefix="My Authenticated" />;
}
