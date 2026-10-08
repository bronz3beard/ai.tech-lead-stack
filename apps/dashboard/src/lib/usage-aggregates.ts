import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import type { Prisma } from '@prisma/client';
import {
  buildAnalyticsWhere,
  TIMEFRAME_PRESETS,
  type AnalyticsAccessScope,
} from './analytics-service';
import type { DateRange } from './date-range';
import { bucketSum, utcDay, utcWeekStart, type CountPoint } from './time-buckets';

export type { CountPoint };

/** Window used for time series when the caller picks no dates. */
export const DEFAULT_SERIES_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AggregateFilter {
  scope: AnalyticsAccessScope;
  /** "My Activity": only this user's events. */
  user?: { userId?: string; userEmail?: string };
  projectName?: string;
  /** A TIMEFRAME_PRESETS value; ignored when dateRange is set. */
  timeframe?: string;
  dateRange?: DateRange;
}


export interface AdoptionSummary {
  skillsLoaded: number;
  llmCalls: number;
  /** Distinct session ids; legacy MCP rows recorded none, so older activity is undercounted. */
  sessions: number;
  projects: number;
  people: number;
  actorSplit: { human: number; agent: number; unknown: number };
  topSkills: CountPoint[];
  dailySkillLoads: CountPoint[];
}

export interface SpendSummary {
  llmCalls: number;
  failedCalls: number;
  totalCostUsd: number;
  /** Spend priced from estimated usage or fallback rates. */
  estimatedCostUsd: number;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  /** Calls that reported cache usage; the denominator behind cacheHitRate. */
  cacheReportingCalls: number;
  /** Cache reads ÷ input tokens over calls that reported cache usage; null when none did. */
  cacheHitRate: number | null;
  sessions: number;
  byProvider: { provider: string; costUsd: number; calls: number }[];
  byProject: { projectName: string; costUsd: number; calls: number }[];
  byPerson: { person: string; costUsd: number; calls: number }[];
  weekly: CountPoint[];
}

/** Every dashboard aggregate excludes rows tagged as test data. */
function aggregateWhere(
  filter: AggregateFilter,
  extra: Prisma.AnalyticsEventWhereInput
): Prisma.AnalyticsEventWhereInput {
  return {
    AND: [
      buildAnalyticsWhere(filter),
      { environment: { not: 'test' } },
      extra,
    ],
  };
}

/** Bounds a time series to the picked range, or to the last DEFAULT_SERIES_DAYS. */
function seriesWhere(filter: AggregateFilter, now = new Date()): AggregateFilter {
  if (filter.dateRange?.from || filter.dateRange?.to) return filter;
  if (filter.timeframe && TIMEFRAME_PRESETS.includes(filter.timeframe)) return filter;
  return { ...filter, dateRange: { from: new Date(now.getTime() - DEFAULT_SERIES_DAYS * DAY_MS) } };
}

async function countDistinct(
  where: Prisma.AnalyticsEventWhereInput,
  field: 'sessionId' | 'projectName' | 'userId'
): Promise<number> {
  const groups = await prisma.analyticsEvent.groupBy({
    by: [field],
    where: { AND: [where, { [field]: { not: null } }] },
  });
  return groups.length;
}

export async function getAdoptionSummary(filter: AggregateFilter): Promise<AdoptionSummary> {
  const activity = aggregateWhere(filter, { kind: { in: ['skill_invocation', 'llm_generation'] } });
  const skillLoads = aggregateWhere(filter, { kind: 'skill_invocation' });

  const [byKind, byActor, topSkills, sessions, projects, people, loadTimes] = await Promise.all([
    prisma.analyticsEvent.groupBy({ by: ['kind'], where: activity, _count: { _all: true } }),
    prisma.analyticsEvent.groupBy({ by: ['actorType'], where: activity, _count: { _all: true } }),
    prisma.analyticsEvent.groupBy({
      by: ['skillName'],
      where: skillLoads,
      _count: { skillName: true },
      orderBy: { _count: { skillName: 'desc' } },
      take: 10,
    }),
    countDistinct(activity, 'sessionId'),
    countDistinct(activity, 'projectName'),
    countDistinct(activity, 'userId'),
    prisma.analyticsEvent.findMany({
      where: aggregateWhere(seriesWhere(filter), { kind: 'skill_invocation' }),
      select: { createdAt: true },
    }),
  ]);

  const kindCount = (k: string) => byKind.find((g) => g.kind === k)?._count._all ?? 0;
  const actorCount = (a: string | null) =>
    byActor.find((g) => g.actorType === a)?._count._all ?? 0;

  return {
    skillsLoaded: kindCount('skill_invocation'),
    llmCalls: kindCount('llm_generation'),
    sessions,
    projects,
    people,
    actorSplit: {
      human: actorCount('HUMAN'),
      agent: actorCount('AGENT'),
      unknown: actorCount(null),
    },
    topSkills: topSkills.map((g) => ({ name: g.skillName ?? 'unknown', total: g._count.skillName })),
    dailySkillLoads: bucketSum(
      loadTimes.map((r) => ({ at: r.createdAt, value: 1 })),
      utcDay
    ),
  };
}

export async function getSpendSummary(filter: AggregateFilter): Promise<SpendSummary> {
  const llm = aggregateWhere(filter, { kind: 'llm_generation' });

  const [totals, failed, estimated, cache, sessions, byProvider, byProject, byUser, weekRows] =
    await Promise.all([
      prisma.analyticsEvent.aggregate({
        where: llm,
        _count: { _all: true },
        _sum: { totalCost: true, promptTokens: true, completionTokens: true, cacheReadTokens: true },
      }),
      prisma.analyticsEvent.count({ where: { AND: [llm, { status: 'ERROR' }] } }),
      prisma.analyticsEvent.aggregate({
        where: { AND: [llm, { costIsEstimate: true }] },
        _sum: { totalCost: true },
      }),
      prisma.analyticsEvent.aggregate({
        where: { AND: [llm, { cacheReadTokens: { not: null } }] },
        _count: { _all: true },
        _sum: { cacheReadTokens: true, promptTokens: true },
      }),
      countDistinct(llm, 'sessionId'),
      prisma.analyticsEvent.groupBy({
        by: ['provider'],
        where: llm,
        _count: { _all: true },
        _sum: { totalCost: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ['projectName'],
        where: llm,
        _count: { _all: true },
        _sum: { totalCost: true },
      }),
      prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: llm,
        _count: { _all: true },
        _sum: { totalCost: true },
      }),
      prisma.analyticsEvent.findMany({
        where: aggregateWhere(seriesWhere(filter), { kind: 'llm_generation' }),
        select: { createdAt: true, totalCost: true },
      }),
    ]);

  const userIds = byUser.map((g) => g.userId).filter((id): id is string => Boolean(id));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const personLabel = (id: string | null) => {
    if (!id) return 'Unattributed';
    const u = users.find((x) => x.id === id);
    return u?.name || u?.email || 'Unknown user';
  };

  const cacheInput = cache._sum.promptTokens ?? 0;
  const byCost = <T extends { costUsd: number }>(rows: T[]) =>
    rows.sort((a, b) => b.costUsd - a.costUsd);

  return {
    llmCalls: totals._count._all,
    failedCalls: failed,
    totalCostUsd: totals._sum.totalCost ?? 0,
    estimatedCostUsd: estimated._sum.totalCost ?? 0,
    promptTokens: totals._sum.promptTokens ?? 0,
    completionTokens: totals._sum.completionTokens ?? 0,
    cacheReadTokens: totals._sum.cacheReadTokens ?? 0,
    cacheReportingCalls: cache._count._all,
    cacheHitRate: cacheInput > 0 ? (cache._sum.cacheReadTokens ?? 0) / cacheInput : null,
    sessions,
    byProvider: byCost(
      byProvider.map((g) => ({
        provider: g.provider ?? 'unknown',
        costUsd: g._sum.totalCost ?? 0,
        calls: g._count._all,
      }))
    ),
    byProject: byCost(
      byProject.map((g) => ({
        projectName: g.projectName ?? 'unknown',
        costUsd: g._sum.totalCost ?? 0,
        calls: g._count._all,
      }))
    ),
    byPerson: byCost(
      byUser.map((g) => ({
        person: personLabel(g.userId),
        costUsd: g._sum.totalCost ?? 0,
        calls: g._count._all,
      }))
    ),
    weekly: bucketSum(
      weekRows.map((r) => ({ at: r.createdAt, value: r.totalCost ?? 0 })),
      utcWeekStart
    ),
  };
}
