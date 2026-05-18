/**
 * Mirror of the mapping logic in route.ts for testing.
 */
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
          if (p.type === 'tool-invocation') {
            const { toolCallId, toolName } = p.toolInvocation;
            const args =
              p.toolInvocation.args ||
              p.toolInvocation.input ||
              p.toolInvocation.parameters ||
              {};
            return { type: 'tool-call', toolCallId, toolName, args };
          }
          return null;
        })
        .filter(Boolean);

      const toolResults: any[] = parts
        .filter(
          (p: any) =>
            p.type === 'tool-invocation' &&
            (p.toolInvocation.state === 'result' ||
              p.toolInvocation.state === 'output-available')
        )
        .map((p: any) => {
          const { toolCallId, toolName } = p.toolInvocation;
          const result =
            p.toolInvocation.result !== undefined
              ? p.toolInvocation.result
              : p.toolInvocation.output;
          return { type: 'tool-result', toolCallId, toolName, result };
        });

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
          if (p.type === 'tool-invocation') {
            const { toolCallId, toolName } = p.toolInvocation;
            const result =
              p.toolInvocation.result !== undefined
                ? p.toolInvocation.result
                : p.toolInvocation.output;
            return { type: 'tool-result', toolCallId, toolName, result };
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
      args: { path: 'test.txt', content: 'hi' },
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
    expect(result[1].content[0].result).toEqual({ success: true });
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
    expect(result[1].content[0].result).toEqual({ success: true, path: 'test2.txt' });
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
      args: { path: 'src/App.tsx', content: 'export {}' },
    });
    expect(result[1].role).toBe('tool');
    expect(result[1].content[0].type).toBe('tool-result');
    expect(result[1].content[0].result).toEqual({ success: true, path: 'src/App.tsx' });
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
    expect(result[0].content[0].result).toEqual({ success: true });
  });
});
