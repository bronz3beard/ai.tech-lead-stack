import { prisma } from '@/lib/prisma';
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
export async function syncTracesFromLangfuse(limit = 50) {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey || publicKey === 'placeholder') {
    console.warn('[AnalyticsSync] Skipping sync: Langfuse credentials not configured.');
    return { count: 0, status: 'SKIPPED' };
  }

  try {
    console.log(`[AnalyticsSync] Starting sync for last ${limit} traces...`);
    const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;
    
    // Fetch traces from Langfuse
    const response = await fetch(`${baseUrl}/api/public/traces?limit=${limit}&orderBy=timestamp.desc`, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      throw new Error(`Langfuse API error: ${response.statusText}`);
    }

    const data = await response.json();
    const traces = data.data || [];
    let syncedCount = 0;

    for (const trace of traces) {
      // 1. Process project and skill names
      const rawProject = trace.metadata?.projectName || 
                         trace.tags?.find((t: string) => !t.includes(':')) || 
                         'tech-lead-stack';
      
      const normalizedProject = normalizeProjectName(rawProject);
      const normalizedSkill = normalizeSkillName(trace.name?.replace('skill:', '') || 'unknown');

      // 2. Resolve User ID if possible
      let resolvedUserId: string | null = null;
      if (trace.userId && trace.userId.includes('@')) {
        const user = await prisma.user.findUnique({
          where: { email: trace.userId },
          select: { id: true }
        });
        if (user) resolvedUserId = user.id;
      }

      // 3. Upsert into Postgres
      // We use the langfuseTraceId as the unique key in metadata for deduplication if needed,
      // but here we check for existing langfuseTraceId mapping.
      const existing = await prisma.analyticsEvent.findFirst({
        where: { langfuseTraceId: trace.id }
      });

      if (!existing) {
        await prisma.analyticsEvent.create({
          data: {
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
            langfuseTraceId: trace.id,
            createdAt: new Date(trace.timestamp),
            metadata: {
              ...trace.metadata,
              syncedAt: new Date().toISOString(),
              isSynced: true
            }
          }
        });
        syncedCount++;
      }
    }

    console.log(`[AnalyticsSync] Completed. Synced ${syncedCount} new traces.`);
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
        select: { id: true }
      });
      if (user) {
        resolvedUserId = user.id;
      }
    }

    where.OR = [
      ...(resolvedUserId ? [{ userId: resolvedUserId }] : []),
      ...(filters.userEmail ? [{ metadata: { path: ['userEmail'], equals: filters.userEmail } }] : [])
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
        fromDate.setDate(now.getDate() - 1);
        break;
    }

    // Only apply timeframe filter if it was a valid preset
    if (filters.timeframe && ['1yr', '6mo', '3mo', '1mo', 'week', 'day'].includes(filters.timeframe)) {
      where.createdAt = { gte: fromDate };
    }
  }

  console.log('[AnalyticsService] Fetching with where:', JSON.stringify(where, null, 2), 'limit:', filters.limit);

  const events = await prisma.analyticsEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit,
  });

  console.log(`[AnalyticsService] Found ${events.length} events`);

  return events.map((event) => {
    const metadata = (event.metadata as Record<string, any>) || {};
    
    // Attribution Fallback Hierarchy: root projectName -> metadata.projectName -> metadata.projectId -> tag (none here) -> fallback
    const projectName = event.projectName || metadata.projectName || metadata.projectId || 'tech-lead-stack';

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
