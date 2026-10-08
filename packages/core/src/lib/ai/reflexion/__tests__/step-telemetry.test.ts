import { reflexionStepTelemetry } from '../step-telemetry';

jest.mock('../../../prisma', () => ({ prisma: {} }));

const critique = {
  gstackDiagnosis: 6,
  atomicBatches: 6,
  productionEthos: 6,
  modernWeb: 6,
  score: 6,
  passed: false,
  actionableFix: 'split S4',
};

describe('reflexionStepTelemetry', () => {
  it('records the engine phase as loopPhase and the lifecycle phase in metadata', () => {
    const params = reflexionStepTelemetry({
      event: { phase: 'scored', revision: 2, critique },
      loopRunId: 'run-1',
      revision: 2,
      intentPhase: 'plan',
    });

    expect(params.loopPhase).toBe('scored');
    expect(params.metadata).toMatchObject({ intentPhase: 'plan', passed: false, score: 6, revision: 2 });
    expect(params.teamRole).toBe('critic');
  });

  it('carries provider usage when the step made an LLM call', () => {
    const params = reflexionStepTelemetry({
      event: {
        phase: 'generated',
        revision: 1,
        usage: { promptTokens: 1200, completionTokens: 300, modelId: 'gemini-3.8-flash' },
      },
      loopRunId: 'run-1',
      revision: 1,
    });

    expect(params).toMatchObject({
      kind: 'llm_generation',
      usageFromProvider: true,
      sessionId: 'run-1',
      promptTokens: 1200,
      completionTokens: 300,
      model: 'gemini-3.8-flash',
    });
  });

  it('keeps the last seen revision on marker events that carry none', () => {
    const params = reflexionStepTelemetry({
      event: { phase: 'adjudicate' },
      loopRunId: 'run-1',
      revision: 3,
    });

    expect(params.metadata).toMatchObject({ revision: 3, totalSteps: 3 });
    expect(params.kind).toBe('loop_step');
    expect(params.promptTokens).toBeUndefined();
    expect(params.teamRole).toBe('adjudicator');
  });
});
