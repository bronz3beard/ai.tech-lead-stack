import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  makeFakeClientRepo,
  spyOnChildProcess,
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
 * NOTE: PR creation uses the GitHub API client (src/lib/github/client.ts), not local git binaries.
 * NOTE: This test guards tech-lead-stack's own codebase and MCP tool execution flows — it does NOT
 * cover write-capable skills executed autonomously by the developer's IDE agent.
 */

// Mock langfuse & prisma to prevent external network or DB calls
jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../lib/prisma', () => ({
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

describe('No Git Mutations in Tech-Lead Stack Code Paths', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  let fakeRepo: { root: string; cleanup: () => void };
  let fakeHomeDir: string;
  let homeDirSpy: jest.SpyInstance;
  let cpSpy: { calls: any[]; restore: () => void };

  const mutatingGitRegex =
    /\bgit\b\s+(commit|push|add|checkout|reset|clean|merge|rebase|stash|rm)\b/;

  beforeEach(() => {
    fakeRepo = makeFakeClientRepo();
    fakeHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-mutation-home-'));
    homeDirSpy = jest.spyOn(os, 'homedir').mockReturnValue(fakeHomeDir);
    cpSpy = spyOnChildProcess();
  });

  afterEach(() => {
    cpSpy.restore();
    homeDirSpy.mockRestore();
    fakeRepo.cleanup();
    try {
      fs.rmSync(fakeHomeDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  it('asserts zero mutating git commands across in-scope read-only handlers and code flows', async () => {
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

    const alignmentService = new AlignmentService(fakeRepo.root);
    const kiService = new KiService();
    const handlers = new Handlers(
      fsService,
      telemetry,
      alignmentService,
      kiService
    );

    // 1. Skill load flows
    await handlers.handleListSkills();
    await handlers.handleGetSkill('get_skill', { skillName: 'ask' });

    // 2. Alignment check flows
    await alignmentService.getAlignmentState();
    await handlers.handleVerifyMissionAlignment({
      agent: 'test-agent',
      projectName: 'fake-client-app',
    });

    // 3. Stubbed reflexion run flows
    const stubRunner = createStubRunner();
    const tempStateDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'reflexion-git-test-')
    );
    try {
      const stateStore = new FileStateStore(tempStateDir);
      const res = await runReflexion(stubRunner, {
        brief: 'No git mutation test',
        mode: 'auto',
        stateStore,
      });

      const state = await stateStore.load(res.runId);
      if (state) {
        await resumeReflexion(
          stubRunner,
          state,
          { runId: state.runId, decisions: [] },
          { brief: state.brief, stateStore }
        );
      }

      await handlers.handleReflexionStatus({
        runId: res.runId,
        stateDir: tempStateDir,
      });
    } finally {
      try { fs.rmSync(tempStateDir, { recursive: true, force: true }); } catch {}
    }

    // 4. KI create flows
    await kiService.upsertKnowledgeItem({
      slug: 'git-test-ki',
      summary: 'Testing git safety',
      artifacts: [{ name: 'artifact.txt', content: 'content' }],
    });
    await handlers.handleCreateKnowledgeItem({
      slug: 'mcp-git-test-ki',
      summary: 'Testing MCP git safety',
      artifacts: [{ name: 'doc.md', content: 'doc' }],
    });

    // Verify all child process calls
    for (const call of cpSpy.calls) {
      expect(call.fullCommand).not.toMatch(mutatingGitRegex);
    }

    // Explicit check: ensure any git command present is strictly read-only (e.g. status, diff, log, rev-parse, ls-files, show)
    const gitCalls = cpSpy.calls.filter(
      (c) =>
        c.command === 'git' ||
        (typeof c.fullCommand === 'string' && c.fullCommand.includes('git'))
    );

    for (const gitCall of gitCalls) {
      const subCommand =
        gitCall.args[0] || (gitCall.fullCommand.split(' ')[1] ?? '');
      if (subCommand) {
        expect([
          'status',
          'diff',
          'log',
          'rev-parse',
          'ls-files',
          'show',
        ]).toContain(subCommand);
      }
    }
  });
});
