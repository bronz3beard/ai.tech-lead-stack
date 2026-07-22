import {
  autonomousWorkRatio,
  autonomyDepth,
  evaluatorRejectionRate,
  classifyEvaluatorHealth,
  convergence,
  humanTouchpointsPerRun,
  frictionRate,
  costPerPassedPlan,
} from '../agentic-metrics';
import { AnalyticsEvent, ReflexionRun } from '@prisma/client';

const mockEvent = (overrides: Partial<AnalyticsEvent>): AnalyticsEvent => ({
  id: 'event-1',
  skillName: null,
  userId: null,
  model: null,
  agent: null,
  duration: null,
  status: null,
  error: null,
  promptTokens: null,
  completionTokens: null,
  totalTokens: null,
  totalCost: null,
  langfuseTraceId: null,
  metadata: null,
  createdAt: new Date(),
  projectId: null,
  projectName: null,
  actorType: null,
  autonomy: null,
  loopRunId: null,
  loopPhase: null,
  teamRole: null,
  ...overrides,
});

const mockRun = (overrides: Partial<ReflexionRun>): ReflexionRun => ({
  id: 'run-1',
  userId: null,
  brief: 'Test',
  status: 'PASSED',
  stateJson: {},
  latestScore: null,
  revision: 0,
  costUsd: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Agentic Metrics', () => {
  describe('autonomousWorkRatio', () => {
    it('returns 0 for empty array', () => {
      expect(autonomousWorkRatio([])).toBe(0);
    });

    it('calculates the ratio correctly', () => {
      const events = [
        mockEvent({ actorType: 'AGENT' }),
        mockEvent({ actorType: 'HUMAN' }),
        mockEvent({ actorType: 'AGENT' }),
        mockEvent({ actorType: null }),
      ];
      expect(autonomousWorkRatio(events)).toBe(0.5); // 2 / 4
    });
  });

  describe('autonomyDepth', () => {
    it('returns 0 for empty array', () => {
      expect(autonomyDepth([])).toBe(0);
    });

    it('returns 0 if no agent events', () => {
      const events = [mockEvent({ actorType: 'HUMAN' })];
      expect(autonomyDepth(events)).toBe(0);
    });

    it('calculates the depth correctly', () => {
      const events = [
        mockEvent({ actorType: 'AGENT', autonomy: 'AUTONOMOUS' }),
        mockEvent({ actorType: 'AGENT', autonomy: 'DIRECTED' }),
        mockEvent({ actorType: 'AGENT', autonomy: 'AUTONOMOUS' }),
        mockEvent({ actorType: 'HUMAN', autonomy: 'DIRECTED' }),
      ];
      expect(autonomyDepth(events)).toBe(2 / 3);
    });
  });

  describe('evaluatorRejectionRate', () => {
    it('returns 0 for empty array', () => {
      expect(evaluatorRejectionRate([])).toBe(0);
    });

    it('returns 0 if no critique events', () => {
      const events = [mockEvent({ loopPhase: 'generate' })];
      expect(evaluatorRejectionRate(events)).toBe(0);
    });

    it('calculates the rate correctly', () => {
      const events = [
        mockEvent({ loopPhase: 'critique', metadata: { passed: true } }),
        mockEvent({ loopPhase: 'critique', metadata: { passed: false } }),
        mockEvent({ loopPhase: 'critique', metadata: { passed: false } }),
        mockEvent({ loopPhase: 'generate' }),
      ];
      expect(evaluatorRejectionRate(events)).toBe(2 / 3);
    });
  });

  describe('classifyEvaluatorHealth', () => {
    it('classifies NODDING_LOOP correctly', () => {
      const res = classifyEvaluatorHealth(0, 20);
      expect(res.state).toBe('NODDING_LOOP');
    });

    it('classifies BLOCKED_EVALUATOR correctly', () => {
      const res = classifyEvaluatorHealth(0.95, 20);
      expect(res.state).toBe('BLOCKED_EVALUATOR');
    });

    it('classifies HEALTHY correctly', () => {
      const res1 = classifyEvaluatorHealth(0.15, 10);
      expect(res1.state).toBe('HEALTHY');
      const res2 = classifyEvaluatorHealth(0.85, 50);
      expect(res2.state).toBe('HEALTHY');
    });

    it('classifies WATCH correctly', () => {
      // low sample size, err=0
      const res1 = classifyEvaluatorHealth(0, 19);
      expect(res1.state).toBe('WATCH');

      // err < 0.15 but > 0
      const res2 = classifyEvaluatorHealth(0.1, 50);
      expect(res2.state).toBe('WATCH');

      // err > 0.85 but < 0.95 or low sample
      const res3 = classifyEvaluatorHealth(0.9, 50);
      expect(res3.state).toBe('WATCH');

      const res4 = classifyEvaluatorHealth(0.96, 19);
      expect(res4.state).toBe('WATCH');
    });
  });

  describe('convergence', () => {
    it('returns 0s for empty array or no passed runs', () => {
      expect(convergence([])).toEqual({
        meanRevisionsToPass: 0,
        meanScoreDelta: 0,
      });
      expect(convergence([mockRun({ status: 'FAILED' })])).toEqual({
        meanRevisionsToPass: 0,
        meanScoreDelta: 0,
      });
    });

    it('calculates metrics correctly', () => {
      const runs = [
        mockRun({
          status: 'PASSED',
          revision: 2,
          stateJson: { history: [{ score: 5 }, { score: 7 }, { score: 9 }] },
        }),
        mockRun({
          status: 'PASSED',
          revision: 4,
          stateJson: { scores: [3, 5, 8] },
        }),
        mockRun({
          status: 'PASSED',
          revision: 0,
          stateJson: {}, // No score delta valid
        }),
      ];
      const res = convergence(runs);
      expect(res.meanRevisionsToPass).toBe(2); // (2+4+0)/3
      expect(res.meanScoreDelta).toBe(4.5); // (4 + 5) / 2 valid runs
    });
  });

  describe('humanTouchpointsPerRun', () => {
    it('returns 0 if no loop runs', () => {
      expect(humanTouchpointsPerRun([])).toBe(0);
    });

    it('calculates touchpoints correctly', () => {
      const events = [
        mockEvent({ loopRunId: 'r1', loopPhase: 'interview' }),
        mockEvent({ loopRunId: 'r1', loopPhase: 'generate' }),
        mockEvent({ loopRunId: 'r2', loopPhase: 'interview' }),
        mockEvent({ loopRunId: 'r2', loopPhase: 'interview' }),
      ];
      expect(humanTouchpointsPerRun(events)).toBe(1.5); // 3 interview events / 2 run IDs
    });
  });

  describe('frictionRate', () => {
    it('returns 0 if no loop runs', () => {
      expect(frictionRate([])).toBe(0);
    });

    it('calculates rate correctly', () => {
      const events = [
        mockEvent({ loopRunId: 'r1', metadata: { frictionFiled: true } }),
        mockEvent({ loopRunId: 'r1', metadata: { other: true } }),
        mockEvent({ loopRunId: 'r2', metadata: { frictionFiled: false } }),
        mockEvent({ loopRunId: 'r3' }), // 3 runs, 1 with friction
      ];
      expect(frictionRate(events)).toBe(33.33333333333333); // (1 / 3) * 100
    });
  });

  describe('costPerPassedPlan', () => {
    it('returns 0 if no passed runs', () => {
      expect(costPerPassedPlan([])).toBe(0);
      expect(
        costPerPassedPlan([mockRun({ status: 'FAILED', costUsd: 10 })])
      ).toBe(0);
    });

    it('calculates cost correctly', () => {
      const runs = [
        mockRun({ status: 'PASSED', costUsd: 1.5 }),
        mockRun({ status: 'PASSED', costUsd: 2.5 }),
        mockRun({ status: 'FAILED', costUsd: 5.0 }),
      ];
      expect(costPerPassedPlan(runs)).toBe(2.0); // (1.5 + 2.5) / 2
    });
  });
});
