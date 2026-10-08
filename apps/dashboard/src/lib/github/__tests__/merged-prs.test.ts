import { GitHubClient } from '../client';

jest.mock('@zenithfoundry/tech-lead-stack/db', () => ({ prisma: {} }));

const node = (number: number, extra: Record<string, unknown> = {}) => ({
  number,
  title: `PR ${number}`,
  body: null,
  headRefName: `feat/${number}`,
  createdAt: '2026-10-01T00:00:00Z',
  mergedAt: '2026-10-02T00:00:00Z',
  additions: 10,
  deletions: 2,
  author: { __typename: 'User', login: 'dev' },
  reviews: { nodes: [{ submittedAt: '2026-10-01T05:00:00Z' }] },
  commits: {
    nodes: [
      { commit: { authoredDate: '2026-09-30T12:00:00Z', message: 'second' } },
      { commit: { authoredDate: '2026-09-30T10:00:00Z', message: 'first' } },
    ],
  },
  ...extra,
});

const page = (nodes: unknown[], hasNextPage: boolean, endCursor: string | null = null) => ({
  ok: true,
  json: async () => ({ data: { search: { pageInfo: { hasNextPage, endCursor }, nodes } } }),
});

describe('GitHubClient.listMergedPullRequests', () => {
  const client = new GitHubClient({ owner: 'acme', repo: 'app', accessToken: 'token' });
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('pages through merged PRs, skipping non-PR nodes, and maps them to records', async () => {
    fetchMock
      .mockResolvedValueOnce(page([node(1), {}], true, 'c1'))
      .mockResolvedValueOnce(page([node(2, { author: { __typename: 'Bot', login: 'dependabot' } })], false));

    const { prs, capped } = await client.listMergedPullRequests({ since: new Date('2026-07-10T00:00:00Z'), cap: 100 });

    expect(capped).toBe(false);
    expect(prs.map((p) => p.number)).toEqual([1, 2]);
    expect(prs[0]).toMatchObject({
      body: '',
      firstCommitAt: '2026-09-30T10:00:00Z',
      firstReviewAt: '2026-10-01T05:00:00Z',
      commitMessages: ['second', 'first'],
      authorIsBot: false,
    });
    expect(prs[1].authorIsBot).toBe(true);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.variables.q).toBe('repo:acme/app is:pr is:merged merged:>=2026-07-10 sort:updated-desc');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).variables.cursor).toBe('c1');
  });

  it('stops at the cap and reports it', async () => {
    fetchMock.mockResolvedValueOnce(page([node(1), node(2), node(3)], true, 'c1'));

    const { prs, capped } = await client.listMergedPullRequests({ since: new Date(), cap: 2 });

    expect(prs).toHaveLength(2);
    expect(capped).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a response that does not match the expected shape', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ errors: [{ message: 'Bad credentials' }] }) });

    await expect(client.listMergedPullRequests({ since: new Date(), cap: 10 })).rejects.toThrow();
  });

  it('only ever sends a read query', async () => {
    fetchMock.mockResolvedValueOnce(page([], false));
    await client.listMergedPullRequests({ since: new Date(), cap: 10 });

    const { query } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(query.trim().startsWith('query ')).toBe(true);
    expect(query).not.toMatch(/mutation/i);
  });
});
