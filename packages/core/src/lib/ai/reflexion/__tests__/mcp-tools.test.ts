process.env.GEMINI_API_KEY = 'test';
process.env.ANTHROPIC_API_KEY = 'test';
import { runReflexion, resumeReflexion } from '../engine';
import { Handlers } from '../../../../mcp-server/handlers';

jest.mock('../engine', () => ({
  runReflexion: jest.fn().mockResolvedValue({
    runId: 'mcp-run',
    verdict: 'Success',
    idePrompt: 'Mock IDE prompt',
    stopReason: 'passed',
  }),
  resumeReflexion: jest.fn().mockResolvedValue({
    runId: 'mcp-run',
    verdict: 'Success',
    idePrompt: 'Mock IDE prompt',
    stopReason: 'user-approve',
  }),
}));

jest.mock('../state-store', () => {
  return {
    FileStateStore: jest.fn().mockImplementation(() => ({
      load: jest.fn().mockResolvedValue({
        brief: 'test brief',
        params: { maxRevisions: 3, maxStructuralRepairs: 1, passThreshold: 8 },
        runId: 'mcp-run',
      }),
      save: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('MCP Handlers Extension', () => {
  const mockFs: any = {};
  const mockTelemetry: any = { recordEvent: jest.fn() };
  const mockAlignment: any = {
    ensureAligned: jest.fn().mockResolvedValue(true),
  };
  const mockKi: any = {};

  const handlers = new Handlers(mockFs, mockTelemetry, mockAlignment, mockKi);

  it('handleReflexionLoop passes mode and budget correctly', async () => {
    const args = {
      brief: 'test brief',
      mode: 'auto',
      budget: { maxCostUsd: 1 },
    };

    const result = await handlers.handleReflexionLoop(args);
    if (result.isError) {
      console.error(result.content[0].text);
    }

    expect(runReflexion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        brief: 'test brief',
        mode: 'auto',
        budget: { maxCostUsd: 1 },
        stateStore: expect.any(Object),
      }),
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('handleReflexionResume calls engine with FileStateStore', async () => {
    const args = {
      runId: 'mcp-run',
      answers: { runId: 'mcp-run', decisions: [] },
    };

    const res = await handlers.handleReflexionResume(args);
    if ((res as any).isError) {
      console.error((res as any).content[0].text);
    }

    expect(resumeReflexion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runId: 'mcp-run' }),
      args.answers,
      expect.objectContaining({
        mode: 'interview',
        stateStore: expect.any(Object),
      }),
      expect.any(Function)
    );
    expect((res as any).content[0].text).toContain('Verdict: Success');
  });
});
