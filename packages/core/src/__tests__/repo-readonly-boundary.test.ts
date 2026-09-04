import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  makeFakeClientRepo,
  snapshotTree,
  assertNoRepoWrites,
  spyOnFsWrites,
} from './helpers/readonly-harness';
import { Handlers } from '../mcp-server/handlers';
import { FileSystemService } from '../lib/skills/fs-service';
import { Telemetry } from '../mcp-server/telemetry';
import { AlignmentService } from '../lib/skills/alignment-service';
import { KiService } from '../lib/ki/ki-service';
import {
  runReflexion,
  resumeReflexion,
  ReflexionRunner,
} from '../lib/ai/reflexion/engine';
import { FileStateStore } from '../lib/ai/reflexion/state-store';

/**
 * EXPLICIT SCOPE COMMENT:
 * This test proves tech-lead-stack's own advisory surface + read-only skills are read-only;
 * it deliberately does NOT execute write-capable skills, whose edits are the IDE agent's
 * responsibility and are expected.
 */

// Mock langfuse & prisma to prevent external network or DB calls

jest.mock('../lib/prisma', () => ({
  prisma: {
    user: { findFirst: jest.fn().mockResolvedValue(null) },
    project: { findFirst: jest.fn().mockResolvedValue(null) },
  },
}));

function createStubRunner(): ReflexionRunner {
  return {
    generate: jest.fn().mockResolvedValue('# Stub Boundary Plan\n- Step 1'),
    critique: jest.fn().mockResolvedValue({
      gstackDiagnosis: 9,
      atomicBatches: 9,
      productionEthos: 9,
      modernWeb: 9,
      score: 9,
      passed: true,
      actionableFix: '',
    }),
    adjudicate: jest.fn().mockResolvedValue('FINAL APPROVED BOUNDARY PLAN'),
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

describe('Repository Readonly Boundary E2E Sequence', () => {
  const repoRoot = path.resolve(process.cwd(), '../..');
  let fakeClientRepo: { root: string; cleanup: () => void };
  let fakeHomeDir: string;
  let homeDirSpy: jest.SpyInstance;
  let fsSpy: { writes: any[]; restore: () => void };

  beforeEach(() => {
    fakeClientRepo = makeFakeClientRepo();
    fakeHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boundary-home-'));
    homeDirSpy = jest.spyOn(os, 'homedir').mockReturnValue(fakeHomeDir);
    fsSpy = spyOnFsWrites();
  });

  afterEach(() => {
    fsSpy.restore();
    homeDirSpy.mockRestore();
    fakeClientRepo.cleanup();
    try {
      fs.rmSync(fakeHomeDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('runs a full realistic sequence and asserts .ai/.mission-alignment.json is the ONLY change under clientRoot', async () => {
    const fsService = new FileSystemService(repoRoot, fakeClientRepo.root);
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

    const alignmentService = new AlignmentService(fakeClientRepo.root);
    const kiService = new KiService();
    const handlers = new Handlers(
      fsService,
      telemetry,
      alignmentService,
      kiService
    );

    // Snapshot clientRoot before the WHOLE sequence
    const beforeTree = snapshotTree(fakeClientRepo.root);

    // Step 1: get_skill (a read-only skill: 'ask')
    const getSkillRes = await handlers.handleGetSkill('get_skill', {
      skillName: 'ask',
      projectName: 'fake-client-app',
      model: 'gpt-5.6-terra',
      agent: 'test-agent',
    });
    expect(getSkillRes.isError).toBe(false);
    expect(getSkillRes.content[0].text).toContain('Codebase Consultant');

    // Step 2: verify_mission_alignment (record alignment)
    const alignRes = await handlers.handleVerifyMissionAlignment({
      agent: 'test-agent',
      projectName: 'fake-client-app',
    });
    expect(alignRes.isError).toBe(false);
    expect(alignRes.content[0].text).toContain('Mission Alignment Recorded');

    // Step 3: reflexion_loop (stubbed, safe stateDir in temp)
    const safeReflexionDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'boundary-reflexion-')
    );
    try {
      const stateStore = new FileStateStore(safeReflexionDir);
      const stubRunner = createStubRunner();
      const reflexionResult = await runReflexion(stubRunner, {
        brief: 'Boundary test feature brief',
        mode: 'auto',
        stateStore,
      });

      expect(reflexionResult.finalPassed).toBe(true);

      const savedState = await stateStore.load(reflexionResult.runId);
      if (savedState) {
        await resumeReflexion(
          stubRunner,
          savedState,
          { runId: savedState.runId, decisions: [] },
          { brief: savedState.brief, stateStore }
        );
      }

      await handlers.handleReflexionStatus({
        runId: reflexionResult.runId,
        stateDir: safeReflexionDir,
      });
    } finally {
      try {
        fs.rmSync(safeReflexionDir, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 50,
        });
      } catch {
        // ignore cleanup errors
      }
    }

    // Step 4: create_knowledge_item
    const kiRes = await handlers.handleCreateKnowledgeItem({
      slug: 'boundary-ki-item',
      summary: 'Boundary Knowledge Item',
      artifacts: [
        { name: 'boundary.txt', content: 'Boundary content payload' },
      ],
    });
    expect(kiRes.isError).toBe(false);

    // Snapshot clientRoot after the WHOLE sequence
    const afterTree = snapshotTree(fakeClientRepo.root);

    // Assert assertNoRepoWrites with allow: ['.ai/.mission-alignment.json']
    assertNoRepoWrites(beforeTree, afterTree, {
      allow: ['.ai/.mission-alignment.json'],
    });

    // Explicit verification that .git markers are completely untouched
    expect(afterTree.get('.git/HEAD')).toEqual(beforeTree.get('.git/HEAD'));
    expect(afterTree.get('.git/config')).toEqual(beforeTree.get('.git/config'));

    // Assert write spy shows ZERO writes under clientRoot except .ai/.mission-alignment.json
    const clientWrites = fsSpy.writes.filter((w) =>
      w.path.startsWith(fakeClientRepo.root)
    );
    for (const write of clientWrites) {
      const isAlignmentPath =
        write.path.endsWith(`${path.sep}.ai`) ||
        write.path.includes(path.join('.ai', '.mission-alignment.json'));
      expect(isAlignmentPath).toBe(true);
    }
  });
});
