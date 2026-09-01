import { readFile } from 'fs/promises';
import { join } from 'path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * @desc API endpoint to fetch the E2E Testing Guide markdown content.
 * This is used to render a "How-To" section in the Design Review sidebar.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const filePath = join(process.cwd(), 'src/app/design-review/E2E_TESTING_GUIDE.md');
    const content = await readFile(filePath, 'utf-8');

    return NextResponse.json({ content });
  } catch (error) {
    console.error('[testing-guide] GET error:', error);
    return NextResponse.json(
      { message: 'Failed to load testing guide.' },
      { status: 500 }
    );
  }
}
