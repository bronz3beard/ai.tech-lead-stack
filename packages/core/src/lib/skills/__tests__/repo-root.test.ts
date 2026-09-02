import * as fs from 'fs';
import * as path from 'path';
import { findRepoRoot } from '../repo-root';
import { FileSystemService } from '../fs-service';

describe('Repo Root & Skill Discovery Resolution', () => {
  it('findRepoRoot resolves the tech-lead-stack root containing .ai/skills and .agents/workflows', () => {
    const root = findRepoRoot(__dirname);
    expect(fs.existsSync(path.join(root, '.ai', 'skills'))).toBe(true);
    expect(fs.existsSync(path.join(root, '.agents', 'workflows'))).toBe(true);
    expect(fs.existsSync(path.join(root, '.ai', 'skills', 'planning-expert-quick.md'))).toBe(true);
  });

  it('findRepoRoot resolves correctly from simulated dist directory', () => {
    const simulatedDistDir = path.resolve(__dirname, '../../../dist');
    const root = findRepoRoot(simulatedDistDir);
    expect(fs.existsSync(path.join(root, '.ai', 'skills'))).toBe(true);
    expect(path.basename(root)).toBe('tech-lead-stack');
  });

  it('findRepoRoot resolves correctly from simulated packages directory', () => {
    const simulatedPackagesDir = path.resolve(__dirname, '../../../../');
    const root = findRepoRoot(simulatedPackagesDir);
    expect(fs.existsSync(path.join(root, '.ai', 'skills'))).toBe(true);
    expect(path.basename(root)).toBe('tech-lead-stack');
  });

  it('FileSystemService self-heals when passed an incorrect repoRoot (e.g. packages/core)', async () => {
    const incorrectRoot = path.resolve(__dirname, '../../..'); // points to packages/core
    expect(fs.existsSync(path.join(incorrectRoot, '.ai', 'skills'))).toBe(false);

    const fsService = new FileSystemService(incorrectRoot);
    const skill = await fsService.readSkill('planning-expert-quick');

    expect(skill).not.toBeNull();
    expect(skill?.content).toContain('name: planning-expert-quick');
    expect(skill?.path).toContain('.ai/skills/planning-expert-quick.md');
  });

  it('FileSystemService finds planning-expert-quick and lists available skills', async () => {
    const root = findRepoRoot();
    const fsService = new FileSystemService(root);

    const skill = await fsService.readSkill('planning-expert-quick');
    expect(skill).not.toBeNull();
    expect(skill?.content).toContain('planning-expert-quick');

    const searchDirs = fsService.getSearchDirs();
    expect(searchDirs.some((dir) => dir.endsWith(path.join('.ai', 'skills')))).toBe(true);
    expect(searchDirs.some((dir) => dir.endsWith(path.join('.agents', 'workflows')))).toBe(true);
  });
});
