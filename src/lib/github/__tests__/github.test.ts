import { GitHubClient } from '../client';

describe('GitHubClient Safety Guards', () => {
  const mockConfig = {
    owner: 'test-owner',
    repo: 'test-repo',
    accessToken: 'test-token',
  };

  const client = new GitHubClient(mockConfig);

  // Mock global fetch
  global.fetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateBranch', () => {
    it('should allow valid feat/ branches', async () => {
      // We test via a public method that calls validateBranch
      // Mocking getBranchState to avoid actual network call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ object: { sha: '123' } }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: { sha: '456' } }),
      });

      await expect(client.getBranchState('feat/new-ui')).resolves.not.toThrow();
    });

    it('should allow valid discovery/ branches', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ object: { sha: '123' } }),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tree: { sha: '456' } }),
      });

      await expect(client.getBranchState('discovery/requirements')).resolves.not.toThrow();
    });

    it('should strictly block the main branch', async () => {
      await expect(client.getBranchState('main')).rejects.toThrow(
        /SECURITY VIOLATION: Access to protected branch 'main' is strictly forbidden/
      );
    });

    it('should strictly block the master branch', async () => {
      await expect(client.getBranchState('master')).rejects.toThrow(
        /SECURITY VIOLATION: Access to protected branch 'master' is strictly forbidden/
      );
    });

    it('should block production/prod branches', async () => {
      await expect(client.getBranchState('production')).rejects.toThrow(/SECURITY VIOLATION/);
      await expect(client.getBranchState('prod')).rejects.toThrow(/SECURITY VIOLATION/);
    });

    it('should block branches not following feat/ or discovery/ prefix', async () => {
      await expect(client.getBranchState('patch/fix-bug')).rejects.toThrow(
        /naming convention/
      );
      await expect(client.getBranchState('hotfix/emergency')).rejects.toThrow(
        /naming convention/
      );
    });

    it('should block empty or invalid branch strings', async () => {
      await expect(client.getBranchState('')).rejects.toThrow();
      await expect(client.getBranchState(' ')).rejects.toThrow();
    });
  });

  describe('Security via API interaction', () => {
    it('updateRef should enforce branch validation before making network request', async () => {
      await expect(client.updateRef('main', 'sha123')).rejects.toThrow(/SECURITY VIOLATION/);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('commitFiles should enforce branch validation before starting flow', async () => {
      await expect(client.commitFiles('master', 'msg', {})).rejects.toThrow(/SECURITY VIOLATION/);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
