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
import { Octokit } from 'octokit';

const execFileAsync = promisify(execFile);

/**
 * Fetches the authenticated user's GitHub username.
 */
async function getGitHubUsername(token: string) {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.rest.users.getAuthenticated();
  return data.login;
}

export async function validateSkill(content: string) {
  // ... (keeping validateSkill as is)
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
  const octokit = new Octokit({ auth: token });

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

  try {
    // 1. Get Repo Information
    const remoteRes = await execFileAsync('git', ['config', '--get', 'remote.origin.url']);
    const remoteUrl = remoteRes.stdout.trim();
    
    // Parse owner and repo from URL
    // Examples:
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    const cleanUrl = remoteUrl.trim().replace(/\.git$/, '');
    const match = cleanUrl.match(/github\.com[:/]([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Could not parse GitHub owner/repo from remote URL: ${remoteUrl}`);
    }
    const owner = match[1];
    const repo = match[2];

    // 2. Get Authenticated User (for assignment)
    const githubUser = await getGitHubUsername(token);

    // 3. GitHub API Operations

    // Get main branch SHA
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: 'heads/main',
    });
    const mainSha = refData.object.sha;

    // Create new branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainSha,
    });

    // Create the file
    const skillPath = `.ai/skills/${fileName}`;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: skillPath,
      message: `Add new skill: ${parsedName}`,
      content: Buffer.from(content).toString('base64'),
      branch: branchName,
      committer: {
        name: 'Interlink Bot',
        email: 'bot@interlink.local',
      },
      author: {
        name: session.user.name || 'Interlink User',
        email: session.user.email || 'user@interlink.local',
      },
    });

    // Create Draft PR
    const { data: prData } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: `Add new skill: ${parsedName}`,
      head: branchName,
      base: 'main',
      body: `Automated PR for new skill.\n\nDescription: ${parsedDescription}`,
      draft: true,
    });

    // Assign to user
    await octokit.rest.issues.addAssignees({
      owner,
      repo,
      issue_number: prData.number,
      assignees: [githubUser],
    });

    return { 
      success: true, 
      message: 'Draft PR created successfully!', 
      prUrl: prData.html_url 
    };

  } catch (error: unknown) {
    console.error('Submission failed:', error);
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    const message = err.response?.data?.message || err.message || 'Submission failed';
    return { success: false, message: `GitHub Error: ${message}` };
  }
}
