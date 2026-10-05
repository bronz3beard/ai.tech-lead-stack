// A plain copy of fs, so one test can spy on renameSync (the real module's
// properties are not redefinable). Behaviour is unchanged for every test.
jest.mock('fs', () => ({ ...jest.requireActual('fs') }));

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStateStore } from '../state-store';
import { ReflexionStateV2 } from '../schema';

describe('FileStateStore', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-state-store-'));
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 50,
        });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  const dummyState: ReflexionStateV2 = {
    version: 2,
    runId: 'run-123',
    brief: 'Test brief',
    phase: 'AWAITING_ANSWERS',
    plan: '## Test Plan',
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

  it('saves state atomically and loads it', async () => {
    const store = new FileStateStore(testDir);
    await store.save(dummyState);

    const loaded = await store.load('run-123');
    expect(loaded).toBeDefined();
    expect(loaded?.runId).toBe('run-123');
    expect(loaded?.brief).toBe('Test brief');
    expect(loaded?.phase).toBe('AWAITING_ANSWERS');

    // Check files
    const statePath = path.join(testDir, 'state.json');
    const tmpPath = path.join(testDir, 'state.json.tmp');
    expect(fs.existsSync(statePath)).toBe(true);
    expect(fs.existsSync(tmpPath)).toBe(false);
  });

  it('migrates v1 output if state.json is missing', async () => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'plan.md'), '## V1 Plan');
    fs.writeFileSync(
      path.join(testDir, 'critique.json'),
      JSON.stringify({
        runId: 'v1-run-id',
        brief: 'V1 Brief',
        revisionsUsed: 2,
        rounds: [
          {
            draft: '## V1 Plan',
            critique: { score: 5, passed: false, actionableFix: 'fix' },
          },
          {
            draft: '## V1 Plan',
            critique: {
              gstackDiagnosis: 8,
              atomicBatches: 8,
              productionEthos: 8,
              modernWeb: 8,
              score: 8,
              passed: true,
              actionableFix: '',
            },
          },
        ],
      })
    );

    const store = new FileStateStore(testDir);
    const loaded = await store.load('any-run-id');

    expect(loaded).toBeDefined();
    expect(loaded?.version).toBe(2);
    expect(loaded?.runId).toBe('v1-run-id');
    expect(loaded?.brief).toBe('V1 Brief');
    expect(loaded?.plan).toBe('## V1 Plan');
    expect(loaded?.phase).toBe('AWAITING_ANSWERS');
    expect(loaded?.revision).toBe(2);
    expect(loaded?.critiques.length).toBe(2);
    expect(loaded?.critiques[1].score).toBe(8);
  });

  it('returns null if no files exist', async () => {
    const store = new FileStateStore(testDir);
    const loaded = await store.load('run-123');
    expect(loaded).toBeNull();
  });

  it('survives two saves to the same folder overlapping', async () => {
    // Two runs in one folder: run B saves while run A is between writing its
    // tmp file and renaming it. A shared tmp name made A's rename fail (ENOENT).
    const storeA = new FileStateStore(testDir);
    const storeB = new FileStateStore(testDir);
    // Spy on the mocked module object itself; the `import * as fs` binding is
    // a read-only wrapper that the store also reads through.
    const fsModule = jest.requireMock<typeof import('fs')>('fs');
    const realRename = jest.requireActual<typeof import('fs')>('fs').renameSync;
    let interleaved = false;
    const spy = jest
      .spyOn(fsModule, 'renameSync')
      .mockImplementation((from: fs.PathLike, to: fs.PathLike) => {
        if (!interleaved) {
          interleaved = true;
          void storeB.save({ ...dummyState, runId: 'run-B' });
        }
        return realRename(from, to);
      });

    try {
      await expect(
        storeA.save({ ...dummyState, runId: 'run-A' })
      ).resolves.toBeUndefined();
    } finally {
      spy.mockRestore();
    }

    expect(interleaved).toBe(true);
    expect((await storeA.load('run-A'))?.runId).toBe('run-A');
    expect(fs.readdirSync(testDir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });
});
