/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { AiImpactPanel } from '../AiImpactPanel';
import { computeAiImpact, type PullRequestRecord } from '@/lib/ai-impact';

const pr = (n: number, cycleHours: number, ai: boolean): PullRequestRecord => ({
  number: n,
  title: `PR ${n}`,
  body: '',
  headRefName: `feat/${n}`,
  authorLogin: 'dev',
  authorIsBot: false,
  createdAt: '2026-10-01T00:00:00Z',
  mergedAt: new Date(Date.parse('2026-10-01T00:00:00Z') + cycleHours * 3_600_000).toISOString(),
  firstCommitAt: '2026-10-01T00:00:00Z',
  firstReviewAt: null,
  additions: 10,
  deletions: 0,
  commitMessages: ai ? ['x\n\nCo-Authored-By: Claude <noreply@anthropic.com>'] : ['x'],
});

const links = { branches: new Set<string>(), prNumbers: new Set<number>() };

describe('AiImpactPanel', () => {
  it('explains why the comparison is unavailable', () => {
    render(<AiImpactPanel result={{ status: 'unavailable', reason: 'Link this project to a GitHub repository.' }} />);

    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Link this project to a GitHub repository.')).toBeInTheDocument();
  });

  it('withholds differences when a group is too small', () => {
    const report = computeAiImpact({ prs: [pr(1, 5, true), pr(2, 10, false)], links, windowDays: 30 });
    render(<AiImpactPanel result={{ status: 'ok', repo: 'acme/app', report, capped: false }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Not enough data to compare');
  });

  it('compares the two groups with sample sizes', () => {
    const prs = [
      ...[1, 2, 3, 4, 5].map((n) => pr(n, 5, true)),
      ...[6, 7, 8, 9, 10].map((n) => pr(n, 10, false)),
    ];
    const report = computeAiImpact({ prs, links, windowDays: 30 });
    render(<AiImpactPanel result={{ status: 'ok', repo: 'acme/app', report, capped: true }} />);

    expect(screen.getByText(/AI-assisted n=\s*5/)).toBeInTheDocument();
    expect(screen.getByText(/capped at the newest 300 PRs/)).toBeInTheDocument();
    const cycleRow = screen.getByText('Cycle time (median)').closest('tr')!;
    expect(cycleRow).toHaveTextContent('5.0h');
    expect(cycleRow).toHaveTextContent('10.0h');
    expect(cycleRow).toHaveTextContent('-50%');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
