import { normalizeProjectName } from '../trace-utils';

describe('normalizeProjectName', () => {
  it('should lowercase and trim project names', () => {
    expect(normalizeProjectName('  MyProject  ')).toBe('myproject');
    expect(normalizeProjectName('Gilly')).toBe('gilly');
  });

  it('should extract base name from scoped packages', () => {
    expect(normalizeProjectName('@bronz3beard/tech-lead-stack')).toBe('tech-lead-stack');
    expect(normalizeProjectName('@scope/repo-name')).toBe('repo-name');
  });

  it('should handle path-like names and extract the last part', () => {
    expect(normalizeProjectName('agent-toolbox/tech-lead-stack')).toBe('tech-lead-stack');
    expect(normalizeProjectName('Bronz3beard/ai.tech-lead-stack')).toBe('tech-lead-stack');
    expect(normalizeProjectName('path/to/my-project')).toBe('my-project');
  });

  it('should return unknown for empty or invalid names', () => {
    expect(normalizeProjectName(undefined)).toBe('global');
    expect(normalizeProjectName('')).toBe('global');
    expect(normalizeProjectName('   ')).toBe('global');
    expect(normalizeProjectName('unknown')).toBe('global');
  });
});
