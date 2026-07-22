import {
  resolveModelWithSource,
  resolveModelId,
  ResolveCtx,
} from '../model-resolver';

describe('model-resolver', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.MODEL_PLANNER;
    delete process.env.REFLEXION_CREATOR_MODEL;
    delete process.env.REQUIREMENTS_DEVELOPMENT_MODEL;
    delete process.env.MODEL_IMPLEMENTER;
    delete process.env.MODEL_AUDITOR;
    delete process.env.REFLEXION_CRITIC_MODEL;
    delete process.env.CODE_AUDIT_MODEL;
    delete process.env.MODEL_ADJUDICATOR;
    delete process.env.REFLEXION_ADJUDICATOR_MODEL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns source='env' when MODEL_PLANNER is set in process.env", () => {
    process.env.MODEL_PLANNER = 'claude-sonnet-4-6';

    const ctx: ResolveCtx = {
      project: {
        settings: { modelRouting: { planner: 'gemini-3.5-flash' } },
      } as any,
      user: { settings: { modelRouting: { planner: 'gpt-5.4' } } } as any,
    };

    const resolved = resolveModelWithSource('planner', ctx);
    expect(resolved).toEqual({
      id: 'claude-sonnet-4-6',
      source: 'env',
    });
    expect(resolveModelId('planner', ctx)).toBe('claude-sonnet-4-6');
  });

  it("returns source='project' when Project.settings has modelRouting", () => {
    const ctx: ResolveCtx = {
      project: {
        settings: { modelRouting: { planner: 'claude-opus-4-6' } },
      } as any,
      user: {
        settings: { modelRouting: { planner: 'gemini-3.5-flash' } },
      } as any,
    };

    const resolved = resolveModelWithSource('planner', ctx);
    expect(resolved).toEqual({
      id: 'claude-opus-4-6',
      source: 'project',
    });
    expect(resolveModelId('planner', ctx)).toBe('claude-opus-4-6');
  });

  it("returns source='user' when User.settings has modelRouting", () => {
    const ctx: ResolveCtx = {
      user: {
        settings: { modelRouting: { planner: 'claude-haiku-4-5' } },
      } as any,
    };

    const resolved = resolveModelWithSource('planner', ctx);
    expect(resolved).toEqual({
      id: 'claude-haiku-4-5',
      source: 'user',
    });
    expect(resolveModelId('planner', ctx)).toBe('claude-haiku-4-5');
  });

  it("falls back to legacy User columns (requirementsModel & auditModel) with source='user'", () => {
    const ctx: ResolveCtx = {
      user: {
        requirementsModel: 'claude',
        auditModel: 'gemini',
      } as any,
    };

    const plannerRes = resolveModelWithSource('planner', ctx);
    expect(plannerRes.source).toBe('user');
    expect(plannerRes.id).toBe('claude-sonnet-4-6'); // normalized from legacy 'claude' (MODELS.CLAUDE)

    const auditorRes = resolveModelWithSource('auditor', ctx);
    expect(auditorRes.source).toBe('user');
    expect(auditorRes.id).toBe('gemini-3.5-flash'); // normalized from legacy
  });

  it("returns source='default' for all responsibilities when nothing is set", () => {
    for (const role of [
      'planner',
      'implementer',
      'auditor',
      'adjudicator',
    ] as const) {
      const resolved = resolveModelWithSource(role, {});
      expect(resolved.source).toBe('default');
      expect(resolved.id).toBeDefined();
    }
  });

  it('verifies exact precedence hierarchy across all layers: env > project > user > legacy > default', () => {
    const fullCtx: ResolveCtx = {
      project: {
        settings: {
          modelRouting: {
            planner: 'gemini-3.5-flash',
            implementer: 'gpt-5.4',
          },
        },
      } as any,
      user: {
        settings: {
          modelRouting: {
            planner: 'claude-haiku-4-5',
            auditor: 'claude-sonnet-4-6',
          },
        },
      } as any,
    };

    // Env override
    process.env.MODEL_PLANNER = 'claude-opus-4-6';

    expect(resolveModelWithSource('planner', fullCtx)).toEqual({
      id: 'claude-opus-4-6',
      source: 'env',
    });
    expect(resolveModelWithSource('implementer', fullCtx)).toEqual({
      id: 'gpt-5.4',
      source: 'project',
    });
    expect(resolveModelWithSource('auditor', fullCtx)).toEqual({
      id: 'claude-sonnet-4-6',
      source: 'user',
    });
    expect(resolveModelWithSource('adjudicator', fullCtx).source).toBe(
      'default'
    );
  });
});
