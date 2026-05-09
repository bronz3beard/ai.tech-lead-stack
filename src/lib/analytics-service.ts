import { prisma } from '@/lib/prisma';
import { fetchAllPages } from './langfuse-api';
import { normalizeProjectName, normalizeSkillName } from './trace-utils';

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
}

/**
 * Syncs the latest traces from Langfuse API into the Postgres database.
 * This runs periodically or on-demand to ensure the DB stays updated even if
 * live recording fails.
 */
let lastSyncTime = 0;
const SYNC_COOLDOWN = 5 * 60 * 1000; // 5 minutes

export async function syncTracesFromLangfuse(limit?: number, force = false) {
  if (!force && Date.now() - lastSyncTime < SYNC_COOLDOWN) {
    console.log('[AnalyticsSync] Skipping sync: recently updated.');
    return { count: 0, status: 'SKIPPED_COOLDOWN' };
  }

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey || publicKey === 'placeholder') {
    console.warn(
      '[AnalyticsSync] Skipping sync: Langfuse credentials not configured.'
    );
    return { count: 0, status: 'SKIPPED' };
  }

  try {
    console.log(`[AnalyticsSync] Starting sync... limit: ${limit || 'ALL'}`);
    const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

    // Use enhanced fetchAllPages utility
    const queryParams = new URLSearchParams();
    queryParams.set('orderBy', 'timestamp.desc');

    const traces = await fetchAllPages<any>(
      baseUrl,
      '/api/public/traces',
      queryParams,
      authHeader,
      limit
    );
    console.log(
      `[AnalyticsSync] Fetched ${traces.length} total traces from Langfuse.`
    );

    let syncedCount = 0;
    console.log(
      `[AnalyticsSync] Processing ${traces.length} traces from Langfuse...`
    );

    // 1. Batch resolve users by email
    const emails = [
      ...new Set(
        traces
          .map((t: any) => t.userId)
          .filter((id: any) => id && typeof id === 'string' && id.includes('@'))
      ),
    ] as string[];

    const userLookup = new Map<string, string>();
    if (emails.length > 0) {
      const users = await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true },
      });
      for (const u of users) {
        if (u.email) userLookup.set(u.email, u.id);
      }
    }

    // 2. Batch resolve existing traces
    const traceIds = traces.map((t: any) => t.id).filter(Boolean) as string[];
    const existingEventsLookup = new Map<string, string>();

    if (traceIds.length > 0) {
      const existingEvents = await prisma.analyticsEvent.findMany({
        where: { langfuseTraceId: { in: traceIds } },
        select: { id: true, langfuseTraceId: true },
      });
      for (const event of existingEvents) {
        if (event.langfuseTraceId) {
          existingEventsLookup.set(event.langfuseTraceId, event.id);
        }
      }
    }

    // 3. Prepare batch operations
    const operations: any[] = [];

    for (const trace of traces) {
      const rawProject =
        trace.metadata?.projectName ||
        trace.metadata?.projectId ||
        trace.tags?.find((t: string) => !t.includes(':')) ||
        'tech-lead-stack';

      const normalizedProject = normalizeProjectName(rawProject);
      const normalizedSkill = normalizeSkillName(
        trace.name?.replace('skill:', '') || 'unknown'
      );

      let resolvedUserId: string | null = null;
      if (trace.userId && typeof trace.userId === 'string' && trace.userId.includes('@')) {
        resolvedUserId = userLookup.get(trace.userId) || null;
      }

      const existingId = trace.id ? existingEventsLookup.get(trace.id) : undefined;

      const eventData = {
        skillName: normalizedSkill,
        projectName: normalizedProject,
        userId: resolvedUserId,
        model: trace.metadata?.model || 'unknown',
        agent: trace.metadata?.agent || 'unknown',
        duration: trace.duration || 0,
        status: trace.metadata?.status || 'SUCCESS',
        promptTokens: trace.usage?.promptTokens || 0,
        completionTokens: trace.usage?.completionTokens || 0,
        totalTokens: trace.usage?.totalTokens || 0,
        totalCost: trace.usage?.totalCost || 0,
        metadata: {
          ...trace.metadata,
          syncedAt: new Date().toISOString(),
          isSynced: true,
        },
      };

      if (existingId) {
        operations.push(
          prisma.analyticsEvent.update({
            where: { id: existingId },
            data: eventData,
          })
        );
      } else {
        operations.push(
          prisma.analyticsEvent.create({
            data: {
              ...eventData,
              langfuseTraceId: trace.id,
              createdAt: new Date(trace.timestamp),
            },
          })
        );
      }
      syncedCount++;
    }

    // 4. Execute all queries in a single transaction
    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    console.log(
      `[AnalyticsSync] Sync completed. Persisted ${syncedCount} new records.`
    );
    lastSyncTime = Date.now();
    return { count: syncedCount, status: 'SUCCESS' };
  } catch (error) {
    console.error('[AnalyticsSync] Sync failed:', error);
    return { count: 0, status: 'ERROR', error };
  }
}

export async function getAnalytics(filters: {
  userId?: string;
  userEmail?: string;
  timeframe?: string;
  projectName?: string;
  limit?: number;
}): Promise<TraceData[]> {
  const where: any = {};

  if (filters.userEmail || filters.userId) {
    let resolvedUserId = filters.userId;

    // If we have an email but no CUID, try to find the user to get the CUID
    // This ensures we can match standard userId fields in AnalyticsEvent
    if (filters.userEmail && !resolvedUserId) {
      const user = await prisma.user.findUnique({
        where: { email: filters.userEmail },
        select: { id: true },
      });
      if (user) {
        resolvedUserId = user.id;
      }
    }

    where.OR = [
      ...(resolvedUserId ? [{ userId: resolvedUserId }] : []),
      ...(filters.userEmail
        ? [{ metadata: { path: ['userEmail'], equals: filters.userEmail } }]
        : []),
    ];

    if (where.OR.length === 0) delete where.OR;
  }

  if (filters.projectName && filters.projectName !== 'all') {
    where.projectName = normalizeProjectName(filters.projectName);
  }

  if (filters.timeframe && filters.timeframe !== 'all') {
    const now = new Date();
    const fromDate = new Date();

    switch (filters.timeframe) {
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

    // Only apply timeframe filter if it was a valid preset
    if (
      filters.timeframe &&
      ['1yr', '6mo', '3mo', '1mo', 'week', 'day', 'today'].includes(
        filters.timeframe
      )
    ) {
      where.createdAt = { gte: fromDate };
    }
  }

  console.log(
    '[AnalyticsService] Fetching with where:',
    JSON.stringify(where, null, 2),
    'limit:',
    filters.limit
  );

  const events = await prisma.analyticsEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit === -1 ? undefined : filters.limit || 1000, // Default to 1000 if not specified, -1 for all
  });

  console.log(`[AnalyticsService] Found ${events.length} events`);

  return events.map((event) => {
    const metadata = (event.metadata as Record<string, any>) || {};

    // Attribution Fallback Hierarchy: root projectName -> metadata.projectName -> metadata.projectId -> tag (none here) -> fallback
    const projectName =
      event.projectName ||
      metadata.projectName ||
      metadata.projectId ||
      'tech-lead-stack';

    return {
      id: event.id,
      name: event.skillName || 'unnamed-trace',
      timestamp: event.createdAt.toISOString(),
      sessionId: event.langfuseTraceId || undefined,
      projectName: projectName,
      model: event.model || 'unknown',
      agent: event.agent || 'unknown',
      duration: event.duration || undefined,
      status: event.status || undefined,
      metadata: metadata,
      totalCost: event.totalCost || 0,
      totalTokens: event.totalTokens || 0,
      inputTokens: event.promptTokens || 0,
      outputTokens: event.completionTokens || 0,
    };
  });
}
