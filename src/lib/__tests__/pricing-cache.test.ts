import { buildRunner } from '../ai/reflexion/providers-env';
import { MODELS } from '../../app/api/chat/constants';
import type { LanguageModel } from 'ai';

// Mock the 'ai' module so we can intercept generateText
jest.mock('ai', () => ({
  ...jest.requireActual('ai'),
  generateText: jest.fn(),
  Output: {
    object: jest.fn(),
  },
}));

import { generateText } from 'ai';

describe('Reflexion pricing cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bills cached tokens at a lower rate than fresh tokens', async () => {
    const dummyModel = {} as LanguageModel;
    const runner = buildRunner(dummyModel, dummyModel, dummyModel, {
      creator: MODELS.CLAUDE,
      critic: MODELS.CLAUDE,
      adjudicator: MODELS.CLAUDE,
    });

    const mockGenerateText = generateText as jest.Mock;
    
    // Simulate a fresh request: 1000 input, 100 output
    mockGenerateText.mockResolvedValueOnce({
      text: 'hello',
      usage: {
        promptTokens: 1000,
        completionTokens: 100,
        totalTokens: 1100,
      },
    });

    await runner.generate('prompt', 'system');
    const freshUsage = runner.getUsage();
    
    // Fresh cost: 
    // Input: (1000 / 1000000) * 3.0 = 0.003
    // Output: (100 / 1000000) * 15.0 = 0.0015
    // Total: 0.0045
    expect(freshUsage.costUsd).toBeCloseTo(0.0045);
    expect(freshUsage.cachedReadTokens).toBe(0);

    // Now simulate a request with cache reads: 1000 input (800 read, 0 write), 100 output
    mockGenerateText.mockResolvedValueOnce({
      text: 'hello',
      usage: {
        promptTokens: 1000,
        completionTokens: 100,
        totalTokens: 1100,
        providerMetadata: {
          anthropic: {
            cacheReadInputTokens: 800,
            cacheCreationInputTokens: 0,
          },
        },
      },
    });

    await runner.generate('prompt', 'system');
    const cachedUsage = runner.getUsage();

    // The incremental cost should be:
    // Fresh input: (200 / 1000000) * 3.0 = 0.0006
    // Cached input: (800 / 1000000) * 0.3 = 0.00024
    // Output: (100 / 1000000) * 15.0 = 0.0015
    // Total for this request: 0.00234
    // Total combined: 0.0045 + 0.00234 = 0.00684
    expect(cachedUsage.costUsd).toBeCloseTo(0.00684);
    
    // Cached read tokens should accumulate
    expect(cachedUsage.cachedReadTokens).toBe(800);
    
    // Savings: 800 tokens billed at 0.3 instead of 3.0 = 800/1000000 * 2.7 = 0.00216
    expect(cachedUsage.estimatedCacheSavingsUsd).toBeCloseTo(0.00216);
  });

  it('handles Google caching correctly and suppresses false warnings', async () => {
    const dummyModel = {} as LanguageModel;
    const runner = buildRunner(dummyModel, dummyModel, dummyModel, {
      creator: MODELS.GEMINI,
      critic: MODELS.GEMINI,
      adjudicator: MODELS.GEMINI,
    });

    const mockGenerateText = generateText as jest.Mock;
    
    // Simulate a request with Google cache reads: 1000 input (800 read, 0 write), 100 output
    mockGenerateText.mockResolvedValueOnce({
      text: 'hello',
      usage: {
        promptTokens: 1000,
        completionTokens: 100,
        totalTokens: 1100,
        providerMetadata: {
          google: {
            cachedContentTokenCount: 800,
          },
        },
      },
    });

    const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    
    await runner.generate('prompt', 'A'.repeat(4096 * 4)); // >= 4096 tokens
    
    const usage = runner.getUsage();
    
    // Fresh cost: (200 / 1000000) * 1.5 = 0.0003
    // Cached input: (800 / 1000000) * 0.375 = 0.0003
    // Output: (100 / 1000000) * 9.0 = 0.0009
    // Total: 0.0015
    expect(usage.costUsd).toBeCloseTo(0.0015);
    expect(usage.cachedReadTokens).toBe(800);
    expect(usage.estimatedCacheSavingsUsd).toBeCloseTo((800 / 1000000) * (1.5 - 0.375));
    
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Gemini implicit caching is expected to apply')
    );
    
    consoleDebugSpy.mockRestore();
  });

  it('sets cacheControl breakpoint for Anthropic models on the stable span', async () => {
    const dummyModel = {} as LanguageModel;
    const runner = buildRunner(dummyModel, dummyModel, dummyModel, {
      creator: MODELS.CLAUDE,
      critic: MODELS.CLAUDE,
      adjudicator: MODELS.CLAUDE,
    });

    const mockGenerateText = generateText as jest.Mock;
    mockGenerateText.mockResolvedValueOnce({
      text: 'hello',
      usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
    });

    await runner.generate('PROJECT STACK CONTEXT\ncontext\nBRIEF:\nbrief', 'system');

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'system\n\nPROJECT STACK CONTEXT\ncontext',
        prompt: 'BRIEF:\nbrief',
        experimental_providerMetadata: {
          anthropic: { cacheControl: { type: 'ephemeral' } }
        }
      })
    );
  });
});
