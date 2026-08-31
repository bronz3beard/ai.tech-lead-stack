import {
  ReflexionConfig,
  ReflexionRunner,
  resumeReflexion,
  runReflexion,
} from '../engine';
import { Answers, ReflexionStateV2, Interview } from '../schema';

function createMockRunner(
  generateResponse = 'plan',
  critiqueResponse = {
    passed: true,
    score: 9,
    actionableFix: '',
    gstackDiagnosis: 9,
    atomicBatches: 9,
    productionEthos: 9,
    modernWeb: 9,
  },
  adjudicateResponse = 'verdict',
  interviewResponse: Interview = {
    runId: '123',
    revision: 0,
    recommendation: 'approve',
    questions: [],
  },
  usageResponse = { tokens: 10, costUsd: 0.1 }
): ReflexionRunner {
  return {
    generate: jest.fn().mockResolvedValue(generateResponse),
    critique: jest.fn().mockResolvedValue(critiqueResponse),
    adjudicate: jest.fn().mockResolvedValue(adjudicateResponse),
    interview: jest.fn().mockResolvedValue(interviewResponse),
    getUsage: jest.fn().mockReturnValue(usageResponse),
    wasDegraded: jest.fn(() => false),
    models: { creator: 'gemini', critic: 'claude', adjudicator: 'claude' },
  };
}

describe('engine v2', () => {
  it('legacy auto mode works like v1', async () => {
    const runner = createMockRunner();
    const cfg: ReflexionConfig = { brief: 'test', mode: 'auto' };
    const res = await runReflexion(runner, cfg);
    expect(res.finalPassed).toBe(true);
    expect(res.stopReason).toBe('passed');
  });

  it('interview mode full pass', async () => {
    const runner = createMockRunner();
    const cfg: ReflexionConfig = { brief: 'test', mode: 'interview' };
    const res = await runReflexion(runner, cfg);
    expect(res.finalPassed).toBe(true);
    expect(res.stopReason).toBe('passed');
  });

  it('budget gate trips', async () => {
    const runner = createMockRunner('plan', undefined, undefined, undefined, {
      tokens: 1000,
      costUsd: 10,
    });
    const cfg: ReflexionConfig = {
      brief: 'test',
      mode: 'auto',
      budget: { maxCostUsd: 1 },
    };
    const res = await runReflexion(runner, cfg);
    expect(res.stopReason).toBe('budget-exceeded');
    expect(runner.generate).not.toHaveBeenCalled();
  });

  it('budget gate does not trip if cost is below maxCostUsd', async () => {
    const runner = createMockRunner('plan', undefined, undefined, undefined, {
      tokens: 100,
      costUsd: 0.5,
    });
    const cfg: ReflexionConfig = {
      brief: 'test',
      mode: 'auto',
      budget: { maxCostUsd: 1 },
    };
    const res = await runReflexion(runner, cfg);
    expect(res.stopReason).not.toBe('budget-exceeded');
    expect(runner.generate).toHaveBeenCalled();
  });

  it('zero-question auto-approve', async () => {
    const runner = createMockRunner(
      'plan',
      {
        passed: false,
        score: 8,
        actionableFix: 'fix',
        gstackDiagnosis: 9,
        atomicBatches: 9,
        productionEthos: 9,
        modernWeb: 9,
      },
      'verdict',
      {
        runId: '1',
        revision: 0,
        recommendation: 'refine-plan',
        questions: [
          { id: '1', target: 'plan', ref: '## P0', question: 'q', why: 'w' },
        ],
      }
    );
    const cfg: ReflexionConfig = {
      brief: 'test',
      mode: 'interview',
      passThreshold: 8,
    };
    const res = await runReflexion(runner, cfg);
    expect(res.interview?.recommendation).toBe('approve');
    expect(res.interview?.questions).toHaveLength(0);
    expect(res.stopReason).toBe('passed');
  });

  it('resume refine-plan updates params', async () => {
    const runner = createMockRunner(
      'plan',
      {
        passed: true,
        score: 9,
        actionableFix: '',
        gstackDiagnosis: 9,
        atomicBatches: 9,
        productionEthos: 9,
        modernWeb: 9,
      },
      'verdict',
      { runId: '123', revision: 1, recommendation: 'approve', questions: [] }
    );
    const state: ReflexionStateV2 = {
      version: 2,
      runId: '123',
      brief: 'b',
      phase: 'AWAITING_ANSWERS',
      plan: 'old plan',
      critiques: [
        {
          passed: true,
          score: 9,
          actionableFix: '',
          gstackDiagnosis: 9,
          atomicBatches: 9,
          productionEthos: 9,
          modernWeb: 9,
        },
      ],
      revision: 1,
      params: { passThreshold: 8, maxRevisions: 3, maxStructuralRepairs: 1 },
      usage: { totalTokens: 0, costUsd: 0, perPhase: [] },
      createdAt: 'd',
      updatedAt: 'd',
      interview: {
        runId: '123',
        revision: 0,
        recommendation: 'tune-loop',
        questions: [
          {
            id: 'q1',
            target: 'loop',
            ref: 'passThreshold',
            question: '?',
            why: '!',
          },
        ],
      },
    };
    const answers: Answers = {
      runId: '123',
      decisions: [{ id: 'q1', answer: '9' }],
    };
    const cfg: ReflexionConfig = { brief: 'b', mode: 'auto' };
    const res = await resumeReflexion(runner, state, answers, cfg);
    expect(state.params.passThreshold).toBe(9);
    expect(res.finalPassed).toBe(true);
  });

  it('resume refine-plan violation', async () => {
    const runner = createMockRunner('DUMMY_VIOLATION'); // Returns violation string
    const state: ReflexionStateV2 = {
      version: 2,
      runId: '123',
      brief: 'b',
      phase: 'AWAITING_ANSWERS',
      plan: 'old plan',
      critiques: [],
      revision: 0,
      params: { passThreshold: 8, maxRevisions: 3, maxStructuralRepairs: 1 },
      usage: { totalTokens: 0, costUsd: 0, perPhase: [] },
      createdAt: 'd',
      updatedAt: 'd',
      interview: {
        runId: '123',
        revision: 0,
        recommendation: 'refine-plan',
        questions: [
          { id: 'q1', target: 'plan', ref: '## P0', question: '?', why: '!' },
        ],
      },
    };
    const answers: Answers = {
      runId: '123',
      decisions: [{ id: 'q1', answer: 'change this' }],
    };
    const cfg: ReflexionConfig = { brief: 'b' };
    const res = await resumeReflexion(runner, state, answers, cfg);
    expect(res.stopReason).toBe('refine-contract-violation');
  });

  it('state persistence', async () => {
    const runner = createMockRunner();
    const mockStore = {
      load: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const cfg: ReflexionConfig = {
      brief: 'test',
      mode: 'auto',
      stateStore: mockStore,
    };
    await runReflexion(runner, cfg);
    expect(mockStore.save).toHaveBeenCalled();
  });
});
