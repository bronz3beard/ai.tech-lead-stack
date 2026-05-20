declare var process: any;

import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, tool, jsonSchema } from 'ai';

function extractTextFromParts(parts: any[]): string {
  return parts
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('\n');
}

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

async function main() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY env variable.");
    return;
  }

  const anthropic = createAnthropic({
    apiKey: apiKey,
  });
  
  const model = anthropic('claude-3-5-sonnet-20241022');

  const messages = [
    {
      "parts": [
        {
          "type": "text",
          "text": "change the \"Sign In\" button on the signin page to orange"
        }
      ],
      "id": "knehsWFTzuFLjeWx",
      "role": "user"
    },
    {
      "id": "Gg95cX0yWBD8p3pk",
      "role": "assistant",
      "parts": [
        {
          "type": "step-start"
        },
        {
          "type": "text",
          "text": "Let me first explore the existing codebase to find the Sign In page and its current button styling.",
          "state": "done"
        },
        {
          "type": "tool-list_sandbox_files",
          "toolCallId": "toolu_01RMj6TrMn2uRs5KEYCamEqY",
          "state": "output-available",
          "input": {},
          "output": {
            "success": true,
            "files": ["index.html"]
          }
        }
      ]
    }
  ];

  // Convert UIMessages to CoreMessages for streamText
  const modelMessages: any[] = messages.flatMap((m: any) => {
    if (m.role === 'user') {
      const text =
        extractTextFromParts(m.parts || []) ||
        (typeof m.content === 'string' ? m.content : '');
      return [{ role: 'user', content: text }];
    }

    if (m.role === 'assistant') {
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
              input: parsed.args, // MUST BE input, NOT args!
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
            const rawResult =
              parsed.result !== undefined
                ? parsed.result
                : { error: parsed.errorText || 'Unknown error' };
            
            // Map output to ToolResultOutput format required in AI SDK v6
            const output =
              parsed.state === 'output-error'
                ? { type: 'error-text' as const, value: typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult) }
                : (typeof rawResult === 'string'
                  ? { type: 'text' as const, value: rawResult }
                  : { type: 'json' as const, value: rawResult === undefined ? null : rawResult });

            return {
              type: 'tool-result',
              toolCallId: parsed.toolCallId,
              toolName: parsed.toolName,
              output: output,
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

    return [];
  });

  // Ensure modelMessages strictly ends with a user message to prevent prefill constraint errors
  while (
    modelMessages.length > 0 &&
    modelMessages[modelMessages.length - 1].role === 'assistant'
  ) {
    modelMessages.pop();
  }

  console.log("Mapped Model Messages:", JSON.stringify(modelMessages, null, 2));

  try {
    const result = await streamText({
      model,
      messages: modelMessages,
      tools: {
        list_sandbox_files: tool({
          description: 'List sandbox files',
          inputSchema: jsonSchema<Record<string, never>>({
            type: 'object',
            properties: {},
          }),
        }),
      },
    });

    for await (const chunk of result.textStream) {
      console.log("Chunk:", chunk);
    }
    console.log("\nSuccess! Stream completed.");
  } catch (error: any) {
    console.error("Error thrown:", error);
  }
}

main();
