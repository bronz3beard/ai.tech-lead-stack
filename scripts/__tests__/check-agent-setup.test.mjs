import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractPrompt,
  findGuideProblems,
  findProblems,
  gatherFacts,
  parseAllowed,
} from '../check-agent-setup.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const prompt = extractPrompt(
  fs.readFileSync(path.join(repoRoot, 'docs/agent-setup.md'), 'utf8')
);
const facts = gatherFacts();

describe('check-agent-setup', () => {
  test('the published prompt matches the code', () => {
    assert.deepEqual(findProblems(prompt, facts), []);
  });

  test('reads every ALLOWED list', () => {
    const allowed = parseAllowed(prompt);
    assert.ok(allowed['Toolbox tools'].includes('get_skill'));
    assert.ok(allowed['init options'].includes('--dry-run'));
    assert.ok(allowed.Tiers.includes('byo'));
  });

  test('catches a tool that does not exist', () => {
    const changed = prompt.replace(
      '`apply_patch`.',
      '`apply_patch`, `delete_repo`.'
    );
    assert.match(
      findProblems(changed, facts).join('\n'),
      /does not register: delete_repo/
    );
  });

  test('catches a real tool the prompt leaves out', () => {
    const changed = prompt.replace(', `repo_map`', '');
    assert.match(
      findProblems(changed, facts).join('\n'),
      /leaves out: repo_map/
    );
  });

  test('catches an invented option, command or guide', () => {
    const changed = prompt
      .replace('`--no-project`.', '`--no-project`, `--force`.')
      .replace('/tls:plan-quick', '/tls:plan-fast')
      .replace('docs/tiers.md', 'docs/tier-guide.md');
    const problems = findProblems(changed, facts).join('\n');
    assert.match(problems, /does not have: --force/);
    assert.match(problems, /\/tls: commands that do not exist: plan-fast/);
    assert.match(problems, /files that do not exist: docs\/tier-guide.md/);
  });

  test('the switch guide matches the code, and invented steps are caught', () => {
    const guide = fs.readFileSync(
      path.join(repoRoot, 'docs/switch-to-npm.md'),
      'utf8'
    );
    assert.deepEqual(findGuideProblems(guide, facts), []);

    const changed = guide
      .replace('init --yes', 'init --yes --silent')
      .replace('cleanup.sh" --global --apply', 'cleanup.sh" --global --purge')
      .replace('(agent-setup.md)', '(ai-setup.md)')
      .replace(
        'tech-lead-stack@latest doctor',
        'tech-lead-stack@latest repair'
      );
    const problems = findGuideProblems(changed, facts).join('\n');
    assert.match(problems, /does not have: --silent/);
    assert.match(problems, /cleanup.sh options that do not exist: --purge/);
    assert.match(problems, /do not exist: docs\/ai-setup.md/);
    assert.match(
      problems,
      /commands the tech-lead-stack command does not have: repair/
    );
  });

  test('fails rather than passing when it finds nothing to check', () => {
    const problems = findProblems('no allowed list here', facts);
    assert.ok(problems.some((p) => p.includes('lists nothing')));
    assert.ok(problems.some((p) => p.includes('no /tls: commands')));
  });
});
