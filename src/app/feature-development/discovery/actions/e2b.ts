'use server';

import { Sandbox } from 'e2b';

/**
 * Server Actions for managing E2B Sandbox lifecycle and filesystem post-boot.
 * We use Server Actions here because the E2B SDK relies on Node.js modules 
 * (like `node:fs`) which cannot be bundled in Client Components.
 */

function getApiKey(): string {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error('E2B_API_KEY is not defined in the environment.');
  }
  return apiKey;
}

export async function writeSandboxFileAction(sandboxId: string, path: string, content: string) {
  try {
    const sandbox = await Sandbox.connect(sandboxId, { apiKey: getApiKey() });
    
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
    const sandbox = await Sandbox.connect(sandboxId, { apiKey: getApiKey() });
    const content = await sandbox.files.read(path);
    return { success: true, content };
  } catch (error: any) {
    console.error(`[E2B Action] Failed to read file ${path}:`, error);
    return { success: false, error: error.message };
  }
}

export async function killSandboxAction(sandboxId: string) {
  try {
    const sandbox = await Sandbox.connect(sandboxId, { apiKey: getApiKey() });
    await sandbox.kill();
    return { success: true };
  } catch (error: any) {
    // If it fails to connect, it might already be dead, which is fine
    console.warn(`[E2B Action] Failed to kill sandbox ${sandboxId}:`, error.message);
    return { success: false, error: error.message };
  }
}
