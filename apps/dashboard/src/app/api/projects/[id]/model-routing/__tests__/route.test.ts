jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      json: async () => body,
    })),
  },
}));

import { GET, PUT } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('/api/projects/[id]/model-routing API Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.MODEL_PLANNER;
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-owner' },
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 403 Forbidden for a non-owner non-admin user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-other',
      role: Role.DEVELOPER,
      email: 'other@example.com',
    });
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: 'proj-1',
      ownerId: 'user-owner',
      settings: {},
    });

    const params = Promise.resolve({ id: 'proj-1' });
    const req = {
      json: async () => ({ planner: 'gemini-3.6-flash' }),
    } as unknown as Request;

    const res = await PUT(req, { params });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.message).toBe('Forbidden');
  });

  it('rejects invalid model routing in PUT body with 400', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-owner',
      role: Role.DEVELOPER,
      email: 'owner@example.com',
    });
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: 'proj-1',
      ownerId: 'user-owner',
      settings: {},
    });

    const params = Promise.resolve({ id: 'proj-1' });
    const req = {
      json: async () => ({ planner: 'invalid-non-existent-model' }),
    } as unknown as Request;

    const res = await PUT(req, { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toBe('Invalid request body');
  });

  it('persists modelRouting on PUT and shows source="project" in GET.effective', async () => {
    const userMock = {
      id: 'user-owner',
      role: Role.DEVELOPER,
      email: 'owner@example.com',
      settings: {},
    };
    let projectMock = {
      id: 'proj-1',
      ownerId: 'user-owner',
      settings: {},
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(userMock);
    (prisma.project.findUnique as jest.Mock).mockImplementation(() =>
      Promise.resolve(projectMock)
    );
    (prisma.project.update as jest.Mock).mockImplementation(({ data }) => {
      projectMock = {
        ...projectMock,
        settings: data.settings,
      };
      return Promise.resolve(projectMock);
    });

    const params = Promise.resolve({ id: 'proj-1' });
    const putReq = {
      json: async () => ({ planner: 'gemini-3.6-flash' }),
    } as unknown as Request;

    const putRes = await PUT(putReq, { params });
    const putBody = await putRes.json();

    expect(putRes.status).toBe(200);
    expect(putBody.routing).toEqual({ planner: 'gemini-3.6-flash' });

    const getReq = {} as Request;
    const getRes = await GET(getReq, { params });
    const getBody = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getBody.routing).toEqual({ planner: 'gemini-3.6-flash' });
    expect(getBody.effective.planner).toEqual({
      model: 'gemini-3.6-flash',
      source: 'project',
    });
  });
});
