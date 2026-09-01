import * as aiModule from 'ai';
import { buildRunner } from '../providers-env';

jest.mock('../pricing', () => ({
  PRICE_PER_MTOK: {},
}));

jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: {
    object: jest.fn(),
  },
}));

describe('planner-fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generate() retries on fallbackPlanner, ensuring ID is distinct, and reports degraded', async () => {
    const mockCreator = { id: 'claude-sonnet-4-6' } as unknown as aiModule.LanguageModel;
    const mockCritic = { id: 'gemini-3.1-pro' } as unknown as aiModule.LanguageModel;
    const mockAdjudicator = { id: 'gemini-3.1-pro' } as unknown as aiModule.LanguageModel;
    const mockFallbackPlanner = { id: 'gemini-3.6-flash' } as unknown as aiModule.LanguageModel;

    const error429 = new Error('rate limit') as Error & { status?: number };
    error429.status = 429;

    (aiModule.generateText as jest.Mock)
      .mockRejectedValueOnce(error429) // Original planner fails
      .mockResolvedValueOnce({
        text: 'fallback planner result',
        usage: { totalTokens: 100 },
      });

    const runner = buildRunner(
      mockCreator,
      mockCritic,
      mockAdjudicator,
      {
        creator: 'claude-sonnet-4-6',
        critic: 'gemini-3.1-pro',
        adjudicator: 'gemini-3.1-pro',
      },
      undefined, // fallbackCritic
      undefined, // createModelFn
      mockFallbackPlanner,
      'gemini-3.6-flash' // fallbackPlannerId
    );

    expect(runner.wasDegraded()).toBe(false);

    const result = await runner.generate('prompt', 'system');
    
    expect(result).toBe('fallback planner result');
    expect(runner.wasDegraded()).toBe(true);

    // Assert that the distinct fallbackPlanner was called
    expect(aiModule.generateText).toHaveBeenCalledTimes(2);
    expect(aiModule.generateText).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: mockFallbackPlanner,
      })
    );

    // Verify distinct IDs
    expect((mockFallbackPlanner as any).id).not.toBe((mockCritic as any).id);
  });

  it('generate() rethrows when fallbackPlanner is undefined (no second credentialed slot)', async () => {
    const mockCreator = { id: 'claude-sonnet-4-6' } as unknown as aiModule.LanguageModel;
    const mockCritic = { id: 'gemini-3.1-pro' } as unknown as aiModule.LanguageModel;
    const mockAdjudicator = { id: 'gemini-3.1-pro' } as unknown as aiModule.LanguageModel;

    const error429 = new Error('rate limit') as Error & { status?: number };
    error429.status = 429;

    (aiModule.generateText as jest.Mock).mockRejectedValueOnce(error429);

    const runner = buildRunner(
      mockCreator,
      mockCritic,
      mockAdjudicator,
      {
        creator: 'claude-sonnet-4-6',
        critic: 'gemini-3.1-pro',
        adjudicator: 'gemini-3.1-pro',
      },
      undefined, // fallbackCritic
      undefined, // createModelFn
      undefined, // fallbackPlanner
      undefined // fallbackPlannerId
    );

    await expect(runner.generate('prompt', 'system')).rejects.toThrow('rate limit');
    
    expect(runner.wasDegraded()).toBe(false);
    expect(aiModule.generateText).toHaveBeenCalledTimes(1);
  });
});
