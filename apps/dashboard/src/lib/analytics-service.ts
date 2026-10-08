import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import type { Prisma } from '@prisma/client';
import { getProjectAccessFilter } from './access';
import type { DateRange } from './date-range';
import { normalizeProjectName } from '@zenithfoundry/tech-lead-stack/trace-utils';

export interface TraceData {
  id: string;
  name: string;
  timestamp: string;
  sessionId?: string;
  projectName: string;
  model: string;
  agent: string;
  duration?: number;
  status?: string;
  metadata?: Record<string, unknown>;
  totalCost?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  actorType?: string | null;
  autonomy?: string | null;
  loopRunId?: string | null;
  loopPhase?: string | null;
  teamRole?: string | null;
  /** 'skill_invocation' | 'llm_generation' | 'tool_call' | 'loop_step'; null on rows not yet backfilled. */
  kind?: string | null;
  provider?: string | null;
  costIsEstimate?: boolean;
  cacheReadTokens?: number;
}

/**
 * Which events a caller may read. `null` means unrestricted (admin/superuser).
 * Otherwise the caller sees their own events plus events of projects they can access.
 */
export type AnalyticsAccessScope = {
  userId: string;
  projectNames: string[];
} | null;

/** Rows getAnalytics returns when no limit is given. The dashboard labels its window with this. */
export const DEFAULT_ANALYTICS_LIMIT = 1000;

/** Timeframe values getAnalytics applies; anything else is ignored. */
export const TIMEFRAME_PRESETS = ['1yr', '6mo', '3mo', '1mo', 'week', 'day', 'today'];

/** Resolves what a signed-in user may read: unrestricted for admins, else own + accessible projects. */
export async function resolveAnalyticsScope(user: {
  id: string;
  role: string;
  email?: string | null;
}): Promise<AnalyticsAccessScope> {
  const accessFilter = getProjectAccessFilter(user);
  if (Object.keys(accessFilter).length === 0) return null;

  const projects = await prisma.project.findMany({
    where: accessFilter,
    select: { name: true },
  });
  return {
    userId: user.id,
    projectNames: projects.map((p) => normalizeProjectName(p.name)),
  };
}

/** Lower-bound date for a timeframe preset, or undefined for unknown/'all'. */
function timeframeStart(timeframe: string | undefined, now = new Date()): Date | undefined {
  if (!timeframe || !TIMEFRAME_PRESETS.includes(timeframe)) return undefined;
  const fromDate = new Date(now);
  switch (timeframe) {
    case '1yr':
      fromDate.setFullYear(now.getFullYear() - 1);
      break;
    case '6mo':
      fromDate.setMonth(now.getMonth() - 6);
      break;
    case '3mo':
      fromDate.setMonth(now.getMonth() - 3);
      break;
    case '1mo':
      fromDate.setMonth(now.getMonth() - 1);
      break;
    case 'week':
      fromDate.setDate(now.getDate() - 7);
      break;
    case 'day':
      // Last 24 hours
      fromDate.setDate(now.getDate() - 1);
      break;
    case 'today':
      // Since midnight local time
      fromDate.setHours(0, 0, 0, 0);
      break;
  }
  return fromDate;
}

/**
 * Builds the AnalyticsEvent where-clause. Pure, so the access rules are unit-tested.
 * Every condition is AND-ed: access scope, "my activity", project, and time window.
 */
export function buildAnalyticsWhere(input: {
  scope: AnalyticsAccessScope;
  /** Restrict to one user's events ("My Activity"). */
  user?: { userId?: string; userEmail?: string };
  projectName?: string;
  timeframe?: string;
  dateRange?: DateRange;
  now?: Date;
}): Prisma.AnalyticsEventWhereInput {
  const and: Prisma.AnalyticsEventWhereInput[] = [];

  if (input.scope) {
    and.push({
      OR: [
        { userId: input.scope.userId },
        ...(input.scope.projectNames.length > 0
          ? [{ projectName: { in: input.scope.projectNames } }]
          : []),
      ],
    });
  }

  const { userId, userEmail } = input.user ?? {};
  if (userId || userEmail) {
    and.push({
      OR: [
        ...(userId ? [{ userId }] : []),
        ...(userEmail
          ? [{ metadata: { path: ['userEmail'], equals: userEmail } }]
          : []),
      ],
    });
  }

  if (input.projectName && input.projectName !== 'all') {
    and.push({ projectName: normalizeProjectName(input.projectName) });
  }

  const { from, to } = input.dateRange ?? {};
  if (from || to) {
    and.push({ createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } });
  } else {
    const start = timeframeStart(input.timeframe, input.now);
    if (start) and.push({ createdAt: { gte: start } });
  }

  return and.length > 0 ? { AND: and } : {};
}

type AnalyticsEventRow = Prisma.AnalyticsEventGetPayload<object>;

/** Maps a stored row to the shape the dashboard renders. */
export function toTraceData(event: AnalyticsEventRow): TraceData {
  const metadata = (event.metadata as Record<string, unknown> | null) ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

  // Attribution Fallback Hierarchy: root projectName -> metadata.projectName -> metadata.projectId -> fallback
  const projectName =
    event.projectName ||
    str(metadata.projectName) ||
    str(metadata.projectId) ||
    'tech-lead-stack';

  return {
    id: event.id,
    name: event.skillName || 'unnamed-trace',
    timestamp: event.createdAt.toISOString(),
    // A real grouping key, never the per-row trace id.
    sessionId: event.sessionId ?? str(metadata.chatId) ?? event.loopRunId ?? undefined,
    projectName,
    model: event.model || 'unknown',
    agent: event.agent || 'unknown',
    duration: event.duration ?? undefined,
    status: event.status ?? undefined,
    metadata,
    totalCost: event.totalCost ?? 0,
    totalTokens: event.totalTokens ?? 0,
    inputTokens: event.promptTokens ?? 0,
    outputTokens: event.completionTokens ?? 0,
    actorType: event.actorType,
    autonomy: event.autonomy,
    loopRunId: event.loopRunId,
    loopPhase: event.loopPhase,
    teamRole: event.teamRole,
    kind: event.kind,
    provider: event.provider,
    costIsEstimate: event.costIsEstimate,
    cacheReadTokens: event.cacheReadTokens ?? 0,
  };
}

export async function getAnalytics(filters: {
  /** Required: pass `null` only for admins/superusers. */
  scope: AnalyticsAccessScope;
  userId?: string;
  userEmail?: string;
  timeframe?: string;
  /** Explicit date-picker range; takes precedence over `timeframe`. */
  dateRange?: DateRange;
  projectName?: string;
  limit?: number;
}): Promise<TraceData[]> {
  let resolvedUserId = filters.userId;

  // If we have an email but no CUID, try to find the user to get the CUID
  // This ensures we can match standard userId fields in AnalyticsEvent
  if (filters.userEmail && !resolvedUserId) {
    const user = await prisma.user.findUnique({
      where: { email: filters.userEmail },
      select: { id: true },
    });
    if (user) resolvedUserId = user.id;
  }

  const where = buildAnalyticsWhere({
    scope: filters.scope,
    user: { userId: resolvedUserId, userEmail: filters.userEmail },
    projectName: filters.projectName,
    timeframe: filters.timeframe,
    dateRange: filters.dateRange,
  });

  try {
    const events = await prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit === -1 ? undefined : filters.limit || DEFAULT_ANALYTICS_LIMIT, // -1 for all
    });

    return events.map(toTraceData);
  } catch (error) {
    console.error(
      '[AnalyticsService] Error fetching events from database:',
      error
    );
    return [];
  }
}
