import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/ui/chart";

export const revalidate = 60; // cached for 60 seconds

async function getGlobalMetrics() {
  "use cache";

  // Here you would fetch from Langfuse API or local DB
  // For the sake of this dashboard setup, we simulate an API call
  // In a real scenario, we'd use langfuse.getTraces() or similar.

  return {
    totalExecutions: 15423,
    activeWorkflows: 89,
    topSkills: [
      { name: "planning-expert", total: 4500 },
      { name: "quality-gatekeeper", total: 3200 },
      { name: "code-review", total: 2800 },
      { name: "changelog", total: 1500 },
      { name: "visual-verify", total: 900 },
    ],
  };
}

export default async function PublicDashboard() {
  const metrics = await getGlobalMetrics();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Agent Analytics</h1>
          <p className="text-gray-500 mt-2">Global Public Dashboard</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Skills Run</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalExecutions.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeWorkflows.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Top Skills</CardTitle>
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
