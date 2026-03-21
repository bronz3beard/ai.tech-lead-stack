import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

async function getUserMetrics(userId: string) {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    throw new Error('Missing Langfuse API keys in environment variables');
  }

  const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

  try {
    // Increase limit to 100 (Langfuse maximum) for better time-series data
    const tracesResponse = await fetch(
      `${baseUrl}/api/public/traces?userId=${userId}&limit=100`,
      {
        headers: {
          Authorization: authHeader,
        },
        next: { revalidate: 60 },
      }
    );

    if (!tracesResponse.ok) {
      throw new Error(
        `Failed to fetch from Langfuse: ${tracesResponse.statusText}`
      );
    }

    const tracesData = await tracesResponse.json();
    const traces = tracesData.data || [];

    return traces.map((t: Record<string, unknown>) => ({
      id: t.id as string,
      name: t.name as string,
      timestamp: t.timestamp as string,
      sessionId: t.sessionId as string | undefined,
      projectName: (t.metadata as Record<string, unknown>)?.projectName as string || 'unknown',
      duration: t.duration as number | undefined,
      status: t.status as string | undefined,
      metadata: t.metadata as Record<string, unknown> | undefined,
      totalCost: t.totalCost as number | undefined,
    }));
  } catch (error) {
    console.error('Error fetching metrics from Langfuse:', error);
    return [];
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/api/auth/signin');
  }

  const userEmail = session.user.email;
  if (!userEmail) {
    redirect('/api/auth/signin');
  }
  const traces = await getUserMetrics(userEmail);

  return <DashboardContent traces={traces} titlePrefix="My Authenticated" />;
}
