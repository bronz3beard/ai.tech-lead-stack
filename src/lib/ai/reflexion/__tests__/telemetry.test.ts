
jest.mock('../../../telemetry-service', () => {
  return {
    telemetryService: { recordEvent: (...args: any[]) => (global as any).mockTelemetryFn(...args) }
  };
});
process.env.GEMINI_API_KEY = 'test';
process.env.ANTHROPIC_API_KEY = 'test';

import { Handlers } from '../../../../mcp-server/handlers';


jest.mock('../engine', () => ({
  runReflexion: jest.fn().mockImplementation(async (runner, cfg, onStep) => {
    // Simulate step events
    onStep({ phase: 'critique', revision: 1, critique: { score: 9, passed: false } });
    onStep({ phase: 'adjudicate' });
    onStep({ phase: 'interview' });

    return {
      runId: 'tel-run',
      verdict: 'Success',
      idePrompt: '',
      stopReason: 'passed'
    };
  })
}));

describe('Telemetry Events', () => {
  it('emits proper actor telemetry per phase in MCP handlers', async () => {
    const withAnalytics = jest.fn();
    (global as any).mockTelemetryFn = withAnalytics;
    const mockFs: any = {};
    const mockTelemetry: any = { recordEvent: withAnalytics }; // We inject it to handlers to catch it directly.


    const mockAlignment: any = { ensureAligned: jest.fn().mockResolvedValue(true) };
    const mockKi: any = {};

    const handlers = new Handlers(mockFs, mockTelemetry, mockAlignment, mockKi);

    const args = { brief: 'telemetry check', mode: 'auto', projectName: 'test', agent: 'test' };
    await handlers.handleReflexionLoop(args);

    // Wait for background tasks and dynamic imports to resolve since it's fire-and-forget
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should have emitted 3 step events (critique, adjudicate, interview) + 1 completion event
    expect(withAnalytics).toHaveBeenCalledTimes(3);

    // Check step 1: critique
    expect(withAnalytics).toHaveBeenCalledWith(expect.objectContaining({
        loopPhase: 'critique',
      teamRole: 'critic',
      actorType: 'AGENT',
      autonomy: 'AUTONOMOUS'
    }));

    // Check step 2: adjudicate
    expect(withAnalytics).toHaveBeenCalledWith(expect.objectContaining({
        loopPhase: 'adjudicate',
      teamRole: 'adjudicator',
    }));

    // Check step 3: interview
    expect(withAnalytics).toHaveBeenCalledWith(expect.objectContaining({
        loopPhase: 'interview',
      teamRole: 'interviewer',
    }));

      });
});
