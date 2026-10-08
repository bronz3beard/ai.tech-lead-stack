import { McpSession, SESSION_IDLE_MS } from '../session';

describe('McpSession', () => {
  it('keeps the same id while calls arrive within the idle window', () => {
    let now = 0;
    let n = 0;
    const session = new McpSession(() => now, () => `id${++n}`);

    const first = session.current();
    now += SESSION_IDLE_MS - 1;
    expect(session.current()).toBe(first);
  });

  it('starts a new session after an idle gap longer than the window', () => {
    let now = 0;
    let n = 0;
    const session = new McpSession(() => now, () => `id${++n}`);

    expect(session.current()).toBe('mcp-id1');
    now += SESSION_IDLE_MS + 1;
    expect(session.current()).toBe('mcp-id2');
  });
});
