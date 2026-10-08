/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import PublicDashboard from '../page';
import { getServerSession } from 'next-auth';
import { getAdoptionSummary } from '@/lib/usage-aggregates';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/usage-aggregates', () => ({
  DEFAULT_SERIES_DAYS: 90,
  getAdoptionSummary: jest.fn(),
}));

jest.mock('@zenithfoundry/tech-lead-stack/db', () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/components/ProjectSelect', () => ({
  ProjectSelect: ({ projects, selectedProjectId }: any) => (
    <div data-testid="project-select" data-selected={selectedProjectId}>
      {projects.map((p: any) => p.name).join(', ')}
    </div>
  ),
}));

jest.mock('@/components/ui/chart', () => ({
  BarChart: () => <div data-testid="bar-chart" />,
  LineChart: () => <div data-testid="line-chart" />,
}));

jest.mock('@/components/dashboard/DashboardDisclaimer', () => ({
  DashboardDisclaimer: () => <div data-testid="disclaimer" />,
}));

describe('PublicDashboard Page Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAdoptionSummary as jest.Mock).mockResolvedValue({
      skillsLoaded: 1142,
      llmCalls: 40,
      sessions: 12,
      projects: 3,
      people: 2,
      actorSplit: { human: 300, agent: 900, unknown: 0 },
      topSkills: [],
      dailySkillLoads: [],
    });
    (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('renders public dashboard in anonymous mode when getServerSession returns null', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const ui = await PublicDashboard({
      searchParams: Promise.resolve({ projectId: 'all' }),
    });
    const { getByText, getAllByText } = render(ui);

    expect(getByText('Global Public Dashboard')).toBeInTheDocument();
    expect(getByText(/Adoption for:/)).toBeInTheDocument();
    expect(getAllByText('All Projects').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Skills Loaded')).toBeInTheDocument();
    expect(getByText('1,142')).toBeInTheDocument();
    expect(getByText('75%')).toBeInTheDocument(); // 900 agent of 1,200
  });

  it('never shows spend on the public page', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const ui = await PublicDashboard({ searchParams: Promise.resolve({}) });
    const { container } = render(ui);

    expect(container.textContent).not.toMatch(/\$\d/);
  });

  it('ignores a project filter from an anonymous visitor and offers no project picker', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const ui = await PublicDashboard({
      searchParams: Promise.resolve({ projectId: 'alpha-project' }),
    });
    const { queryByTestId } = render(ui);

    expect(getAdoptionSummary).toHaveBeenCalledWith({ scope: null, projectName: undefined });
    expect(queryByTestId('project-select')).toBeNull();
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('narrows to a project the signed-in user can access', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'DEVELOPER', email: 'dev@example.com' },
    });
    (prisma.project.findMany as jest.Mock).mockResolvedValue([{ name: 'alpha-project' }]);

    await PublicDashboard({ searchParams: Promise.resolve({ projectId: 'alpha-project' }) });

    expect(getAdoptionSummary).toHaveBeenCalledWith({ scope: null, projectName: 'alpha-project' });
  });

  it('shows the aggregate when the summary query fails', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (getAdoptionSummary as jest.Mock).mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const ui = await PublicDashboard({ searchParams: Promise.resolve({}) });
    const { getByText } = render(ui);

    expect(getByText('Skills Loaded')).toBeInTheDocument();
  });

  it('renders public dashboard when user is authenticated with a session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'ADMIN', email: 'admin@example.com' },
    });
    (prisma.project.findMany as jest.Mock).mockResolvedValue([
      { name: 'alpha-project', settings: null },
    ]);

    const ui = await PublicDashboard({
      searchParams: Promise.resolve({ projectId: 'all' }),
    });
    const { getByText } = render(ui);

    expect(getByText('Global Public Dashboard')).toBeInTheDocument();
    expect(getByText('All Projects, Alpha project')).toBeInTheDocument();
  });

  it('renders resiliently without throwing when getServerSession rejects (missing NEXTAUTH_SECRET)', async () => {
    (getServerSession as jest.Mock).mockRejectedValue(
      new Error('MissingSecret: Please define a secret in production.')
    );

    const ui = await PublicDashboard({
      searchParams: Promise.resolve({ projectId: 'all' }),
    });
    const { getByText, getAllByText } = render(ui);

    expect(getByText('Global Public Dashboard')).toBeInTheDocument();
    expect(getAllByText('All Projects').length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty db projects gracefully without crashing on undefined project name', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([]);

    const ui = await PublicDashboard({
      searchParams: Promise.resolve({ projectId: 'non-existent' }),
    });
    const { getByText, getAllByText } = render(ui);

    expect(getByText('Global Public Dashboard')).toBeInTheDocument();
    // Default fallback project name is All Projects
    expect(getAllByText('All Projects').length).toBeGreaterThanOrEqual(1);
  });

  it('handles undefined searchParams gracefully without throwing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const ui = await PublicDashboard({
      searchParams: undefined as any,
    });
    const { getByText } = render(ui);

    expect(getByText('Global Public Dashboard')).toBeInTheDocument();
  });
});
