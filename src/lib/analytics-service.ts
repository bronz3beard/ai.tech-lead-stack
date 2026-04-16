import { prisma } from '@/lib/prisma';
import { normalizeProjectName } from './trace-utils';

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
