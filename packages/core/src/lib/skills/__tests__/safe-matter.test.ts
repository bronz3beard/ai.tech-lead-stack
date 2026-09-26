import { parseFrontmatter } from '../safe-matter';

describe('parseFrontmatter', () => {
  const flag = '__safeMatterExecuted';

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[flag];
  });

  it('parses YAML front-matter and body', () => {
    const parsed = parseFrontmatter('---\nname: demo\ncost: 1\n---\nBody');

    expect(parsed.data).toEqual({ name: 'demo', cost: 1 });
    expect(parsed.content.trim()).toBe('Body');
  });

  it.each(['js', 'javascript', 'JS'])(
    'rejects ---%s front-matter without executing it',
    (language) => {
      const payload = `---${language}\n{ name: (globalThis.${flag} = true) }\n---\nBody`;

      expect(() => parseFrontmatter(payload)).toThrow(
        'JavaScript front-matter is not allowed'
      );
      expect((globalThis as Record<string, unknown>)[flag]).toBeUndefined();
    }
  );
});
