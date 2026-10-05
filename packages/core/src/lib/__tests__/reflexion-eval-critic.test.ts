jest.mock('ai', () => ({
  ...jest.requireActual('ai'),
  generateText: jest.fn(),
}));
jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: jest.fn(() => (id: string) => ({ provider: 'anthropic', id })),
}));
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => (id: string) => ({ provider: 'google', id })),
}));

import { generateText } from 'ai';
import { buildCriticRunner } from '../../../scripts/reflexion-eval';
import { MODELS } from '../ai/constants';
import { CRITIC_SYSTEM } from '../ai/reflexion/prompts';
import type { Critique } from '../ai/reflexion/schema';

const mockGenerateText = generateText as jest.Mock;

const critique: Critique = {
  gstackDiagnosis: 8,
  atomicBatches: 8,
  productionEthos: 8,
  modernWeb: 8,
  score: 8,
  passed: true,
  actionableFix: '',
};

describe('reflexion-eval critic runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-anthropic';
    process.env.GEMINI_API_KEY = 'test-gemini';
    // The script loads the repo .env, which may set this; each test decides.
    delete process.env.REFLEXION_CRITIC_MODEL;
  });

  it('grades with generateText + Output.object on the default Claude critic', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: critique });

    const result = await buildCriticRunner()!.critique('the plan');

    expect(result).toEqual(critique);
    const call = mockGenerateText.mock.calls[0][0];
    expect(call.model).toEqual({ provider: 'anthropic', id: MODELS.CLAUDE });
    expect(call.system).toBe(CRITIC_SYSTEM);
    expect(call.output).toBeDefined();
    // generateObject's option; its presence would mean the old API is back.
    expect(call).not.toHaveProperty('schema');
  });

  it('uses REFLEXION_CRITIC_MODEL when it is set', async () => {
    process.env.REFLEXION_CRITIC_MODEL = 'claude-opus-5-5';
    mockGenerateText.mockResolvedValueOnce({ output: critique });

    await buildCriticRunner()!.critique('the plan');

    expect(mockGenerateText.mock.calls[0][0].model.id).toBe('claude-opus-5-5');
  });

  it('falls back to the Gemini critic when the Claude call fails', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('anthropic down'))
      .mockResolvedValueOnce({ output: critique });

    const result = await buildCriticRunner()!.critique('the plan');

    expect(result).toEqual(critique);
    expect(mockGenerateText.mock.calls[1][0].model).toEqual({
      provider: 'google',
      id: MODELS.GEMINI_FALLBACK_CRITIC,
    });
  });

  it('returns null when no API keys are configured', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;

    expect(buildCriticRunner()).toBeNull();
  });
});
