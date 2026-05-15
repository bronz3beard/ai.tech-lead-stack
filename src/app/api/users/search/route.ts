import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

/**
 * @desc Searches for users by email. Used for project sharing.
 * @param req query param 'q' for the email search term
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: query,
          mode: 'insensitive',
        },
        // Don't include the current user in search results
        NOT: {
          id: session.user.id,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
      },
      limit: 10,
    } as any); // cast to any because prisma findMany might not have 'limit' if it's named 'take'

    // Fix for Prisma 'take' vs 'limit'
    const usersFixed = await prisma.user.findMany({
      where: {
        email: {
          contains: query,
          mode: 'insensitive',
        },
        NOT: {
          id: session.user.id,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
      },
      take: 10,
    });

    return NextResponse.json({ users: usersFixed });
  } catch (error) {
    console.error('User search error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
