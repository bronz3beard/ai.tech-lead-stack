import { resolveGeminiApiKeys } from '../utils';

describe('resolveGeminiApiKeys', () => {
  const originalEnv = process.env;
  let mockDecrypt: jest.Mock;

  beforeEach(() => {
    jest.resetModules(); // clears the cache
    process.env = { ...originalEnv };
    mockDecrypt = jest.fn((ciphertext: string) => `decrypted_${ciphertext}`);

    // Mock console.info
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('throws an error if no API key is configured', () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    expect(() => {
      resolveGeminiApiKeys({ geminiApiKey: null }, mockDecrypt);
    }).toThrow('No Gemini API key configured');
  });

  it('returns environment key if no user key is present', () => {
    process.env.GEMINI_API_KEY = 'env_gemini_key';

    const result = resolveGeminiApiKeys({ geminiApiKey: null }, mockDecrypt);

    expect(result).toEqual(['env_gemini_key']);
    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it('returns google generative ai environment key if gemini environment key is absent', () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'env_google_key';

    const result = resolveGeminiApiKeys({ geminiApiKey: null }, mockDecrypt);

    expect(result).toEqual(['env_google_key']);
  });

  it('returns db key if no environment key is present', () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    const user = { geminiApiKey: 'db_secret' };
    const result = resolveGeminiApiKeys(user, mockDecrypt);

    expect(result).toEqual(['decrypted_db_secret']);
    expect(mockDecrypt).toHaveBeenCalledWith('db_secret');
  });

  it('returns both keys with user key first by default', () => {
    process.env.GEMINI_API_KEY = 'env_key';
    delete process.env.GEMINI_API_KEY_PRECEDENCE;

    const user = { geminiApiKey: 'db_secret' };
    const result = resolveGeminiApiKeys(user, mockDecrypt);

    expect(result).toEqual(['decrypted_db_secret', 'env_key']);
  });

  it('returns both keys with env key first when precedence is env', () => {
    process.env.GEMINI_API_KEY = 'env_key';
    process.env.GEMINI_API_KEY_PRECEDENCE = 'env';

    const user = { geminiApiKey: 'db_secret' };
    const result = resolveGeminiApiKeys(user, mockDecrypt);

    expect(result).toEqual(['env_key', 'decrypted_db_secret']);
  });

  it('logs info in development mode when keys are found', () => {
    process.env.NODE_ENV = 'development';
    process.env.GEMINI_API_KEY = 'env_key_very_long_for_masking';

    resolveGeminiApiKeys({ geminiApiKey: null }, mockDecrypt);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[chat] Gemini: Found 1 key(s). Preferred: env_...ng')
    );
  });

  it('does not log info in production mode', () => {
    process.env.NODE_ENV = 'production';
    process.env.GEMINI_API_KEY = 'env_key_very_long_for_masking';

    resolveGeminiApiKeys({ geminiApiKey: null }, mockDecrypt);

    expect(console.info).not.toHaveBeenCalled();
  });
});
