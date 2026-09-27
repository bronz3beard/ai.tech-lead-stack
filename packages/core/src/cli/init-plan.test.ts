import {
  type EditorState,
  type PlanOptions,
  describeChange,
  freeGateways,
  planEditors,
} from './init-plan';
import {
  SETTINGS_TEMPLATE,
  SETTING_QUESTIONS,
  assignedNames,
  withSettings,
} from './settings-file';

const npx = { command: 'npx', args: ['-y', 'tech-lead-stack@1'] };
const auto: PlanOptions = { editors: 'auto', gateway: 'auto', server: npx };

function editor(overrides: Partial<EditorState>): EditorState {
  return {
    id: 'claude-code-mcp',
    editor: 'claude-code',
    label: 'Claude Code',
    path: '/home/me/.claude.json',
    kind: 'mcp-entry',
    installed: true,
    config: { state: 'missing' },
    ...overrides,
  };
}

const withServers = (mcpServers: object): EditorState['config'] => ({
  state: 'read',
  config: { mcpServers },
});

describe('planEditors', () => {
  it('adds the toolbox to an installed editor with nothing configured', () => {
    const [change] = planEditors([editor({})], auto);
    expect(change).toMatchObject({
      action: 'add',
      name: 'tech-lead-stack',
      server: npx,
    });
  });

  it('skips editors that are not installed, unless named with --ide', () => {
    const cursor = editor({ editor: 'cursor', installed: false });
    expect(planEditors([cursor], auto)).toEqual([]);
    expect(
      planEditors([cursor], { ...auto, editors: ['cursor'] })[0].action
    ).toBe('add');
  });

  it('never replaces an existing connection, including a clone setup', () => {
    const clone = withServers({
      'tech-lead-stack': {
        command: 'npm',
        args: ['--prefix', '/code/tls', 'run', 'mcp:start'],
      },
    });
    const [change] = planEditors([editor({ config: clone })], auto);
    expect(change).toMatchObject({
      action: 'keep',
      reason: expect.stringContaining('already connected'),
    });
  });

  it('puts the toolbox behind a free slm-gate instead of adding a second server', () => {
    const config = withServers({
      'slm-gate': { command: 'slm-gate', args: ['mcp'], env: {} },
    });
    const [change] = planEditors([editor({ config })], auto);
    expect(change).toEqual(
      expect.objectContaining({
        action: 'behind-gateway',
        gateway: 'slm-gate',
        env: { DOWNSTREAM_MCP: JSON.stringify(npx), TLS_ADAPTER: 'on' },
      })
    );
  });

  it('adds its own server when --gateway none is given', () => {
    const config = withServers({
      'slm-gate': { command: 'slm-gate', args: ['mcp'] },
    });
    expect(
      planEditors([editor({ config })], { ...auto, gateway: 'none' })[0].action
    ).toBe('add');
  });

  it('leaves an unreadable config alone', () => {
    const [change] = planEditors(
      [editor({ config: { state: 'unreadable' } })],
      auto
    );
    expect(change.action).toBe('keep');
    expect(describeChange(change)).toContain('fix it first');
  });
});

describe('freeGateways', () => {
  it('counts gateways with nothing behind them, not ones serving something else', () => {
    const config = {
      mcpServers: {
        'slm-gate': { command: 'node', args: ['/x/mcp-gate/index.js'] },
        other: { command: 'my-proxy', env: { DOWNSTREAM_MCP: '' } },
        busy: {
          command: 'slm-gate',
          env: { DOWNSTREAM_MCP: '{"command":"other-toolbox"}' },
        },
        github: { command: 'gh-mcp' },
      },
    };
    expect(freeGateways(config)).toEqual(['slm-gate', 'other']);
  });

  it('does not guess between several free gateways', () => {
    const config = withServers({
      a: { command: 'x', env: { DOWNSTREAM_MCP: '' } },
      b: { command: 'y', env: { DOWNSTREAM_MCP: '' } },
    });
    expect(planEditors([editor({ config })], auto)[0].action).toBe('add');
  });
});

describe('settings file', () => {
  it('fills the template placeholders and keeps the comments', () => {
    const text = withSettings(SETTINGS_TEMPLATE, {
      DATABASE_URL: 'postgresql://u:p@h/db',
    });
    expect(text).toContain('DATABASE_URL="postgresql://u:p@h/db"');
    expect(text).not.toContain('# DATABASE_URL');
    expect(text).toContain('# ANTHROPIC_API_KEY=""');
    expect(assignedNames(text)).toEqual(new Set(['DATABASE_URL']));
  });

  it('never overwrites a value that is already set', () => {
    const text = 'GEMINI_API_KEY="keep-me"\n';
    expect(withSettings(text, { GEMINI_API_KEY: 'new' })).toBe(text);
  });

  it('fills an empty assignment and appends names it has no line for', () => {
    const text = withSettings('ANTHROPIC_API_KEY=""\n', {
      ANTHROPIC_API_KEY: 'a'.repeat(24),
      DATABASE_URL: 'postgresql://h/db',
    });
    expect(text).toBe(
      `ANTHROPIC_API_KEY="${'a'.repeat(24)}"\nDATABASE_URL="postgresql://h/db"\n`
    );
  });

  it('validates answers before they are written', () => {
    const [db, anthropic] = SETTING_QUESTIONS;
    expect(db.schema.safeParse('mysql://h/db').success).toBe(false);
    expect(db.schema.safeParse('postgresql://u:p@h:5432/db').success).toBe(
      true
    );
    expect(
      anthropic.schema.safeParse('has "quote" in it and is long').success
    ).toBe(false);
  });
});
