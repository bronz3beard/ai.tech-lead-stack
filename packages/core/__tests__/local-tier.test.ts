import { createModel, providerOf } from '../src/lib/ai/model-registry';
import { validateDistinctModels } from '../src/lib/ai/orchestrator';
import { ReflexionRunner, runReflexion } from '../src/lib/ai/reflexion/engine';

describe('Local Execution Tier', () => {
  describe('orchestrator validation', () => {
    it('allows identical models for local tier', () => {
      expect(() => validateDistinctModels('m', 'm', 'local')).not.toThrow();
    });

    it('throws for identical models on byo and sub-max', () => {
      expect(() => validateDistinctModels('m', 'm', 'byo')).toThrow();
      expect(() => validateDistinctModels('m', 'm', 'sub-max')).toThrow();
    });

    it('enforces distinct models and distinct vendors where required', () => {
      // In the orchestrator, validateDistinctModels relies on the models being distinct.
      // If creator == auditor, it throws for sub-max and byo.
      expect(() =>
        validateDistinctModels('claude-opus-4-6', 'claude-opus-4-6', 'byo')
      ).toThrow();
      // If they are distinct, it should not throw just on identity (though distinct-vendor might be enforced elsewhere, the function validateDistinctModels currently just checks identity, unless modified by other PRs).
      // Let's verify our modification: it checks `TIER_POLICY[tier].isolation !== 'same-model' && creator === auditor`
      expect(() =>
        validateDistinctModels('claude-opus-4-6', 'gpt-5.4', 'byo')
      ).not.toThrow();
    });
  });

  describe('model registry', () => {
    const origEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...origEnv };
    });

    afterAll(() => {
      process.env = origEnv;
    });

    it('providerOf and createModel correctly resolve local endpoint', () => {
      process.env.LOCAL_MODEL_ENDPOINT = 'http://localhost:11434/v1';
      process.env.LOCAL_MODEL_NAME = 'llama-3';

      expect(providerOf('llama-3')).toBe('local');

      const model = createModel('llama-3', 'dummy-key');
      // The model created is an OpenAI model using the local baseURL.
      expect(model).toBeDefined();
    });

    it('providerOf falls back for unknown when local endpoint not matching', () => {
      process.env.LOCAL_MODEL_ENDPOINT = 'http://localhost:11434/v1';
      process.env.LOCAL_MODEL_NAME = 'llama-3';

      expect(() => providerOf('unknown-model')).toThrow();
    });
  });

  describe('reflexion engine wallclock budget', () => {
    it('stops execution when wallclock is exceeded', async () => {
      // Mock runner
      const mockRunner: ReflexionRunner = {
        generate: async () => {
          // artificially delay to exceed wallclock
          await new Promise((r) => setTimeout(r, 150));
          return 'mock draft';
        },
        critique: async () => ({
          score: 5,
          passed: false,
          actionableFix: 'fix it',
          gstackDiagnosis: 5,
          atomicBatches: 5,
          productionEthos: 5,
          modernWeb: 5,
        }),
        adjudicate: async () => 'verdict',
        interview: async () => ({
          runId: 'test',
          revision: 1,
          questions: [],
          recommendation: 'approve',
        }),
        getUsage: () => ({ tokens: 10, costUsd: 0 }),
        models: { creator: 'test', critic: 'test', adjudicator: 'test' },
        wasDegraded: () => false,
      };

      const cfg = {
        brief: 'test brief',
        maxRevisions: 3,
        budget: { maxWallClockMs: 100 }, // short budget
      };

      const result = await runReflexion(mockRunner, cfg);
      expect(result.stopReason).toBe('wallclock-exceeded');
    });

    it('stops execution when tokens are exceeded', async () => {
      const mockRunner: ReflexionRunner = {
        generate: async () => 'mock draft',
        critique: async () => ({
          score: 5,
          passed: false,
          actionableFix: 'fix it',
          gstackDiagnosis: 5,
          atomicBatches: 5,
          productionEthos: 5,
          modernWeb: 5,
        }),
        adjudicate: async () => 'verdict',
        interview: async () => ({
          runId: 'test',
          revision: 1,
          questions: [],
          recommendation: 'approve',
        }),
        getUsage: () => ({ tokens: 2000, costUsd: 0 }),
        models: { creator: 'test', critic: 'test', adjudicator: 'test' },
        wasDegraded: () => false,
      };

      const cfg = {
        brief: 'test brief',
        maxRevisions: 3,
        budget: { maxTotalTokens: 1000 },
      };

      const result = await runReflexion(mockRunner, cfg);
      expect(result.stopReason).toBe('budget-exceeded');
    });
  });
});
