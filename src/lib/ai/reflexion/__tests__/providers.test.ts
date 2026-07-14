import * as aiModule from 'ai';
import { buildRunner } from '../providers-env';

jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: {
    object: jest.fn(),
  },
}));

describe('providers v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildRunner accumulates usage and provides interview()', async () => {
    (aiModule.generateText as jest.Mock)
      .mockResolvedValueOnce({ text: 'text', usage: { totalTokens: 10 } })
      .mockResolvedValueOnce({
        output: { runId: '1', questions: [] },
        usage: { totalTokens: 20 },
      });

    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const mockModel: any = {};
    const runner = buildRunner(mockModel, mockModel, mockModel, {
      creator: 'a',
      critic: 'b',
      adjudicator: 'c',
    });

    expect(runner.getUsage().tokens).toBe(0);

    await runner.generate('prompt', 'system');
    expect(runner.getUsage().tokens).toBe(10);

    const interviewRes = await runner.interview('prompt', 'system');
    expect(interviewRes.runId).toBe('1');
    expect(runner.getUsage().tokens).toBe(30);

    spy.mockRestore();
  });

  it('401 on Claude falls back to gemini-3.1-pro-preview', async () => {
    const mockCreator: any = { id: 'gemini-3.5-flash' };
    const mockCritic: any = { id: 'claude-sonnet-4-6' };
    const mockFallbackCritic: any = { id: 'gemini-3.1-pro-preview' };

    const error401 = new Error('unauthorized');
    (error401 as any).status = 401;

    (aiModule.generateText as jest.Mock)
      .mockRejectedValueOnce(error401) // First call to Claude fails
      .mockResolvedValueOnce({
        output: { score: 7, passed: false, actionableFix: 'fix' },
        usage: { totalTokens: 15 },
      }); // Fallback succeeds

    const runner = buildRunner(
      mockCreator,
      mockCritic,
      mockCritic,
      {
        creator: 'gemini-3.5-flash',
        critic: 'claude-sonnet-4-6',
        adjudicator: 'claude-sonnet-4-6',
      },
      mockFallbackCritic
    );

    expect(runner.wasDegraded()).toBe(false);

    const critique = await runner.critique('prompt', 'system');
    expect(critique.score).toBe(7);
    expect(runner.wasDegraded()).toBe(true);

    // Verify generateText was called first with mockCritic and then with mockFallbackCritic
    expect(aiModule.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: mockCritic,
      })
    );
    expect(aiModule.generateText).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: mockFallbackCritic,
      })
    );
  });

  it('successful passed=false critique does not trigger fallback and wasDegraded remains false', async () => {
    const mockCreator: any = { id: 'gemini-3.5-flash' };
    const mockCritic: any = { id: 'claude-sonnet-4-6' };
    const mockFallbackCritic: any = { id: 'gemini-3.1-pro-preview' };

    (aiModule.generateText as jest.Mock).mockResolvedValueOnce({
      output: { score: 5, passed: false, actionableFix: 'fix' },
      usage: { totalTokens: 15 },
    });

    const runner = buildRunner(
      mockCreator,
      mockCritic,
      mockCritic,
      {
        creator: 'gemini-3.5-flash',
        critic: 'claude-sonnet-4-6',
        adjudicator: 'claude-sonnet-4-6',
      },
      mockFallbackCritic
    );

    expect(runner.wasDegraded()).toBe(false);

    const critique = await runner.critique('prompt', 'system');
    expect(critique.score).toBe(5);
    expect(runner.wasDegraded()).toBe(false);

    // Verify generateText was called only once with mockCritic
    expect(aiModule.generateText).toHaveBeenCalledTimes(1);
    expect(aiModule.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: mockCritic,
      })
    );
  });
});
