import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractChangelogSection, parseTag } from '../release.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '',
  '- Tag-driven releases.',
  '',
  '## [1.0.0] - 2026-10-01',
  '',
  '### Fixed',
  '',
  '- The date picker filters results.',
  '',
  '[1.0.0]: https://github.com/bronz3beard/ai.tech-lead-stack/releases/tag/v1.0.0',
  '',
].join('\n');

describe('parseTag', () => {
  it('accepts a stable release tag', () => {
    assert.deepStrictEqual(parseTag('v1.2.3'), {
      version: '1.2.3',
      prerelease: false,
    });
  });

  it('marks a tag with a prerelease suffix as a prerelease', () => {
    assert.deepStrictEqual(parseTag('v1.2.3-rc.1'), {
      version: '1.2.3-rc.1',
      prerelease: true,
    });
  });

  for (const tag of [
    'v1.0',
    '1.0.0',
    'v01.0.0',
    'v1.0.0+build.5',
    'v1.0.0-x;rm -rf',
    'v1.0.0\nversion=9.9.9',
    undefined,
  ]) {
    it(`rejects ${JSON.stringify(tag)}`, () => {
      assert.throws(() => parseTag(tag), /is not a release tag/);
    });
  }
});

describe('extractChangelogSection', () => {
  it("reads release-please's heading, with its compare link and date", () => {
    const changelog = [
      '# Changelog',
      '',
      '## [1.1.0](https://github.com/bronz3beard/ai.tech-lead-stack/compare/v1.0.3...v1.1.0) (2026-09-27)',
      '',
      '### Added',
      '',
      '* **cli:** `init` sets up every editor ([abc1234](https://github.com/x/y/commit/abc1234))',
      '',
      '## [1.0.3] - 2026-09-26',
      '',
      '- Older, hand-written notes.',
    ].join('\n');
    assert.strictEqual(
      extractChangelogSection(changelog, '1.1.0'),
      '### Added\n\n* **cli:** `init` sets up every editor ([abc1234](https://github.com/x/y/commit/abc1234))'
    );
  });

  it('returns the notes for a version, stopping before link references', () => {
    assert.strictEqual(
      extractChangelogSection(CHANGELOG, '1.0.0'),
      '### Fixed\n\n- The date picker filters results.'
    );
  });

  it('stops at the next section heading', () => {
    assert.strictEqual(
      extractChangelogSection(CHANGELOG, 'Unreleased'),
      '### Added\n\n- Tag-driven releases.'
    );
  });

  it('does not treat a prerelease heading as the stable version', () => {
    const changelog = '## [1.1.0-rc.1] - 2026-10-02\n\n- Preview.\n';
    assert.throws(
      () => extractChangelogSection(changelog, '1.1.0'),
      /has no notes for 1.1.0/
    );
  });

  it('fails when the version has no section', () => {
    assert.throws(
      () => extractChangelogSection(CHANGELOG, '2.0.0'),
      /has no notes for 2.0.0/
    );
  });
});
