import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
}

/**
 * @desc Proxies a request to the GitHub REST API to list repositories the
 *       signed-in user has access to. Uses the OAuth access_token stored in
 *       the `Account` table — no token is ever exposed to the client.
 *
 * @returns 200 { repos: GitHubRepo[] }
 * @returns 403 if the session has no linked GitHub account or the token is missing.
 * @returns 502 if the GitHub API call fails.
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Only GitHub-linked accounts have a stored access_token we can use.
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'github' },
    select: { access_token: true },
  });

  if (!account?.access_token) {
    return NextResponse.json(
      {
        message:
          'No GitHub account linked. Please sign out and sign in again with GitHub to connect your repositories.',
      },
      { status: 403 },
    );
  }

  try {
    // Fetch all repos the user has access to (including org repos via membership).
    // `affiliation=owner,collaborator,organization_member` covers personal + org repos.
    const response = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member',
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        // Next.js 15 cache: do not cache — always fresh
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('GitHub API error:', response.status, errorBody);
      return NextResponse.json(
        { message: 'Failed to fetch repositories from GitHub.' },
        { status: 502 },
      );
    }

    const rawRepos: GitHubRepo[] = await response.json();

    // Return only the fields the frontend needs
    const repos = rawRepos.map(({ id, name, full_name, html_url, description, private: isPrivate }) => ({
      id,
      name,
      full_name,
      html_url,
      description,
      private: isPrivate,
    }));

    return NextResponse.json({ repos });
  } catch (error: unknown) {
    console.error('GitHub repos proxy error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
