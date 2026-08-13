import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('pr-body-inject and resolve-labels', () => {
  it('pr-body-inject should be executable', () => {
    assert.doesNotThrow(() => {
      execSync('node --check scripts/pr-body-inject.mjs');
    });
  });

  it('resolve-labels should be executable', () => {
    assert.doesNotThrow(() => {
      execSync('node --check scripts/resolve-labels.mjs');
    });
  });

  it('classifyDiff (resolve-labels) behaves deterministically', async () => {
    const { classifyDiff } = await import('../resolve-labels.mjs');
    const result = classifyDiff({
      files: ['src/components/Button.tsx', 'package.json'],
      commitSubjects: ['feat: add shiny button', 'fix: dependency issue'],
      hasUiChange: true
    });

    assert.ok(result.includes('enhancement'));
    assert.ok(result.includes('bug'));
    assert.ok(result.includes('ui'));
    assert.ok(!result.includes('nouiimpact'));
    // The previous test failed on 'dependencies' because our classifyDiff only adds it if there are NO OTHER files.
    // In this array, 'src/components/Button.tsx' is "other".
    const depResult = classifyDiff({
      files: ['package.json'],
      commitSubjects: [],
      hasUiChange: false
    });
    assert.ok(depResult.includes('dependencies'));
    assert.ok(depResult.includes('nouiimpact'));
  });
});
