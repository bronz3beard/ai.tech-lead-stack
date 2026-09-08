/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import PublicDashboard from '../page';
import { getServerSession } from 'next-auth';
import { getAnalytics } from '@/lib/analytics-service';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/analytics-service', () => ({
  getAnalytics: jest.fn(),
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

jest.mock('@/components/dashboard/InsightsTable', () => ({
  InsightsTable: () => <div data-testid="insights-table" />,
}));

jest.mock('@/components/dashboard/StepAnalyticsTable', () => ({
  StepAnalyticsTable: () => <div data-testid="step-analytics-table" />,
}));

jest.mock('@/components/dashboard/PhaseCostPanel', () => ({
  PhaseCostPanel: () => <div data-testid="phase-cost-panel" />,
}));

jest.mock('@/components/dashboard/DashboardDisclaimer', () => ({
  DashboardDisclaimer: () => <div data-testid="disclaimer" />,
}));

describe('PublicDashboard Page Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAnalytics as jest.Mock).mockResolvedValue([]);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('renders public dashboard in anonymous mode when getServerSession returns null', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const ui = await PublicDashboard({
      searchParams: Promise.resolve({ projectId: 'all' }),
    });
    const { getByText, getAllByText } = render(ui);

    expect(getByText('Global Public Dashboard')).toBeInTheDocument();
    expect(getByText(/Viewing telemetry data for:/)).toBeInTheDocument();
    expect(getAllByText('All Projects').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Total Skills Run')).toBeInTheDocument();
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
