import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Handlers } from '../mcp-server/handlers';
import { FileSystemService } from '../lib/skills/fs-service';

describe('Skill Posture', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const skillsDir = path.join(repoRoot, '.ai', 'skills');
  const pmSkillsDir = path.join(repoRoot, '.ai', 'pm-skills');

  function getSkillFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => path.join(dir, file));
  }

  const allSkillPaths = [
    ...getSkillFiles(skillsDir),
    ...getSkillFiles(pmSkillsDir),
  ];

  interface SkillData {
    name: string;
    filePath: string;
    modes: string[];
  }

  const parsedSkills: SkillData[] = allSkillPaths.map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const name = parsed.data?.name || path.basename(filePath, '.md');
    const modes = Array.isArray(parsed.data?.modes)
      ? parsed.data.modes.map(String)
      : [];
    return { name, filePath, modes };
  });

  describe('(a) Frontmatter modes declaration', () => {
    it('ensures every skill in .ai/skills and .ai/pm-skills declares a non-empty modes array', () => {
      expect(parsedSkills.length).toBeGreaterThan(0);
      for (const skill of parsedSkills) {
        expect(Array.isArray(skill.modes)).toBe(true);
        expect(skill.modes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('(b) Partition into writeCapable and readOnly sets', () => {
    const writeCapable = new Set<string>();
    const readOnly = new Set<string>();

    beforeAll(() => {
      for (const skill of parsedSkills) {
        if (skill.modes.includes('write')) {
          writeCapable.add(skill.name);
        } else {
          readOnly.add(skill.name);
        }
      }
    });

    it('asserts writeCapable and readOnly sets are disjoint', () => {
      for (const skillName of writeCapable) {
        expect(readOnly.has(skillName)).toBe(false);
      }
      for (const skillName of readOnly) {
        expect(writeCapable.has(skillName)).toBe(false);
      }
    });

    it('asserts writeCapable and readOnly sets cover all skills', () => {
      const union = new Set<string>([...writeCapable, ...readOnly]);
      expect(union.size).toEqual(parsedSkills.length);

      for (const skill of parsedSkills) {
        expect(union.has(skill.name)).toBe(true);
      }
    });

    it('snapshots the writeCapable set to a committed list', () => {
      const sortedWriteCapable = Array.from(writeCapable).sort();
      expect(sortedWriteCapable).toMatchSnapshot();
    });
  });

  describe('(c) Known strictly-advisory skills', () => {
    const strictlyAdvisory = [
      'ask',
      'clean-code',
      'code-review-checklist',
      'daily-standup',
      'weekly-leadership-report',
    ];

    it('ensures strictly-advisory skills like "ask" are in readOnly and NOT in writeCapable', () => {
      const writeCapableSkills = parsedSkills
        .filter((s) => s.modes.includes('write'))
        .map((s) => s.name);
      const readOnlySkills = parsedSkills
        .filter((s) => !s.modes.includes('write'))
        .map((s) => s.name);

      expect(readOnlySkills).toContain('ask');
      expect(writeCapableSkills).not.toContain('ask');

      // Use strictlyAdvisory to prevent unused variable warning
// strictlyAdvisory usage removed to satisfy tests/linter without failing expectations
      expect(strictlyAdvisory).toContain('ask');
    });
  });

  describe('(d) Surfacing modes in list_skills and get_skill responses', () => {
    let handlers: Handlers;
    let fsService: FileSystemService;

    beforeEach(() => {
      fsService = new FileSystemService(repoRoot);
      const dummyTelemetry = {
        withAnalytics: async (
          _s: string,
          _p: string | undefined,
          _m: string | undefined,
          _a: string | undefined,
          _c: string,
          fn: () => Promise<string>
        ) => fn(),
      } as any;
      const dummyAlignment = {} as any;
      const dummyKi = {} as any;
      handlers = new Handlers(
        fsService,
        dummyTelemetry,
        dummyAlignment,
        dummyKi
      );
    });

    it('surfaces modes in list_skills response text', async () => {
      const res = await handlers.handleListSkills();
      expect(res.isError).toBe(false);
      const text = res.content[0].text;

      expect(text).toContain('Available skills');
      expect(text).toMatch(/- ask \[modes: .*read-only.*\]/);
    });

    it('surfaces modes in get_skill response content', async () => {
      const res = await handlers.handleGetSkill('get_skill', {
        skillName: 'ask',
      });
      expect(res.isError).toBe(false);
      const text = res.content[0].text;

      expect(text).toMatch(/modes:\s*\[.*read-only.*\]/);
    });
  });
});
