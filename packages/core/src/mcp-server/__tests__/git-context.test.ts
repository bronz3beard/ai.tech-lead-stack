import { prNumberFromEnv, resolveGitContext } from '../git-context';

describe('prNumberFromEnv', () => {
  it('reads the PR number from a GitHub Actions pull-request ref', () => {
    expect(prNumberFromEnv({ GITHUB_REF: 'refs/pull/147/merge' })).toBe(147);
  });

  it('falls back to PR_NUMBER', () => {
    expect(prNumberFromEnv({ PR_NUMBER: '12' })).toBe(12);
  });

  it('returns undefined for branch refs and junk values', () => {
    expect(prNumberFromEnv({ GITHUB_REF: 'refs/heads/main' })).toBeUndefined();
    expect(prNumberFromEnv({ PR_NUMBER: 'abc' })).toBeUndefined();
    expect(prNumberFromEnv({})).toBeUndefined();
  });
});

describe('resolveGitContext', () => {
  it('reads the branch with a read-only rev-parse in the given directory', () => {
    const exec = jest.fn().mockReturnValue('feat/update-metrics\n');

    const ctx = resolveGitContext({ env: {}, cwd: '/repo', exec });

    expect(exec).toHaveBeenCalledWith('git', ['rev-parse', '--abbrev-ref', 'HEAD'], '/repo');
    expect(ctx).toEqual({ gitBranch: 'feat/update-metrics', prNumber: undefined });
  });

  it('reports no branch for a detached HEAD', () => {
    const ctx = resolveGitContext({ env: {}, cwd: '/repo', exec: () => 'HEAD\n' });
    expect(ctx.gitBranch).toBeUndefined();
  });

  it('returns an empty context when git fails', () => {
    const ctx = resolveGitContext({
      env: {},
      cwd: '/not-a-repo',
      exec: () => {
        throw new Error('not a git repository');
      },
    });
    expect(ctx).toEqual({ gitBranch: undefined, prNumber: undefined });
  });
});
