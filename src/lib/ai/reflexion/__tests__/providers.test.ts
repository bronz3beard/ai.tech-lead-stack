import * as aiModule from 'ai';
import { buildRunner } from '../providers-env';

jest.mock('../pricing', () => ({
  PRICE_PER_MTOK: {
    'gemini-3.6-flash': { inputUsdPerMTok: 1.0, outputUsdPerMTok: 2.0 },
    'claude-sonnet-4-6': { inputUsdPerMTok: 3.0, outputUsdPerMTok: 4.0 },
    'gemini-3.1-pro-preview': { inputUsdPerMTok: 5.0, outputUsdPerMTok: 6.0 },
  },
}));

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

  it('buildRunner accumulates usage and provides interview() with missing model pricing', async () => {
    (aiModule.generateText as jest.Mock)
      .mockResolvedValueOnce({
        text: 'text',
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      })
      .mockResolvedValueOnce({
        output: { runId: '1', questions: [] },
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      });

    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const mockModel = {} as aiModule.LanguageModel;
    const runner = buildRunner(mockModel, mockModel, mockModel, {
      creator: 'unknown-a',
      critic: 'unknown-b',
      adjudicator: 'unknown-c',
    });

    expect(runner.getUsage().tokens).toBe(0);
    expect(runner.getUsage().costUsd).toBe(0);

    await runner.generate('prompt', 'system');
    expect(runner.getUsage().tokens).toBe(10);
    expect(runner.getUsage().costUsd).toBe(0); // Cost remains 0 for missing model

    const interviewRes = await runner.interview('prompt', 'system');
    expect(interviewRes.runId).toBe('1');
    expect(runner.getUsage().tokens).toBe(30);
    expect(runner.getUsage().costUsd).toBe(0); // Cost remains 0

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(
        'cost tracking not available for provider unknown-a'
      )
    );
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(
        'cost tracking not available for provider unknown-b'
      )
    );

    spy.mockRestore();
  });

  it('buildRunner computes correct costUsd using deterministic fixture rates', async () => {
    // mock generate with gemini-3.6-flash (creator): 1,000 prompt (1.0/M), 2,000 completion (2.0/M) = $0.001 + $0.004 = $0.005
    (aiModule.generateText as jest.Mock)
      .mockResolvedValueOnce({
        text: 'text',
        usage: {
          promptTokens: 1000,
          completionTokens: 2000,
          totalTokens: 3000,
        },
      })
      // mock critique with claude-sonnet-4-6 (critic): 2,000 prompt (3.0/M), 1,000 completion (4.0/M) = $0.006 + $0.004 = $0.010
      .mockResolvedValueOnce({
        output: { score: 9 },
        usage: {
          promptTokens: 2000,
          completionTokens: 1000,
          totalTokens: 3000,
        },
      });

    const mockModel = {} as aiModule.LanguageModel;
    const runner = buildRunner(mockModel, mockModel, mockModel, {
      creator: 'gemini-3.6-flash',
      critic: 'claude-sonnet-4-6',
      adjudicator: 'claude-sonnet-4-6',
    });

    await runner.generate('prompt', 'system');
    expect(runner.getUsage().costUsd).toBeCloseTo(0.005);

    await runner.critique('prompt', 'system');
    expect(runner.getUsage().costUsd).toBeCloseTo(0.015); // Total cost = $0.005 + $0.010 = $0.015
    expect(runner.getUsage().tokens).toBe(6000);
  });

  it('401 on Claude falls back to gemini-3.1-pro-preview', async () => {
    const mockCreator = {
      id: 'gemini-3.6-flash',
    } as unknown as aiModule.LanguageModel;
    const mockCritic = {
      id: 'claude-sonnet-4-6',
    } as unknown as aiModule.LanguageModel;
    const mockFallbackCritic = {
      id: 'gemini-3.1-pro-preview',
    } as unknown as aiModule.LanguageModel;

    const error401 = new Error('unauthorized') as Error & { status?: number };
    error401.status = 401;

    (aiModule.generateText as jest.Mock)
      .mockRejectedValueOnce(error401) // First call to Claude fails
      .mockResolvedValueOnce({
        output: { score: 7, passed: false, actionableFix: 'fix' },
        usage: {
          promptTokens: 1_000_000,
          completionTokens: 1_000_000,
          totalTokens: 2_000_000,
        },
      }); // Fallback succeeds

    const runner = buildRunner(
      mockCreator,
      mockCritic,
      mockCritic,
      {
        creator: 'gemini-3.6-flash',
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

    // Pro preview mock rates: $5.0 input, $6.0 output. With 1M tokens each, total is $11.0.
    expect(runner.getUsage().costUsd).toBeCloseTo(11.0);
  });

  it('successful passed=false critique does not trigger fallback and wasDegraded remains false', async () => {
    const mockCreator = {
      id: 'gemini-3.6-flash',
    } as unknown as aiModule.LanguageModel;
    const mockCritic = {
      id: 'claude-sonnet-4-6',
    } as unknown as aiModule.LanguageModel;
    const mockFallbackCritic = {
      id: 'gemini-3.1-pro-preview',
    } as unknown as aiModule.LanguageModel;

    (aiModule.generateText as jest.Mock).mockResolvedValueOnce({
      output: { score: 5, passed: false, actionableFix: 'fix' },
      usage: { totalTokens: 15 },
    });

    const runner = buildRunner(
      mockCreator,
      mockCritic,
      mockCritic,
      {
        creator: 'gemini-3.6-flash',
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
