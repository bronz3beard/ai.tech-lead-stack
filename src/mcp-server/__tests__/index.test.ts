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
          callback: () => Promise<any>
        ) => callback()
      ),
  })),
}));

import { FileSystemService } from '@/lib/skills';
import * as fs from 'fs/promises';
import { Handlers } from '../handlers';
import { Telemetry } from '../telemetry';

// Mock the services
jest.mock('@/lib/skills/fs-service');
jest.mock('fs/promises');

describe('MCP Server', () => {
  let handlers: Handlers;
  let mockFsService: jest.Mocked<FileSystemService>;
  let mockTelemetry: jest.Mocked<Telemetry>;

  beforeEach(() => {
    mockFsService = new FileSystemService(
      'mock-root'
    ) as jest.Mocked<FileSystemService>;
    mockTelemetry = new Telemetry() as jest.Mocked<Telemetry>;

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
      async (name, project, model, agent, cost, callback) => {
        return await callback();
      }
    );

    handlers = new Handlers(mockFsService, mockTelemetry);
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
        expect.any(Function)
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
        expect.any(Function)
      );
    });
  });
});
