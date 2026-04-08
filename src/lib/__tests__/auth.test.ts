import { authOptions } from '../auth';

describe('authOptions', () => {
  it('should have GithubProvider and CredentialsProvider configured', () => {
    expect(authOptions.providers.length).toBe(2);
    expect(authOptions.providers[0].id).toBe('github');
    expect(authOptions.providers[1].id).toBe('credentials');
  });

  it('should use jwt sessions', () => {
    expect(authOptions.session?.strategy).toBe('jwt');
  });
});
