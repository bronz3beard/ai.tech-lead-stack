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

  describe('tier enforcement', () => {
    it('returns a structured refusal payload when tier ceiling is exceeded', async () => {
      const mockFsService = new FileSystemService('root') as jest.Mocked<FileSystemService>;
      const mockTelemetry = new Telemetry() as jest.Mocked<Telemetry>;
      const mockKiService = new KiService() as jest.Mocked<KiService>;
      const mockAlignmentService = new AlignmentService('root') as jest.Mocked<AlignmentService>;

      const handlers = new Handlers(
        mockFsService,
        mockTelemetry,
        mockAlignmentService,
        mockKiService
      );

      // A sub-pro task with a Risk-2 signal
      const res = await handlers.handleReflexionLoop({
        brief: 'Implement a new feature',
        tier: 'sub-pro',
        sizeScore: 2,
        riskSignals: ['auth migration']
      });

      expect(res.isError).toBeFalsy(); // It's a structured response, not a throw
      
      const parsedContent = JSON.parse(res.content[0].text);
      expect(parsedContent.refused).toBe(true);
      expect(parsedContent.escalateTo).toBe('sub-max');
      expect(parsedContent.reason).toContain('risk level 2');
    });
  });

  describe('get_skill and plan_pipeline', () => {
    it('appends graph footer to get_skill', async () => {
      const mockFsService = new FileSystemService('root') as jest.Mocked<FileSystemService>;
      const mockTelemetry = new Telemetry() as jest.Mocked<Telemetry>;
      const mockKiService = new KiService() as jest.Mocked<KiService>;
      const mockAlignmentService = new AlignmentService('root') as jest.Mocked<AlignmentService>;

      mockFsService.readSkill.mockResolvedValue({
        content: 'description: Test\ncost: 0\n---\nSkill content',
        path: '/test.md'
      });
      mockFsService.loadGraph.mockResolvedValue({
        nodes: [{ id: 'test-skill', phase: 'plan', kind: 'skill', domain: 'eng', targets: ['api'] }],
        edges: [
          { from: 'test-skill', to: 'next-skill', type: 'suggests' },
          { from: 'test-skill', to: 'req-skill', type: 'requires' }
        ],
        artifactFlow: [
          { type: 'spec', consumedBy: ['plan'] },
          { type: 'plan-doc', emittedBy: ['plan'] }
        ]
      });

      mockTelemetry.withAnalytics.mockImplementation(async (a, b, c, d, e, cb) => cb());

      const handlers = new Handlers(mockFsService, mockTelemetry, mockAlignmentService, mockKiService);
      const res = await handlers.handleGetSkill('get_test_skill', { skillName: 'test-skill' });
      
      expect(res.isError).toBeFalsy();
      const text = res.content[0].text;
      expect(text).toContain('[GRAPH] phase=plan kind=skill domain=eng');
      expect(text).toContain('requires=[req-skill]');
      expect(text).toContain('suggests=[next-skill]');
      expect(text).toContain('consumes=[spec]');
      expect(text).toContain('emits=[plan-doc]');
      expect(text).toContain('targets=[api]');
    });

    it('returns ordered phases from plan_pipeline', async () => {
      const mockFsService = new FileSystemService('root') as jest.Mocked<FileSystemService>;
      const mockTelemetry = new Telemetry() as jest.Mocked<Telemetry>;
      const mockKiService = new KiService() as jest.Mocked<KiService>;
      const mockAlignmentService = new AlignmentService('root') as jest.Mocked<AlignmentService>;

      mockFsService.loadGraph.mockResolvedValue({
        nodes: [
          { id: 'spec-skill', phase: 'specify' },
          { id: 'plan-skill', phase: 'plan' },
          { id: 'build-skill', phase: 'build' }
        ],
        edges: [],
        artifactFlow: [
          { type: 'spec', emittedBy: ['specify'] },
          { type: 'plan-doc', emittedBy: ['plan'] }
        ]
      });

      mockTelemetry.withAnalytics.mockImplementation(async (a, b, c, d, e, cb) => cb());

      const handlers = new Handlers(mockFsService, mockTelemetry, mockAlignmentService, mockKiService);
      const res = await handlers.handlePlanPipeline({ intent: 'test' });
      
      expect(res.isError).toBeFalsy();
      const text = res.content[0].text;
      expect(text).toContain('Phase specify: [spec-skill] -> emits [spec]');
      expect(text).toContain('Phase plan: [plan-skill] -> emits [plan-doc]');
      expect(text).toContain('Phase build: [build-skill] -> emits [none]');
      
      // Check order
      const idxSpecify = text.indexOf('Phase specify');
      const idxPlan = text.indexOf('Phase plan');
      const idxBuild = text.indexOf('Phase build');
      expect(idxSpecify).toBeLessThan(idxPlan);
      expect(idxPlan).toBeLessThan(idxBuild);
    });
  });
});
