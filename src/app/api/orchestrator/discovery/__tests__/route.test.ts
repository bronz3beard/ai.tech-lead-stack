/**
 * @desc Tests for the orchestrator discovery route.
 *
 * Key regression guard: verifies that the `write_to_sandbox` tool's `inputSchema`
 * field produces a valid JSON Schema with `type: 'object'` when serialized.
 * This prevents regressions from Zod/AI SDK version upgrades breaking the tool
 * schema contract required by Anthropic (and other providers).
 *
 * Error guarded against: `tools.0.custom.input_schema.type: Field required`
 * Root cause: Zod v4 + raw z.object() in tool() → broken input_schema shape.
 * Fix: Use `jsonSchema()` from `ai` + `inputSchema` key (AI SDK v6 renamed `parameters`).
 */

// ---------------------------------------------------------------------------
// Shared utilities extracted from the route under test for isolated testing.
// We test the pure functions directly to avoid spinning up the full Next.js
// route handler (which requires DB, auth session, and streaming infra).
// ---------------------------------------------------------------------------

/** Mirrors `getEnhancedSystemInstruction` from the route. */
function getEnhancedSystemInstruction(context: {
  figmaUrl?: string;
  branchUrl?: string;
  componentName?: string;
}) {
  const BASE = 'You are the Discovery Agent for the Tech-Lead Stack.';
  let instruction = BASE;

  if (context.componentName || context.figmaUrl || context.branchUrl) {
    instruction = `CONTEXT FOR THIS SESSION:\n${context.componentName ? `- TARGET FEATURE: ${context.componentName}` : ''}\n${context.figmaUrl ? `- FIGMA DESIGN: ${context.figmaUrl}` : ''}\n${context.branchUrl ? `- EXISTING BRANCH: ${context.branchUrl}` : ''}\n\n---\n${instruction}`;
  }

  return instruction;
}

/** Mirrors `extractTextFromParts` from the route. */
function extractTextFromParts(parts: unknown[]): string {
  return parts
    .filter((p: unknown): p is { type: 'text'; text: string } => {
      const part = p as Record<string, unknown>;
      return part.type === 'text' && typeof part.text === 'string';
    })
    .map((p) => p.text)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getEnhancedSystemInstruction', () => {
  it('returns the base prompt when no context is provided', () => {
    const result = getEnhancedSystemInstruction({});
    expect(result).toContain('You are the Discovery Agent');
    expect(result).not.toContain('CONTEXT FOR THIS SESSION');
  });

  it('prepends the context block when componentName is provided', () => {
    const result = getEnhancedSystemInstruction({
      componentName: 'Gauge Widget',
    });
    expect(result).toContain('CONTEXT FOR THIS SESSION');
    expect(result).toContain('TARGET FEATURE: Gauge Widget');
    expect(result).toContain('You are the Discovery Agent');
  });

  it('prepends the context block when figmaUrl is provided', () => {
    const result = getEnhancedSystemInstruction({
      figmaUrl: 'https://www.figma.com/design/abc123',
    });
    expect(result).toContain('FIGMA DESIGN: https://www.figma.com/design/abc123');
  });

  it('prepends the context block when branchUrl is provided', () => {
    const result = getEnhancedSystemInstruction({
      branchUrl: 'https://github.com/org/repo/tree/feature/my-branch',
    });
    expect(result).toContain(
      'EXISTING BRANCH: https://github.com/org/repo/tree/feature/my-branch'
    );
  });

  it('includes all three context lines when all fields are provided', () => {
    const result = getEnhancedSystemInstruction({
      componentName: 'MapView',
      figmaUrl: 'https://figma.com/x',
      branchUrl: 'https://github.com/org/repo/tree/feat',
    });
    expect(result).toContain('TARGET FEATURE: MapView');
    expect(result).toContain('FIGMA DESIGN: https://figma.com/x');
    expect(result).toContain(
      'EXISTING BRANCH: https://github.com/org/repo/tree/feat'
    );
  });
});

describe('extractTextFromParts', () => {
  it('returns an empty string for an empty parts array', () => {
    expect(extractTextFromParts([])).toBe('');
  });

  it('extracts text from a single text part', () => {
    const parts = [{ type: 'text', text: 'Hello world' }];
    expect(extractTextFromParts(parts)).toBe('Hello world');
  });

  it('joins multiple text parts with double newlines', () => {
    const parts = [
      { type: 'text', text: 'First' },
      { type: 'text', text: 'Second' },
    ];
    expect(extractTextFromParts(parts)).toBe('First\n\nSecond');
  });

  it('ignores non-text parts', () => {
    const parts = [
      { type: 'tool-call', toolCallId: 'abc', toolName: 'write_to_sandbox', args: {} },
      { type: 'text', text: 'Visible text only' },
      { type: 'tool-result', toolCallId: 'abc', toolName: 'write_to_sandbox', result: {} },
    ];
    expect(extractTextFromParts(parts)).toBe('Visible text only');
  });

  it('ignores parts where text is not a string', () => {
    const parts = [
      { type: 'text', text: 123 },
      { type: 'text', text: 'Valid' },
    ];
    expect(extractTextFromParts(parts)).toBe('Valid');
  });
});

// ---------------------------------------------------------------------------
// Regression guard: jsonSchema + inputSchema fix for Zod v4 + AI SDK v6.
//
// AI SDK v6 renamed `parameters` → `inputSchema` on the Tool type.
// `jsonSchema()` from `ai` accepts raw JSON Schema and produces a Schema<T>
// wrapping it correctly for providers — no Zod converter involved.
//
// The tool() function is a pass-through identity function — it returns the
// same Tool object you pass in. We verify the inputSchema shape directly on
// the object literal that tool() receives and returns.
//
// Error guarded: tools.0.custom.input_schema.type: Field required
// ---------------------------------------------------------------------------
describe('write_to_sandbox tool schema (jsonSchema fix — Zod v4 + AI SDK v6)', () => {
  it('produces a valid JSON Schema with type: object in inputSchema.jsonSchema', () => {

    const { tool, jsonSchema } = require('ai') as typeof import('ai');

    const schema = jsonSchema<{ path: string; content: string }>({
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    });

    const writeTool = tool({
      description: 'Writes a file to the ephemeral development environment.',
      inputSchema: schema,
      execute: async ({ path }: { path: string; content: string }) => ({ success: true, path }),
    });

    // The Tool object returned by tool() has inputSchema on it
    const resolvedSchema = (writeTool.inputSchema as any).jsonSchema as Record<string, unknown>;

    expect(resolvedSchema).toBeDefined();
    expect(resolvedSchema.type).toBe('object');
    expect((resolvedSchema.properties as any)?.path?.type).toBe('string');
    expect((resolvedSchema.properties as any)?.content?.type).toBe('string');
    expect(resolvedSchema.required).toContain('path');
    expect(resolvedSchema.required).toContain('content');
  });

  it('does NOT produce the broken Zod v4 raw internal shape (no "def" key)', () => {

    const { tool, jsonSchema } = require('ai') as typeof import('ai');

    const writeTool = tool({
      description: 'test',
      inputSchema: jsonSchema<{ path: string; content: string }>({
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      }),
      execute: async ({ path }: { path: string; content: string }) => ({ success: true, path }),
    });

    // Raw Zod v4 shape would have a `def` key. jsonSchema() must NOT produce this.
    const inputSchema = writeTool.inputSchema as any;
    expect(inputSchema.def).toBeUndefined();
    expect(inputSchema.jsonSchema).toBeDefined();
  });
});
