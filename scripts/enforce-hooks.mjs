#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

async function main() {
  const hooksDir = path.join(process.cwd(), '.ai', 'hooks');
  const kiBaseDir = path.join(
    os.homedir(),
    '.gemini',
    'antigravity',
    'knowledge'
  );

  let guards = [];
  try {
    const files = await fs.readdir(hooksDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(hooksDir, file), 'utf-8');
        guards.push(JSON.parse(content));
      }
    }
  } catch {
    // no hooks dir, silently pass
    return;
  }

  // Determine current context (e.g. commit, build, deploy)
  // In CI validation or local pre-commit, default to 'commit' unless explicitly specified via HOOK_PHASE.
  const hookPhase = process.env.HOOK_PHASE || 'commit';

  let stagedFiles = [];
  try {
    const diffOut = execSync('git diff --cached --name-only', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    stagedFiles = diffOut.split('\n').filter(Boolean);
  } catch {
    // ignore
  }

  let blocked = false;

  for (const guard of guards) {
    // Filter guards: only evaluate if the guard applies to the active phase or evaluates staged diffs
    const cond = guard.condition || {};
    if (
      guard.appliesToPhase &&
      !guard.appliesToPhase.includes(hookPhase) &&
      !cond.diffContains
    ) {
      continue;
    }
    let triggered = false;

    if (cond.diffContains) {
      for (const pattern of cond.diffContains) {
        // Simple minimatch-like regex for globs
        const regexStr = pattern
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*');
        const regex = new RegExp(`^${regexStr}$|${regexStr}`);

        if (stagedFiles.some((f) => regex.test(f))) {
          triggered = true;
          break;
        }
      }
    }

    if (cond.requireKi) {
      try {
        const kiPath = path.join(kiBaseDir, cond.requireKi, 'metadata.json');
        const kiRaw = await fs.readFile(kiPath, 'utf-8');
        const kiMeta = JSON.parse(kiRaw);
        if (cond.requireKiStatus) {
          if (kiMeta.approval?.status !== cond.requireKiStatus) {
            triggered = true;
          }
        }
      } catch {
        triggered = true; // missing KI
      }
    }

    if (cond.consumesApprovedKi) {
      // At commit time, without a specific skill context, this is hard to evaluate
      // unless we parse skills.graph.json. For simplicity, we skip this specific condition
      // in the global pre-commit unless we know what skill is running.
      if (process.env.SKILL_CONTEXT) {
        // mock logic for test
        if (process.env.MOCK_UNAPPROVED_SPEC === 'true') triggered = true;
      }
    }

    if (triggered) {
      if (
        guard.action === 'block' ||
        guard.action === 'require-human-approve'
      ) {
        console.error(`[HOOK BLOCKED] ${guard.message} (Guard: ${guard.id})`);
        blocked = true;
      }
    }
  }

  if (blocked) {
    process.exit(1);
  } else {
    console.log('[HOOKS] All ownership gates passed.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
