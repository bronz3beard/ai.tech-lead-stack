import { z } from 'zod';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { buildAnalyticsWhere, type AnalyticsAccessScope } from '@/lib/analytics-service';
import { utcWeekStart } from '@/lib/time-buckets';
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
  user: { id: string; role: Role; email?: string | null },
  scope: AnalyticsAccessScope
): Promise<AgenticHealthSummary> {
  // `projectId` carries the project *name* from the dashboard URL (?project=).
  const { projectId, from, to } = AgenticHealthParamsSchema.parse(params);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const eventWhere = {
    AND: [
      buildAnalyticsWhere({
        scope,
        projectName: projectId ?? undefined,
        dateRange: { from: dateFilter.gte, to: dateFilter.lte },
      }),
      { environment: { not: 'test' } },
    ],
  };

  // We explicitly fetch ALL events to compute the ratio of AGENT vs HUMAN correctly.
  const events = await prisma.analyticsEvent.findMany({
    where: eventWhere,
    orderBy: { createdAt: 'asc' },
  });

  // ReflexionRun has no projectId column; runs are scoped by userId (non-admins see only their own runs).
  const runWhere: { createdAt?: typeof dateFilter; userId?: string } = {};
  if (Object.keys(dateFilter).length > 0) runWhere.createdAt = dateFilter;
  if (user.role !== Role.ADMIN) {
      runWhere.userId = user.id;
  }

  const runs = await prisma.reflexionRun.findMany({
    where: runWhere,
    orderBy: { createdAt: 'desc' },
  });

  // Autonomy ratios count units of work (skill loads, LLM calls). Tool calls and
  // loop markers would let one reflexion run outweigh dozens of human turns.
  const workEvents = events.filter(
    (e) => e.kind === 'skill_invocation' || e.kind === 'llm_generation'
  );
  const awr = autonomousWorkRatio(workEvents);
  const ad = autonomyDepth(workEvents);
  const err = evaluatorRejectionRate(events);
  const critiqueCount = events.filter((e) => e.loopPhase === 'scored').length;
  const health = classifyEvaluatorHealth(err, critiqueCount);
  const conv = convergence(runs);
  const htr = humanTouchpointsPerRun(events);
  const fr = frictionRate(events);
  const cpp = costPerPassedPlan(runs);

  // Calculate Weekly AWR
  const weeklyBuckets: Record<string, { total: number; agent: number }> = {};

  for (const event of workEvents) {
    const key = utcWeekStart(event.createdAt);

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
