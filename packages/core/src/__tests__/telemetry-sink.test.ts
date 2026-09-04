import crypto from 'node:crypto';
import { langfuseSink } from '../lib/langfuse-sink';
import { prisma } from '../lib/prisma';
import { telemetryService } from '../lib/telemetry-service';

// Mock node-fetch
const originalFetch = global.fetch;

describe('Langfuse Sink & Telemetry Service', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    // Reset langfuse sink state
    (langfuseSink as any).publicKey = 'test-public';
    (langfuseSink as any).secretKey = 'test-secret';
    (langfuseSink as any).queue = [];
    (langfuseSink as any).droppedCounter = 0;
    (langfuseSink as any).isFlushing = false;

    // We mock Prisma to avoid actual DB writes during test
    jest
      .spyOn(prisma.analyticsEvent, 'create')
      .mockImplementation(((args: any) => {
        return Promise.resolve({
          id: crypto.randomUUID(),
          ...args.data,
        });
      }) as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    langfuseSink.shutdown();
  });

  it('isolates sink failures (429) from Postgres writes', async () => {
    fetchMock.mockResolvedValue({
      status: 429,
      ok: false,
      headers: new Headers({ 'Retry-After': '1' }),
      text: async () => 'Too Many Requests',
    });

    const event = await telemetryService.recordEvent({
      skillName: 'test-skill',
      duration: 1.5,
      status: 'SUCCESS',
      promptTokens: 10,
      completionTokens: 20,
    });

    expect(event).toBeDefined();
    expect(prisma.analyticsEvent.create).toHaveBeenCalled();
    expect(event!.langfuseTraceId).toBeDefined();

    // Force a flush to trigger the 429 logic
    await langfuseSink.flush();

    // Fetch was called, but event creation succeeded
    expect(fetchMock).toHaveBeenCalled();

    // Since it's a 429, it should have requeued the event
    expect((langfuseSink as any).queue.length).toBeGreaterThan(0);
    expect((langfuseSink as any).queue[0].trace.id).toBe(
      event!.langfuseTraceId
    );
  });

  it('flushes events in a batch at the size threshold', async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true });

    // Fill up to 49 events (threshold is 50)
    for (let i = 0; i < 49; i++) {
      langfuseSink.enqueue({
        traceId: `trace-${i}`,
        skillName: 'test-skill',
        duration: 1,
        status: 'SUCCESS',
      });
    }

    // No fetch should be triggered automatically yet (ignoring interval for test)
    expect(fetchMock).not.toHaveBeenCalled();

    // Enqueue 50th event
    langfuseSink.enqueue({
      traceId: 'trace-50',
      skillName: 'test-skill',
      duration: 1,
      status: 'SUCCESS',
    });

    // Allow async flush to process
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const payload = JSON.parse(fetchCall[1].body);

    // Should contain 50 traces + 50 generations = 100 batch items
    expect(payload.batch.length).toBe(100);
  });

  it('bounds the queue strictly (with flush mocked)', () => {
    const originalFlush = langfuseSink.flush;
    langfuseSink.flush = jest.fn().mockResolvedValue(undefined);

    for (let i = 0; i < 110; i++) {
      langfuseSink.enqueue({
        traceId: `trace-${i}`,
        skillName: 'test-skill',
        duration: 1,
        status: 'SUCCESS',
      });
    }

    const queue = (langfuseSink as any).queue;
    expect(queue.length).toBe(100);
    // Oldest should be dropped, so trace-0 is gone, trace-10 is first
    expect(queue[0].trace.id).toBe('trace-10');
    expect((langfuseSink as any).droppedCounter).toBe(10);

    langfuseSink.flush = originalFlush;
  });

  it('preserves idempotency linkage through retries', async () => {
    const traceId = 'deterministic-id-123';

    langfuseSink.enqueue({
      traceId,
      skillName: 'test-skill',
      duration: 1,
      status: 'SUCCESS',
    });

    fetchMock.mockResolvedValueOnce({
      status: 429,
      ok: false,
      headers: new Headers({ 'Retry-After': '0' }),
      text: async () => 'Too Many Requests',
    });

    await langfuseSink.flush();

    // Queue should have requeued the event
    expect((langfuseSink as any).queue.length).toBe(1);
    expect((langfuseSink as any).queue[0].trace.id).toBe(traceId);

    // Second flush succeeds
    fetchMock.mockResolvedValueOnce({ status: 200, ok: true });
    await langfuseSink.flush(1); // Call with retry count to simulate the timeout calling it

    const secondCall = fetchMock.mock.calls[1];
    const payload = JSON.parse(secondCall[1].body);

    const traceCreate = payload.batch.find(
      (b: any) => b.type === 'trace-create'
    );
    expect(traceCreate.body.id).toBe(traceId);
  });
});
