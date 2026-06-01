import { syncTracesFromLangfuse } from '../analytics-service';
import { fetchAllPages } from '../langfuse-api';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
    analyticsEvent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      $transaction: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../langfuse-api', () => ({
  fetchAllPages: jest.fn(),
}));

describe('syncTracesFromLangfuse', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      LANGFUSE_PUBLIC_KEY: 'test-public-key',
      LANGFUSE_SECRET_KEY: 'test-secret-key',
      LANGFUSE_BASE_URL: 'https://cloud.langfuse.com',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should skip sync if credentials are not configured', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'placeholder';
    const result = await syncTracesFromLangfuse(undefined, true);
    expect(result.status).toBe('SKIPPED');
    expect(fetchAllPages).not.toHaveBeenCalled();
  });

  it('should fetch and sync observations to the database', async () => {
    // Mock latestEvent findFirst to return null (initial migration)
    (prisma.analyticsEvent.findFirst as jest.Mock).mockResolvedValue(null);

    // Mock fetchAllPages to return mock observations
    const mockObservations = [
      {
        id: 'obs-1',
        traceId: 'trace-1',
        userId: 'user@example.com',
        model: 'gpt-4o',
        startTime: '2026-06-01T12:00:00.000Z',
        endTime: '2026-06-01T12:00:02.000Z',
        trace_context: {
          traceName: 'skill:planning-expert',
          tags: ['my-project'],
        },
        usage: {
          input: 100,
          output: 50,
          total: 150,
          totalPrice: '0.00350',
        },
        metadata: {
          agent: 'planning-expert',
          status: 'SUCCESS',
        },
      },
    ];

    (fetchAllPages as jest.Mock).mockResolvedValue(mockObservations);

    // Mock database lookup for users and existing traces
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { id: 'user-123', email: 'user@example.com' },
    ]);
    (prisma.analyticsEvent.findMany as jest.Mock).mockResolvedValue([]);

    // Mock transaction
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);

    const result = await syncTracesFromLangfuse(undefined, true);

    expect(result.status).toBe('SUCCESS');
    expect(result.count).toBe(1);

    // Verify fetchAllPages was called with observations endpoint and proper params
    expect(fetchAllPages).toHaveBeenCalledWith(
      'https://cloud.langfuse.com',
      '/api/public/v2/observations',
      expect.any(URLSearchParams),
      expect.stringContaining('Basic '),
      undefined
    );

    // Verify the query params contain type=GENERATION
    const calledParams = (fetchAllPages as jest.Mock).mock.calls[0][2] as URLSearchParams;
    expect(calledParams.get('type')).toBe('GENERATION');
    expect(calledParams.get('fields')).toContain('usage');
    expect(calledParams.get('fromStartTime')).toBeDefined();

    // Verify database transaction query content
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        langfuseTraceId: 'trace-1',
        skillName: 'planning-expert',
        projectName: 'my-project',
        userId: 'user-123',
        model: 'gpt-4o',
        agent: 'planning-expert',
        duration: 2,
        status: 'SUCCESS',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        totalCost: 0.0035,
      }),
    });
  });
});
