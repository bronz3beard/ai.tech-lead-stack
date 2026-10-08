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
          actorType: 'AGENT',
          autonomy: 'DIRECTED',
        })
      );
    });

    it('should propagate agentic telemetry overrides', async () => {
      const telemetry = new Telemetry();
      const mockCallback = jest.fn().mockResolvedValue('SuccessResult');

      await telemetry.withAnalytics(
        'test-skill',
        'test-project',
        'test-model',
        'test-agent',
        'high',
        mockCallback,
        {
          actorType: 'HUMAN',
          autonomy: 'AUTONOMOUS',
          loopRunId: 'test-run-123',
          loopPhase: 'critique',
          teamRole: 'developer',
        }
      );

      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'HUMAN',
          autonomy: 'AUTONOMOUS',
          loopRunId: 'test-run-123',
          loopPhase: 'critique',
          teamRole: 'developer',
        })
      );
    });

    it('records the served skill size as prompt tokens, with no completion tokens and as a skill invocation', async () => {
      const telemetry = new Telemetry();
      const skillText = 'x'.repeat(4000);

      await telemetry.withAnalytics(
        'planning-expert',
        'test-project',
        'claude-opus-5-5',
        'claude-code',
        '~1000 tokens',
        async () => skillText
      );

      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'skill_invocation',
          promptTokens: 1000,
          completionTokens: 0,
        })
      );
    });

    it('groups calls under the agent-supplied session id when given', async () => {
      const telemetry = new Telemetry();

      await telemetry.withAnalytics('a', 'p', 'm', 'g', undefined, async () => 'ok', {
        sessionId: 'agent-run-1',
      });

      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'agent-run-1' })
      );
    });

    it('falls back to one server session id across consecutive calls', async () => {
      const telemetry = new Telemetry();

      await telemetry.withAnalytics('a', 'p', 'm', 'g', undefined, async () => 'ok');
      await telemetry.withAnalytics('b', 'p', 'm', 'g', undefined, async () => 'ok');

      const calls = (telemetryService.recordEvent as jest.Mock).mock.calls;
      const [first, second] = calls.map((c) => c[0].sessionId);
      expect(first).toMatch(/^mcp-/);
      expect(second).toBe(first);
    });

    it('lets a caller label a non-skill tool call', async () => {
      const telemetry = new Telemetry();

      await telemetry.withAnalytics('plan_pipeline', undefined, undefined, undefined, 'unknown', async () => 'chain', {
        kind: 'tool_call',
      });

      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'tool_call' })
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
