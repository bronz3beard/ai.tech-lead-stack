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

import { GET, PUT } from '../route';
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
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('/api/settings/profile API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-123' },
    });
  });

  describe('GET Auth & Round-trip', () => {
    it('returns 401 Unauthorized when session is missing', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.message).toBe('Unauthorized');
    });

    it('returns profile data including modelRouting from settings', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: 'dev@example.com',
        firstName: 'Alex',
        lastName: 'Dev',
        name: 'Alex Dev',
        image: null,
        preferredModel: 'gemini',
        requirementsModel: null,
        auditModel: null,
        settings: {
          modelRouting: { planner: 'gemini-3.6-flash' },
          otherSetting: true,
        },
      });

      const res = await GET();
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.modelRouting).toEqual({ planner: 'gemini-3.6-flash' });
      expect(body.email).toBe('dev@example.com');
    });
  });

  describe('PUT / PATCH', () => {
    it('returns 401 Unauthorized when session is missing on PUT', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const req = {
        json: async () => ({ modelRouting: { planner: 'gemini-3.6-flash' } }),
      } as unknown as Request;

      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.message).toBe('Unauthorized');
    });

    it('accepts and persists valid modelRouting merging with existing settings and supports GET round-trip', async () => {
      let storedUser = {
        id: 'user-123',
        email: 'dev@example.com',
        firstName: 'Alex',
        lastName: 'Dev',
        name: 'Alex Dev',
        image: null,
        preferredModel: 'gemini',
        requirementsModel: null,
        auditModel: null,
        settings: {
          existingKey: 'value',
          modelRouting: { auditor: 'claude-haiku-4-5' },
        },
      };

      (prisma.user.findUnique as jest.Mock).mockImplementation(() =>
        Promise.resolve(storedUser)
      );

      (prisma.user.update as jest.Mock).mockImplementation(({ data }) => {
        storedUser = {
          ...storedUser,
          settings: data.settings,
        };
        return Promise.resolve(storedUser);
      });

      const req = {
        json: async () => ({
          modelRouting: { planner: 'gemini-3.6-flash' },
        }),
      } as unknown as Request;

      const putRes = await PUT(req);
      const putBody = await putRes.json();

      expect(putRes.status).toBe(200);
      expect(putBody.modelRouting).toEqual({
        auditor: 'claude-haiku-4-5',
        planner: 'gemini-3.6-flash',
      });

      const getRes = await GET();
      const getBody = await getRes.json();
      expect(getBody.modelRouting).toEqual({
        auditor: 'claude-haiku-4-5',
        planner: 'gemini-3.6-flash',
      });
    });

    it('rejects an invalid model id in modelRouting with a 400 error', async () => {
      const req = {
        json: async () => ({
          modelRouting: { planner: 'invalid-non-existent-model' },
        }),
      } as unknown as Request;

      const res = await PUT(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.message).toBe('Invalid request body');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
