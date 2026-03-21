import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

async function getUserMetrics(userId: string) {
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

    const tracesResponse = await fetch(
      url,
      {
        headers: {
          Authorization: authHeader,
        },
        next: { revalidate: 60 },
      }
    );

    if (!tracesResponse.ok) {
      const errorText = await tracesResponse.text();
      throw new Error(
        `Failed to fetch from Langfuse: ${tracesResponse.status} ${tracesResponse.statusText} - ${errorText}`
      );
    }

    const tracesData = await tracesResponse.json();
    const traces = tracesData.data || [];

    console.log(`Successfully fetched ${traces.length} traces for ${userId}`);

    return traces.map((t: any) => {
      // Safely extract metadata
      const metadata = t.metadata || {};

      return {
        id: t.id,
        name: t.name || 'unnamed-trace',
        timestamp: t.timestamp,
        sessionId: t.sessionId,
        // Ensure projectName is extracted correctly from metadata
        projectName: metadata.projectName || 'unknown',
        model: t.model || metadata.model,
        duration: t.duration,
        status: t.status,
        metadata: metadata,
        // Langfuse sometimes puts usage at the top level or inside usage object
        totalCost: t.totalCost || 0,
        totalTokens: t.totalTokens || (t.usage?.totalTokens) || 0,
        inputTokens: t.inputTokens || (t.usage?.inputTokens) || 0,
        outputTokens: t.outputTokens || (t.usage?.outputTokens) || 0,
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
