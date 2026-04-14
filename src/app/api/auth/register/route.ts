import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['DESIGNER', 'QA', 'PM']).optional().default('PM'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password, role } = parsed.data;

    // Configurable Domain Validation
    const allowedDomainsEnv = process.env.ALLOWED_DOMAINS || '';
    const allowedDomains = allowedDomainsEnv
      .replace(/[\[\]'"]/g, '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const domain = email.split('@')[1].toLowerCase();

    if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
      return NextResponse.json(
        {
          message: `Invalid email domain. Authorized domains: ${allowedDomains.join(', ')}`,
        },
        { status: 403 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });

    if (existingUser) {
      const methods: string[] = [];
      if (existingUser.password_hash) methods.push('Email/Password');
      if (existingUser.accounts.length > 0) {
        existingUser.accounts.forEach((acc) => {
          const provider =
            acc.provider.charAt(0).toUpperCase() + acc.provider.slice(1);
          if (!methods.includes(provider)) methods.push(provider);
        });
      }

      const methodString =
        methods.length > 0 ? methods.join(' and ') : 'an unknown method';

      return NextResponse.json(
        {
          message: `An account already exists for this email. It was created via ${methodString}. Please sign in using that method.`,
        },
        { status: 409 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    await prisma.user.create({
      data: {
        email,
        password_hash,
        role: role as any,
      },
    });

    return NextResponse.json(
      { message: 'User created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
