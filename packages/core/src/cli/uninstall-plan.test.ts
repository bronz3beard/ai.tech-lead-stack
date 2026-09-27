import type { EditorState } from './init-plan';
import {
  planUninstall,
  startsNpxPackage,
  withoutToolbox,
} from './uninstall-plan';

function editor(mcpServers: object): EditorState {
  return {
    id: 'cursor-mcp',
    editor: 'cursor',
    label: 'Cursor',
    path: '/home/me/.cursor/mcp.json',
    kind: 'mcp-entry',
    installed: true,
    config: { state: 'read', config: { mcpServers } },
  };
}

const npx = { command: 'npx', args: ['-y', 'tech-lead-stack@1'] };

describe('planUninstall', () => {
  it('removes a server init added through npx', () => {
    expect(planUninstall([editor({ 'tech-lead-stack': npx })])).toEqual([
      expect.objectContaining({
        action: 'remove-server',
        name: 'tech-lead-stack',
      }),
    ]);
  });

  it('detaches the toolbox from a gateway without removing the gateway', () => {
    const gateway = {
      command: 'slm-gate',
      env: { DOWNSTREAM_MCP: JSON.stringify(npx), TLS_ADAPTER: 'on' },
    };
    expect(planUninstall([editor({ 'slm-gate': gateway })])).toEqual([
      expect.objectContaining({
        action: 'detach-gateway',
        gateway: 'slm-gate',
      }),
    ]);
  });

  it('leaves clone setups and unrelated servers alone', () => {
    const changes = planUninstall([
      editor({
        // install.sh's default name, with a clone folder named anything.
        'tech-lead-stack': {
          command: 'npm',
          args: ['--prefix', '/code/tls', 'run', 'mcp:start'],
        },
        tls: { command: 'node', args: ['/code/tls/dist/mcp-server.mjs'] },
        github: { command: 'gh-mcp' },
      }),
    ]);
    expect(
      changes.map((c) => [c.action, (c as { name: string }).name])
    ).toEqual([
      ['leave-clone', 'tech-lead-stack'],
      ['leave-clone', 'tls'],
    ]);
  });

  it('skips editors whose config is missing or unreadable', () => {
    const missing = { ...editor({}), config: { state: 'missing' as const } };
    const unreadable = {
      ...editor({}),
      config: { state: 'unreadable' as const },
    };
    expect(planUninstall([missing, unreadable])).toEqual([]);
  });
});

describe('helpers', () => {
  it('recognises only the published package started by npx', () => {
    expect(startsNpxPackage(npx)).toBe(true);
    expect(
      startsNpxPackage({ command: 'npx', args: ['-y', 'tech-lead-stack'] })
    ).toBe(true);
    expect(
      startsNpxPackage({ command: 'npx', args: ['-y', 'tech-lead-stack-fork'] })
    ).toBe(false);
    expect(
      startsNpxPackage({ command: 'node', args: ['tech-lead-stack'] })
    ).toBe(false);
  });

  it("keeps the gateway's own settings", () => {
    expect(
      withoutToolbox({
        DOWNSTREAM_MCP: '{}',
        TLS_ADAPTER: 'on',
        OLLAMA_MODEL: 'qwen',
      })
    ).toEqual({ OLLAMA_MODEL: 'qwen' });
  });
});
