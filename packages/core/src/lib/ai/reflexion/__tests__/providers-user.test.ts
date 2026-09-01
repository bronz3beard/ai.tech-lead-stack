import { runnerFromUser } from '../providers-user';
import { User, Project } from '@prisma/client';

describe('runnerFromUser end-to-end model routing precedence', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MODEL_PLANNER;
    delete process.env.MODEL_AUDITOR;
    delete process.env.MODEL_ADJUDICATOR;
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('honours project settings over user settings and system defaults (confirm creator model is Opus)', () => {
    const mockUser: User = {
      id: 'user-1',
      settings: {
        tier: 'sub-pro',
        modelRouting: {
          planner: 'gemini-3.6-flash',
          auditor: 'claude-haiku-4-5',
        },
      },
    } as any;

    const mockProject: Project = {
      id: 'proj-1',
      settings: {
        modelRouting: {
          planner: 'claude-opus-4-6',
        },
      },
    } as any;

    const runner = runnerFromUser(mockUser, mockProject);
    expect(runner.models.creator).toBe('claude-opus-4-6');
    expect(runner.models.critic).toBe('claude-haiku-4-5');
  });
});
