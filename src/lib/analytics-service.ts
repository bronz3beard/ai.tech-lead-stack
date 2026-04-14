import { prisma } from '@/lib/prisma';

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
  timeframe?: string;
  projectName?: string;
}): Promise<TraceData[]> {
  const where: any = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.projectName) {
    where.projectName = filters.projectName;
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
      default:
        break; // Handles parsing if date ranges are passed directly via 'from' and 'to'
    }

    // Fallback parsing for from / to values
    if (!['1yr', '6mo', '3mo', '1mo', 'week', 'day'].includes(filters.timeframe)) {
       // Ignore if not a preset timeframe
    } else {
       where.createdAt = { gte: fromDate };
    }
  }

  const events = await prisma.analyticsEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return events.map((event) => ({
    id: event.id,
    name: event.skillName || 'unnamed-trace',
    timestamp: event.createdAt.toISOString(),
    sessionId: event.langfuseTraceId || undefined, 
    projectName: event.projectName || 'tech-lead-stack', 
    model: event.model || 'unknown',
    agent: event.agent || 'unknown',
    duration: event.duration || undefined,
    status: event.status || undefined,
    metadata: (event.metadata as Record<string, unknown>) || {},
    totalCost: event.totalCost || 0,
    totalTokens: event.totalTokens || 0,
    inputTokens: event.promptTokens || 0,
    outputTokens: event.completionTokens || 0,
  }));
}
