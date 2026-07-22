import { UserResolver } from '../user-resolver';
import * as child_process from 'child_process';

jest.mock('child_process');

describe('UserResolver', () => {
  let userResolver: UserResolver;
  const originalEnv = process.env;

  beforeEach(() => {
    userResolver = new UserResolver();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getUserEmail', () => {
    it('should return email from GitHub CLI if available', () => {
      (child_process.execSync as jest.Mock).mockImplementation(
        (command: string) => {
          if (command === 'gh api user -q .email') {
            return Buffer.from('githubuser@example.com\n');
          }
          return Buffer.from('');
        }
      );

      const email = userResolver.getUserEmail();

      expect(email).toBe('githubuser@example.com');
      expect(child_process.execSync).toHaveBeenCalledWith(
        'gh api user -q .email',
        { stdio: 'pipe' }
      );
    });

    it('should fallback to git config if GitHub CLI returns null string', () => {
      (child_process.execSync as jest.Mock).mockImplementation(
        (command: string) => {
          if (command === 'gh api user -q .email') {
            return Buffer.from('null\n');
          }
          if (command === 'git config --global user.email') {
            return Buffer.from('gitconfiguser@example.com\n');
          }
          return Buffer.from('');
        }
      );

      const email = userResolver.getUserEmail();

      expect(email).toBe('gitconfiguser@example.com');
      expect(child_process.execSync).toHaveBeenCalledWith(
        'gh api user -q .email',
        { stdio: 'pipe' }
      );
      expect(child_process.execSync).toHaveBeenCalledWith(
        'git config --global user.email',
        { stdio: 'pipe' }
      );
    });

    it('should fallback to git config if GitHub CLI throws an error', () => {
      (child_process.execSync as jest.Mock).mockImplementation(
        (command: string) => {
          if (command === 'gh api user -q .email') {
            throw new Error('Command failed');
          }
          if (command === 'git config --global user.email') {
            return Buffer.from('gitconfigfallback@example.com\n');
          }
          return Buffer.from('');
        }
      );

      const email = userResolver.getUserEmail();

      expect(email).toBe('gitconfigfallback@example.com');
      expect(child_process.execSync).toHaveBeenCalledWith(
        'gh api user -q .email',
        { stdio: 'pipe' }
      );
      expect(child_process.execSync).toHaveBeenCalledWith(
        'git config --global user.email',
        { stdio: 'pipe' }
      );
    });

    it('should fallback to environment variable if both GitHub CLI and git config fail', () => {
      (child_process.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed');
      });
      process.env.USER_EMAIL = 'envuser@example.com';

      const email = userResolver.getUserEmail();

      expect(email).toBe('envuser@example.com');
      expect(child_process.execSync).toHaveBeenCalledWith(
        'gh api user -q .email',
        { stdio: 'pipe' }
      );
      expect(child_process.execSync).toHaveBeenCalledWith(
        'git config --global user.email',
        { stdio: 'pipe' }
      );
    });

    it('should return "unknown" if all methods fail', () => {
      (child_process.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed');
      });
      delete process.env.USER_EMAIL;

      const email = userResolver.getUserEmail();

      expect(email).toBe('unknown');
    });
  });

  describe('getUserName', () => {
    it('should return name from git config if available', () => {
      (child_process.execSync as jest.Mock).mockImplementation(
        (command: string) => {
          if (command === 'git config --global user.name') {
            return Buffer.from('Test User\n');
          }
          return Buffer.from('');
        }
      );

      const name = userResolver.getUserName();

      expect(name).toBe('Test User');
      expect(child_process.execSync).toHaveBeenCalledWith(
        'git config --global user.name',
        { stdio: 'pipe' }
      );
    });

    it('should return "unknown" if git config throws an error', () => {
      (child_process.execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed');
      });

      const name = userResolver.getUserName();

      expect(name).toBe('unknown');
    });
  });
});
