import { resolveGeminiApiKeys, isQuotaError, getErrorMessage } from '../utils';

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
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });
    process.env.GEMINI_API_KEY = 'env_key_very_long_for_masking';

    resolveGeminiApiKeys({ geminiApiKey: null }, mockDecrypt);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining(
        '[chat] Gemini: Found 1 key(s). Preferred: env_...ng'
      )
    );
  });

  it('does not log info in production mode', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    });
    process.env.GEMINI_API_KEY = 'env_key_very_long_for_masking';

    resolveGeminiApiKeys({ geminiApiKey: null }, mockDecrypt);

    expect(console.info).not.toHaveBeenCalled();
  });
});

describe('getErrorMessage', () => {
  it('returns error.message if the input is an Error instance', () => {
    const error = new Error('Standard error message');
    expect(getErrorMessage(error)).toBe('Standard error message');
  });

  it('extracts message from an object with error.message', () => {
    const error = { error: { message: 'Nested error.message' } };
    expect(getErrorMessage(error)).toBe('Nested error.message');
  });

  it('extracts message from an object with a direct message property', () => {
    const error = { message: 'Direct message property' };
    expect(getErrorMessage(error)).toBe('Direct message property');
  });

  it('extracts message from an object with data.error.message', () => {
    const error = { data: { error: { message: 'Data error message' } } };
    expect(getErrorMessage(error)).toBe('Data error message');
  });

  it('extracts message from an object with response.data.error.message', () => {
    const error = {
      response: { data: { error: { message: 'Response data error message' } } },
    };
    expect(getErrorMessage(error)).toBe('Response data error message');
  });

  it('stringifies an object if no matching message properties are found', () => {
    const error = { someOtherField: 'Unexpected format', code: 500 };
    expect(getErrorMessage(error)).toBe(JSON.stringify(error));
  });

  it('returns a string representation for a simple string input', () => {
    const error = 'Just a simple string error';
    expect(getErrorMessage(error)).toBe('Just a simple string error');
  });

  it('returns a string representation for a number input', () => {
    const error = 404;
    expect(getErrorMessage(error)).toBe('404');
  });

  it('returns a string representation for null input', () => {
    const error = null;
    expect(getErrorMessage(error)).toBe('null');
  });

  it('returns a string representation for undefined input', () => {
    const error = undefined;
    expect(getErrorMessage(error)).toBe('undefined');
  });
});

describe('getErrorMessage', () => {
  it('should handle standard Error objects', () => {
    expect(getErrorMessage(new Error('Standard error'))).toBe('Standard error');
  });

  it('should extract message from nested AI SDK structures', () => {
    expect(getErrorMessage({ error: { message: 'Nested error' } })).toBe(
      'Nested error'
    );
    expect(
      getErrorMessage({ data: { error: { message: 'Data error' } } })
    ).toBe('Data error');
    expect(
      getErrorMessage({
        response: { data: { error: { message: 'Response error' } } },
      })
    ).toBe('Response error');
  });

  it('should fallback to stringification for objects without message field', () => {
    expect(getErrorMessage({ someField: 'value' })).toBe(
      '{"someField":"value"}'
    );
  });

  it('should stringify primitive types', () => {
    expect(getErrorMessage('String error')).toBe('String error');
    expect(getErrorMessage(123)).toBe('123');
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
  });

  it('should handle circular structures gracefully by stringifying what it can or catching', () => {
    const circular: any = { field: 'value' };
    circular.self = circular;
    // The function should gracefully handle circular structures by falling back to String()
    expect(() => getErrorMessage(circular)).not.toThrow();
    expect(getErrorMessage(circular)).toBe('[object Object]');
  });
});

describe('isQuotaError', () => {
  it('should return false for falsy values', () => {
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
    expect(isQuotaError(false)).toBe(false);
    expect(isQuotaError('')).toBe(false);
    expect(isQuotaError(0)).toBe(false);
  });

  it('should identify direct status/code 429', () => {
    expect(isQuotaError({ status: 429 })).toBe(true);
    expect(isQuotaError({ statusCode: 429 })).toBe(true);
    expect(isQuotaError({ code: 429 })).toBe(true);
    expect(isQuotaError({ error_code: 429 })).toBe(true);
    expect(isQuotaError({ status: '429' })).toBe(true);
  });

  it('should identify Resource Exhausted string codes', () => {
    expect(isQuotaError({ code: 'RESOURCE_EXHAUSTED' })).toBe(true);
    expect(isQuotaError({ status: 'RATE_LIMIT_EXCEEDED' })).toBe(true);
    expect(isQuotaError({ code: 'FORBIDDEN' })).toBe(true);
    expect(isQuotaError({ reason: 'resource_exhausted' })).toBe(true);
    expect(isQuotaError({ reason: 'RATE_LIMIT_EXCEEDED' })).toBe(true);
  });

  it('should identify quota issues via deep heuristic check', () => {
    expect(
      isQuotaError(
        new Error('OpenAI API returned an error: 429 Too Many Requests')
      )
    ).toBe(true);
    expect(
      isQuotaError({
        message:
          'You exceeded your current quota, please check your plan and billing details.',
      })
    ).toBe(true);
    expect(
      isQuotaError({ error: { message: 'Rate limit reached for requests' } })
    ).toBe(true);
    expect(
      isQuotaError({
        response: { data: { error: { message: 'resource exhausted' } } },
      })
    ).toBe(true);
  });

  it('should return false for non-quota errors', () => {
    expect(
      isQuotaError({ status: 500, message: 'Internal Server Error' })
    ).toBe(false);
    expect(
      isQuotaError({
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      })
    ).toBe(false);
    expect(isQuotaError(new Error('Network error'))).toBe(false);
    expect(
      isQuotaError({ data: { message: 'Invalid API key provided.' } })
    ).toBe(false);
  });

  it('should handle circular objects gracefully without crashing', () => {
    const circular: any = { status: 500, message: 'some error' };
    circular.self = circular;
    // The function should gracefully handle circular structures
    expect(() => isQuotaError(circular)).not.toThrow();
    expect(isQuotaError(circular)).toBe(false);

    const circularQuota: any = { status: 429 };
    circularQuota.self = circularQuota;
    expect(() => isQuotaError(circularQuota)).not.toThrow();
    expect(isQuotaError(circularQuota)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getChatTools — jsonSchema + inputSchema regression guard (Zod v4 + AI SDK v6)
//
// AI SDK v6 renamed `parameters` → `inputSchema` on the Tool type.
// These tests assert that each tool's inputSchema produces a valid JSON Schema
// object (type: 'object', with expected properties) when serialized.
//
// Error guarded: tools.0.custom.input_schema.type: Field required
// ---------------------------------------------------------------------------
jest.mock('@/lib/skills', () => ({
  skillsService: {
    getDynamicSkills: jest.fn().mockResolvedValue(new Map()),
    readSkill: jest.fn().mockResolvedValue(null),
    readFile: jest.fn().mockResolvedValue(''),
  },
}));

describe('getChatTools — inputSchema regression (Zod v4 + AI SDK v6)', () => {
  const { getChatTools } = require('../utils') as typeof import('../utils');

  function getJsonSchema(t: Record<string, unknown>): Record<string, unknown> {
    // AI SDK v6: the key is inputSchema, not parameters
    return (t.inputSchema as any).jsonSchema as Record<string, unknown>;
  }

  it('list_skills: inputSchema.jsonSchema.type is "object"', () => {
    const tools = getChatTools();
    const schema = getJsonSchema(tools.list_skills as any);
    expect(schema).toBeDefined();
    expect(schema.type).toBe('object');
  });

  it('get_skill: inputSchema.jsonSchema.type is "object" and has expected properties', () => {
    const tools = getChatTools();
    const schema = getJsonSchema(tools.get_skill as any);
    expect(schema.type).toBe('object');
    const props = schema.properties as Record<string, unknown>;
    expect(props.name).toBeDefined();
    expect(props.skillName).toBeDefined();
    expect(props.skill_id).toBeDefined();
    expect(props.type).toBeDefined();
  });

  it('read_file: inputSchema.jsonSchema.type is "object" and has path/filepath properties', () => {
    const tools = getChatTools();
    const schema = getJsonSchema(tools.read_file as any);
    expect(schema.type).toBe('object');
    const props = schema.properties as Record<string, unknown>;
    expect(props.path).toBeDefined();
    expect(props.filepath).toBeDefined();
  });

  it('no tool has a raw Zod v4 "def" key on its inputSchema (broken schema guard)', () => {
    const tools = getChatTools();
    for (const [name, t] of Object.entries(tools)) {
      const inputSchema = (t as any).inputSchema;
      expect(inputSchema?.def).toBeUndefined();
      expect(inputSchema?.jsonSchema).toBeDefined();
      if (inputSchema?.def !== undefined) {
        throw new Error(
          `Tool "${name}" has a raw Zod v4 "def" key — jsonSchema() wrapper is missing.`
        );
      }
    }
  });
});
