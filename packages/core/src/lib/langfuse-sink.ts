/**
 * @file langfuse-sink.ts
 * @description Programmatic HTTP sink for Langfuse telemetry ingestion.
 * Replaces the deprecated v3 Langfuse SDK with a batched, bounded, and 
 * resilient fetch-based architecture to prevent memory leaks and handle 
 * 429 Too Many Requests errors gracefully.
 */

import crypto from 'node:crypto';

/**
 * Parameters for enqueuing a new telemetry event.
 * Contains both trace-level metadata and generation-level usage metrics.
 */
export interface EnqueueEventParams {
  traceId: string;
  skillName: string;
  projectName?: string;
  model?: string;
  agent?: string;
  duration: number;
  status: 'SUCCESS' | 'ERROR';
  error?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalCost?: number;
  userEmail?: string;
  metadata?: Record<string, any>;
  loopPhase?: string | null;
  actorType?: string | null;
  autonomy?: string | null;
  loopRunId?: string | null;
  teamRole?: string | null;
}

/**
 * Internal queue payload structure.
 * Groups the trace creation event with its corresponding generation event.
 */
export interface LangfuseQueuePayload {
  trace: any;
  generation?: any;
}

/**
 * LangfuseSink handles asynchronous, batched delivery of telemetry events 
 * to the Langfuse public ingestion API. It ensures application performance 
 * is not degraded by network latency or outages.
 */
export class LangfuseSink {
  private queue: LangfuseQueuePayload[] = [];
  
  // Sink configuration constants
  private static MAX_SIZE = 100;           // Hard limit on queue size to prevent memory leaks
  private static MAX_RETRIES = 3;          // Maximum retry attempts for 429 rate limits
  private static FLUSH_INTERVAL_MS = 5000; // Time interval for automatic batch flushing
  
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private droppedCounter = 0; // Tracks events dropped due to full queue or max retries
  
  private publicKey: string | undefined = process.env.LANGFUSE_PUBLIC_KEY;
  private secretKey: string | undefined = process.env.LANGFUSE_SECRET_KEY;
  private baseUrl: string = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

  constructor() {
    this.startTimer();
  }

  /**
   * Initializes the recurring flush timer.
   * The timer is unref'd to prevent it from keeping the Node.js event loop alive 
   * when the application attempts to gracefully shut down.
   */
  private startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.flush().catch((err) => console.error('[LangfuseSink] Auto-flush error:', err));
    }, LangfuseSink.FLUSH_INTERVAL_MS);
    
    // Prevent timer from keeping the process alive
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Transforms raw execution parameters into Langfuse trace and generation objects, 
   * then pushes them onto the queue for batched ingestion.
   */
  public enqueue(params: EnqueueEventParams) {
    // Fail fast if Langfuse is not properly configured
    if (!this.publicKey || !this.secretKey || this.publicKey === 'placeholder') {
      return;
    }

    const endTime = new Date();
    // Reconstruct start time using the measured duration
    const startTime = new Date(endTime.getTime() - params.duration * 1000);

    // Construct the root trace object
    const trace = {
      id: params.traceId,
      name: `skill:${params.skillName}`,
      userId: params.userEmail,
      metadata: {
        ...params.metadata,
        projectName: params.projectName,
        model: params.model,
        agent: params.agent,
        loopPhase: params.loopPhase,
        actorType: params.actorType,
        autonomy: params.autonomy,
        loopRunId: params.loopRunId,
        teamRole: params.teamRole,
      },
      tags: [params.projectName, params.model, params.skillName].filter(Boolean) as string[],
    };

    // Construct the generation object (representing the LLM call)
    const generation = {
      id: `${params.traceId}_gen`,
      name: params.status === 'ERROR' ? `error:${params.skillName}` : `generation:${params.skillName}`,
      model: params.model,
      statusMessage: params.error,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      usageDetails: {
        input: params.promptTokens || 0,
        output: params.completionTokens || 0,
        total: (params.promptTokens || 0) + (params.completionTokens || 0)
      },
      costDetails: {
        total: params.totalCost || 0
      },
      metadata: { ...trace.metadata }
    };

    this.queue.push({ trace, generation });

    // Enforce queue bounds to prevent memory bloat during prolonged outages
    if (this.queue.length > LangfuseSink.MAX_SIZE) {
      this.queue.shift(); // Drop oldest
      this.droppedCounter++;
      console.warn(`[LangfuseSink] Queue full, dropped oldest event. Total dropped: ${this.droppedCounter}`);
    }

    // Proactively trigger a flush if the batch size threshold is met
    if (this.queue.length >= 50) {
      this.flush().catch(() => {});
    }
  }

  /**
   * Processes the current queue, transforming items into the v5 programmatic 
   * ingestion format, and POSTs the batch to Langfuse. Implements exponential 
   * backoff for 429 responses.
   * 
   * @param retries Current retry depth for exponential backoff calculations
   */
  public async flush(retries = 0): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;
    if (!this.publicKey || !this.secretKey) return;

    this.isFlushing = true;
    // Snapshot the current queue for this batch
    const batchItems = [...this.queue];
    this.queue = [];

    // Transform internal queue format to Langfuse ingestion API batch format
    const batch: any[] = [];
    for (const item of batchItems) {
      batch.push({
        id: crypto.randomUUID(),
        type: 'trace-create',
        timestamp: new Date().toISOString(),
        body: item.trace
      });
      if (item.generation) {
        batch.push({
          id: crypto.randomUUID(),
          type: 'generation-create',
          timestamp: new Date().toISOString(),
          body: {
            ...item.generation,
            traceId: item.trace.id
          }
        });
      }
    }

    try {
      const auth = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64');
      const res = await fetch(`${this.baseUrl}/api/public/ingestion`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batch })
      });

      // Handle rate limits gracefully
      if (res.status === 429) {
        if (retries >= LangfuseSink.MAX_RETRIES) {
          this.droppedCounter += batchItems.length;
          console.error(`[LangfuseSink] Max retries reached on 429, dropping ${batchItems.length} events. Total dropped: ${this.droppedCounter}`);
          return;
        }

        // Respect the server's Retry-After header if provided, otherwise use exponential backoff
        const retryAfter = res.headers.get('Retry-After');
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retries) * 1000;
        
        console.warn(`[LangfuseSink] 429 Too Many Requests, retrying in ${delayMs}ms... (Retry ${retries + 1}/${LangfuseSink.MAX_RETRIES})`);
        
        // Re-queue the failed batch at the front of the queue
        this.queue = [...batchItems, ...this.queue];
        
        // Enforce max size again to ensure the requeued items didn't breach the limit
        while (this.queue.length > LangfuseSink.MAX_SIZE) {
          this.queue.shift(); // Drop oldest (from the front of the requeued batch)
          this.droppedCounter++;
        }

        // Schedule the retry
        setTimeout(() => {
          this.flush(retries + 1).catch(() => {});
        }, delayMs);
        
        return;
      }

      // Handle standard HTTP errors
      if (!res.ok) {
        const errText = await res.text();
        this.droppedCounter += batchItems.length;
        console.error(`[LangfuseSink] Ingestion failed (${res.status}): ${errText}. Dropped ${batchItems.length} events.`);
      }
    } catch (err: any) {
      // Handle network-level errors (DNS, timeout, connection refused)
      this.droppedCounter += batchItems.length;
      console.error(`[LangfuseSink] Network error during flush: ${err.message || String(err)}. Dropped ${batchItems.length} events.`);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Safely terminates the sink, clearing intervals and firing a final, 
   * un-awaited flush to ensure no telemetry is lost during process teardown.
   */
  public shutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Fire and forget final flush
    this.flush().catch(() => {});
  }
}

// Export as a singleton
export const langfuseSink = new LangfuseSink();
