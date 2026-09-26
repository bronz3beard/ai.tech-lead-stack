import matter from 'gray-matter';

/**
 * gray-matter ships a `javascript` engine that `eval`s front-matter opened
 * with `---js` / `---javascript`. Skill markdown can come from users and the
 * AI agent, so that engine must never run. Overriding both names (gray-matter
 * aliases `js` → `javascript`) makes such documents fail to parse instead.
 */
const rejectJavaScriptFrontmatter = () => {
  throw new Error('JavaScript front-matter is not allowed');
};

/**
 * Parses markdown front-matter with the JavaScript engine disabled.
 * Use this for any content that did not come from a trusted repo file.
 */
export function parseFrontmatter(content: string) {
  return matter(content, {
    engines: {
      js: rejectJavaScriptFrontmatter,
      javascript: rejectJavaScriptFrontmatter,
    },
  });
}
