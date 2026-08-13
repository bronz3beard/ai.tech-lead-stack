import path from 'path';

import {
  makeFakeClientRepo,
  snapshotTree,
  assertNoRepoWrites,
  spyOnFsWrites,
} from '../../__tests__/helpers/readonly-harness';
import { Handlers } from '../handlers';
import { FileSystemService } from '../../lib/skills/fs-service';
import { Telemetry } from '../telemetry';
import { AlignmentService } from '../../lib/skills/alignment-service';
import { KiService } from '../../lib/ki/ki-service';

// Mock langfuse to prevent ESM dynamic import issues in Jest
jest.mock('langfuse', () => ({
  Langfuse: jest.fn().mockImplementation(() => ({})),
}));

describe('MCP Server - skills-readonly', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  let fakeClientRepo: { root: string; cleanup: () => void };
  let fsSpy: { writes: any[]; restore: () => void };

  beforeEach(() => {
    // Seed fake client root with a decoy skill file to test precedence
    fakeClientRepo = makeFakeClientRepo({
      '.ai/skills/ask.md':
        '# DECOY ASK SKILL IN CLIENT ROOT\nThis should never be read.\n',
    });
    fsSpy = spyOnFsWrites();
  });

  afterEach(() => {
    fsSpy.restore();
    fakeClientRepo.cleanup();
  });

  it('verifies list_skills, get_skills, and get_skill are strictly read-only and read from repoRoot', async () => {
    const fsService = new FileSystemService(repoRoot, fakeClientRepo.root);
    const telemetry = new Telemetry();
    jest
      .spyOn(telemetry, 'withAnalytics')
      .mockImplementation(
        async <T>(
          _s: any,
          _p: any,
          _m: any,
          _a: any,
          _c: any,
          fn: () => Promise<T>
        ): Promise<T> => fn()
      );

    const alignmentService = new AlignmentService(repoRoot);
    const kiService = new KiService();
    const handlers = new Handlers(
      fsService,
      telemetry,
      alignmentService,
      kiService
    );

    const beforeTree = snapshotTree(fakeClientRepo.root);

    // 1. Invoke list_skills
    const listRes = await handlers.handleListSkills();
    expect(listRes.isError).toBe(false);
    expect(listRes.content[0].text).toContain('Available skills');
    expect(listRes.content[0].text).toContain('ask');

    // 2. Invoke get_skills with a valid skill ('ask')
    const getSkillsRes = await handlers.handleGetSkill('get_skills', {
      skillName: 'ask',
    });
    expect(getSkillsRes.isError).toBe(false);
    const getSkillsText = getSkillsRes.content[0].text;

    // (c) Assert content is read from tech-lead-stack's own .ai/skills (repoRoot), never from clientRoot decoy
    expect(getSkillsText).not.toContain('DECOY ASK SKILL IN CLIENT ROOT');
    expect(getSkillsText).toContain('Codebase Consultant');

    // 3. Invoke get_skill with a valid skill ('ask')
    const getSkillRes = await handlers.handleGetSkill('get_skill', {
      skillName: 'ask',
    });
    expect(getSkillRes.isError).toBe(false);
    const getSkillText = getSkillRes.content[0].text;
    expect(getSkillText).not.toContain('DECOY ASK SKILL IN CLIENT ROOT');
    expect(getSkillText).toContain('modes: [read-only, mcp]');

    // 4. Cover an unknown skill ID (errors, still zero writes)
    const unknownRes = await handlers.handleGetSkill('get_skill', {
      skillName: 'nonexistent-unknown-skill-xyz',
    });
    expect(unknownRes.isError).toBe(true);
    expect(unknownRes.content[0].text).toContain(
      'Error: Skill file "nonexistent-unknown-skill-xyz" not found.'
    );

    const afterTree = snapshotTree(fakeClientRepo.root);

    // (a) Assert clientRoot tree is identical before/after with empty allow
    assertNoRepoWrites(beforeTree, afterTree, { allow: [] });

    // (b) Assert spyOnFsWrites records ZERO writes anywhere
    expect(fsSpy.writes).toHaveLength(0);
  });
});
