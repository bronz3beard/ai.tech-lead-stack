import { telemetryService } from '@/lib/telemetry-service';
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
  ...jest.requireActual('../../lib/trace-utils'),
  isSkillTrace: jest.fn().mockReturnValue(false),
}));

// Mock telemetryService from the library
jest.mock('@/lib/telemetry-service', () => ({
  telemetryService: {
    recordEvent: jest.fn().mockResolvedValue({ id: 'mock-event-id' }),
  },
}));

describe('Telemetry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
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
        'high',
        mockCallback
      );

      expect(result).toBe('SuccessResult');
      expect(mockCallback).toHaveBeenCalled();

      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          skillName: 'test-skill',
          projectName: 'test-project',
          model: 'test-model',
          agent: 'test-agent',
          status: 'SUCCESS',
          metadata: expect.objectContaining({
            skillCost: 'high',
            source: 'mcp',
          }),
        })
      );
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
          undefined,
          mockCallback
        )
      ).rejects.toThrow('Skill execution failed');

      expect(mockCallback).toHaveBeenCalled();

      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          skillName: 'test-skill-error',
          status: 'ERROR',
          error: 'Skill execution failed',
        })
      );
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
          undefined,
          mockCallback
        )
      ).rejects.toEqual('String error');

      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          skillName: 'test-skill-string-error',
          status: 'ERROR',
          error: 'String error',
        })
      );
    });
  });
});
