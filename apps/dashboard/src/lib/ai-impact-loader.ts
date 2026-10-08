import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { normalizeProjectName } from '@zenithfoundry/tech-lead-stack/trace-utils';
import { unstable_cache } from 'next/cache';
import { getProjectAccessFilter } from './access';
import { computeAiImpact, type AiImpactReport, type TelemetryLinks } from './ai-impact';
import type { DateRange } from './date-range';
import { createGitHubClient } from './github/client';

const DEFAULT_WINDOW_DAYS = 90;
/** Upper bound on PRs per load; the panel says so when it is hit. */
const PR_CAP = 300;
/** GitHub data is shared by everyone with access to the repo, so one copy per window. */
const CACHE_SECONDS = 15 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AiImpactResult =
  | { status: 'ok'; repo: string; report: AiImpactReport; capped: boolean }
  | { status: 'unavailable'; reason: string };

/** Distinct branches and PR numbers on which TLS recorded AI work for this project. */
async function telemetryLinks(projectName: string): Promise<TelemetryLinks> {
  const rows = await prisma.analyticsEvent.findMany({
    where: {
      projectName: normalizeProjectName(projectName),
      kind: { in: ['skill_invocation', 'llm_generation'] },
      environment: { not: 'test' },
      OR: [{ gitBranch: { not: null } }, { prNumber: { not: null } }],
    },
    select: { gitBranch: true, prNumber: true },
    distinct: ['gitBranch', 'prNumber'],
  });
  return {
    branches: new Set(rows.map((r) => r.gitBranch).filter((b): b is string => Boolean(b))),
    prNumbers: new Set(rows.map((r) => r.prNumber).filter((n): n is number => n !== null)),
  };
}

/**
 * BETA: AI-assisted vs not, for one project the user can access. Never throws;
 * missing prerequisites come back as an explained `unavailable` result.
 */
export async function loadAiImpact(input: {
  user: { id: string; role: string; email?: string | null };
  projectName: string;
  dateRange: DateRange;
  now?: Date;
}): Promise<AiImpactResult> {
  try {
    const project = await prisma.project.findFirst({
      where: { AND: [{ name: input.projectName }, getProjectAccessFilter(input.user)] },
      select: { id: true, name: true, githubFullName: true },
    });
    if (!project) return { status: 'unavailable', reason: 'Project not found or not accessible.' };
    if (!project.githubFullName) {
      return { status: 'unavailable', reason: 'Link this project to a GitHub repository to compare merged PRs.' };
    }

    const now = input.now ?? new Date();
    const to = input.dateRange.to ?? now;
    const since = input.dateRange.from ?? new Date(to.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);
    const windowDays = Math.max(1, Math.round((to.getTime() - since.getTime()) / DAY_MS));

    let client;
    try {
      client = await createGitHubClient(input.user.id, project.id);
    } catch {
      return { status: 'unavailable', reason: 'Sign in with GitHub to load this project’s pull requests.' };
    }

    // The token stays out of the cache key: it lives in the closure, not the arguments.
    const fetchPrs = unstable_cache(
      () => client.listMergedPullRequests({ since, cap: PR_CAP }),
      ['ai-impact-merged-prs', project.githubFullName, since.toISOString().slice(0, 10)],
      { revalidate: CACHE_SECONDS }
    );

    const [{ prs, capped }, links] = await Promise.all([fetchPrs(), telemetryLinks(project.name)]);
    const inWindow = prs.filter((p) => Date.parse(p.mergedAt) <= to.getTime());

    return {
      status: 'ok',
      repo: project.githubFullName,
      report: computeAiImpact({ prs: inWindow, links, windowDays }),
      capped,
    };
  } catch (error) {
    console.error('[AiImpact] Failed to load:', error);
    return { status: 'unavailable', reason: 'GitHub data could not be loaded right now.' };
  }
}
