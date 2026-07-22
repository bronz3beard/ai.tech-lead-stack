import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  makeFakeClientRepo,
  snapshotTree,
  assertNoRepoWrites,
  spyOnFsWrites,
  spyOnChildProcess,
} from '../../../__tests__/helpers/readonly-harness';

describe('createAgentTools - Readonly & Temp Confinement', () => {
  const originalCwd = process.cwd();
  let fakeClientRepo: { root: string; cleanup: () => void };
  let cpSpy: { calls: any[]; restore: () => void };

  beforeEach(() => {
    fakeClientRepo = makeFakeClientRepo();
    process.chdir(fakeClientRepo.root);
    cpSpy = spyOnChildProcess();
    jest.resetModules();
  });

  afterEach(() => {
    cpSpy.restore();
    process.chdir(originalCwd);
    fakeClientRepo.cleanup();
  });

  it('lint_and_format: (a) writes under os.tmpdir(), (b) removes tempDir after use, (c) leaves clientRoot unchanged', async () => {
    const { createAgentTools } = require('../agent-tools');
    const tools: any = createAgentTools(
      '--- \nname: test-skill\ndescription: test\ncost: ~500 tokens\nmodes: [read-only]\n---'
    );
    const beforeTree = snapshotTree(fakeClientRepo.root);
    const { writes, restore } = spyOnFsWrites();

    let createdTempDir = '';

    try {
      const sampleContent =
        '---\nname: test-skill\ndescription: sample\ncost: ~500 tokens\nmodes: [read-only]\n---\n# Test Skill';
      const result = await tools.lint_and_format.execute(
        { content: sampleContent },
        {} as any
      );

      expect(result.success).toBe(true);

      // (a) Assert all writes land inside os.tmpdir() and ZERO writes land inside clientRoot
      expect(writes.length).toBeGreaterThan(0);
      const tmpDirPrefix = fs.realpathSync(os.tmpdir());

      for (const w of writes) {
        const isTmp =
          w.path.startsWith(tmpDirPrefix) ||
          w.path.startsWith(path.resolve(os.tmpdir()));
        expect(isTmp).toBe(true);
        expect(w.path.startsWith(fakeClientRepo.root)).toBe(false);

        if (w.method.includes('mkdir') || w.method.includes('writeFile')) {
          const dir = w.path.endsWith('temp-skill.md')
            ? path.dirname(w.path)
            : w.path;
          if (dir.includes('skill-lint-')) {
            createdTempDir = dir;
          }
        }
      }

      // (b) Assert temp dir is removed after execution
      expect(createdTempDir).not.toBe('');
      expect(fs.existsSync(createdTempDir)).toBe(false);

      const afterTree = snapshotTree(fakeClientRepo.root);

      // (c) Assert fake clientRoot is unchanged
      assertNoRepoWrites(beforeTree, afterTree, { allow: [] });
    } finally {
      restore();
    }
  });

  it('validate_ethos: (a) writes under os.tmpdir(), (b) removes tempDir after use, (c) leaves clientRoot unchanged', async () => {
    const { createAgentTools } = require('../agent-tools');
    const tools: any = createAgentTools(
      '--- \nname: ethos-skill\ndescription: ethos\ncost: ~500 tokens\nmodes: [read-only]\n---'
    );
    const beforeTree = snapshotTree(fakeClientRepo.root);
    const { writes, restore } = spyOnFsWrites();

    let createdTempDir = '';

    try {
      const sampleContent =
        '---\nname: ethos-skill\ndescription: ethos\ncost: ~500 tokens\nmodes: [read-only]\n---\n# Ethos Skill';
      const result = await tools.validate_ethos.execute(
        { content: sampleContent },
        {} as any
      );

      expect(result.success).toBe(true);

      // (a) Assert all writes land inside os.tmpdir() and ZERO writes land inside clientRoot
      expect(writes.length).toBeGreaterThan(0);
      const tmpDirPrefix = fs.realpathSync(os.tmpdir());

      for (const w of writes) {
        const isTmp =
          w.path.startsWith(tmpDirPrefix) ||
          w.path.startsWith(path.resolve(os.tmpdir()));
        expect(isTmp).toBe(true);
        expect(w.path.startsWith(fakeClientRepo.root)).toBe(false);

        if (w.method.includes('mkdir') || w.method.includes('writeFile')) {
          const dir = w.path.endsWith('temp-skill.md')
            ? path.dirname(w.path)
            : w.path;
          if (dir.includes('skill-validate-')) {
            createdTempDir = dir;
          }
        }
      }

      // (b) Assert temp dir is removed after execution
      expect(createdTempDir).not.toBe('');
      expect(fs.existsSync(createdTempDir)).toBe(false);

      const afterTree = snapshotTree(fakeClientRepo.root);

      // (c) Assert fake clientRoot is unchanged
      assertNoRepoWrites(beforeTree, afterTree, { allow: [] });
    } finally {
      restore();
    }
  });

  it('check_schema and update_skill_template make ZERO filesystem writes', async () => {
    const { createAgentTools } = require('../agent-tools');
    const tools: any = createAgentTools(
      '--- \nname: schema-skill\ndescription: schema\ncost: ~500 tokens\nmodes: [read-only]\n---'
    );
    const beforeTree = snapshotTree(fakeClientRepo.root);
    const { writes, restore } = spyOnFsWrites();

    try {
      const schemaResult = await tools.check_schema.execute(
        {
          content:
            '---\nname: valid\ndescription: desc\ncost: ~100 tokens\n---',
        },
        {} as any
      );
      expect(schemaResult.success).toBe(true);

      const updateResult = await tools.update_skill_template.execute(
        {
          newContent: '# Refined Content',
          explanation: 'Refined skill structure',
        },
        {} as any
      );
      expect(updateResult.success).toBe(true);

      // Assert zero writes to disk
      expect(writes).toHaveLength(0);

      const afterTree = snapshotTree(fakeClientRepo.root);
      assertNoRepoWrites(beforeTree, afterTree, { allow: [] });
    } finally {
      restore();
    }
  });
});
