import fc from 'fast-check';
import {
  isSkillTrace,
  isActiveSkill,
  normalizeProjectName,
  normalizeSkillName,
} from './trace-utils';

describe('name normalization (property-based)', () => {
  // The pre-ReDoS-fix implementation, kept as the behavioural reference.
  const legacySkillName = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/\.md$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  it('matches the legacy normalization for any non-blank input', () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        fc.pre(name.trim() !== '');
        expect(normalizeSkillName(name)).toBe(legacySkillName(name));
      })
    );
  });

  it('always yields a kebab-case slug', () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        expect(normalizeSkillName(name)).toMatch(/^([a-z0-9]+(-[a-z0-9]+)*)?$/);
        expect(normalizeProjectName(name)).toMatch(
          /^([a-z0-9]+(-[a-z0-9]+)*)?$/
        );
      })
    );
  });
});

describe('name normalization', () => {
  it('collapses separators and trims surrounding dashes', () => {
    expect(normalizeSkillName('--Planning   Expert--.md')).toBe(
      'planning-expert'
    );
    expect(normalizeProjectName('  My___Project!! ')).toBe('my-project');
  });

  it('stays fast on long runs of dashes', () => {
    const input = `a${'-'.repeat(50_000)}!`;
    const started = Date.now();

    expect(normalizeSkillName(input)).toBe('a');
    expect(normalizeProjectName(input)).toBe('a');
    expect(Date.now() - started).toBeLessThan(100);
  });
});

describe('isSkillTrace', () => {
  it("should return true when name is 'skill' or 'skill.md'", () => {
    expect(isSkillTrace('skill')).toBe(true);
    expect(isSkillTrace('skill.md')).toBe(true);
  });

  it("should return true when skillName is 'skill' or 'skill.md'", () => {
    expect(isSkillTrace(undefined, 'skill')).toBe(true);
    expect(isSkillTrace('other', 'skill.md')).toBe(true);
  });

  it('should return false for normal trace names and skill names', () => {
    expect(isSkillTrace('skill:planning-expert')).toBe(false);
    expect(isSkillTrace('generation:test')).toBe(false);
    expect(isSkillTrace('my-custom-skill')).toBe(false);

    expect(isSkillTrace('skill:planning-expert', 'planning-expert')).toBe(
      false
    );
    expect(isSkillTrace('generation:test', 'test-skill')).toBe(false);
  });
});

describe('isActiveSkill', () => {
  it('should return true for any valid user-facing skill', () => {
    expect(isActiveSkill('planning-expert')).toBe(true);
    expect(isActiveSkill('agent-optimizer')).toBe(true);
    expect(isActiveSkill('some-random-new-skill')).toBe(true);
  });

  it('should return false for system/meta-skill traces', () => {
    expect(isActiveSkill('skill')).toBe(false);
    expect(isActiveSkill('skill.md')).toBe(false);
    expect(isActiveSkill('unknown')).toBe(false);
  });

  it('should handle case sensitivity and .md extensions', () => {
    expect(isActiveSkill('Planning-Expert.md')).toBe(true);
    expect(isActiveSkill('SKILL.MD')).toBe(false);
  });

  it('should return false for undefined or empty input', () => {
    expect(isActiveSkill(undefined)).toBe(false);
    expect(isActiveSkill('')).toBe(false);
  });
});
