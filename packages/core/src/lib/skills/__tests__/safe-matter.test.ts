import fc from 'fast-check';
import matter from 'gray-matter';
import { parseFrontmatter } from '../safe-matter';

describe('parseFrontmatter (property-based)', () => {
  it('never executes JavaScript front-matter, whatever surrounds the payload', () => {
    const flag = '__safeMatterPropertyExecuted';
    const g = globalThis as Record<string, unknown>;

    fc.assert(
      fc.property(
        fc.constantFrom('js', 'javascript', 'JS', 'JavaScript'),
        fc.string(),
        (language, junk) => {
          const payload = `(globalThis.${flag} = true, ${JSON.stringify(junk)})`;
          let data: unknown = {};
          try {
            data = parseFrontmatter(
              `---${language}\n${payload}\n---\nBody`
            ).data;
          } catch (error) {
            expect(String(error)).toContain(
              'JavaScript front-matter is not allowed'
            );
          }
          expect(data).toEqual({});
          expect(g[flag]).toBeUndefined();
        }
      )
    );
    delete g[flag];
  });

  it('round-trips arbitrary YAML front-matter data', () => {
    const data = fc.dictionary(
      fc.stringMatching(/^[a-z][a-z0-9_]{0,10}$/),
      fc.oneof(fc.integer(), fc.string(), fc.boolean())
    );
    fc.assert(
      fc.property(data, (value) => {
        const doc = matter.stringify('Body', value);
        expect(parseFrontmatter(doc).data).toEqual(value);
      })
    );
  });
});

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
