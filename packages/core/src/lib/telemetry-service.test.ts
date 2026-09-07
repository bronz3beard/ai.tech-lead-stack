import { prisma } from './prisma';
import {
  telemetryService,
  TelemetryService,
  withAnalytics,
} from './telemetry-service';

jest.mock('./prisma', () => ({
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

describe('TelemetryService', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should be a singleton', () => {
    const instance1 = TelemetryService.getInstance();
    const instance2 = TelemetryService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should record an event to Prisma and Langfuse', async () => {
    (prisma.analyticsEvent.create as jest.Mock).mockResolvedValue({
      id: 'event-123',
    });

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

  describe('model validation and pricing', () => {
    beforeEach(() => {
      (prisma.analyticsEvent.create as jest.Mock).mockClear();
    });

    it('should handle date-suffixed ids, prefix-only ids, and junk values correctly', async () => {
      (prisma.analyticsEvent.create as jest.Mock).mockResolvedValue({ id: 'event-123' });

      // 1. Date suffixed model in catalog
      await telemetryService.recordEvent({
        skillName: 'Test',
        model: 'claude-sonnet-4-6-20260101',
        agent: 'test-agent',
        duration: 1,
        status: 'SUCCESS',
        promptTokens: 1000000, // 1M tokens
        completionTokens: 1000000,
      });

      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'claude-sonnet-4-6', // normalized
            totalCost: 18, // 3 input + 15 output
          }),
        })
      );
      
      const firstCallArgs = (prisma.analyticsEvent.create as jest.Mock).mock.calls[0][0];
      expect(firstCallArgs.data.metadata.invalidModel).toBeUndefined();
      expect(firstCallArgs.data.metadata.pricingFallback).toBeUndefined();

      (prisma.analyticsEvent.create as jest.Mock).mockClear();

      // 2. Prefix-only model not in catalog, but matching a family for pricing
      await telemetryService.recordEvent({
        skillName: 'Test',
        model: 'gemini-3.7-flash', 
        agent: 'test-agent',
        duration: 1,
        status: 'SUCCESS',
        promptTokens: 1000000,
        completionTokens: 1000000,
      });

      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'gemini-3.7-flash', // kept verbatim
            totalCost: 4.5, // 0.75 input + 3.75 output
          }),
        })
      );

      const secondCallArgs = (prisma.analyticsEvent.create as jest.Mock).mock.calls[0][0];
      expect(secondCallArgs.data.metadata.invalidModel).toBeUndefined();
      expect(secondCallArgs.data.metadata.pricingFallback).toBeUndefined();

      (prisma.analyticsEvent.create as jest.Mock).mockClear();

      // 3. Junk value routed to agent
      await telemetryService.recordEvent({
        skillName: 'Test',
        model: 'test',
        duration: 1,
        status: 'SUCCESS',
        promptTokens: 10,
        completionTokens: 10,
      });

      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'unknown-model',
            agent: 'test', // routed to agent
            metadata: expect.objectContaining({
              invalidModel: 'test',
              pricingFallback: true,
            }),
          }),
        })
      );
      
      (prisma.analyticsEvent.create as jest.Mock).mockClear();
      
      // 4. "Antigravity" routed to agent
      await telemetryService.recordEvent({
        skillName: 'Test',
        model: 'Antigravity',
        duration: 1,
        status: 'SUCCESS',
      });
      
      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            model: 'unknown-model',
            agent: 'Antigravity', 
            metadata: expect.objectContaining({
              invalidModel: 'Antigravity',
            }),
          }),
        })
      );
    });
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
      const wrappedSkill = await withAnalytics(
        'test-skill',
        { userId: 'user-123' },
        mockSkill
      );

      await expect(wrappedSkill('test-input')).rejects.toThrow('Failed');
    });
  });
});
