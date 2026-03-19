import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/ui/chart";

async function getUserMetrics(userId: string) {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";

  if (!publicKey || !secretKey) {
    throw new Error("Missing Langfuse API keys in environment variables");
  }

  const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;

  try {
    const tracesResponse = await fetch(`${baseUrl}/api/public/traces?userId=${userId}`, {
      headers: {
        Authorization: authHeader,
      },
      next: { revalidate: 60 },
    });

    if (!tracesResponse.ok) {
      throw new Error(`Failed to fetch from Langfuse: ${tracesResponse.statusText}`);
    }

    const tracesData = await tracesResponse.json();
    const traces = tracesData.data || [];

    const totalExecutions = traces.length;
    let activeWorkflows = 0;
    const skillCounts: Record<string, number> = {};

    for (const trace of traces) {
      if (trace.name) {
        skillCounts[trace.name] = (skillCounts[trace.name] || 0) + 1;
      }
      // Simple heuristic for active workflows (e.g. executed recently or has some session id)
      if (trace.sessionId) {
        activeWorkflows++;
      }
    }

    const topSkills = Object.entries(skillCounts)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      totalExecutions,
      activeWorkflows: activeWorkflows > 0 ? activeWorkflows : totalExecutions,
      topSkills,
    };
  } catch (error) {
    console.error("Error fetching metrics from Langfuse:", error);
    // Return fallback empty metrics on error
    return {
      totalExecutions: 0,
      activeWorkflows: 0,
      topSkills: [],
    };
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/api/auth/signin");
  }

  const userId = (session.user as { id: string }).id;
  const metrics = await getUserMetrics(userId);

  return (
    <div className="flex flex-col min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">My Dashboard</h1>
          <p className="text-gray-500 mt-2">Authenticated User Analytics</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Skills Run</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalExecutions.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Active Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeWorkflows.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>My Top Skills</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <BarChart data={metrics.topSkills} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
