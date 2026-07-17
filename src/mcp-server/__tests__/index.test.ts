// Mock langfuse to prevent ESM dynamic import issues in Node 22
jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({})),
}));

// Mock telemetry to prevent real telemetry service from loading
jest.mock('../telemetry', () => ({
  Telemetry: jest.fn().mockImplementation(() => ({
    withAnalytics: jest
      .fn()
      .mockImplementation(
        (
          _skill: string,
          _project: string,
          _model: string,
          _agent: string,
          _cost: string | undefined,
          callback: () => Promise<any>,
          _overridesArg?: Parameters<Telemetry['withAnalytics']>[6]
        ) => callback()
      ),
  })),
}));

import { KiService } from '@/lib/ki/ki-service';
import { FileSystemService } from '@/lib/skills';
import { AlignmentService } from '@/lib/skills/alignment-service';
import * as fs from 'fs/promises';
import { Handlers } from '../handlers';
import { Telemetry } from '../telemetry';

// Mock the services
jest.mock('@/lib/skills/fs-service');
jest.mock('@/lib/ki/ki-service');
jest.mock('@/lib/skills/alignment-service');
jest.mock('fs/promises');

describe('MCP Server', () => {
  let handlers: Handlers;
  let mockFsService: jest.Mocked<FileSystemService>;
  let mockTelemetry: jest.Mocked<Telemetry>;
  let mockKiService: jest.Mocked<KiService>;
  let mockAlignmentService: jest.Mocked<AlignmentService>;

  beforeEach(() => {
    mockFsService = new FileSystemService(
      'mock-root'
    ) as jest.Mocked<FileSystemService>;
    mockTelemetry = new Telemetry() as jest.Mocked<Telemetry>;
    mockKiService = new KiService() as jest.Mocked<KiService>;
    mockAlignmentService = new AlignmentService(
      'mock-root'
    ) as jest.Mocked<AlignmentService>;

    // Default mock implementations
    mockFsService.getSearchDirs.mockReturnValue(['mock-dir-1', 'mock-dir-2']);

    // We mock readSkill to return a default file payload for success paths
    mockFsService.readSkill.mockImplementation(async (skillName) => {
      if (skillName === 'test-skill') {
        return {
          content: 'Skill Content',
          path: 'mock/path.md',
        };
      }
      return null; // Not found
    });

    mockTelemetry.withAnalytics.mockImplementation(
      async (name, project, model, agent, cost, callback, _overrides) => {
        return await callback();
      }
    );

    handlers = new Handlers(
      mockFsService,
      mockTelemetry,
      mockAlignmentService,
      mockKiService
    );
  });

  describe('CallToolRequestSchema handler - get_skills / get_skill', () => {
    it('should successfully read a skill file from the first directory', async () => {
      const result = await handlers.handleGetSkill('get_skill', {
        skillName: 'test-skill',
        projectName: 'test-project',
        model: 'gpt-4',
        agent: 'test-agent',
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('Skill Content');

      expect(mockTelemetry.withAnalytics).toHaveBeenCalledWith(
        'test-skill',
        'test-project',
        'gpt-4',
        'test-agent',
        'unknown',
        expect.any(Function),
        {}
      );
    });

    it('should return an error if skill is not found', async () => {
      const result = await handlers.handleGetSkill('get_skill', {
        skillName: 'non-existent',
        projectName: 'test-project',
        model: 'gpt-4',
        agent: 'test-agent',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Error: Skill file "non-existent" not found.'
      );
    });

    it('should fallback to extracting project name from package.json if omitted', async () => {
      // Force fallback branch by omitting projectName
      mockFsService.findProjectRoot.mockResolvedValue('/mock/app');

      // Mock package.json read
      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify({ name: 'app' })
      );

      const result = await handlers.handleGetSkill('get_skill', {
        skillName: 'test-skill',
      });

      expect(result.isError).toBe(false);
      expect(mockTelemetry.withAnalytics).toHaveBeenCalledWith(
        'test-skill',
        'app',
        undefined,
        undefined,
        'unknown',
        expect.any(Function),
        {}
      );
    });

    it('should pass custom telemetry overrides to withAnalytics', async () => {
      const result = await handlers.handleGetSkill('get_skill', {
        skillName: 'test-skill',
        projectName: 'test-project',
        model: 'gpt-4',
        agent: 'test-agent',
        loopRunId: 'mission-123',
        teamRole: 'architect',
        actorType: 'USER',
        autonomy: 'AUTONOMOUS',
        loopPhase: 'planning',
      });

      expect(result.isError).toBe(false);
      expect(mockTelemetry.withAnalytics).toHaveBeenCalledWith(
        'test-skill',
        'test-project',
        'gpt-4',
        'test-agent',
        'unknown',
        expect.any(Function),
        {
          loopRunId: 'mission-123',
          teamRole: 'architect',
          actorType: 'USER',
          autonomy: 'AUTONOMOUS',
          loopPhase: 'planning',
        }
      );
    });

    it('should default teamRole to qa and actorType to AGENT for qa-handover-generator', async () => {
      mockFsService.readSkill.mockImplementation(async (skillName) => {
        if (skillName === 'qa-handover-generator') {
          return {
            content: 'cost: ~1500 tokens\nQA Handover content',
            path: 'mock/qa.md',
          };
        }
        return null;
      });

      const result = await handlers.handleGetSkill('get_skill', {
        skillName: 'qa-handover-generator',
        projectName: 'test-project',
        model: 'gpt-4',
        agent: 'test-agent',
      });

      expect(result.isError).toBe(false);
      expect(mockTelemetry.withAnalytics).toHaveBeenCalledWith(
        'qa-handover-generator',
        'test-project',
        'gpt-4',
        'test-agent',
        '~1500 tokens',
        expect.any(Function),
        {
          teamRole: 'qa',
          actorType: 'AGENT',
        }
      );
    });
  });
});
