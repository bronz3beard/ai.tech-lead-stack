import { createAgentTools } from '@/lib/ai/agent-tools';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { ModelMessage } from 'ai';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  UIMessageStreamWriter,
} from 'ai';
import { getServerSession } from 'next-auth';
import { initializeModel } from '../../chat/utils';

export const maxDuration = 300;

const systemPrompt = `You are an AI Assistant designed to help developers create high-quality skills for the Tech-Lead Stack.
Project Goal: Democratizing high-quality tech leadership via AI agents.

Ethos to enforce:
- G-Stack: Standardized, scalable component architecture. Diagnosis before Advice.
- MinimumCD: Continuous deployment focus—skills must be small, testable, and safely deployable.
- Matching Patterns: Enforce the use of the SKILL_TEMPLATE.md structure.

Tone: Professional, direct, and architecture-focused.

You have access to tools that can:
- format and lint markdown code
- validate skills against ethos scripts
- fetch stylistic reference examples
- check frontmatter schema
- update the skill template with new content

When analyzing a skill, actively use these tools to provide factual, tool-backed feedback rather than guessing.
If the user wants you to fix their code, or if you find errors via validation, use the 'update_skill_template' tool to propose the full updated markdown.`;

/**
 * @desc Extracts plain text from a UIMessage's parts array.
 * Handles the common text part shape: { type: 'text', text: string }.
 */
function extractTextFromParts(parts: unknown[]): string {
  return parts
    .filter((p: unknown): p is { type: 'text'; text: string } => {
      const part = p as Record<string, unknown>;
      return part.type === 'text' && typeof part.text === 'string';
    })
    .map((p) => p.text)
    .join('\n\n');
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const { messages, currentContent } = await req.json();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found.' }), {
        status: 404,
      });
    }

    // Resolve model and provider via canonical initializeModel utility
    // This handles DB keys -> .env fallbacks.
    const aiProvider = await initializeModel(user);

    // Manual conversion: UIMessage (from transport JSON) → ModelMessage[]
    // We bypass `convertToModelMessages` because deserialized JSON from req.json()
    // fails its strict Zod schema validation (missing Date objects, metadata, etc.).
    const modelMessages: ModelMessage[] = messages.map((m: any) => {
      const text = extractTextFromParts(m.parts || []);
      return {
        role: m.role as 'user' | 'assistant' | 'system',
        content: text,
      };
    });

    // Inject current editor content as context into the last user message
    if (currentContent && modelMessages.length > 0) {
      const lastMessage = modelMessages[modelMessages.length - 1];
      if (
        lastMessage.role === 'user' &&
        typeof lastMessage.content === 'string'
      ) {
        lastMessage.content += `\n\n--- [SYSTEM CONTEXT: CURRENT SKILL CONTENT] ---\n${currentContent}\n--- [END SYSTEM CONTEXT] ---`;
      }
    }

    console.log(
      `[skill-chat] Request received. Provider: ${aiProvider.provider}, Model: ${aiProvider.modelId}, Messages: ${modelMessages.length}`
    );

    const tools = createAgentTools(currentContent ?? '');

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
          // Initializing signal
          writer.write({
            type: 'data-custom',
            id: 'init-status',
            data: { status: 'Initializing Skill Assistant...' },
          });

          const result = await streamText({
            model: aiProvider,
            system: systemPrompt,
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(5),
            onStepFinish: async (event) => {
              if (event.toolCalls && event.toolCalls.length > 0) {
                const insights: string[] = [];
                for (const call of event.toolCalls) {
                  const resultPart = event.toolResults.find(
                    (r) => r.toolCallId === call.toolCallId
                  );
                  if (resultPart) {
                    if (call.toolName === 'lint_and_format') {
                      insights.push(
                        'Applied auto-formatting and linting fixes.'
                      );
                    } else if (call.toolName === 'validate_ethos') {
                      insights.push(
                        'Validated content against G-Stack & MinimumCD ethos.'
                      );
                    } else if (call.toolName === 'get_stylistic_examples') {
                      insights.push(
                        'Cross-referenced stylistic patterns from similar skills.'
                      );
                    } else if (call.toolName === 'check_schema') {
                      insights.push('Verified frontmatter schema compliance.');
                    } else if (call.toolName === 'update_skill_template') {
                      insights.push(
                        'Synthesized proposed corrections for the current draft.'
                      );
                    }
                  }
                }

                writer.write({
                  type: 'data-custom',
                  id: `step-${Date.now()}`,
                  data: {
                    status: 'Analyzing skill architecture...',
                    insights:
                      insights.length > 0
                        ? insights
                        : ['Processing analytical step...'],
                  },
                });
              }
            },
          });

          // Once the model finished analytical turns, relay the final summary streams
          const uiStream = result.toUIMessageStream();
          let textEmitted = false;

          try {
            for await (const chunk of uiStream) {
              // Track if we got any text parts to handle the fallback notice reliably
              if (chunk.type === 'text-delta' && chunk.delta?.trim()) {
                textEmitted = true;
              }
              writer.write(chunk);
            }

            // DYNAMIC SUMMARY TURN: If the model finished but didn't produce a final summary text
            // (typically after hitting the step limit), we force a final turn with no tools
            // to synthesize all previous research into a final report.
            if (!textEmitted) {
              console.info(
                `[skill-chat] Analytical limit reached without report. Triggering dynamic summary turn...`
              );

              writer.write({
                type: 'data-custom',
                id: 'summary-status',
                data: { status: 'Synthesizing final architectural report...' },
              });

              // Capture tool results and calls from the research phase
              const response = await result.response;
              const researchMessages = response.messages;

              const summaryResult = await streamText({
                model: aiProvider,
                system: systemPrompt,
                messages: [
                  ...modelMessages,
                  ...researchMessages,
                  {
                    role: 'user',
                    content:
                      'FINAL DIRECTIVE: The analytical process has reached its step limit. Respond now with your exhaustive final summary and recommendations based on the tool outputs above. Do NOT use any more tools.',
                  },
                ],
                // No tools provided here to force a text-only summary
              });

              // Stream the summary to the same writer
              for await (const chunk of summaryResult.toUIMessageStream()) {
                if (chunk.type === 'text-delta' && chunk.delta?.trim()) {
                  textEmitted = true;
                }
                writer.write(chunk);
              }
            }

            // Final success signal
            writer.write({
              type: 'data-custom',
              id: 'final-status',
              data: { status: 'DONE' },
            });
          } catch (streamErr) {
            console.error('[skill-chat] Error iterating uiStream:', streamErr);
          }
        },
      }),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'An error occurred';
    console.error('[skill-chat] Route error:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
