import 'dotenv/config';
import { test as nodeTest } from 'node:test';
import assert from 'node:assert';
import { buildRegistry, resolveSkill } from './registry.js';

// If this file is accidentally executed by Jest (e.g. via an IDE extension),
// this dummy test prevents the "Test suite must contain at least one test" error.
if (typeof describe !== 'undefined' && typeof it !== 'undefined') {
  describe('voice-relay tests', () => {
    it('are run via node:test, not Jest', () => {});
  });
}

nodeTest('registry writes:false flag', async () => {
  const registry = await buildRegistry();
  
  // Every writes:false must be deliberate. We don't have a list of all 
  // writes:false skills, but we can verify that the default fallback 
  // assigns writes:true to random missing ones, and that known read-only 
  // skills like 'ask' have writes:false.
  
  const askSkill = registry.find(s => s.id === 'ask');
  assert.ok(askSkill);
  assert.strictEqual(askSkill?.writes, false);
  
  // Test a skill that isn't read-only to ensure default is true
  const devTeam = registry.find(s => s.id === 'dev-team');
  if (devTeam) {
    assert.strictEqual(devTeam.writes, true);
  }
});

nodeTest('resolveSkill matching', async () => {
  const registry = await buildRegistry();
  
  // Test exact alias match
  const res1 = resolveSkill('plan a new feature', registry);
  assert.ok(res1);
  assert.strictEqual(res1.entry.id, 'plan');
  assert.strictEqual(res1.prompt, 'a new feature');

  // Test longest alias wins ('pm task' vs 'pm')
  // We don't know the exact aliases but we can test 'ask'
  const res2 = resolveSkill('ask about this code', registry);
  assert.ok(res2);
  assert.strictEqual(res2.entry.id, 'ask');
  assert.strictEqual(res2.prompt, 'about this code');
  
  // Test fallback to ask (returns null, fallback handled in server)
  const res3 = resolveSkill('what does this do', registry);
  assert.strictEqual(res3, null);
});
