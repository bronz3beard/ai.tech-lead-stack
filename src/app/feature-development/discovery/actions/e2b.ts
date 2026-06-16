'use server';

import { Sandbox } from 'e2b';

/**
 * Server Actions for managing E2B Sandbox lifecycle and filesystem post-boot.
 * We use Server Actions here because the E2B SDK relies on Node.js modules 
 * (like `node:fs`) which cannot be bundled in Client Components.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

async function getApiKey(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Could not fetch user session.');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { e2bApiKey: true },
  });

  if (!user?.e2bApiKey) {
    throw new Error('Sandbox Environment API Key is not configured. Please add it in Settings > API Keys.');
  }

  return decrypt(user.e2bApiKey);
}

export async function writeSandboxFileAction(sandboxId: string, path: string, content: string) {
  try {
    const apiKey = await getApiKey();
    const sandbox = await Sandbox.connect(sandboxId, { apiKey });
    
    // Ensure parent directory exists
    const parts = path.split('/');
    if (parts.length > 1) {
      const dir = path.substring(0, path.lastIndexOf('/'));
      await sandbox.commands.run(`mkdir -p "${dir}"`);
    }
    
    await sandbox.files.write(path, content);
    return { success: true };
  } catch (error: any) {
    console.error(`[E2B Action] Failed to write file ${path}:`, error);
    return { success: false, error: error.message };
  }
}

export async function readSandboxFileAction(sandboxId: string, path: string) {
  try {
    const apiKey = await getApiKey();
    const sandbox = await Sandbox.connect(sandboxId, { apiKey });
    const content = await sandbox.files.read(path);
    return { success: true, content };
  } catch (error: any) {
    console.error(`[E2B Action] Failed to read file ${path}:`, error);
    return { success: false, error: error.message };
  }
}

export async function killSandboxAction(sandboxId: string) {
  try {
    const apiKey = await getApiKey();
    const sandbox = await Sandbox.connect(sandboxId, { apiKey });
    await sandbox.kill();
    return { success: true };
  } catch (error: any) {
    // If it fails to connect, it might already be dead, which is fine
    console.warn(`[E2B Action] Failed to kill sandbox ${sandboxId}:`, error.message);
    return { success: false, error: error.message };
  }
}
