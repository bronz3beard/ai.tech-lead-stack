#!/usr/bin/env node
/**
 * @file publish-evidence.mjs
 * @description Uploads captured visual evidence to a branch on the same repository
 *              by using the GitHub Git Data API (no worktree checkouts).
 *              Falls back to local file path (Path B) for private repositories
 *              to prevent inline attachment breaking due to Camo proxies.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const originalLog = console.log;
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    console.error('Missing or invalid manifest path argument.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { featureBranch, shots } = manifest;

  if (!shots || shots.length === 0) {
    console.warn('No shots found in manifest.');
    process.exit(0);
  }

  // Retrieve GitHub Context using GitHub CLI
  let repoData;
  try {
    const rawData = execSync('gh api repos/{owner}/{repo}', {
      encoding: 'utf-8',
    });
    repoData = JSON.parse(rawData);
  } catch (err) {
    console.error(
      'Failed to fetch repository information using GitHub CLI:',
      err.message
    );
    process.stdout.write(
      JSON.stringify({ path: 'B', reason: 'github_api_error' }, null, 2) + '\n'
    );
    process.exit(0);
  }

  if (repoData.private) {
    console.warn(
      'Private repository detected. Evidence will not be pushed (Path B fallback).'
    );
    process.stdout.write(
      JSON.stringify(
        {
          path: 'B',
          reason: 'private_repository',
          localFolder: manifest.outputDir,
          shots: shots.filter((s) => s.status === 'captured'),
        },
        null,
        2
      ) + '\n'
    );
    process.exit(0);
  }

  if (!repoData.permissions || !repoData.permissions.push) {
    console.warn(
      'No push permission detected. Evidence will not be pushed (Path B fallback).'
    );
    process.stdout.write(
      JSON.stringify(
        {
          path: 'B',
          reason: 'no_push_permission',
          localFolder: manifest.outputDir,
          shots: shots.filter((s) => s.status === 'captured'),
        },
        null,
        2
      ) + '\n'
    );
    process.exit(0);
  }

  // PATH A: Public & Has Push Permission
  console.log('Proceeding with public inline embedding (Path A)...');

  const owner = repoData.owner.login;
  const repo = repoData.name;
  const evidenceBranch = `pr/evidence-${featureBranch}`;

  // Step 1: Create Blobs
  const tree = [];
  for (const shot of shots) {
    if (shot.status !== 'captured') continue;
    const content = fs.readFileSync(shot.path).toString('base64');
    try {
      const result = execSync(
        `gh api repos/${owner}/${repo}/git/blobs -X POST -f content="${content}" -f encoding="base64"`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      const blob = JSON.parse(result);
      const gitPath = `screenshots/${featureBranch}/${shot.viewport}.png`;
      tree.push({
        path: gitPath,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
      console.log(`Uploaded blob for ${shot.viewport}: ${blob.sha}`);
    } catch (err) {
      console.error(`Failed to upload blob for ${shot.viewport}`);
    }
  }

  if (tree.length === 0) {
    console.error('No blobs uploaded successfully.');
    process.stdout.write(
      JSON.stringify({ path: 'B', reason: 'blob_upload_failed' }, null, 2) +
        '\n'
    );
    process.exit(0);
  }

  // Step 2: Get base tree
  let baseTreeSha = null;
  let commitSha = null;
  try {
    const refResult = execSync(
      `gh api repos/${owner}/${repo}/git/ref/heads/${evidenceBranch}`,
      { encoding: 'utf-8' }
    );
    const ref = JSON.parse(refResult);
    commitSha = ref.object.sha;

    const commitResult = execSync(
      `gh api repos/${owner}/${repo}/git/commits/${commitSha}`,
      { encoding: 'utf-8' }
    );
    baseTreeSha = JSON.parse(commitResult).tree.sha;
  } catch (err) {
    console.log(
      `Branch ${evidenceBranch} does not exist yet. Will create a new one.`
    );
  }

  // Step 3: Create Tree
  let newTreeSha = null;
  try {
    const treePayload = { tree };
    if (baseTreeSha) treePayload.base_tree = baseTreeSha;

    const result = execSync(
      `gh api repos/${owner}/${repo}/git/trees -X POST --input -`,
      {
        input: JSON.stringify(treePayload),
        encoding: 'utf-8',
      }
    );
    newTreeSha = JSON.parse(result).sha;
    console.log(`Created tree: ${newTreeSha}`);
  } catch (err) {
    console.error('Failed to create tree:', err.message);
    process.stdout.write(
      JSON.stringify({ path: 'B', reason: 'tree_creation_failed' }, null, 2) +
        '\n'
    );
    process.exit(0);
  }

  // Step 4: Create Commit
  let newCommitSha = null;
  try {
    const commitPayload = {
      message: `docs(evidence): capture for ${featureBranch}`,
      tree: newTreeSha,
    };
    if (commitSha) commitPayload.parents = [commitSha];

    const result = execSync(
      `gh api repos/${owner}/${repo}/git/commits -X POST --input -`,
      {
        input: JSON.stringify(commitPayload),
        encoding: 'utf-8',
      }
    );
    newCommitSha = JSON.parse(result).sha;
    console.log(`Created commit: ${newCommitSha}`);
  } catch (err) {
    console.error('Failed to create commit:', err.message);
    process.stdout.write(
      JSON.stringify({ path: 'B', reason: 'commit_creation_failed' }, null, 2) +
        '\n'
    );
    process.exit(0);
  }

  // Step 5: Update Ref
  try {
    if (commitSha) {
      execSync(
        `gh api repos/${owner}/${repo}/git/refs/heads/${evidenceBranch} -X PATCH -f sha="${newCommitSha}" -F force=false`
      );
    } else {
      execSync(
        `gh api repos/${owner}/${repo}/git/refs -X POST -f ref="refs/heads/${evidenceBranch}" -f sha="${newCommitSha}"`
      );
    }
    console.log(`Updated ref refs/heads/${evidenceBranch} to ${newCommitSha}`);
  } catch (err) {
    console.error('Failed to update ref:', err.message);
    process.stdout.write(
      JSON.stringify({ path: 'B', reason: 'ref_update_failed' }, null, 2) + '\n'
    );
    process.exit(0);
  }

  const resultUrls = tree.map((item) => ({
    viewport: path.basename(item.path, '.png'),
    url: `https://raw.githubusercontent.com/${owner}/${repo}/${newCommitSha}/${item.path}`,
  }));

  process.stdout.write(
    JSON.stringify(
      {
        path: 'A',
        commitSha: newCommitSha,
        urls: resultUrls,
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.stdout.write(
    JSON.stringify({ path: 'B', reason: 'unexpected_error' }, null, 2) + '\n'
  );
});
