import 'dotenv/config';
import { buildRegistry } from './registry.js';

test('registry writes:false flag', () => {
  const registry = buildRegistry();
  
  // Every writes:false must be deliberate. We don't have a list of all 
  // writes:false skills, but we can verify that the default fallback 
  // assigns writes:true to random missing ones, and that known read-only 
  // skills like 'ask' have writes:false.
  
  const askSkill = registry.find(s => s.id === 'ask');
  expect(askSkill).toBeTruthy();
  expect(askSkill?.writes).toBe(false);
  
  // Test a skill that isn't read-only to ensure default is true
  const pmTask = registry.find(s => s.id === 'pm-task-specifier');
  if (pmTask) {
    expect(pmTask.writes).toBe(true);
  }
});
