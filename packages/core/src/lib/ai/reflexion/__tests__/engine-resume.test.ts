import { runReflexion, ReflexionRunner, ReflexionConfig } from '../engine';
import { ReflexionStateV2 } from '../schema';

describe('engine resume mid-phase', () => {
  it('resumes at revision N if crashed during GENERATING for revision N', async () => {
    const mockRunner: ReflexionRunner = {
      generate: jest.fn().mockResolvedValue('new draft'),
      critique: jest.fn().mockResolvedValue({ score: 5, passed: false, actionableFix: 'fix' }),
      adjudicate: jest.fn().mockResolvedValue('verdict'),
      interview: jest.fn().mockResolvedValue({ recommendation: 'approve', questions: [] }),
      getUsage: () => ({ tokens: 0, costUsd: 0 }),
      models: { creator: 'mock', critic: 'mock', adjudicator: 'mock' },
      wasDegraded: () => false,
    };

    const existingState: ReflexionStateV2 = {
      version: 2,
      runId: 'test-run',
      brief: 'test brief',
      phase: 'GENERATING',
      plan: 'old plan',
      critiques: [
        { score: 4, passed: false, actionableFix: 'fix 1', gstackDiagnosis: 0, atomicBatches: 0, productionEthos: 0, modernWeb: 0 }
      ],
      revision: 0,
      params: { passThreshold: 8, maxRevisions: 3, maxStructuralRepairs: 1 },
      usage: { totalTokens: 0, costUsd: 0, perPhase: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      criticDegraded: false,
    };

    const cfg: ReflexionConfig = {
      brief: 'test brief',
      maxRevisions: 3,
    };

    const steps: any[] = [];
    await runReflexion(mockRunner, cfg, (e) => steps.push(e), existingState);

    // If it crashed during GENERATING for revision 1 (because revision 0 is in critiques),
    // it should resume at revision 1.
    const generateStep = steps.find(s => s.phase === 'generate');
    expect(generateStep).toBeDefined();
    expect(generateStep.revision).toBe(1);
  });

  it('resumes at the same revision if crashed during CRITIQUING after refinement', async () => {
    const mockRunner: ReflexionRunner = {
      generate: jest.fn().mockResolvedValue('new draft'),
      critique: jest.fn().mockResolvedValue({ score: 5, passed: false, actionableFix: 'fix', gstackDiagnosis: 0, atomicBatches: 0, productionEthos: 0, modernWeb: 0 }),
      adjudicate: jest.fn().mockResolvedValue('verdict'),
      interview: jest.fn().mockResolvedValue({ recommendation: 'approve', questions: [] }),
      getUsage: () => ({ tokens: 0, costUsd: 0 }),
      models: { creator: 'mock', critic: 'mock', adjudicator: 'mock' },
      wasDegraded: () => false,
    };

    const existingState: ReflexionStateV2 = {
      version: 2,
      runId: 'test-run',
      brief: 'test brief',
      phase: 'CRITIQUING',
      plan: 'refined plan',
      critiques: [
        { score: 4, passed: false, actionableFix: 'fix 1', gstackDiagnosis: 0, atomicBatches: 0, productionEthos: 0, modernWeb: 0 },
        { score: 6, passed: false, actionableFix: 'fix 2', gstackDiagnosis: 0, atomicBatches: 0, productionEthos: 0, modernWeb: 0 }
      ],
      revision: 2, // Manually incremented in resumeReflexion
      params: { passThreshold: 8, maxRevisions: 4, maxStructuralRepairs: 1 },
      usage: { totalTokens: 0, costUsd: 0, perPhase: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      criticDegraded: false,
    };

    const cfg: ReflexionConfig = {
      brief: 'test brief',
      maxRevisions: 4,
    };

    const steps: any[] = [];
    await runReflexion(mockRunner, cfg, (e) => steps.push(e), existingState);

    // If it crashed at revision 2 CRITIQUING, the loop should not skip revision 2.
    // Wait, runReflexion doesn't handle CRITIQUING phase from existingState in a special way if it's outside the loop...
    // Actually, let's see what steps are executed.
    const generateStep = steps.find(s => s.phase === 'generate');
    // It should resume at revision 2, NOT 3.
    expect(generateStep.revision).toBe(2);
  });
});
