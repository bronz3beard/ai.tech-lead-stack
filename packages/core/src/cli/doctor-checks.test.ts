import {
  checkAnyEditor,
  checkDatabase,
  checkEditor,
  checkFeatures,
  checkNode,
  checkRtk,
  checkSettingsFile,
  findToolboxEntries,
  formatReport,
  hasFailure,
  versionAtLeast,
} from './doctor-checks';

const claude = {
  id: 'claude-code-mcp',
  label: 'Claude Code',
  path: '~/.claude.json',
};

describe('checkNode', () => {
  it.each(['v22.5.0', 'v22.17.1', 'v24.0.0'])('accepts %s', (v) => {
    expect(checkNode(v).status).toBe('ok');
  });

  it.each(['v22.4.9', 'v20.11.0'])('fails %s with an install link', (v) => {
    const check = checkNode(v);
    expect(check.status).toBe('fail');
    expect(check.fix).toContain('nodejs.org');
  });
});

describe('findToolboxEntries', () => {
  it('finds a direct npx entry', () => {
    const config = {
      mcpServers: {
        'tech-lead-stack': {
          command: 'npx',
          args: ['-y', 'tech-lead-stack@1'],
        },
      },
    };
    expect(findToolboxEntries(config)).toEqual([
      { name: 'tech-lead-stack', via: 'direct', settings: [] },
    ]);
  });

  it('finds a clone entry under any name by its server file', () => {
    const config = {
      mcpServers: {
        tls: {
          command: 'node',
          args: ['/home/me/code/tls/dist/mcp-server.mjs'],
        },
      },
    };
    expect(findToolboxEntries(config)[0]).toMatchObject({
      name: 'tls',
      via: 'direct',
    });
  });

  it('finds the toolbox behind a gateway and reports setting names, not values', () => {
    const config = {
      mcpServers: {
        'slm-gate': {
          command: 'slm-gate',
          args: ['mcp'],
          env: {
            ANTHROPIC_API_KEY: 'sk-secret',
            DOWNSTREAM_MCP: JSON.stringify({
              command: 'npx',
              args: ['-y', 'tech-lead-stack@1'],
              env: { DATABASE_URL: 'postgresql://u:p@h/db' },
            }),
          },
        },
      },
    };
    const [entry] = findToolboxEntries(config);
    expect(entry).toEqual({
      name: 'slm-gate',
      via: 'gateway',
      settings: ['ANTHROPIC_API_KEY', 'DATABASE_URL'],
    });
    expect(JSON.stringify(entry)).not.toContain('sk-secret');
  });

  it('ignores unrelated servers and malformed configs', () => {
    expect(
      findToolboxEntries({ mcpServers: { github: { command: 'gh-mcp' } } })
    ).toEqual([]);
    expect(findToolboxEntries(null)).toEqual([]);
    expect(findToolboxEntries({ mcpServers: 'nope' })).toEqual([]);
  });
});

describe('checkEditor', () => {
  it('says nothing about an editor that is not installed', () => {
    expect(checkEditor(claude, { state: 'missing' })).toBeNull();
  });

  it('points an installed editor without the toolbox at init', () => {
    const check = checkEditor(claude, {
      state: 'read',
      config: { mcpServers: {} },
    });
    expect(check).toMatchObject({ status: 'info' });
    expect(check?.fix).toContain('init');
  });

  it('warns when the toolbox is connected both directly and through a gateway', () => {
    const config = {
      mcpServers: {
        'tech-lead-stack': { command: 'npx', args: ['-y', 'tech-lead-stack'] },
        'slm-gate': {
          command: 'slm-gate',
          env: {
            DOWNSTREAM_MCP: '{"command":"npx","args":["-y","tech-lead-stack"]}',
          },
        },
      },
    };
    expect(checkEditor(claude, { state: 'read', config })?.status).toBe('warn');
  });

  it('warns about a config file that is not valid JSON', () => {
    expect(checkEditor(claude, { state: 'unreadable' })?.status).toBe('warn');
  });
});

describe('checkAnyEditor', () => {
  it('warns only when no editor was found at all', () => {
    expect(checkAnyEditor([null, null])?.status).toBe('warn');
    expect(
      checkAnyEditor([null, { id: 'x', status: 'info', title: 'x' }])
    ).toBeNull();
  });
});

describe('checkFeatures', () => {
  const byId = (env: Record<string, string>) =>
    Object.fromEntries(checkFeatures(env).map((c) => [c.id, c.status]));

  it('turns on the two-model loop only with both keys', () => {
    expect(byId({ ANTHROPIC_API_KEY: 'a' })['tier-byo']).toBe('info');
    expect(
      byId({ ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g' })['tier-byo']
    ).toBe('ok');
    expect(
      byId({ ANTHROPIC_API_KEY: 'a', GOOGLE_GENERATIVE_AI_API_KEY: 'g' })[
        'tier-byo'
      ]
    ).toBe('ok');
  });

  it('treats blank values as not set', () => {
    expect(
      byId({ ANTHROPIC_API_KEY: ' ', GEMINI_API_KEY: 'g' })['tier-byo']
    ).toBe('info');
  });

  it('turns on the local tier only with an endpoint and a model name', () => {
    expect(
      byId({ LOCAL_MODEL_ENDPOINT: 'http://localhost:11434/v1' })['tier-local']
    ).toBe('info');
    expect(
      byId({
        LOCAL_MODEL_ENDPOINT: 'http://localhost:11434/v1',
        LOCAL_MODEL_NAME: 'qwen',
      })['tier-local']
    ).toBe('ok');
  });
});

describe('checkDatabase', () => {
  it.each([
    [{ state: 'no-url' } as const, 'info'],
    [{ state: 'unreachable', message: 'ECONNREFUSED' } as const, 'fail'],
    [{ state: 'no-tables' } as const, 'warn'],
    [{ state: 'ready' } as const, 'ok'],
  ])('maps %o to %s', (db, status) => {
    expect(checkDatabase(db).status).toBe(status);
  });
});

describe('checkSettingsFile', () => {
  it('warns when other users can read a file that may hold keys', () => {
    const check = checkSettingsFile({
      path: '/h/.tech-lead-stack/.env',
      exists: true,
      othersCanRead: true,
    });
    expect(check.status).toBe('warn');
    expect(check.fix).toContain('chmod 600');
  });
});

describe('versionAtLeast', () => {
  it.each([
    ['0.50.0', 'v0.50.0', true],
    ['0.51.0', 'v0.50.0', true],
    ['1.0', 'v0.50.0', true],
    ['0.43.0', 'v0.50.0', false],
    ['0.50', 'v0.50.1', false],
  ])('%s >= %s is %s', (a, b, expected) => {
    expect(versionAtLeast(a, b)).toBe(expected);
  });
});

describe('checkRtk', () => {
  it('offers RTK when it is missing, flags an old one, and accepts the pinned one', () => {
    expect(checkRtk({ installed: null, pinned: 'v0.50.0' }).status).toBe(
      'info'
    );
    expect(checkRtk({ installed: '0.43.0', pinned: 'v0.50.0' })).toMatchObject({
      status: 'warn',
      title: expect.stringContaining('older'),
    });
    expect(checkRtk({ installed: '0.50.0', pinned: 'v0.50.0' }).status).toBe(
      'ok'
    );
  });
});

describe('formatReport and hasFailure', () => {
  it('shows fixes for problems only and counts what needs fixing', () => {
    const checks = [
      { id: 'a', status: 'ok' as const, title: 'fine', fix: 'hidden' },
      { id: 'b', status: 'fail' as const, title: 'broken', fix: 'do this' },
    ];
    const report = formatReport('1.2.3', checks);
    expect(report).toContain('v1.2.3');
    expect(report).toContain('→ do this');
    expect(report).not.toContain('hidden');
    expect(report).toContain('1 thing(s) to fix');
    expect(hasFailure(checks)).toBe(true);
  });
});
