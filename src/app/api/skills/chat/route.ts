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
import { telemetryService } from '@/lib/telemetry-service';

export const maxDuration = 300;

const systemPrompt = `You are the AI Skill Refinement Architect for the Tech-Lead Stack.
Your primary mission is to Refine and Augment existing AI skills, transforming them into high-integrity assets that adhere to the G-Stack and MinimumCD methodologies.

CORE DIRECTIVES:
1. LOGIC PRESERVATION (CRITICAL): You MUST preserve the unique domain-specific logic, terminology, and purpose of the skill provided in the context. 
2. AUGMENTATION OVER REPLACEMENT: Do not replace the user's specific implementation with generic boilerplate. Instead, wrap the existing logic in the G-Stack framework (Phase 0: Diagnosis, Phase 1: Implementation, Verification Gates).
3. NO PLACEHOLDERS: NEVER use placeholders like 'name: new-skill', 'description: Describe here', or '[insert purpose]'. If the draft has a name and description, USE THEM.
4. ACTIONABLE OUTPUT: If you identify missing architectural depth, use the 'update_skill_template' tool to propose a COMPLETE, updated version of the SPECIFIC skill as part of your final response.

ETHOS:
- G-Stack: Diagnosis before Advice. Mandatory Phase 0 for environment discovery.
- MinimumCD: Small, testable, and safely deployable increments.
- High Integrity: Every skill must have clear verification gates and error handling.

Example Transformation (Reference Only):
[CONVERSION GOAL]: Transform a simple 'search-code' skill into a high-integrity G-Stack version.

USER DRAFT:
---
name: search-code
description: Search code for patterns.
---
# search-code
Run grep to find code patterns.

YOUR REFINEMENT:
---
name: search-code
description: High-integrity architectural discovery using pattern matching and grep.
cost: ~800 tokens
---
# search-code

> [!IMPORTANT]
> Adheres to G-Stack: Diagnosis before implementation.

## Phase 0: Discovery & Diagnosis
- Action: Identify relevant directories (src, lib) using list_dir.
- Guardrail: Ignore large binary files and node_modules.

## Phase 1: Action (Search Implementation)
- Step 1: Run grep_search with the provided pattern.
- Step 2: Contextualize results against the discovered tech stack.

## MinimumCD & Quality Verification
1. Accuracy: Verify results contain matches.
2. Performance: Ensure grep command doesn't time out on large repos.
`;

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
                    // Record telemetry for every tool execution
                    const duration = 0; // ai library doesn't expose tool-level duration easily in onStepFinish
                    const status = 'SUCCESS'; // If it's in results, it was tried

                    // Safely extract tool arguments from the tool call object
                    const toolArgs = (call as any).args ?? (call as any).input ?? {};
                    
                    await telemetryService.recordEvent({
                      skillName: call.toolName,
                      projectName: 'Skill Assistant',
                      model: aiProvider.modelId,
                      agent: 'Skill Assistant',
                      duration,
                      status,
                      userEmail: session.user.email ?? undefined,
                      metadata: {
                        args: toolArgs,
                        source: 'chat-ui'
                      }
                    }).catch(e => console.error('[skill-chat] Telemetry failed:', e));

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
