import { GitHubCodeProvider } from '../github-provider';

// Mock octokit module entirely to avoid ESM import issues in Jest
jest.mock('octokit', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => {
      return {
        rest: {
          repos: {
            getContent: jest.fn(),
          },
        },
      };
    }),
  };
});

// Import mocked Octokit
import { Octokit } from 'octokit';

describe('GitHubCodeProvider', () => {
  const mockToken = 'test-token';
  const mockRepo = 'owner/repo';
  let provider: GitHubCodeProvider;
  let mockOctokitInstance: any;

  beforeEach(() => {
    // Fresh instance for every test
    provider = new GitHubCodeProvider(mockToken, mockRepo);
    // The instance created inside constructor
    mockOctokitInstance = (provider as any).octokit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('readFile', () => {
    it('should read a file and decode base64 content', async () => {
      const mockContent = 'Hello GitHub';
      const mockBase64 = Buffer.from(mockContent).toString('base64');
      
      mockOctokitInstance.rest.repos.getContent.mockResolvedValueOnce({
        data: {
          content: mockBase64,
          encoding: 'base64',
        },
      });

      const result = await provider.readFile('test.txt');
      expect(result).toBe(mockContent);
      expect(mockOctokitInstance.rest.repos.getContent).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: 'test.txt',
      });
    });

    it('should throw error if content is missing', async () => {
      mockOctokitInstance.rest.repos.getContent.mockResolvedValueOnce({
        data: {},
      });

      await expect(provider.readFile('test.txt')).rejects.toThrow('Path test.txt is not a file.');
    });

    it('should return cached content on second call', async () => {
      const mockContent = 'Cached Content';
      const mockBase64 = Buffer.from(mockContent).toString('base64');
      
      mockOctokitInstance.rest.repos.getContent.mockResolvedValueOnce({
        data: { content: mockBase64, encoding: 'base64' },
      });

      // First call
      const result1 = await provider.readFile('cache.txt');
      expect(result1).toBe(mockContent);
      expect(mockOctokitInstance.rest.repos.getContent).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await provider.readFile('cache.txt');
      expect(result2).toBe(mockContent);
      expect(mockOctokitInstance.rest.repos.getContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('readSkill', () => {
    it('should read a skill file successfully', async () => {
      const mockContent = 'skill content';
      const mockBase64 = Buffer.from(mockContent).toString('base64');
      
      mockOctokitInstance.rest.repos.getContent.mockResolvedValueOnce({
        data: { content: mockBase64 },
      });

      const result = await provider.readSkill('test-skill', 'skill');
      expect(result?.content).toBe(mockContent);
      expect(result?.path).toBe('github://owner/repo/.ai/skills/test-skill.md');
    });
  });

  describe('getDynamicSkills', () => {
    it('should list and parse skills across directories', async () => {
      // Mock .ai/skills
      mockOctokitInstance.rest.repos.getContent.mockResolvedValueOnce({
        data: [
          { name: 'skill1.md', type: 'file' },
        ],
      });
      // Mock .agents/workflows
      mockOctokitInstance.rest.repos.getContent.mockResolvedValueOnce({
        data: [
          { name: 'flow1.md', type: 'file' },
        ],
      });

      const skills = await provider.getDynamicSkills();
      expect(skills.size).toBe(2);
      expect(skills.has('skill1')).toBe(true);
      expect(skills.get('skill1')?.type).toBe('skill');
    });

    it('should use cache on subsequent calls', async () => {
      mockOctokitInstance.rest.repos.getContent.mockResolvedValueOnce({
        data: [{ name: 'skill-cached.md', type: 'file' }],
      });
      mockOctokitInstance.rest.repos.getContent.mockResolvedValueOnce({
        data: [],
      });

      await provider.getDynamicSkills();
      expect(mockOctokitInstance.rest.repos.getContent).toHaveBeenCalledTimes(2);

      await provider.getDynamicSkills();
      expect(mockOctokitInstance.rest.repos.getContent).toHaveBeenCalledTimes(2); // No new calls
    });
  });
});
