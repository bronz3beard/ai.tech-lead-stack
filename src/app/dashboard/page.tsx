import {
  DashboardContent,
  TraceData,
} from '@/components/dashboard/DashboardContent';
import { authOptions } from '@/lib/auth';
import { langfuseLabel } from '@/lib/langfuse-labels';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { isSkillTrace } from '@/lib/trace-utils';

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
    const url = `${baseUrl}/api/public/traces?userId=${encodeURIComponent(userId)}&limit=100`;
    console.log(`Fetching traces for user: ${userId} from ${url}`);

    const tracesResponse = await fetch(url, {
      headers: {
        Authorization: authHeader,
      },
      next: { revalidate: 60 },
    });

    if (!tracesResponse.ok) {
      const errorText = await tracesResponse.text();
      throw new Error(
        `Failed to fetch from Langfuse: ${tracesResponse.status} ${tracesResponse.statusText} - ${errorText}`
      );
    }

    const tracesResponseData = await tracesResponse.json();
    const allTraces: LangfuseTrace[] = tracesResponseData.data || [];

    // Filter out skeletal SKILL traces before processing
    const traces = allTraces.filter(t => !isSkillTrace(t.name, t.metadata?.skillName as string | undefined));

    console.log(`Successfully fetched ${traces.length} filtered traces for ${userId} (skipped ${allTraces.length - traces.length} SKILL traces)`);

    return traces.map((t) => {
      // Safely extract metadata
      const metadata = t.metadata || {};

      return {
        id: t.id,
        name: t.name || 'unnamed-trace',
        timestamp: t.timestamp,
        sessionId: t.sessionId,
        // Ensure projectName is extracted correctly from metadata
        projectName: (metadata.projectName as string) || 'unknown',
        model: langfuseLabel(metadata.model),
        agent: langfuseLabel(metadata.agent),
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
