import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  makeFakeClientRepo,
  snapshotTree,
  assertNoRepoWrites,
  spyOnFsWrites,
} from '../../../../__tests__/helpers/readonly-harness';
import { runReflexion, resumeReflexion, ReflexionRunner } from '../engine';
import { FileStateStore } from '../state-store';
import { Handlers } from '../../../../mcp-server/handlers';
import { FileSystemService } from '../../../skills/fs-service';
import { Telemetry } from '../../../../mcp-server/telemetry';
import { AlignmentService } from '../../../skills/alignment-service';
import { KiService } from '../../../ki/ki-service';
import { Answers } from '../schema';

// Mock langfuse to prevent ESM dynamic import issues in Jest
jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({})),
}));

// Mock telemetry & prisma to prevent any side effects or network calls
jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    user: { findFirst: jest.fn().mockResolvedValue(null) },
    project: { findFirst: jest.fn().mockResolvedValue(null) },
  },
}));

function createStubRunner(): ReflexionRunner {
  return {
    generate: jest.fn().mockResolvedValue('# Stub Plan\n- Step 1'),
    critique: jest.fn().mockResolvedValue({
      gstackDiagnosis: 9,
      atomicBatches: 9,
      productionEthos: 9,
      modernWeb: 9,
      score: 9,
      passed: true,
      actionableFix: '',
    }),
    adjudicate: jest.fn().mockResolvedValue('FINAL APPROVED PLAN'),
    interview: jest.fn().mockResolvedValue({
      runId: 'run-stub',
      revision: 1,
      questions: [],
      recommendation: 'approve',
    }),
    getUsage: () => ({ tokens: 0, costUsd: 0 }),
    models: {
      creator: 'stub-creator',
      critic: 'stub-critic',
      adjudicator: 'stub-adjudicator',
    },
    wasDegraded: () => false,
  };
}

describe('Reflexion State Confinement', () => {
  const originalCwd = process.cwd();
  let fakeRepo: { root: string; cleanup: () => void };
  let fsSpy: { writes: any[]; restore: () => void };
  let stubRunner: ReflexionRunner;

  beforeEach(() => {
    fakeRepo = makeFakeClientRepo();
    fsSpy = spyOnFsWrites();
    stubRunner = createStubRunner();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fsSpy.restore();
    fakeRepo.cleanup();
  });

  it('1. Confines default state dir .reflexion-out when process.cwd() is set to clientRoot', async () => {
    process.chdir(fakeRepo.root);

    const beforeTree = snapshotTree(fakeRepo.root);

    // 1.1 Run runReflexion with default FileStateStore('.reflexion-out')
    const stateStore = new FileStateStore('.reflexion-out');
    const result = await runReflexion(stubRunner, {
      brief: 'Test brief for confinement',
      mode: 'auto',
      stateStore,
    });

    expect(result.finalPassed).toBe(true);

    // 1.2 Run resumeReflexion with loaded state
    const savedState = await stateStore.load(result.runId);
    expect(savedState).not.toBeNull();

    if (savedState) {
      const answers: Answers = {
        runId: savedState.runId,
        decisions: [{ id: 'q1', answer: 'yes' }],
        directive: 'approve',
      };
      await resumeReflexion(stubRunner, savedState, answers, {
        brief: savedState.brief,
        stateStore,
      });
    }

    // 1.3 Invoke MCP handlers handleReflexionStatus and handleReflexionResume
    const repoRoot = path.resolve(__dirname, '../../../../..');
    const fsService = new FileSystemService(repoRoot, fakeRepo.root);
    const telemetry = new Telemetry();
    jest
      .spyOn(telemetry, 'withAnalytics')
      .mockImplementation(
        async <T>(
          _s: any,
          _p: any,
          _m: any,
          _a: any,
          _c: any,
          fn: () => Promise<T>
        ): Promise<T> => fn()
      );

    const handlers = new Handlers(
      fsService,
      telemetry,
      new AlignmentService(repoRoot),
      new KiService()
    );

    // Test handleReflexionStatus with default state dir
    const statusRes = await handlers.handleReflexionStatus({
      runId: result.runId,
    });
    expect(statusRes.isError).toBeFalsy();
    expect(statusRes.content[0].text).toContain(result.runId);

    const afterTree = snapshotTree(fakeRepo.root);

    // Assert NO file created under clientRoot (tree-diff + fs-write spy)
    assertNoRepoWrites(beforeTree, afterTree, { allow: [] });

    // Assert fsSpy recorded ZERO writes targeting paths inside clientRoot
    const clientWrites = fsSpy.writes.filter((w) =>
      w.path.startsWith(fakeRepo.root)
    );
    expect(clientWrites).toHaveLength(0);
  });

  it('2. Writes state files ONLY inside an explicit safe stateDir (temp dir)', async () => {
    process.chdir(fakeRepo.root);
    const safeDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'explicit-safe-state-')
    );

    try {
      const beforeTree = snapshotTree(fakeRepo.root);

      const stateStore = new FileStateStore(safeDir);
      const result = await runReflexion(stubRunner, {
        brief: 'Test brief with explicit safe state dir',
        mode: 'auto',
        stateStore,
      });

      expect(result.finalPassed).toBe(true);

      // Verify state files exist inside safeDir
      expect(fs.existsSync(path.join(safeDir, 'state.json'))).toBe(true);

      const afterTree = snapshotTree(fakeRepo.root);

      // Assert clientRoot remains untouched
      assertNoRepoWrites(beforeTree, afterTree, { allow: [] });

      const clientWrites = fsSpy.writes.filter((w) =>
        w.path.startsWith(fakeRepo.root)
      );
      expect(clientWrites).toHaveLength(0);
    } finally {
      fs.rmSync(safeDir, { recursive: true, force: true });
    }
  });
});
