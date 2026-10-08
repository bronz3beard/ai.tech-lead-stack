import { computeStepMetrics } from '../step-metrics';
import type { TraceData } from '../analytics-service';

const trace = (overrides: Partial<TraceData>): TraceData => ({
  id: 'e',
  name: 'reflexion-loop',
  timestamp: '2026-10-01T00:00:00Z',
  projectName: 'tls',
  model: 'm',
  agent: 'a',
  ...overrides,
});

describe('computeStepMetrics', () => {
  it('counts a reflexion run once, at its highest step total, across its phase events', () => {
    const metrics = computeStepMetrics([
      trace({ id: '1', loopRunId: 'run-1', loopPhase: 'generated', metadata: { totalSteps: 1, intentPhase: 'plan' } }),
      trace({ id: '2', loopRunId: 'run-1', loopPhase: 'scored', metadata: { totalSteps: 2, intentPhase: 'plan' } }),
      trace({ id: '3', loopRunId: 'run-1', loopPhase: 'adjudicate', metadata: { totalSteps: 2, intentPhase: 'plan' } }),
    ]);

    expect(metrics).toEqual([
      { skillName: 'reflexion-loop', intentPhase: 'plan', totalExecutions: 1, averageSteps: 2, totalSteps: 2 },
    ]);
  });

  it('counts each web-chat analysis turn as its own run', () => {
    const metrics = computeStepMetrics([
      trace({ id: 'a', name: 'analysis:ask', metadata: { totalSteps: 3 } }),
      trace({ id: 'b', name: 'analysis:ask', metadata: { totalSteps: 5 } }),
    ]);

    expect(metrics).toEqual([
      { skillName: 'analysis:ask', intentPhase: 'unspecified', totalExecutions: 2, averageSteps: 4, totalSteps: 8 },
    ]);
  });

  it('ignores events that carry no step count', () => {
    expect(computeStepMetrics([trace({ metadata: {} })])).toEqual([]);
  });
});
