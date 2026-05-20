/**
 * Mirror of the mapping logic in route.ts for testing.
 */
function parseToolPart(p: any): {
  toolCallId: string;
  toolName: string;
  args: any;
  state?: string;
  result?: any;
  errorText?: string;
} | null {
  if (!p) return null;

  let source: any = null;
  let inferredToolName = '';

  if (p.type === 'tool-invocation' && p.toolInvocation && typeof p.toolInvocation === 'object') {
    source = p.toolInvocation;
  } else if (typeof p.type === 'string' && p.type.startsWith('tool-')) {
    source = p;
    inferredToolName = p.type.slice(5);
  } else if (p.toolCallId && p.toolName) {
    source = p;
  }

  if (!source) return null;

  const toolCallId = source.toolCallId || p.toolCallId;
  const toolName = source.toolName || p.toolName || inferredToolName;
  if (!toolCallId || !toolName) return null;

  const args = source.args || source.input || source.parameters || {};
  const state = source.state;
  const result = source.result !== undefined ? source.result : source.output;
  const errorText = source.errorText;

  return {
    toolCallId,
    toolName,
    args,
    state,
    result,
    errorText,
  };
}

function wrapToolResult(result: any, isError?: boolean): any {
  if (result && typeof result === 'object' && 'type' in result) {
    const type = result.type;
    if (
      type === 'text' ||
      type === 'json' ||
      type === 'execution-denied' ||
      type === 'error-text' ||
      type === 'error-json' ||
      type === 'content'
    ) {
      return result;
    }
  }

  if (isError) {
    if (typeof result === 'string') {
      return { type: 'error-text', value: result };
    }
    return { type: 'error-json', value: result };
  }

  if (typeof result === 'string') {
    return { type: 'text', value: result };
  }
  return { type: 'json', value: result };
}

function mapUIMessagesToCoreMessages(messages: any[]): any[] {
  return messages.flatMap((m: any) => {
    if (m.role === 'user') {
      const text =
        (m.parts || [])
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n\n') || (typeof m.content === 'string' ? m.content : '');
      return [{ role: 'user', content: text }];
    }

    if (m.role === 'assistant') {
      // Normalize payload: construct parts from toolInvocations if absent
      let parts = m.parts;
      if (!parts && m.toolInvocations) {
        parts = [];
        if (m.content) {
          parts.push({ type: 'text', text: m.content });
        }
        for (const invocation of m.toolInvocations) {
          parts.push({ type: 'tool-invocation', toolInvocation: invocation });
        }
      }
      parts = parts || [];

      const assistantContent: any[] = parts
        .map((p: any) => {
          if (p.type === 'text') return { type: 'text', text: p.text };
          const parsed = parseToolPart(p);
          if (parsed) {
            return {
              type: 'tool-call',
              toolCallId: parsed.toolCallId,
              toolName: parsed.toolName,
              input: parsed.args,
            };
          }
          return null;
        })
        .filter(Boolean);

      const toolResults: any[] = parts
        .map((p: any) => {
          const parsed = parseToolPart(p);
          if (
            parsed &&
            (parsed.state === 'result' ||
              parsed.state === 'output-available' ||
              parsed.state === 'output-error')
          ) {
            const isError =
              parsed.errorText !== undefined ||
              parsed.state === 'output-error';
            const rawResult =
              parsed.result !== undefined
                ? parsed.result
                : (parsed.errorText || 'Unknown error');
            return {
              type: 'tool-result',
              toolCallId: parsed.toolCallId,
              toolName: parsed.toolName,
              output: wrapToolResult(rawResult, isError),
            };
          }
          return null;
        })
        .filter(Boolean);

      const msgs: any[] = [];
      if (assistantContent.length > 0) {
        msgs.push({ role: 'assistant', content: assistantContent });
      }
      if (toolResults.length > 0) {
        msgs.push({ role: 'tool', content: toolResults });
      }

      if (msgs.length === 0 && m.content) {
        msgs.push({ role: 'assistant', content: m.content });
      }

      return msgs;
    }

    if (m.role === 'tool') {
      let parts = m.parts;
      if (!parts && m.toolInvocations) {
        parts = m.toolInvocations.map((invocation: any) => ({
          type: 'tool-invocation',
          toolInvocation: invocation,
        }));
      }
      parts = parts || [];

      const toolResults = parts
        .map((p: any) => {
          const parsed = parseToolPart(p);
          if (parsed) {
            const isError =
              parsed.errorText !== undefined ||
              parsed.state === 'output-error';
            const rawResult =
              parsed.result !== undefined
                ? parsed.result
                : (parsed.errorText || 'Unknown error');
            return {
              type: 'tool-result',
              toolCallId: parsed.toolCallId,
              toolName: parsed.toolName,
              output: wrapToolResult(rawResult, isError),
            };
          }
          return null;
        })
        .filter(Boolean);

      return [{ role: 'tool', content: toolResults }];
    }

    return [];
  });
}

describe('Discovery Route Message Mapping (flatMap)', () => {
  it('correctly maps simple text messages', () => {
    const messages = [
      {
        role: 'user',
        content: 'Hello',
        parts: [{ type: 'text', text: 'Hello' }],
      },
    ];
    const result = mapUIMessagesToCoreMessages(messages);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Hello');
  });

  it('preserves tool calls in assistant messages', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Writing file...' },
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call_1',
              toolName: 'write_to_sandbox',
              args: { path: 'test.txt', content: 'hi' },
              state: 'call',
            },
          },
        ],
      },
    ];
    const result = mapUIMessagesToCoreMessages(messages);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content).toContainEqual({
      type: 'text',
      text: 'Writing file...',
    });
    expect(result[0].content).toContainEqual({
      type: 'tool-call',
      toolCallId: 'call_1',
      toolName: 'write_to_sandbox',
      input: { path: 'test.txt', content: 'hi' },
    });
  });

  it('splits assistant message with result into assistant + tool messages', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call_1',
              toolName: 'write_to_sandbox',
              args: { path: 'test.txt', content: 'hi' },
              result: { success: true },
              state: 'result',
            },
          },
        ],
      },
    ];
    const result = mapUIMessagesToCoreMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content[0].type).toBe('tool-call');
    expect(result[1].role).toBe('tool');
    expect(result[1].content[0].type).toBe('tool-result');
    expect(result[1].content[0].output).toEqual({ type: 'json', value: { success: true } });
  });

  it('splits assistant message with output (instead of result) into assistant + tool messages', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call_2',
              toolName: 'write_to_sandbox',
              args: { path: 'test2.txt', content: 'hello' },
              output: { success: true, path: 'test2.txt' },
              state: 'output-available',
            },
          },
        ],
      },
    ];
    const result = mapUIMessagesToCoreMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content[0].type).toBe('tool-call');
    expect(result[1].role).toBe('tool');
    expect(result[1].content[0].type).toBe('tool-result');
    expect(result[1].content[0].output).toEqual({ type: 'json', value: { success: true, path: 'test2.txt' } });
  });

  it('splits assistant message with output-error state into assistant + tool error messages', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call_err_1',
              toolName: 'write_to_sandbox',
              args: { path: 'error.txt', content: 'wont work' },
              state: 'output-error',
              errorText: 'Disk Full',
            },
          },
        ],
      },
    ];
    const result = mapUIMessagesToCoreMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content[0].type).toBe('tool-call');
    expect(result[1].role).toBe('tool');
    expect(result[1].content[0].type).toBe('tool-result');
    expect(result[1].content[0].output).toEqual({ type: 'error-text', value: 'Disk Full' });
  });

  it('handles explicit tool role messages', () => {
    const messages = [
      {
        role: 'tool',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call_1',
              toolName: 'write_to_sandbox',
              result: { success: true },
              state: 'result',
            },
          },
        ],
      },
    ];
    const result = mapUIMessagesToCoreMessages(messages);
    expect(result[0].role).toBe('tool');
    expect(result[0].content[0].type).toBe('tool-result');
  });

  it('maps toolInvocations array on assistant message when parts is missing', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'I have written the component.',
        toolInvocations: [
          {
            toolCallId: 'call_3',
            toolName: 'write_to_sandbox',
            args: { path: 'src/App.tsx', content: 'export {}' },
            output: { success: true, path: 'src/App.tsx' },
            state: 'output-available',
          },
        ],
      },
    ];
    const result = mapUIMessagesToCoreMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content).toContainEqual({
      type: 'text',
      text: 'I have written the component.',
    });
    expect(result[0].content).toContainEqual({
      type: 'tool-call',
      toolCallId: 'call_3',
      toolName: 'write_to_sandbox',
      input: { path: 'src/App.tsx', content: 'export {}' },
    });
    expect(result[1].role).toBe('tool');
    expect(result[1].content[0].type).toBe('tool-result');
    expect(result[1].content[0].output).toEqual({ type: 'json', value: { success: true, path: 'src/App.tsx' } });
  });

  it('maps toolInvocations array on tool message when parts is missing', () => {
    const messages = [
      {
        role: 'tool',
        toolInvocations: [
          {
            toolCallId: 'call_4',
            toolName: 'write_to_sandbox',
            output: { success: true },
            state: 'output-available',
          },
        ],
      },
    ];
    const result = mapUIMessagesToCoreMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('tool');
    expect(result[0].content[0].type).toBe('tool-result');
    expect(result[0].content[0].output).toEqual({ type: 'json', value: { success: true } });
  });

  it('maps flat serialized tool parts (Shape B) correctly with dynamic type matching', () => {
    const messages = [
      {
        role: 'assistant',
        parts: [
          {
            type: 'tool-list_sandbox_files',
            toolCallId: 'call_flat_1',
            toolName: 'list_sandbox_files',
            args: { recursive: true },
            result: ['index.html', 'src/App.tsx'],
            state: 'result',
          },
        ],
      },
    ];
    const result = mapUIMessagesToCoreMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('assistant');
    expect(result[0].content[0].type).toBe('tool-call');
    expect(result[0].content[0].toolName).toBe('list_sandbox_files');
    expect(result[1].role).toBe('tool');
    expect(result[1].content[0].type).toBe('tool-result');
    expect(result[1].content[0].output).toEqual({ type: 'json', value: ['index.html', 'src/App.tsx'] });
  });
});
