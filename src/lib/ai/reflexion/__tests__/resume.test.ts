// Mock next/server
jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: jest.fn((body, init) => ({
        status: init?.status || 200,
        json: async () => body,
      })),
    },
  };
});

import { POST } from '../../../../app/api/orchestrator/reflexion/resume/route';
import { prisma } from '../../../prisma';
import { getServerSession } from 'next-auth';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('../../../prisma', () => ({
  prisma: {
    reflexionRun: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Resume Route', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (body: any) =>
    ({
      json: async () => body,
    }) as any;

  it('rejects unauthorized access', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const req = createMockRequest({ runId: 'run-123', decisions: [] });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects mismatching userId (401)', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-2' },
    });
    (prisma.reflexionRun.findUnique as jest.Mock).mockResolvedValue({
      id: 'run-123',
      userId: 'user-1', // different user
    });

    const req = createMockRequest({ runId: 'run-123', decisions: [] });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Forbidden');
  });

  it('returns 400 for invalid payload', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });

    const req = createMockRequest({ decisions: 'bad' });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
