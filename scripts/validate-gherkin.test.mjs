import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { validateGherkin } from './validate-gherkin.mjs';

const IMPERATIVE_FIXTURE = path.join(
  process.cwd(),
  'tests/fixtures/imperative-fail.feature'
);
const MALFORMED_FIXTURE = path.join(
  process.cwd(),
  'tests/fixtures/malformed-fail.feature'
);
const VALID_FIXTURE = path.join(
  process.cwd(),
  'tests/fixtures/valid-declarative.feature'
);
const CLI_SCRIPT = path.join(process.cwd(), 'scripts/validate-gherkin.mjs');

test('validateGherkin - valid declarative feature', () => {
  const content = fs.readFileSync(VALID_FIXTURE, 'utf8');
  const result = validateGherkin(content);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('validateGherkin - imperative steps fail', () => {
  const content = fs.readFileSync(IMPERATIVE_FIXTURE, 'utf8');
  const result = validateGherkin(content);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('type')));
  assert.ok(result.errors.some((e) => e.includes('click')));
});

test('validateGherkin - malformed structure fails', () => {
  const content = fs.readFileSync(MALFORMED_FIXTURE, 'utf8');
  const result = validateGherkin(content);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Feature:')));
});

test('CLI exit code - invalid feature exits with 1', () => {
  const result = spawnSync(process.execPath, [CLI_SCRIPT, IMPERATIVE_FIXTURE]);
  assert.strictEqual(result.status, 1, 'Should exit 1 on imperative failure');
});

test('CLI exit code - malformed feature exits with 1', () => {
  const result = spawnSync(process.execPath, [CLI_SCRIPT, MALFORMED_FIXTURE]);
  assert.strictEqual(result.status, 1, 'Should exit 1 on malformed failure');
});

test('CLI exit code - valid feature exits with 0', () => {
  const result = spawnSync(process.execPath, [CLI_SCRIPT, VALID_FIXTURE]);
  assert.strictEqual(result.status, 0, 'Should exit 0 on valid feature');
});
