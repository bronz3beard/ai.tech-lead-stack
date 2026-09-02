import { z } from 'zod';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { getProjectAccessFilter } from '@/lib/access';
import {
  autonomousWorkRatio,
  autonomyDepth,
  evaluatorRejectionRate,
  classifyEvaluatorHealth,
  convergence,
  humanTouchpointsPerRun,
  frictionRate,
  costPerPassedPlan,
  EvaluatorHealthClassification,
  ConvergenceMetrics,
} from '@/lib/agentic-metrics';
import { ReflexionRun, Role } from '@prisma/client';

export const AgenticHealthParamsSchema = z.object({
  projectId: z.string().optional().nullable(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
});

export type AgenticHealthParams = z.infer<typeof AgenticHealthParamsSchema>;

export interface AgenticHealthSummary {
  autonomousWorkRatio: number;
  autonomyDepth: number;
  evaluatorRejectionRate: number;
  evaluatorHealth: EvaluatorHealthClassification;
  convergence: ConvergenceMetrics;
  humanTouchpointsPerRun: number;
  frictionRate: number;
  costPerPassedPlan: number;
  eventsCount: number;
  runsCount: number;
  weeklyAWR: { date: string; awr: number }[];
  runs: ReflexionRun[];
}

export async function loadAgenticHealth(
  params: unknown,
  user: { id: string; role: Role; email?: string | null }
): Promise<AgenticHealthSummary> {
  const { projectId, from, to } = AgenticHealthParamsSchema.parse(params);

  const accessFilter = getProjectAccessFilter(user);

  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  // Fetch AnalyticsEvents matching the filters
  const eventWhere: any = { ...accessFilter };
  if (projectId && projectId !== 'all') eventWhere.projectId = projectId;
  if (Object.keys(dateFilter).length > 0) eventWhere.createdAt = dateFilter;

  // We explicitly fetch ALL events to compute the ratio of AGENT vs HUMAN correctly.
  const events = await prisma.analyticsEvent.findMany({
    where: eventWhere,
    orderBy: { createdAt: 'asc' },
  });

  // ReflexionRun has no projectId column; runs are scoped by userId (non-admins see only their own runs).
  const runWhere: any = {};
  if (Object.keys(dateFilter).length > 0) runWhere.createdAt = dateFilter;
  if (user.role !== Role.ADMIN) {
      runWhere.userId = user.id;
  }

  const runs = await prisma.reflexionRun.findMany({
    where: runWhere,
    orderBy: { createdAt: 'desc' },
  });

  const awr = autonomousWorkRatio(events);
  const ad = autonomyDepth(events);
  const err = evaluatorRejectionRate(events);
  const critiqueCount = events.filter((e) => e.loopPhase === 'critique').length;
  const health = classifyEvaluatorHealth(err, critiqueCount);
  const conv = convergence(runs);
  const htr = humanTouchpointsPerRun(events);
  const fr = frictionRate(events);
  const cpp = costPerPassedPlan(runs);

  // Calculate Weekly AWR
  const weeklyBuckets: Record<string, { total: number; agent: number }> = {};

  for (const event of events) {
    // bucket by ISO week or simple start-of-week string
    const d = new Date(event.createdAt);
    // simple string bucket: YYYY-MM-DD of Monday
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const key = monday.toISOString().split('T')[0];

    if (!weeklyBuckets[key]) {
      weeklyBuckets[key] = { total: 0, agent: 0 };
    }
    weeklyBuckets[key].total++;
    if (event.actorType === 'AGENT') {
      weeklyBuckets[key].agent++;
    }
  }

  const weeklyAWR = Object.entries(weeklyBuckets)
    .map(([date, counts]) => ({
      date,
      awr: counts.agent / counts.total,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    autonomousWorkRatio: awr,
    autonomyDepth: ad,
    evaluatorRejectionRate: err,
    evaluatorHealth: health,
    convergence: conv,
    humanTouchpointsPerRun: htr,
    frictionRate: fr,
    costPerPassedPlan: cpp,
    eventsCount: events.length,
    runsCount: runs.length,
    weeklyAWR,
    runs,
  };
}
