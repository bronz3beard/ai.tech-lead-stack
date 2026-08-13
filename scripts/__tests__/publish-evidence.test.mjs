import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('publish-evidence (integration mock check)', () => {
  it('should not contain any reference to upload-evidence.mjs', () => {
    const scriptPath = path.resolve('scripts/publish-evidence.mjs');
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert.strictEqual(content.includes('upload-evidence.mjs'), false);
  });

  it('should not contain any reference to git add .', () => {
    const scriptPath = path.resolve('scripts/publish-evidence.mjs');
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert.strictEqual(content.includes('git add .'), false);
    assert.strictEqual(content.includes('git checkout'), false);
  });
});

describe('verify-evidence (integration mock check)', () => {
  it('should not contain any reference to upload-evidence.mjs', () => {
    const scriptPath = path.resolve('scripts/verify-evidence.mjs');
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert.strictEqual(content.includes('upload-evidence.mjs'), false);
  });

  it('should not include an Authorization header in options', () => {
    const scriptPath = path.resolve('scripts/verify-evidence.mjs');
    const content = fs.readFileSync(scriptPath, 'utf8');
    // Ensure we don't accidentally set Authorization in code. (ignore comments)
    const code = content.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert.strictEqual(code.includes('Authorization:'), false);
    assert.strictEqual(code.includes('authorization:'), false);
  });
});
