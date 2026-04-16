import { telemetryService, TelemetryService, withAnalytics } from '../telemetry-service';
import { prisma } from '../prisma';
import { Langfuse } from 'langfuse';

jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    analyticsEvent: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('langfuse', () => {
  return {
    Langfuse: jest.fn().mockImplementation(() => ({
      trace: jest.fn(() => ({
        id: 'test-trace-id',
        generation: jest.fn(),
      })),
      flushAsync: jest.fn().mockResolvedValue(undefined),
      getTrace: jest.fn(),
    })),
  };
});

describe('TelemetryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be a singleton', () => {
    const instance1 = TelemetryService.getInstance();
    const instance2 = TelemetryService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should record an event to Prisma and Langfuse', async () => {
    (prisma.analyticsEvent.create as jest.Mock).mockResolvedValue({ id: 'event-123' });

    const params = {
      skillName: 'Test Skill',
      projectName: 'Test Project',
      duration: 1.5,
      status: 'SUCCESS' as const,
      userEmail: 'test@example.com',
    };

    const result = await telemetryService.recordEvent(params);

    expect(result).toBeDefined();
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          skillName: 'test-skill', 
          projectName: 'test-project', 
          status: 'SUCCESS',
        }),
      })
    );
  });

  describe('withAnalytics', () => {
    it('should wrap a successful skill execution', async () => {
      const mockSkill = jest.fn().mockResolvedValue('Success!');
      const wrappedSkill = await withAnalytics(
        'test-skill', 
        { userId: 'user-123', projectName: 'Test Project' }, 
        mockSkill
      );

      const result = await wrappedSkill('test-input');
      expect(result).toBe('Success!');
      expect(mockSkill).toHaveBeenCalledWith('test-input');
    });

    it('should handle error in skill execution', async () => {
      const mockSkill = jest.fn().mockRejectedValue(new Error('Failed'));
      const wrappedSkill = await withAnalytics('test-skill', { userId: 'user-123' }, mockSkill);

      await expect(wrappedSkill('test-input')).rejects.toThrow('Failed');
    });
  });
});

