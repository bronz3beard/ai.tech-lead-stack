import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, LineChart } from '@/components/ui/chart';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

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

    const totalExecutions = traces.length;
    let activeWorkflows = 0;
    const skillCounts: Record<string, number> = {};
    const timeBuckets: Record<string, number> = {};

    // Sort traces by timestamp ascending
    const sortedTraces = [...traces].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const trace of sortedTraces) {
      // 1. Group by skill name
      let skillName = 'unknown';
      if (trace.name && trace.name.startsWith('skill:')) {
        skillName = trace.name.replace('skill:', '');
      } else if (
        trace.name === 'skill_execution' &&
        trace.metadata?.skillName
      ) {
        skillName = trace.metadata.skillName;
      } else if (trace.name) {
        skillName = trace.name;
      }

      skillCounts[skillName] = (skillCounts[skillName] || 0) + 1;

      // 2. Track workflows
      if (trace.sessionId) {
        activeWorkflows++;
      }

      // 3. Time series: aggregate by day
      const date = new Date(trace.timestamp);
      const dateKey = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      timeBuckets[dateKey] = (timeBuckets[dateKey] || 0) + 1;
    }

    const topSkills = Object.entries(skillCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const tracesByTime = Object.entries(timeBuckets).map(([name, total]) => ({
      name,
      total,
    }));

    return {
      totalExecutions,
      activeWorkflows: activeWorkflows > 0 ? activeWorkflows : totalExecutions,
      topSkills,
      tracesByTime,
    };
  } catch (error) {
    console.error('Error fetching metrics from Langfuse:', error);
    return {
      totalExecutions: 0,
      activeWorkflows: 0,
      topSkills: [],
      tracesByTime: [],
    };
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
  const metrics = await getUserMetrics(userEmail);

  return (
    <div className="flex flex-col min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            My Dashboard
          </h1>
          <p className="text-muted mt-2">Authenticated User Analytics</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                My Skills Run
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {metrics.totalExecutions.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">
                My Active Workflows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {metrics.activeWorkflows.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-foreground">My Top Skills</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <BarChart data={metrics.topSkills} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-foreground">
                My Traces by time
              </CardTitle>
              <p className="text-sm text-muted">
                Visualizes your agent activity volume over time, grouped by day.
              </p>
            </CardHeader>
            <CardContent className="pl-2">
              <LineChart data={metrics.tracesByTime} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
