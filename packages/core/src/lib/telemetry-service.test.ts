import { prisma } from './prisma';
import { telemetryService, TelemetryService } from './telemetry-service';

jest.mock('./prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    analyticsEvent: {
      create: jest.fn(),
    },
  },
}));

const createMock = prisma.analyticsEvent.create as jest.Mock;
const lastData = () => createMock.mock.calls[createMock.mock.calls.length - 1][0].data;

describe('TelemetryService', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    createMock.mockResolvedValue({ id: 'event-123' });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('is a singleton', () => {
    expect(TelemetryService.getInstance()).toBe(TelemetryService.getInstance());
  });

  it('records an event to Postgres with normalized names', async () => {
    const result = await telemetryService.recordEvent({
      skillName: 'Test Skill',
      kind: 'skill_invocation',
      projectName: 'Test Project',
      duration: 1.5,
      status: 'SUCCESS',
      userEmail: 'test@example.com',
    });

    expect(result).toEqual({ id: 'event-123' });
    expect(lastData()).toMatchObject({
      skillName: 'test-skill',
      projectName: 'test-project',
      status: 'SUCCESS',
      kind: 'skill_invocation',
    });
  });

  describe('cost', () => {
    it('records no cost for a skill invocation, whatever its token count', async () => {
      await telemetryService.recordEvent({
        skillName: 'planning-expert',
        kind: 'skill_invocation',
        model: 'claude-opus-5-5',
        duration: 0.1,
        status: 'SUCCESS',
        promptTokens: 1200,
      });

      expect(lastData()).toMatchObject({
        totalCost: null,
        costIsEstimate: true,
        promptTokens: 1200,
        completionTokens: 0,
        totalTokens: 1200,
      });
      expect(lastData().metadata.llmCall).toBe(false);
    });

    it('prices an LLM generation and marks provider usage at an exact rate as actual', async () => {
      await telemetryService.recordEvent({
        skillName: 'analysis:ask',
        kind: 'llm_generation',
        model: 'claude-sonnet-5-5',
        duration: 2,
        status: 'SUCCESS',
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        usageFromProvider: true,
      });

      // $2 input + $10 output per 1M tokens
      expect(lastData()).toMatchObject({ totalCost: 12, costIsEstimate: false, provider: 'anthropic' });
      expect(lastData().metadata.llmCall).toBe(true);
    });

    it('prices cache reads and writes at their own rates', async () => {
      await telemetryService.recordEvent({
        skillName: 'analysis:ask',
        kind: 'llm_generation',
        model: 'claude-sonnet-5-5',
        duration: 2,
        status: 'SUCCESS',
        promptTokens: 1_000_000, // includes the cached tokens below
        cacheReadTokens: 500_000,
        cacheWriteTokens: 100_000,
        completionTokens: 0,
        usageFromProvider: true,
      });

      // fresh 400k × $2 + read 500k × $0.20 + write 100k × $2.50 = 0.8 + 0.1 + 0.25
      expect(lastData().totalCost).toBeCloseTo(1.15, 6);
      expect(lastData()).toMatchObject({ cacheReadTokens: 500_000, cacheWriteTokens: 100_000 });
    });

    it('keeps an estimate flag when the model is priced by family fallback', async () => {
      await telemetryService.recordEvent({
        skillName: 'analysis:ask',
        kind: 'llm_generation',
        model: 'gemini-9-flash',
        duration: 1,
        status: 'SUCCESS',
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        usageFromProvider: true,
      });

      expect(lastData()).toMatchObject({ totalCost: 4.5, costIsEstimate: true, provider: 'google' });
      expect(lastData().metadata.pricingFallback).toBe(true);
    });

    it('records a null cost when the model has no known price', async () => {
      await telemetryService.recordEvent({
        skillName: 'analysis:ask',
        kind: 'llm_generation',
        model: 'Antigravity',
        duration: 1,
        status: 'SUCCESS',
        promptTokens: 10,
        completionTokens: 10,
      });

      expect(lastData()).toMatchObject({ totalCost: null, provider: null, model: 'unknown-model' });
    });
  });

  describe('environment', () => {
    const originalEnv = process.env;
    afterEach(() => {
      process.env = originalEnv;
    });

    it('tags rows written under Jest as test data', async () => {
      await telemetryService.recordEvent({ skillName: 'x', kind: 'tool_call', duration: 0, status: 'SUCCESS' });
      expect(lastData().environment).toBe('test');
    });

    it('uses TLS_TELEMETRY_ENV outside tests, defaulting to production', async () => {
      process.env = { ...originalEnv, NODE_ENV: 'production', TLS_TELEMETRY_ENV: undefined };
      await telemetryService.recordEvent({ skillName: 'x', kind: 'tool_call', duration: 0, status: 'SUCCESS' });
      expect(lastData().environment).toBe('production');
    });
  });

  it('stores session and git context columns', async () => {
    await telemetryService.recordEvent({
      skillName: 'planning-expert',
      kind: 'skill_invocation',
      duration: 0,
      status: 'SUCCESS',
      sessionId: 'mcp-abc',
      gitBranch: 'feat/x',
      prNumber: 42,
    });

    expect(lastData()).toMatchObject({ sessionId: 'mcp-abc', gitBranch: 'feat/x', prNumber: 42 });
  });

  describe('model validation', () => {
    it('normalizes date-suffixed catalog ids', async () => {
      await telemetryService.recordEvent({
        skillName: 'Test',
        kind: 'llm_generation',
        model: 'claude-sonnet-4-6-20260101',
        agent: 'test-agent',
        duration: 1,
        status: 'SUCCESS',
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
      });

      expect(lastData()).toMatchObject({ model: 'claude-sonnet-4-6', totalCost: 18 }); // 3 + 15
      expect(lastData().metadata.invalidModel).toBeUndefined();
      expect(lastData().metadata.pricingFallback).toBeUndefined();
    });

    it('keeps an uncatalogued id with a provider prefix verbatim', async () => {
      await telemetryService.recordEvent({
        skillName: 'Test',
        kind: 'llm_generation',
        model: 'gemini-3.7-flash',
        agent: 'test-agent',
        duration: 1,
        status: 'SUCCESS',
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
      });

      expect(lastData()).toMatchObject({ model: 'gemini-3.7-flash', totalCost: 4.5 }); // 0.75 + 3.75
    });

    it('routes a junk model value to the agent field', async () => {
      await telemetryService.recordEvent({
        skillName: 'Test',
        kind: 'skill_invocation',
        model: 'test',
        duration: 1,
        status: 'SUCCESS',
      });

      expect(lastData()).toMatchObject({ model: 'unknown-model', agent: 'test' });
      expect(lastData().metadata.invalidModel).toBe('test');
    });

    it('routes an agent name passed as the model to the agent field', async () => {
      await telemetryService.recordEvent({
        skillName: 'Test',
        kind: 'skill_invocation',
        model: 'Antigravity',
        duration: 1,
        status: 'SUCCESS',
      });

      expect(lastData()).toMatchObject({ model: 'unknown-model', agent: 'Antigravity' });
    });
  });
});
