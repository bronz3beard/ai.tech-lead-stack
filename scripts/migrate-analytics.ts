import { prisma } from '../src/lib/prisma';
import { fetchAllPages } from '../src/lib/langfuse-api';

interface LangfuseUsage {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  input?: number;
  output?: number;
  total?: number;
}

interface LangfuseTrace {
  id: string;
  name?: string;
  timestamp: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  duration?: number;
  status?: string;
  tags?: string[];
  totalCost?: number;
  usage?: LangfuseUsage;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  observations?: LangfuseObservation[];
  userId?: string;
}

interface LangfuseObservation {
  id: string;
  traceId: string;
  type: string;
  name?: string;
  model?: string;
  metadata?: Record<string, unknown>;
  usage?: LangfuseUsage;
  calculatedTotalCost?: number;
}

async function main() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey || publicKey === 'placeholder') {
    console.warn('Langfuse API keys are not configured or still placeholders');
    return;
  }

  const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

  console.log('Fetching traces from Langfuse...');
  const allTraces = await fetchAllPages<LangfuseTrace>(
    baseUrl,
    '/api/public/traces',
    new URLSearchParams(),
    authHeader,
    1000
  );

  console.log(`Fetched ${allTraces.length} traces. Mapping to DB events...`);

  // Simple migration mapping avoiding fetching observations for simplicity,
  // falling back to basic trace-level usage stats.

  // Pre-fetch all users to avoid N+1 queries during migration mapping
  const users = await prisma.user.findMany();
  const userMap = new Map<string, string>();
  users.forEach(u => {
    userMap.set(u.id, u.id);
    if (u.email) userMap.set(u.email, u.id);
  });

  const validEvents = [];
  const traceIds = new Set<string>(); // to deduplicate manually before createMany

  for (const trace of allTraces) {
    if (!trace.name || trace.name === 'chat' || trace.name === 'session') continue; // only migrate skills
    if (traceIds.has(trace.id)) continue;

    let userId = trace.userId || 'anonymous';
    let resolvedUserId = userMap.get(userId);

    if(!resolvedUserId) {
        continue;
    }

    const totalTokens = trace.totalTokens || trace.usage?.totalTokens || trace.usage?.total || 0;
    const promptTokens = trace.inputTokens || trace.usage?.inputTokens || trace.usage?.promptTokens || trace.usage?.input || 0;
    const completionTokens = trace.outputTokens || trace.usage?.outputTokens || trace.usage?.completionTokens || trace.usage?.output || 0;

    validEvents.push({
      id: trace.id,
      skillName: trace.name,
      userId: resolvedUserId,
      model: (trace.metadata?.model as string) || undefined,
      agent: (trace.metadata?.agent as string) || undefined,
      duration: trace.duration,
      status: trace.status,
      error: trace.metadata?.error ? String(trace.metadata.error) : undefined,
      promptTokens,
      completionTokens,
      totalTokens,
      totalCost: trace.totalCost || 0,
      langfuseTraceId: trace.id,
      metadata: trace.metadata ? JSON.parse(JSON.stringify(trace.metadata)) : {},
      createdAt: new Date(trace.timestamp),
    });

    traceIds.add(trace.id);
  }

  if (validEvents.length > 0) {
    console.log(`Inserting ${validEvents.length} events using createMany...`);
    await prisma.analyticsEvent.createMany({
      data: validEvents,
      skipDuplicates: true
    });
  }

  console.log('Migration complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
