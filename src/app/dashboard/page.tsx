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

interface LangfuseUsage {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  input?: number;
  output?: number;
  total?: number;
}

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
  usage?: LangfuseUsage;
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
  usage?: LangfuseUsage;
  calculatedTotalCost?: number;
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
    if (options.from)
      queryParams.set('fromTimestamp', new Date(options.from).toISOString());
    if (options.to)
      queryParams.set('toTimestamp', new Date(options.to).toISOString());

    console.log(`Fetching traces for user: ${userId} with options:`, options);

    const allTraces = await fetchAllPages<LangfuseTrace>(
      baseUrl,
      '/api/public/traces',
      queryParams,
      authHeader,
      5000 // Increased limit to 5000 for full coverage
    );

    let allObservations: LangfuseObservation[] = [];
    if (allTraces.length > 0) {
      // Get min and max dates from trace timestamps to satisfy/optimize bulk observation query
      const timestamps = allTraces.map((t) => new Date(t.timestamp).getTime());
      const minDate = new Date(Math.min(...timestamps)).toISOString();
      const maxDate = new Date(Math.max(...timestamps) + 1000).toISOString();

      const obsParams = new URLSearchParams({
        type: 'GENERATION',
        fromTimestamp: minDate,
        toTimestamp: maxDate,
      });

      allObservations = await fetchAllPages<LangfuseObservation>(
        baseUrl,
        '/api/public/observations',
        obsParams,
        authHeader,
        15000 // Large batch for observations
      );
    }

    // Index observations for faster lookup
    const obsMap = new Map<string, LangfuseObservation[]>();
    allObservations.forEach((o) => {
      if (!obsMap.has(o.traceId)) obsMap.set(o.traceId, []);
      obsMap.get(o.traceId)!.push(o);
    });

    return allTraces
      .filter(
        (t) =>
          !isSkillTrace(t.name, t.metadata?.skillName as string | undefined)
      )
      .map((t) => {
        const metadata = t.metadata || {};
        const observations = obsMap.get(t.id) || [];

        // GREEDY PROJECT IDENTIFICATION
        // We scan EVERYTHING. If "gilly" appears anywhere, it's Gilly.
        const allTextContext = JSON.stringify({
          metadata,
          tags: t.tags || [],
          name: t.name || '',
          oMetadata: observations.map((o) => o.metadata || {}),
        }).toLowerCase();

        let bestProjectName = 'unknown';

        if (allTextContext.includes('gilly')) {
          bestProjectName = 'gilly';
        } else if (allTextContext.includes('tech-lead-stack')) {
          bestProjectName = 'tech-lead-stack';
        } else {
          const sources = [
            metadata.projectName,
            metadata.projectId,
            metadata.project,
            metadata.project_id,
            metadata.repo,
            metadata.repo_name,
            metadata.repository,
            metadata.repository_name,
            metadata.app,
            metadata.app_id,
            ...(t.tags || []),
            ...observations.map((o) => o.metadata?.projectName),
            ...observations.map((o) => o.metadata?.projectId),
            ...observations.map((o) => o.metadata?.project),
            ...observations.map((o) => o.metadata?.repo),
            ...observations.map((o) => o.metadata?.repository),
          ];

          for (const val of sources) {
            if (
              typeof val === 'string' &&
              val !== 'unknown' &&
              val.trim() !== ''
            ) {
              const normalized = normalizeProjectName(val);
              if (normalized !== 'unknown') {
                bestProjectName = normalized;
                break;
              }
            }
          }
        }

        // Calculate aggregated metrics from observations
        // Hardened summing: we treat trace-level metrics as the baseline but always
        // add observation metrics to ensure no sub-step consumption is missed.
        let totalCost = t.totalCost || 0;
        let totalTokens =
          t.totalTokens || t.usage?.totalTokens || t.usage?.total || 0;
        let inputTokens =
          t.inputTokens ||
          t.usage?.inputTokens ||
          t.usage?.promptTokens ||
          t.usage?.input ||
          0;
        let outputTokens =
          t.outputTokens ||
          t.usage?.outputTokens ||
          t.usage?.completionTokens ||
          t.usage?.output ||
          0;

        observations.forEach((obs) => {
          if (obs.usage) {
            totalTokens += obs.usage.total || obs.usage.totalTokens || 0;
            inputTokens +=
              obs.usage.input ||
              obs.usage.promptTokens ||
              obs.usage.inputTokens ||
              0;
            outputTokens +=
              obs.usage.output ||
              obs.usage.completionTokens ||
              obs.usage.outputTokens ||
              0;
          }
          if (obs.calculatedTotalCost) {
            totalCost += obs.calculatedTotalCost;
          }
        });

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
          totalCost,
          totalTokens,
          inputTokens,
          outputTokens,
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
  const parsedLimit =
    limit === 'all' || !limit ? undefined : parseInt(limit, 10);

  const traces = await getUserMetrics(userEmail, {
    limit: parsedLimit,
    from,
    to,
  });

  return <DashboardContent traces={traces} titlePrefix="My Authenticated" />;
}
