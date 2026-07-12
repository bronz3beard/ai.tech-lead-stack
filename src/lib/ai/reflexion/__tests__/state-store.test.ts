import * as fs from 'fs';
import * as path from 'path';
import { FileStateStore } from '../state-store';
import { ReflexionStateV2 } from '../schema';

const TEST_DIR = path.join(__dirname, '.test-state-store');

describe('FileStateStore', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  const dummyState: ReflexionStateV2 = {
    version: 2,
    runId: 'run-123',
    brief: 'Test brief',
    phase: 'AWAITING_ANSWERS',
    plan: '## Test Plan',
    critiques: [{
      gstackDiagnosis: 9,
      atomicBatches: 9,
      productionEthos: 9,
      modernWeb: 9,
      score: 9,
      passed: true,
      actionableFix: ''
    }],
    revision: 1,
    params: {
      passThreshold: 8,
      maxRevisions: 3,
    },
    usage: {
      totalTokens: 100,
      costUsd: 0.1,
      perPhase: []
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it('saves state atomically and loads it', async () => {
    const store = new FileStateStore(TEST_DIR);
    await store.save(dummyState);

    const loaded = await store.load('run-123');
    expect(loaded).toBeDefined();
    expect(loaded?.runId).toBe('run-123');
    expect(loaded?.brief).toBe('Test brief');
    expect(loaded?.phase).toBe('AWAITING_ANSWERS');

    // Check files
    const statePath = path.join(TEST_DIR, 'state.json');
    const tmpPath = path.join(TEST_DIR, 'state.json.tmp');
    expect(fs.existsSync(statePath)).toBe(true);
    expect(fs.existsSync(tmpPath)).toBe(false);
  });

  it('migrates v1 output if state.json is missing', async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'plan.md'), '## V1 Plan');
    fs.writeFileSync(path.join(TEST_DIR, 'critique.json'), JSON.stringify({
      runId: 'v1-run-id',
      brief: 'V1 Brief',
      revisionsUsed: 2,
      rounds: [
        { draft: '## V1 Plan', critique: { score: 5, passed: false, actionableFix: 'fix' } },
        { draft: '## V1 Plan', critique: { gstackDiagnosis: 8, atomicBatches: 8, productionEthos: 8, modernWeb: 8, score: 8, passed: true, actionableFix: '' } }
      ]
    }));

    const store = new FileStateStore(TEST_DIR);
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
    const store = new FileStateStore(TEST_DIR);
    const loaded = await store.load('run-123');
    expect(loaded).toBeNull();
  });
});
