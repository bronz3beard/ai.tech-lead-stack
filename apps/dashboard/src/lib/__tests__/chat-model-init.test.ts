import { initializeModel } from '@/app/api/chat/utils';
import { createModel } from '@/lib/ai/model-registry';
import { keyFor } from '@/lib/ai/model-resolver';
import { MODELS } from '@/app/api/chat/constants';
import { User } from '@prisma/client';

jest.mock('@/lib/ai/model-registry', () => ({
  createModel: jest.fn().mockReturnValue('mock-model'),
  providerOf: jest.requireActual('@/lib/ai/model-registry').providerOf,
  catalogEntry: jest.requireActual('@/lib/ai/model-registry').catalogEntry,
}));

jest.mock('@/lib/ai/model-resolver', () => ({
  keyFor: jest.fn(),
  slotForModel: jest.requireActual('@/lib/ai/model-resolver').slotForModel,
}));

jest.mock('@/lib/crypto', () => ({
  decrypt: jest.fn((c) => c), // pass-through for test
}));

describe('initializeModel', () => {
  let mockUser: User;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'test-user',
      preferredModel: 'gemini',
      geminiApiKey: 'test-gemini-key',
      claudeApiKey: 'test-claude-key',
      openaiApiKey: 'test-openai-key',
      julesApiKey: 'test-jules-key',
    } as any;
    
    (keyFor as jest.Mock).mockImplementation((slot) => `key-for-${slot}`);
  });

  it('initializes Gemini by default', async () => {
    mockUser.preferredModel = 'gemini';
    const model = await initializeModel(mockUser);
    expect(keyFor).toHaveBeenCalledWith('gemini', expect.anything());
    expect(createModel).toHaveBeenCalledWith(MODELS.GEMINI, 'key-for-gemini');
    expect(model).toBe('mock-model');
  });

  it('initializes Claude based on preference', async () => {
    mockUser.preferredModel = 'claude';
    const model = await initializeModel(mockUser);
    expect(keyFor).toHaveBeenCalledWith('anthropic', expect.anything());
    expect(createModel).toHaveBeenCalledWith(MODELS.CLAUDE, 'key-for-anthropic');
    expect(model).toBe('mock-model');
  });

  it('initializes OpenAI based on preference', async () => {
    mockUser.preferredModel = 'openai';
    const model = await initializeModel(mockUser);
    expect(keyFor).toHaveBeenCalledWith('openai', expect.anything());
    expect(createModel).toHaveBeenCalledWith(MODELS.OPENAI, 'key-for-openai');
    expect(model).toBe('mock-model');
  });

  it('initializes Jules based on preference', async () => {
    mockUser.preferredModel = 'jules';
    const model = await initializeModel(mockUser);
    expect(keyFor).toHaveBeenCalledWith('jules', expect.anything());
    expect(createModel).toHaveBeenCalledWith(MODELS.JULES, 'key-for-jules');
    expect(model).toBe('mock-model');
  });

  it('respects explicit modelId override', async () => {
    mockUser.preferredModel = 'gemini'; // fallback
    const model = await initializeModel(mockUser, 'claude-opus-4-6');
    expect(keyFor).toHaveBeenCalledWith('anthropic', expect.anything());
    expect(createModel).toHaveBeenCalledWith('claude-opus-4-6', 'key-for-anthropic');
    expect(model).toBe('mock-model');
  });
});
