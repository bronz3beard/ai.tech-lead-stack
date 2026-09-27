import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  listContinueServers,
  removeContinueServers,
  setContinueServer,
} from '../../packages/core/src/install/continue-config.mjs';

const ours = {
  name: 'tech-lead-stack',
  command: 'npx',
  args: ['-y', 'tech-lead-stack@1'],
};

// The shape older installs wrote, which Continue does not read.
const legacy = `models: []
mcpServers:
  tech-lead-stack:
    command: npm
    args:
      - --prefix
      - "/home/me/tech-lead-stack"
`;

describe('Continue config', () => {
  test('adds our server as a list item to a new file', () => {
    assert.deepEqual(listContinueServers(setContinueServer('', ours)), [ours]);
  });

  test("keeps the user's other servers, settings and comments", () => {
    const text = `# my models
models: []
mcpServers:
  - name: sqlite # local db
    command: npx
`;
    const after = setContinueServer(text, ours);
    assert.match(after, /# my models/);
    assert.match(after, /# local db/);
    assert.deepEqual(
      listContinueServers(after).map((s) => s.name),
      ['sqlite', 'tech-lead-stack']
    );
  });

  test('replaces our entry instead of adding a second one', () => {
    const once = setContinueServer('', { ...ours, args: ['old'] });
    const twice = setContinueServer(once, ours);
    assert.deepEqual(listContinueServers(twice), [ours]);
  });

  test('converts the old map shape into the list Continue reads', () => {
    const after = setContinueServer(legacy, ours);
    assert.match(after, /- name: tech-lead-stack/);
    assert.deepEqual(listContinueServers(after), [ours]);
  });

  test('reads and removes entries in both shapes', () => {
    const pointsHere = (s) =>
      JSON.stringify(s).includes('/home/me/tech-lead-stack');
    assert.equal(listContinueServers(legacy)[0].name, 'tech-lead-stack');
    const { text, removed } = removeContinueServers(legacy, pointsHere);
    assert.deepEqual(removed, ['tech-lead-stack']);
    assert.deepEqual(listContinueServers(text), []);
    assert.match(text, /models: \[\]/);
  });

  test('refuses to edit a file that is not valid YAML', () => {
    assert.throws(
      () => setContinueServer('mcpServers: [unclosed', ours),
      /not valid YAML/
    );
  });
});
