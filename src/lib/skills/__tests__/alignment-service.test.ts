import * as fs from 'fs/promises';
import * as path from 'path';
import { AlignmentService, AlignmentState } from '../alignment-service';

// Mock fs/promises
jest.mock('fs/promises');

describe('AlignmentService', () => {
  const mockProjectRoot = '/mock/project/root';
  let alignmentService: AlignmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    alignmentService = new AlignmentService(mockProjectRoot);
  });

  describe('recordAlignment', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should successfully record mission alignment', async () => {
      const agent = 'test-agent';
      const projectName = 'test-project';
      const expectedAiDir = path.join(mockProjectRoot, '.ai');
      const expectedAlignmentFile = path.join(expectedAiDir, '.mission-alignment.json');

      const expectedState: AlignmentState = {
        agent,
        projectName,
        timestamp: '2023-01-01T00:00:00.000Z',
        aligned: true,
      };

      const result = await alignmentService.recordAlignment(agent, projectName);

      expect(fs.mkdir).toHaveBeenCalledWith(expectedAiDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expectedAlignmentFile,
        JSON.stringify(expectedState, null, 2),
        'utf-8'
      );
      expect(result).toBe(`✅ Mission Alignment Recorded for ${agent} in ${projectName}.\nCompliance token created at ${expectedAlignmentFile}`);
    });

    it('should handle errors properly when writing fails', async () => {
      const errorMessage = 'Disk full';
      (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(alignmentService.recordAlignment('agent', 'project'))
        .rejects
        .toThrow(`Failed to record mission alignment: ${errorMessage}`);
    });

    it('should handle non-Error objects properly when writing fails', async () => {
      const errorMessage = 'Disk full string';
      (fs.writeFile as jest.Mock).mockRejectedValueOnce(errorMessage);

      await expect(alignmentService.recordAlignment('agent', 'project'))
        .rejects
        .toThrow(`Failed to record mission alignment: ${errorMessage}`);
    });
  });

  describe('getAlignmentState', () => {
    it('should successfully return alignment state when file exists', async () => {
      const expectedState: AlignmentState = {
        agent: 'test-agent',
        projectName: 'test-project',
        timestamp: '2023-01-01T00:00:00.000Z',
        aligned: true,
      };

      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(expectedState));

      const result = await alignmentService.getAlignmentState();

      const expectedAlignmentFile = path.join(mockProjectRoot, '.ai', '.mission-alignment.json');
      expect(fs.readFile).toHaveBeenCalledWith(expectedAlignmentFile, 'utf-8');
      expect(result).toEqual(expectedState);
    });

    it('should return null when reading file throws an error', async () => {
      (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('File not found'));

      const result = await alignmentService.getAlignmentState();

      expect(result).toBeNull();
    });
  });
});
