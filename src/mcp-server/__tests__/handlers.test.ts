import { Handlers } from '../handlers';
import { FileSystemService } from '../../lib/skills/fs-service';
import { Telemetry } from '../telemetry';
import { KiService } from '../../lib/ki/ki-service';
import { AlignmentService } from '../../lib/skills/alignment-service';
import { prisma } from '../../lib/prisma';
import { runnerFromEnv } from '../../lib/ai/reflexion/providers-env';

jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../telemetry');
jest.mock('../../lib/skills/fs-service');
jest.mock('../../lib/ki/ki-service');
jest.mock('../../lib/skills/alignment-service');

jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../lib/ai/reflexion/engine', () => ({
  runReflexion: jest.fn().mockResolvedValue({
    runId: 'run-1',
    verdict: 'APPROVED',
  }),
  resumeReflexion: jest.fn(),
}));

jest.mock('../../lib/ai/reflexion/providers-env', () => {
  const actual = jest.requireActual('../../lib/ai/reflexion/providers-env');
  return {
    ...actual,
    runnerFromEnv: jest
      .fn()
      .mockImplementation((ctx) => actual.runnerFromEnv(ctx)),
  };
});

describe('Handlers.handleReflexionLoop project model routing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.MODEL_PLANNER;
    delete process.env.MODEL_AUDITOR;
    delete process.env.MODEL_ADJUDICATOR;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses Project.settings.modelRouting.planner when projectName resolves', async () => {
    const mockFsService = new FileSystemService(
      'root'
    ) as jest.Mocked<FileSystemService>;
    const mockTelemetry = new Telemetry() as jest.Mocked<Telemetry>;
    const mockKiService = new KiService() as jest.Mocked<KiService>;
    const mockAlignmentService = new AlignmentService(
      'root'
    ) as jest.Mocked<AlignmentService>;

    const handlers = new Handlers(
      mockFsService,
      mockTelemetry,
      mockAlignmentService,
      mockKiService
    );

    (prisma.project.findFirst as jest.Mock).mockResolvedValue({
      id: 'proj-123',
      name: 'my-project',
      settings: {
        modelRouting: {
          planner: 'claude-opus-4-6',
        },
      },
    });

    const res = await handlers.handleReflexionLoop({
      brief: 'Implement a new feature in the codebase',
      projectName: 'my-project',
    });

    expect(res.isError).toBeFalsy();
    expect(runnerFromEnv).toHaveBeenCalledWith(
      expect.objectContaining({
        project: expect.objectContaining({
          id: 'proj-123',
          settings: {
            modelRouting: {
              planner: 'claude-opus-4-6',
            },
          },
        }),
      })
    );

    const callResult = (runnerFromEnv as jest.Mock).mock.results[0].value;
    expect(callResult.models.creator).toBe('claude-opus-4-6');
  });
});
