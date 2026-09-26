import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  cutChangelogRelease,
  extractChangelogSection,
  nextVersion,
  parseTag,
} from '../release.mjs';

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

describe('nextVersion', () => {
  it('bumps patch, minor and major from a stable version', () => {
    assert.strictEqual(nextVersion('1.4.2', 'patch'), '1.4.3');
    assert.strictEqual(nextVersion('1.4.2', 'minor'), '1.5.0');
    assert.strictEqual(nextVersion('1.4.2', 'major'), '2.0.0');
  });

  it('uses an exact version as given, including the current one for a first release', () => {
    assert.strictEqual(nextVersion('1.0.0', '1.0.0'), '1.0.0');
    assert.strictEqual(nextVersion('1.0.0', '1.1.0-rc.1'), '1.1.0-rc.1');
  });

  it('asks for an exact version when the current version is a prerelease', () => {
    assert.throws(() => nextVersion('1.1.0-rc.1', 'minor'), /is a prerelease/);
  });

  it('rejects an unknown level', () => {
    assert.throws(() => nextVersion('1.0.0', 'huge'), /Unknown release level/);
  });
});

describe('extractChangelogSection', () => {
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

describe('cutChangelogRelease', () => {
  it('moves the unreleased notes under a new dated version heading', () => {
    const result = cutChangelogRelease(CHANGELOG, {
      version: '1.1.0',
      date: '2026-10-15',
    });
    assert.strictEqual(
      extractChangelogSection(result, '1.1.0'),
      '### Added\n\n- Tag-driven releases.'
    );
    assert.match(result, /## \[Unreleased\]\n\n## \[1\.1\.0\] - 2026-10-15\n/);
    assert.throws(
      () => extractChangelogSection(result, 'Unreleased'),
      /has no notes/
    );
  });

  it('refuses to release a version that already has a section', () => {
    assert.throws(
      () => cutChangelogRelease(CHANGELOG, { version: '1.0.0', date: 'x' }),
      /already has a section for 1.0.0/
    );
  });

  it('refuses to release when nothing is unreleased', () => {
    const empty = '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-10-01\n';
    assert.throws(
      () => cutChangelogRelease(empty, { version: '1.0.1', date: 'x' }),
      /empty/
    );
  });
});
