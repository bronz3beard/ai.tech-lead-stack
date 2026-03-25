import { Telemetry } from '../telemetry';

// Mock child_process to prevent actual shell commands
jest.mock('child_process', () => ({
  execSync: jest.fn().mockImplementation((command: string) => {
    if (command.includes('gh api user')) {
      return Buffer.from('testuser@example.com\n');
    }
    return Buffer.from('');
  }),
}));

// Mock trace-utils
jest.mock('../../lib/trace-utils', () => ({
  isSkillTrace: jest.fn().mockReturnValue(false),
}));

// Mock langfuse
const mockUpdate = jest.fn();
const mockGeneration = jest.fn();
const mockTrace = jest.fn(() => ({
  update: mockUpdate,
  generation: mockGeneration,
}));
const mockFlushAsync = jest.fn();

jest.mock('langfuse', () => {
  return {
    Langfuse: jest.fn().mockImplementation(() => ({
      trace: mockTrace,
      flushAsync: mockFlushAsync,
    })),
  };
});

describe('Telemetry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      LANGFUSE_PUBLIC_KEY: 'test-pub-key',
      LANGFUSE_SECRET_KEY: 'test-sec-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should initialize successfully when env vars are present', () => {
    const telemetry = new Telemetry();
    expect(telemetry['isConfigured']).toBe(true);
    expect(telemetry['langfuse']).not.toBeNull();
  });

  it('should not initialize if keys are placeholders', () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'placeholder';
    process.env.LANGFUSE_SECRET_KEY = 'placeholder';
    const telemetry = new Telemetry();
    expect(telemetry['isConfigured']).toBe(false);
  });

  describe('withAnalytics', () => {
    it('should wrap successful execution and log analytics', async () => {
      const telemetry = new Telemetry();
      const mockCallback = jest.fn().mockResolvedValue('SuccessResult');

      const result = await telemetry.withAnalytics(
        'test-skill',
        'test-project',
        'test-model',
        'test-agent',
        mockCallback
      );

      expect(result).toBe('SuccessResult');
      expect(mockCallback).toHaveBeenCalled();

      expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({
        name: 'skill:test-skill',
        userId: 'testuser@example.com',
      }));

      expect(mockGeneration).toHaveBeenCalledWith(expect.objectContaining({
        name: 'generation:test-skill',
        output: 'SuccessResult',
      }));

      expect(mockUpdate).toHaveBeenCalledWith({
        output: 'Skill test-skill executed successfully.',
      });

      expect(mockFlushAsync).toHaveBeenCalled();
    });

    it('should handle errors in callback and trace them', async () => {
      const telemetry = new Telemetry();
      const mockError = new Error('Skill execution failed');
      const mockCallback = jest.fn().mockRejectedValue(mockError);

      await expect(
        telemetry.withAnalytics(
          'test-skill-error',
          'test-project',
          'test-model',
          'test-agent',
          mockCallback
        )
      ).rejects.toThrow('Skill execution failed');

      expect(mockCallback).toHaveBeenCalled();

      expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({
        name: 'skill:test-skill-error',
      }));

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        output: 'Error executing skill test-skill-error: Skill execution failed',
        metadata: expect.objectContaining({
          error: 'Skill execution failed',
          stack: mockError.stack,
        }),
      }));

      expect(mockFlushAsync).toHaveBeenCalled();
    });

    it('should handle non-Error thrown objects', async () => {
      const telemetry = new Telemetry();
      const mockCallback = jest.fn().mockRejectedValue('String error');

      await expect(
        telemetry.withAnalytics(
          'test-skill-string-error',
          'test-project',
          'test-model',
          'test-agent',
          mockCallback
        )
      ).rejects.toEqual('String error');

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        output: 'Error executing skill test-skill-string-error: String error',
        metadata: expect.objectContaining({
          error: 'String error',
        }),
      }));

      expect(mockFlushAsync).toHaveBeenCalled();
    });
  });
});
