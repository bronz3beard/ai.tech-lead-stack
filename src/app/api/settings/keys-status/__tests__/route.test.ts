jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      json: async () => body,
    })),
  },
}));

import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

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
  },
}));

describe('/api/settings/keys-status API Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.JULES_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 401 Unauthorized if no active session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.message).toBe('Unauthorized');
  });

  it('returns key slot status evaluating DB keys and environment variables without leaking keys', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1' },
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      claudeApiKey: 'encrypted_claude_key',
      geminiApiKey: null,
      openaiApiKey: null,
      julesApiKey: null,
    });

    process.env.OPENAI_API_KEY = 'sk-env-openai-key';

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      anthropic: true, // from DB
      gemini: false, // neither DB nor env
      openai: true, // from env
      jules: false, // neither DB nor env
    });
  });
});
