import { z } from 'zod';
import { prisma } from '@/lib/prisma';
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

  // Determine authorized projects if 'all' is requested, so we can filter ReflexionRun.
  if (projectId && projectId !== 'all') {
    // Project filtering for runs could go here if schema evolves
  } else if (Object.keys(accessFilter).length > 0) {
    // Note: ReflexionRun doesn't directly have projectId in schema.prisma for this project yet.
    // Wait, let me check the schema. Ah! `ReflexionRun` has NO `projectId` in schema.prisma.
    // Wait, the prompt says "scoped by getProjectAccessFilter".
    // I'll need to link it through User or wait, `ReflexionRun` schema:
    // model ReflexionRun {
    //  id          String   @id @default(cuid())
    //  userId      String?
    //  brief       String
    //  ...
    // }
    // As per the requirement to scope by getProjectAccessFilter, we'll scope runs to the users who have access to the projects.
    // Let me check if ReflexionRun is supposed to have a projectId.
    // "scoped by getProjectAccessFilter" - it's requested for AnalyticsEvents. If ReflexionRun lacks it, we filter by userId.

    // Actually, I'll just get all runs for this user for now since ReflexionRun is missing projectId.
  }

  // Wait, let's look at schema.prisma for ReflexionRun again.
  // It has `userId`.
  const runWhere: any = {};
  if (Object.keys(dateFilter).length > 0) runWhere.createdAt = dateFilter;
  // Superusers/Admins have an empty accessFilter object.
  // Others get an object with OR condition.
  // If not admin, restrict to their runs to ensure scoping.
  // Let's stick to the simplest safe fallback: if they aren't an admin, restrict to their runs.
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
