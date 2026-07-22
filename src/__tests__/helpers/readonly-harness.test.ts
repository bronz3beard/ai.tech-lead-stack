import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import {
  makeFakeClientRepo,
  snapshotTree,
  assertNoRepoWrites,
  spyOnFsWrites,
  spyOnChildProcess,
  readSkillModes,
} from './readonly-harness';

describe('readonly-harness', () => {
  let fakeRepo: { root: string; cleanup: () => void };

  beforeEach(() => {
    fakeRepo = makeFakeClientRepo();
  });

  afterEach(() => {
    fakeRepo.cleanup();
  });

  describe('makeFakeClientRepo & snapshotTree', () => {
    it('creates standard client repo files including .git markers', () => {
      expect(fs.existsSync(path.join(fakeRepo.root, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(fakeRepo.root, 'src/index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(fakeRepo.root, 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(fakeRepo.root, '.git/HEAD'))).toBe(true);
      expect(fs.existsSync(path.join(fakeRepo.root, '.git/config'))).toBe(true);
    });

    it('round-trips snapshotTree and tracks files under .git', () => {
      const snapshot = snapshotTree(fakeRepo.root);

      expect(snapshot.has('package.json')).toBe(true);
      expect(snapshot.has('src/index.ts')).toBe(true);
      expect(snapshot.has('README.md')).toBe(true);
      expect(snapshot.has('.git/HEAD')).toBe(true);
      expect(snapshot.has('.git/config')).toBe(true);
      expect(snapshot.size).toBe(5);
    });
  });

  describe('assertNoRepoWrites', () => {
    it('passes for an untouched repo snapshot', () => {
      const before = snapshotTree(fakeRepo.root);
      const after = snapshotTree(fakeRepo.root);

      expect(() => assertNoRepoWrites(before, after)).not.toThrow();
    });

    it('fails when a new file is added', () => {
      const before = snapshotTree(fakeRepo.root);

      fs.writeFileSync(path.join(fakeRepo.root, 'unexpected.txt'), 'data');

      const after = snapshotTree(fakeRepo.root);

      expect(() => assertNoRepoWrites(before, after)).toThrow(
        /Unauthorized repository writes detected:\nAdded files: unexpected\.txt/
      );
    });

    it('fails when an existing file is modified', () => {
      const before = snapshotTree(fakeRepo.root);

      fs.writeFileSync(path.join(fakeRepo.root, 'README.md'), '# Modified README');

      const after = snapshotTree(fakeRepo.root);

      expect(() => assertNoRepoWrites(before, after)).toThrow(
        /Unauthorized repository writes detected:\nModified files: README\.md/
      );
    });

    it('fails when an existing file is removed', () => {
      const before = snapshotTree(fakeRepo.root);

      fs.unlinkSync(path.join(fakeRepo.root, 'src/index.ts'));

      const after = snapshotTree(fakeRepo.root);

      expect(() => assertNoRepoWrites(before, after)).toThrow(
        /Unauthorized repository writes detected:\nRemoved files: src\/index\.ts/
      );
    });

    it('passes when changes occur exclusively in allowed paths', () => {
      const before = snapshotTree(fakeRepo.root);

      const alignmentPath = path.join(fakeRepo.root, '.ai/.mission-alignment.json');
      fs.mkdirSync(path.dirname(alignmentPath), { recursive: true });
      fs.writeFileSync(alignmentPath, JSON.stringify({ aligned: true }));

      const after = snapshotTree(fakeRepo.root);

      expect(() =>
        assertNoRepoWrites(before, after, {
          allow: ['.ai/.mission-alignment.json'],
        })
      ).not.toThrow();
    });
  });

  describe('spyOnFsWrites', () => {
    it('records synchronous and asynchronous fs writes and restores cleanly', async () => {
      const { writes, restore } = spyOnFsWrites();

      const testFile = path.join(fakeRepo.root, 'fs-test.txt');
      fs.writeFileSync(testFile, 'sync content');
      await fs.promises.writeFile(testFile, 'async content');

      expect(writes.length).toBe(2);
      expect(writes[0]).toEqual({
        method: 'writeFileSync',
        path: testFile,
        args: [testFile, 'sync content'],
      });
      expect(writes[1]).toEqual({
        method: 'fs.promises.writeFile',
        path: testFile,
        args: [testFile, 'async content'],
      });

      restore();

      const writesAfterRestore = writes.length;
      fs.writeFileSync(testFile, 'after restore');
      expect(writes.length).toBe(writesAfterRestore);
    });
  });

  describe('spyOnChildProcess', () => {
    it('records child_process execution commands and arguments and restores cleanly', () => {
      const { calls, restore } = spyOnChildProcess();

      child_process.execSync('echo hello');
      child_process.spawnSync('git', ['status']);

      expect(calls.length).toBe(2);
      expect(calls[0]).toEqual({
        method: 'execSync',
        command: 'echo hello',
        args: [],
        fullCommand: 'echo hello',
      });
      expect(calls[1]).toEqual({
        method: 'spawnSync',
        command: 'git',
        args: ['status'],
        fullCommand: 'git status',
      });

      restore();

      const callsAfterRestore = calls.length;
      child_process.execSync('echo world');
      expect(calls.length).toBe(callsAfterRestore);
    });
  });

  describe('readSkillModes', () => {
    it('parses frontmatter modes array correctly from skill file', () => {
      const skillPath = path.join(fakeRepo.root, 'test-skill.md');
      const skillContent = [
        '---',
        'name: test-skill',
        'modes: [read-only, mcp]',
        '---',
        '# Test Skill Body',
      ].join('\n');

      fs.writeFileSync(skillPath, skillContent);

      const modes = readSkillModes(skillPath);
      expect(modes).toEqual(['read-only', 'mcp']);
    });

    it('returns empty array if file is missing or frontmatter modes are absent', () => {
      const noModesPath = path.join(fakeRepo.root, 'no-modes.md');
      fs.writeFileSync(noModesPath, '---\nname: no-modes\n---\nBody');

      expect(readSkillModes(noModesPath)).toEqual([]);
      expect(readSkillModes(path.join(fakeRepo.root, 'non-existent.md'))).toEqual([]);
    });
  });
});
