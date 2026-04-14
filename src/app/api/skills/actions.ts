'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';

const execFileAsync = promisify(execFile);

export async function validateSkill(content: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, message: 'Unauthorized' };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-validate-'));
  const tempFile = path.join(tempDir, 'temp-skill.md');

  try {
    await fs.writeFile(tempFile, content, 'utf-8');

    // Format with Prettier
    await execFileAsync('npx', ['prettier', '--write', tempFile]);

    // Validate using script
    const { stdout } = await execFileAsync('bash', ['scripts/validate-skills.sh', tempFile]);
    return { success: true, message: stdout || 'Validation successful' };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return { success: false, message: err.stdout || err.stderr || err.message || 'Validation failed' };
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to cleanup temp directory', e);
    }
  }
}

export async function submitSkill(content: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, message: 'Unauthorized' };
  }

  // Get user's github access token
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'github' },
  });

  if (!account?.access_token) {
    return { success: false, message: 'GitHub account not linked or access token missing. Please sign in with GitHub.' };
  }

  const token = account.access_token;

  let parsedName = '';
  let parsedDescription = '';
  try {
    const parsed = matter(content);
    parsedName = parsed.data.name;
    parsedDescription = parsed.data.description;
    if (!parsedName) throw new Error("Missing 'name' in frontmatter");
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, message: `Invalid frontmatter: ${err.message}` };
  }

  const safeName = parsedName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const branchName = `add-skill-${safeName}-${Date.now()}`;
  const fileName = `${safeName}.md`;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-submit-'));
  const tempFile = path.join(tempDir, fileName);

  try {
    // 1. Format with Prettier
    await fs.writeFile(tempFile, content, 'utf-8');
    await execFileAsync('npx', ['prettier', '--write', tempFile]);
    const formattedContent = await fs.readFile(tempFile, 'utf-8');

    // 2. Validate it just in case
    await execFileAsync('bash', ['scripts/validate-skills.sh', tempFile]);

    // 3. Git Operations - Use a shallow clone to avoid race conditions on the main repo
    const cloneDir = path.join(tempDir, 'repo');

    // We need the remote URL for the repo. Let's get it from the current repo
    const remoteRes = await execFileAsync('git', ['config', '--get', 'remote.origin.url']);
    let remoteUrl = remoteRes.stdout.trim();

    // Inject token into URL for pushing and cloning
    if (remoteUrl.startsWith('https://github.com/')) {
      remoteUrl = remoteUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
    } else if (remoteUrl.startsWith('git@github.com:')) {
      remoteUrl = remoteUrl.replace('git@github.com:', `https://x-access-token:${token}@github.com/`);
    } else {
      // Fallback to hardcoded URL if unable to parse
      remoteUrl = `https://x-access-token:${token}@github.com/bronz3beard/tech-lead-stack.git`;
    }

    // Clone the repo deeply enough to get main, or just shallow clone main
    await execFileAsync('git', ['clone', '--depth', '1', remoteUrl, cloneDir]);

    // Create new branch
    await execFileAsync('git', ['checkout', '-b', branchName], { cwd: cloneDir });

    // Write new file
    const skillDirPath = path.join(cloneDir, '.ai', 'skills');
    await fs.mkdir(skillDirPath, { recursive: true });
    const skillFilePath = path.join(skillDirPath, fileName);
    await fs.writeFile(skillFilePath, formattedContent, 'utf-8');

    // Commit and push
    await execFileAsync('git', ['add', skillFilePath], { cwd: cloneDir });
    await execFileAsync('git', ['commit', '-m', `Add new skill: ${parsedName}`], { cwd: cloneDir });

    // Set up git user
    await execFileAsync('git', ['config', 'user.email', 'bot@tech-dash.local'], { cwd: cloneDir });
    await execFileAsync('git', ['config', 'user.name', 'TechDash Bot'], { cwd: cloneDir });

    // Amend commit with author if needed, or just commit again since we just set the config
    // Actually, setting config before commit is better. Let's do that.
    await execFileAsync('git', ['commit', '--amend', '--reset-author', '--no-edit'], { cwd: cloneDir });

    await execFileAsync('git', ['push', 'origin', branchName], { cwd: cloneDir });

    // 4. Create PR via GitHub CLI
    const title = `Add new skill: ${parsedName}`;
    const body = `Automated PR for new skill.\n\nDescription: ${parsedDescription}`;

    // execute gh-pr-create.sh, passing script as argument to bash
    // Note: gh-pr-create.sh script is in the main repo. Let's use the absolute path from process.cwd()
    const scriptPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'scripts', 'gh-pr-create.sh');
    const { stdout: prStdout } = await execFileAsync('bash', [scriptPath, title, body, 'main'], {
      cwd: cloneDir, // Run in cloneDir so `gh` uses that repo context
      env: { ...process.env, GITHUB_TOKEN: token }
    });

    // Attempt to parse script output which is JSON
    let prMessage = 'PR created successfully';
    try {
      const prRes = JSON.parse(prStdout.trim());
      if (prRes.status === 'success') {
        prMessage = prRes.message;
      } else {
        throw new Error(prRes.message);
      }
    } catch {
      // If parsing fails but command succeeded, it's fine
      prMessage = prStdout;
    }

    return { success: true, message: prMessage };

  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return { success: false, message: err.stdout || err.stderr || err.message || 'Submission failed' };
  } finally {
    // Cleanup temp dir
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Failed to cleanup temp directory', e);
    }
  }
}
