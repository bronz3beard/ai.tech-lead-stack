import { DbStateStore } from '../db-state-store';
import { prisma } from '../../../prisma';
import { ReflexionStateV2 } from '../schema';

jest.mock('../../../prisma', () => ({
  prisma: {
    reflexionRun: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

describe('DbStateStore', () => {
  const store = new DbStateStore();

  const dummyState: ReflexionStateV2 = {
    version: 2,
    runId: 'run-db-123',
    brief: 'DB brief',
    phase: 'AWAITING_ANSWERS',
    plan: '## DB Plan',
    critiques: [
      {
        gstackDiagnosis: 9,
        atomicBatches: 9,
        productionEthos: 9,
        modernWeb: 9,
        score: 9,
        passed: true,
        actionableFix: '',
      },
    ],
    revision: 1,
    params: {
      passThreshold: 8,
      maxRevisions: 3, maxStructuralRepairs: 1,
    },
    usage: {
      totalTokens: 100,
      costUsd: 0.1,
      perPhase: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads and parses state from DB', async () => {
    (prisma.reflexionRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-db-123',
      stateJson: dummyState,
    });

    const loaded = await store.load('run-db-123');
    expect(loaded).toBeDefined();
    expect(loaded?.runId).toBe('run-db-123');
    expect(prisma.reflexionRun.findUnique).toHaveBeenCalledWith({
      where: { id: 'run-db-123' },
    });
  });

  it('returns null if stateJson is missing or invalid', async () => {
    (prisma.reflexionRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-db-123',
      stateJson: { bad: 'data' },
    });

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const loaded = await store.load('run-db-123');
    expect(loaded).toBeNull();
    spy.mockRestore();
  });

  it('saves state using create when version is undefined', async () => {
    await store.save(dummyState);
    expect(prisma.reflexionRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'AWAITING_INTERVIEW',
          latestScore: 9,
          revision: 1,
          version: 0,
          costUsd: 0.1,
        }),
      })
    );
  });

  it('saves state using updateMany when version is defined and throws on stale version', async () => {
    (dummyState as any)._dbVersion = 1;
    (prisma.reflexionRun.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    
    await store.save(dummyState);
    
    expect(prisma.reflexionRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-db-123', version: 1 },
        data: expect.objectContaining({
          version: 2,
        }),
      })
    );
    
    expect((dummyState as any)._dbVersion).toBe(2);

    // Now test concurrent modification (count = 0)
    (prisma.reflexionRun.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    await expect(store.save(dummyState)).rejects.toThrow('ReflexionRun run-db-123 modified concurrently');
  });
});
