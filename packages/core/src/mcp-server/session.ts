import { randomUUID } from 'crypto';

/** A session ends after 30 minutes without a call (the common web-analytics definition). */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/**
 * Fallback session id for MCP calls that do not supply one. One server process
 * can outlive a client session (e.g. behind a long-lived gateway), so the id
 * also rotates after an idle gap.
 */
export class McpSession {
  private id: string | undefined;
  private lastSeen = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly newId: () => string = randomUUID
  ) {}

  current(): string {
    const t = this.now();
    if (!this.id || t - this.lastSeen > SESSION_IDLE_MS) {
      this.id = `mcp-${this.newId()}`;
    }
    this.lastSeen = t;
    return this.id;
  }
}
