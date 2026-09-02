import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Handlers } from '../mcp-server/handlers';
import { FileSystemService } from '../lib/skills/fs-service';

describe('Skill Posture', () => {
  const SKILLS_DIR = path.join(process.cwd(), '../../.ai', 'skills');
  const PM_SKILLS_DIR = path.join(process.cwd(), '../../.ai', 'pm-skills');

  function getSkillFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => path.join(dir, file));
  }

  const allSkillPaths = [
    ...getSkillFiles(SKILLS_DIR),
    ...getSkillFiles(PM_SKILLS_DIR),
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

  const writeCapableSkills = parsedSkills.filter(s => s.modes.includes('write'));
  const readOnlySkills = parsedSkills.filter(s => !s.modes.includes('write'));

  describe('Frontmatter modes declaration', () => {
    it('ensures every skill declares a non-empty modes array', () => {
      expect(parsedSkills.length).toBeGreaterThan(0);
      for (const skill of parsedSkills) {
        expect(Array.isArray(skill.modes)).toBe(true);
        expect(skill.modes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('write-capable skills', () => {
    it('snapshots the write-capable set to a committed list', () => {
      const sortedWriteCapable = writeCapableSkills.map(s => s.name).sort();
      expect(sortedWriteCapable).toMatchSnapshot();
    });
  });

  describe('read-only skills', () => {
    it('snapshots the read-only set to a committed list', () => {
      const sortedReadOnly = readOnlySkills.map(s => s.name).sort();
      expect(sortedReadOnly).toMatchSnapshot();
    });

    it('ensures strictly-advisory skills like "ask" are in read-only and NOT in write-capable', () => {
      const strictlyAdvisory = ['ask', 'daily-standup'];
      const writeNames = writeCapableSkills.map(s => s.name);
      const readNames = readOnlySkills.map(s => s.name);

      for (const skill of strictlyAdvisory) {
        expect(readNames).toContain(skill);
        expect(writeNames).not.toContain(skill);
      }
    });
  });

  describe('(d) Surfacing modes in list_skills and get_skill responses', () => {
    let handlers: Handlers;
    let fsService: FileSystemService;

    beforeEach(() => {
      fsService = new FileSystemService(path.resolve(process.cwd(), '../..'));
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
