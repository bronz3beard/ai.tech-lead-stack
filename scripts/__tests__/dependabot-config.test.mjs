import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const config = fs.readFileSync(
  path.join(repoRoot, '.github', 'dependabot.yml'),
  'utf8'
);

// The npm entry runs from "- package-ecosystem: npm" to the next ecosystem.
const npmBlock = config.match(
  /- package-ecosystem: npm\n([\s\S]*?)(?=\n {2}- package-ecosystem:|$)/
)?.[1];

describe('dependabot npm groups', () => {
  test('has an npm update entry', () => {
    assert.ok(npmBlock, 'no "package-ecosystem: npm" entry found');
  });

  test('groups ai and every @ai-sdk/* package, majors included, into one PR', () => {
    // A provider major only works with the matching ai major, so separate PRs
    // (as with #127-#129) can never pass CI on their own.
    const group = npmBlock.match(/ {6}ai-sdk:\n((?: {8}.*\n?)+)/)?.[1];
    assert.ok(group, 'no "ai-sdk" group in the npm entry');
    assert.match(group, /patterns: \[[^\]]*'ai'[^\]]*'@ai-sdk\/\*'[^\]]*\]/);
    assert.match(group, /update-types: \[[^\]]*major[^\]]*\]/);
  });

  test('lists ai-sdk before minor-and-patch, since the first matching group wins', () => {
    const aiSdk = npmBlock.indexOf('ai-sdk:');
    const minorAndPatch = npmBlock.indexOf('minor-and-patch:');
    assert.ok(aiSdk !== -1 && minorAndPatch !== -1);
    assert.ok(aiSdk < minorAndPatch);
  });
});
