jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      json: async () => body,
    })),
  },
}));

import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@zenithfoundry/tech-lead-stack/db', () => ({
  prisma: {
    reflexionRun: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

// Only reached after the auth and payload checks under test.
jest.mock('@zenithfoundry/tech-lead-stack/ai/reflexion/engine');
jest.mock('@zenithfoundry/tech-lead-stack/ai/reflexion/providers-user');
jest.mock('@zenithfoundry/tech-lead-stack/ai/reflexion/db-state-store');

const answers = { runId: 'run-123', decisions: [] };

const createMockRequest = (body: unknown) =>
  ({ json: async () => body }) as unknown as Request;

const signedInAs = (id: string | null) =>
  (getServerSession as jest.Mock).mockResolvedValue(
    id ? { user: { id } } : null
  );

describe('/api/orchestrator/reflexion/resume API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated access with 401', async () => {
    signedInAs(null);

    const res = await POST(createMockRequest(answers));

    expect(res.status).toBe(401);
  });

  it('rejects resuming a run owned by another user', async () => {
    signedInAs('user-2');
    (prisma.reflexionRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-123',
      userId: 'user-1',
    });

    const res = await POST(createMockRequest(answers));

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Forbidden');
  });

  it('returns 400 for an invalid answers payload', async () => {
    signedInAs('user-1');

    const res = await POST(createMockRequest({ decisions: 'bad' }));

    expect(res.status).toBe(400);
    expect(prisma.reflexionRun.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the run does not exist', async () => {
    signedInAs('user-1');
    (prisma.reflexionRun.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await POST(createMockRequest({ ...answers, runId: 'missing' }));

    expect(res.status).toBe(404);
  });
});
