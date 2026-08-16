import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scanProjects } from './projects.js';

test('recursive project discovery', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-test-'));
  
  try {
    // Structure:
    // /monorepo/.git (should be found, don't descend)
    // /monorepo/nested/.git (should NOT be found because it's inside monorepo)
    // /category/repo1/.git (deeply nested repo, should be found)
    // /category/node_modules/repo2/.git (should be skipped)
    // /ignored-repo/.git (should be ignored by aliases overlay if we mocked it, but we can't easily mock it without writing the json file)
    
    // Create project-aliases.json in the parent of the src dir (which is process.cwd() for tests typically, but the URL in projects.ts looks relative to projects.js)
    // We'll just test the directory logic here.

    fs.mkdirSync(path.join(tmpRoot, 'monorepo', '.git'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'monorepo', 'nested', '.git'), { recursive: true });
    
    fs.mkdirSync(path.join(tmpRoot, 'category', 'repo1', '.git'), { recursive: true });
    
    fs.mkdirSync(path.join(tmpRoot, 'category', 'node_modules', 'repo2', '.git'), { recursive: true });
    
    fs.mkdirSync(path.join(tmpRoot, 'ignored-repo', '.git'), { recursive: true });

    // Mock project-aliases.json in the dir above src
    const srcParent = path.resolve(process.cwd()); // tests run in peripheral root
    const mockAliases = { _ignore: ['ignored-repo'] };
    fs.writeFileSync(path.join(srcParent, 'project-aliases.json'), JSON.stringify(mockAliases));

    const projects = scanProjects(tmpRoot);
    
    const ids = projects.map(p => p.id).sort();
    assert.deepStrictEqual(ids, ['monorepo', 'repo1']);
    
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    try {
      fs.unlinkSync(path.resolve(process.cwd(), 'project-aliases.json'));
    } catch { /* ignore */ }
  }
});
