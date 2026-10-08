import { buildAnalyticsWhere, toTraceData } from '../analytics-service';

jest.mock('@zenithfoundry/tech-lead-stack/db', () => ({ prisma: {} }));

type Row = Parameters<typeof toTraceData>[0];

const row = (overrides: Partial<Row>): Row => ({
  id: 'evt-1',
  skillName: 'reflexion-loop',
  userId: null,
  model: 'claude-sonnet-5-5',
  agent: 'claude',
  duration: 1.5,
  status: 'SUCCESS',
  error: null,
  promptTokens: 10,
  completionTokens: 5,
  totalTokens: 15,
  totalCost: null,
  langfuseTraceId: 'random-per-row-id',
  metadata: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  projectId: null,
  projectName: 'tech-lead-stack',
  actorType: null,
  autonomy: null,
  loopRunId: null,
  loopPhase: null,
  teamRole: null,
  kind: null,
  provider: null,
  sessionId: null,
  gitBranch: null,
  prNumber: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  reasoningTokens: null,
  costIsEstimate: true,
  environment: 'production',
  ...overrides,
});

describe('buildAnalyticsWhere', () => {
  it('applies no access restriction for an unrestricted (admin) scope', () => {
    expect(buildAnalyticsWhere({ scope: null })).toEqual({});
  });

  it('limits a non-admin to their own events plus their accessible projects', () => {
    const where = buildAnalyticsWhere({
      scope: { userId: 'u1', projectNames: ['alpha', 'beta'] },
    });

    expect(where).toEqual({
      AND: [
        {
          OR: [
            { userId: 'u1' },
            { projectName: { in: ['alpha', 'beta'] } },
          ],
        },
      ],
    });
  });

  it('limits a non-admin with no project access to their own events only', () => {
    const where = buildAnalyticsWhere({
      scope: { userId: 'u1', projectNames: [] },
    });

    expect(where).toEqual({ AND: [{ OR: [{ userId: 'u1' }] }] });
  });

  it('keeps the access clause when a project outside the scope is requested', () => {
    const where = buildAnalyticsWhere({
      scope: { userId: 'u1', projectNames: ['alpha'] },
      projectName: 'Gamma',
    });

    // Both conditions are AND-ed, so a project outside the scope only yields the caller's own rows.
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { OR: [{ userId: 'u1' }, { projectName: { in: ['alpha'] } }] },
        { projectName: 'gamma' },
      ])
    );
  });

  it('prefers an explicit date range over a timeframe preset', () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const where = buildAnalyticsWhere({
      scope: null,
      timeframe: 'week',
      dateRange: { from },
    });

    expect(where).toEqual({ AND: [{ createdAt: { gte: from } }] });
  });

  it('ignores an unknown timeframe', () => {
    expect(buildAnalyticsWhere({ scope: null, timeframe: 'forever' })).toEqual({});
  });
});

describe('toTraceData', () => {
  it('returns the actor columns the dashboard filters on', () => {
    const trace = toTraceData(
      row({
        actorType: 'AGENT',
        autonomy: 'AUTONOMOUS',
        loopRunId: 'run-1',
        loopPhase: 'scored',
        teamRole: 'critic',
      })
    );

    expect(trace).toMatchObject({
      actorType: 'AGENT',
      autonomy: 'AUTONOMOUS',
      loopRunId: 'run-1',
      loopPhase: 'scored',
      teamRole: 'critic',
    });
  });

  it('groups sessions by sessionId, then chatId, then loopRunId — never the per-row trace id', () => {
    expect(toTraceData(row({ sessionId: 's-1', loopRunId: 'run-1' })).sessionId).toBe('s-1');
    expect(toTraceData(row({ metadata: { chatId: 'chat-1' }, loopRunId: 'run-1' })).sessionId).toBe('chat-1');
    expect(toTraceData(row({ loopRunId: 'run-1' })).sessionId).toBe('run-1');
    expect(toTraceData(row({})).sessionId).toBeUndefined();
  });

  it('reports a null cost as zero', () => {
    expect(toTraceData(row({ totalCost: null })).totalCost).toBe(0);
  });
});
