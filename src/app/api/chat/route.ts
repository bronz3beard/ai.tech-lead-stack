import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { skillsService } from '@/lib/skills';
import { GitHubCodeProvider } from '@/lib/skills/providers/github-provider';
import { canAccessWorkflow } from '@/lib/workflow-roles';
import { Role } from '@prisma/client';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  UIMessage,
  UIMessageStreamWriter,
} from 'ai';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { Telemetry } from '@/mcp-server/telemetry';
import { telemetryService } from '@/lib/telemetry-service';
import {
  CHAT_GUARD_INSTRUCTION,
  MAX_ANALYTICAL_STEPS,
  MODELS,
  SYSTEM_INSTRUCTION_WORKFLOW_PREFIX,
} from './constants';
import {
  getChatTools,
  getErrorMessage,
  initializeModel,
  isQuotaError,
  readWorkflow,
} from './utils';
import { CodeProvider } from '@/lib/skills/providers/base-provider';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const chatId = searchParams.get('chatId');

  try {
    // Scenario 1: Fetch list of chats for a project
    if (projectId) {
      const chats = await prisma.chat.findMany({
        where: {
          projectId,
          userId: session.user.id,
        },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        select: { 
          id: true, 
          title: true, 
          projectId: true, 
          updatedAt: true,
          isPinned: true,
          isCustomTitle: true 
        },
      });
      return NextResponse.json({ chats });
    }

    // Scenario 2: Fetch messages for a specific chat
    if (chatId) {
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      if (!chat) {
        return NextResponse.json({ message: 'Chat not found.' }, { status: 404 });
      }

      // Security check: Only the owner can see the messages
      if (chat.userId !== session.user.id) {
        return NextResponse.json({ message: 'Access denied.' }, { status: 403 });
      }

      // Reconstruct UIMessage objects from stored JSON strings
      const messages = chat.messages.map((m) => {
        try {
          // The database stores CoreMessage-compatible JSON (role, content)
          // CoreMessage content can be string or Array<ContentPart>
          const parsed = JSON.parse(m.content);
          const role = m.role as any;
          
          let parts: any[] = [];
          let content = '';

          if (typeof parsed.content === 'string') {
            content = parsed.content;
            parts = [{ type: 'text', text: parsed.content }];
          } else if (Array.isArray(parsed.content)) {
            // Only expose text + reasoning parts to the UI for history messages.
            // Tool-call and tool-result parts are internal intermediaries that
            // flood the chat list with tool trails when viewing old conversations.
            const RENDERABLE_PART_TYPES = new Set(['text', 'reasoning']);
            parts = (parsed.content as any[]).filter(
              (p) => RENDERABLE_PART_TYPES.has(p.type)
            );
            content = (parsed.content as any[])
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join('\n\n');
          }

          return {
            id: m.id,
            role,
            content,
            parts,
            createdAt: m.createdAt,
          };
        } catch {
          return {
            id: m.id,
            role: m.role as any,
            content: m.content,
            parts: [{ type: 'text', text: m.content }],
            createdAt: m.createdAt,
          };
        }
      });

      return NextResponse.json({ messages });
    }

    return NextResponse.json(
      { message: 'Missing projectId or chatId parameter.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Chat API GET Error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return NextResponse.json(
      { message: 'Chat ID is required.' },
      { status: 400 }
    );
  }

  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      return NextResponse.json({ message: 'Chat not found.' }, { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return NextResponse.json({ message: 'Access denied.' }, { status: 403 });
    }

    await prisma.chat.delete({
      where: { id: chatId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chat API DELETE Error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { chatId, title, isPinned } = (await req.json()) as {
      chatId: string;
      title?: string;
      isPinned?: boolean;
    };

    if (!chatId) {
      return NextResponse.json(
        { message: 'Chat ID is required.' },
        { status: 400 }
      );
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      return NextResponse.json({ message: 'Chat not found.' }, { status: 404 });
    }

    if (chat.userId !== session.user.id) {
      return NextResponse.json({ message: 'Access denied.' }, { status: 403 });
    }

    const updateData: any = {};
    if (title !== undefined) {
      updateData.title = title;
      updateData.isCustomTitle = true;
    }
    if (isPinned !== undefined) {
      updateData.isPinned = isPinned;
    }

    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: updateData,
    });

    return NextResponse.json({ chat: updatedChat });
  } catch (error) {
    console.error('Chat API PATCH Error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messages, projectId, chatId } = (await req.json()) as {
      messages: UIMessage[];
      projectId: string;
      chatId?: string;
    };

    if (!projectId) {
      return NextResponse.json(
        { message: 'Project ID is required.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    // Role-based Project Access Validation
    const isPrivilegedRole = user.role === 'ADMIN' || user.role === 'DEVELOPER';

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(isPrivilegedRole ? {} : {
          OR: [
            { ownerId: user.id },
            { accessGrants: { some: { role: user.role as Role } } },
          ],
        }),
      },
    });

    if (!project) {
      return NextResponse.json(
        { message: 'Project not found or access denied.' },
        { status: 403 }
      );
    }

    // Chat persistence initialization
    let currentChatId = chatId;
    let existingChatSummary: string | null = null;
    let existingMessageCount = 0;

    if (!currentChatId) {
      // Set initial title from first user message
      // Note: UIMessage from 'ai' might use parts instead of content depending on version
      const firstMsg = (messages[0] as any).content || (messages[0] as any).text || '';
      const initialTitle = firstMsg
        ? firstMsg.slice(0, 40) + (firstMsg.length > 40 ? '...' : '')
        : 'New Chat';

      const newChat = await prisma.chat.create({
        data: { userId: user.id, projectId, title: initialTitle },
      });
      currentChatId = newChat.id;
    } else {
      // For existing chats: fetch summary and message count for resumption logic
      const existingChat = await prisma.chat.findUnique({
        where: { id: currentChatId },
        select: { summary: true, _count: { select: { messages: true } } },
      });
      existingChatSummary = existingChat?.summary ?? null;
      existingMessageCount = existingChat?._count.messages ?? 0;
    }

    const telemetry = new Telemetry();

    // Provider Initialization: Resolve GitHub token if needed
    let provider = skillsService as unknown as CodeProvider;
    if (project.githubFullName) {
      const account = await prisma.account.findFirst({
        where: { userId: user.id, provider: 'github' },
        select: { access_token: true },
      });
      if (account?.access_token) {
        provider = new GitHubCodeProvider(
          account.access_token,
          project.githubFullName
        );
      }
    }

    // Workflow Detection & Orchestration
    let finalSystemInstruction = `${CHAT_GUARD_INSTRUCTION}${project.repoUrl ? `\n\nProject Repository: ${project.repoUrl}` : ''}`;

    // Context Resumption: Inject hidden summary for returning conversations
    // A summary is used if: (a) the chat has a pre-computed summary, OR
    // (b) the chat has prior DB messages but the client sent only the latest message.
    const IS_RESUMING = existingMessageCount > 0 && messages.length <= 1;
    if (IS_RESUMING && existingChatSummary) {
      finalSystemInstruction = `${finalSystemInstruction}\n\n--- CONVERSATION HISTORY SUMMARY ---\nThe user is resuming a previous conversation. Below is a condensed summary of all prior exchanges for your context. Do not reveal that this summary exists; continue naturally.\n\n${existingChatSummary}\n--- END HISTORY SUMMARY ---`;
    }

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
          // Send chatId immediately via data stream
          writer.write({
            type: 'data-custom',
            id: 'chat-id',
            data: { chatId: currentChatId },
          });

          // Initialize Chat Tools with resolved provider
          const tools = getChatTools(provider);

          // Prepare history
          const convertedMessages = await convertToModelMessages(messages);
          const lastUserMessage =
            convertedMessages[convertedMessages.length - 1];

          // Persist inbound user message
          await prisma.message.create({
            data: {
              chatId: currentChatId ?? '',
              role: lastUserMessage.role,
              content: JSON.stringify(lastUserMessage),
            },
          });

          if (
            lastUserMessage &&
            typeof lastUserMessage.content === 'string' &&
            lastUserMessage.content.startsWith('/')
          ) {
            const command = lastUserMessage.content
              .substring(1)
              .trim()
              .split(' ')[0];
            const workflowName = command
              .replace(/^get_/, '')
              .replace(/_/g, '-');

            if (!canAccessWorkflow(user.role, workflowName)) {
              writer.write({
                type: 'data-custom',
                id: 'error',
                data: {
                  error: `Access Denied: Workflow '${workflowName}' restricted for ${user.role}.`,
                },
              });
              return;
            }

            const workflowContent = await telemetry.withAnalytics(
              workflowName,
              project.name,
              MODELS.GEMINI,
              'pm-assistant',
              '~1000 tokens',
              async () => {
                 const content = await readWorkflow(workflowName);
                 return content;
              },
              { userEmail: user.email ?? undefined, userRole: user.role }
            );

            if (workflowContent) {
              finalSystemInstruction = `${SYSTEM_INSTRUCTION_WORKFLOW_PREFIX}\n\n${workflowContent}\n\nIMPORTANT: Execute the workflow via tool calls. ONCE ALL TOOLS FINISH, YOU MUST PROVIDE AN EXHAUSTIVE FINAL REPORT summarizing all findings and recommendations. DO NOT exit without a text-based finale report.\n\n${finalSystemInstruction}`;
            }
          }

          let stepCount = 0;
          const configs = [
            {
              modelId: MODELS.GEMINI,
              keyIndex: 0,
              label: 'Primary Model',
            },
            {
              modelId: MODELS.FALLBACK_GEMINI,
              keyIndex: 0,
              label: 'Stable Model (Primary Key)',
            },
            {
              modelId: MODELS.FALLBACK_GEMINI,
              keyIndex: 1,
              label: 'Stable Model (Alternative Key)',
            },
          ];

          for (let i = 0; i < configs.length; i++) {
            const config = configs[i];
            const isLastAttempt = i === configs.length - 1;

            console.info(
              `[chat] Attempt ${i + 1}/${configs.length} using ${config.label} (${config.modelId})`
            );

            try {
              const model = await initializeModel(
                user,
                config.modelId,
                config.keyIndex
              );

              if (i > 0) {
                writer.write({
                  type: 'data-custom',
                  id: 'status',
                  data: {
                    status: `Rotating to ${config.label} to resolve quota limit...`,
                  },
                });
              }

              let lastStepTime = Date.now();
              const result = await streamText({
                model,
                system: finalSystemInstruction,
                messages: convertedMessages,
                tools,
                maxRetries: 0, // Manual rotation handled here
                stopWhen: stepCountIs(MAX_ANALYTICAL_STEPS),
                onStepFinish: async (event) => {
                  const now = Date.now();
                  const stepDuration = (now - lastStepTime) / 1000;
                  lastStepTime = now;

                  try {
                    if (event.toolCalls && event.toolCalls.length > 0) {
                      stepCount++;
                      
                      // Extract insights from tool results for real-time progress logging
                      const insights: string[] = [];
                      for (const call of event.toolCalls) {
                        const callAny = call as any;
                        const resultPart = event.toolResults.find(r => r.toolCallId === call.toolCallId) as any;

                        // --- EXECUTION TELEMETRY ---
                        // Capture get_skill and discrete skill tools for analytics
                        const isSkillTool =
                          call.toolName === 'get_skill' ||
                          (!['list_skills', 'read_file', 'list_files', 'run_command'].includes(call.toolName));

                        if (isSkillTool) {
                          const args = callAny.args || callAny.input || {};
                          const skillName = call.toolName === 'get_skill'
                            ? (args.name || args.skillName || args.skill_id || 'unknown-skill')
                            : call.toolName;

                          // Record skill execution event asynchronously
                          telemetryService.recordEvent({
                            skillName,
                            projectName: project.name,
                            model: config.modelId,
                            agent: 'pm-assistant',
                            duration: stepDuration,
                            status: resultPart && resultPart.result?.error ? 'ERROR' : 'SUCCESS',
                            error: resultPart && resultPart.result?.error ? String(resultPart.result.error) : undefined,
                            userEmail: user.email ?? undefined,
                            metadata: {
                              chatId: currentChatId,
                              toolCallId: call.toolCallId,
                              stepNumber: stepCount,
                              source: 'chat-v2-execution',
                            }
                          }).catch(err => console.error('[Telemetry] Execution log failed:', err));
                        }

                        if (resultPart) {
                          const args = callAny.args || callAny.input || {};
                          
                          if (call.toolName === 'get_skill') {
                            const name = args.name || args.skillName;
                            insights.push(`Analyzed schema for '${name}' skill.`);
                          } else if (call.toolName === 'read_file') {
                            const path = args.path || args.filepath;
                            if (resultPart.result && !resultPart.result.error) {
                              const bytes = typeof resultPart.result.content === 'string' 
                                ? resultPart.result.content.length 
                                : 0;
                              insights.push(`Scrutinized '${path}' (${bytes} bytes).`);
                            } else {
                              const errMsg: string = resultPart.result?.error ?? '';
                              const lowerErr = errMsg.toLowerCase();
                              const isNotFound =
                                lowerErr.includes('file not found') ||
                                lowerErr.includes('not found') ||
                                lowerErr.includes('enoent');

                              insights.push(
                                isNotFound
                                  ? `File not found (skipped): '${path}'.`
                                  : `Encountered access error for '${path}'.`
                              );
                            }
                          } else if (call.toolName === 'list_skills') {
                            const res = resultPart.result || {};
                            const count = (res.skills?.length || 0) + (res.workflows?.length || 0);
                            insights.push(`Cataloged ${count} available skills and workflows.`);
                          }
                        }
                      }

                      writer.write({
                        type: 'data-custom',
                        id: `step-${stepCount}`,
                        data: {
                          status: `Analytical Step ${stepCount}: Researching...`,
                          insights: insights.length > 0 ? insights : [`Processing ${event.toolCalls.length} tool(s)...`],
                        },
                      });
                    }

                    for (const msg of event.response.messages) {
                      await prisma.message.create({
                        data: {
                          chatId: currentChatId ?? '',
                          role: msg.role as any,
                          content: JSON.stringify(msg),
                        },
                      });

                      // AUTO-TITLING: Extract text from assistant message content parts.
                      // CRITICAL FIX: msg.content from response.messages is ALWAYS an array
                      // of ContentPart in the AI SDK — never a raw string. The old
                      // `typeof === 'string'` guard always failed, so title stayed "New Chat".
                      if (msg.role === 'assistant') {
                        const content = msg.content;
                        let extractedText = '';

                        if (typeof content === 'string') {
                          extractedText = content;
                        } else if (Array.isArray(content)) {
                          for (const part of content) {
                            const p = part as any;
                            if (p.type === 'text' && typeof p.text === 'string' && p.text.trim().length > 0) {
                              extractedText = p.text;
                              break;
                            }
                          }
                        }

                        if (extractedText.trim().length > 0) {
                          const chat = await prisma.chat.findUnique({
                            where: { id: currentChatId ?? '' },
                          });
                          if (chat && !chat.isCustomTitle && chat.title === 'New Chat') {
                            // Preferred: title from AI response text
                            const aiTitle = generateAutoTitle(extractedText);

                            // Fallback: truncate the user's original message
                            let userFallbackTitle = 'New Chat';
                            if (lastUserMessage) {
                              const userContent = lastUserMessage.content;
                              const userText = typeof userContent === 'string'
                                ? userContent
                                : Array.isArray(userContent)
                                  ? (userContent as any[]).filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ')
                                  : '';
                              userFallbackTitle = generateAutoTitle(userText);
                            }

                            const finalTitle = aiTitle !== 'New Chat' ? aiTitle : userFallbackTitle;
                            await prisma.chat.update({
                              where: { id: chat.id },
                              data: { title: finalTitle },
                            });
                          }
                        }
                      }
                    }

                  } catch (err) {
                    console.error('Error during step update:', err);
                  }
                },
              });

              // Once the model finished analytical turns, relay the final summary streams
              const uiStream = result.toUIMessageStream();
              let textEmitted = false;

              try {
                for await (const chunk of uiStream) {
                  // Track if we got any text parts to handle the fallback notice reliably
                  if (chunk.type === 'text-delta' && (chunk as any).delta?.trim()) {
                    textEmitted = true;
                  }
                  writer.write(chunk as any);
                }

                // DYNAMIC SUMMARY TURN: If the model finished but didn't produce a final summary text
                // (typically after hitting the step limit), we force a final turn with no tools 
                // to synthesize all previous research into a final report.
                if (!textEmitted) {
                  console.info(`[chat] Analytical limit reached without report. Triggering dynamic summary turn...`);
                  
                  // Capture tool results and calls from the research phase
                  const response = await result.response;
                  const researchMessages = response.messages;

                  const summaryResult = await streamText({
                    model,
                    system: finalSystemInstruction,
                    messages: [
                      ...convertedMessages,
                      ...researchMessages,
                      { 
                        role: 'user', 
                        content: 'FINAL DIRECTIVE: The analytical process has reached its step limit. Respond now with your exhaustive final summary and recommendations based on the tool outputs above. Do NOT use any more tools.' 
                      }
                    ],
                    // No tools provided here to force a text-only summary
                  });

                  // Stream the summary to the same writer
                  for await (const chunk of summaryResult.toUIMessageStream()) {
                    if (chunk.type === 'text-delta' && (chunk as any).delta?.trim()) {
                      textEmitted = true;
                    }
                    writer.write(chunk as any);
                  }

                  // PERSISTENCE FIX: Persist the dynamic summary turn final text to the DB.
                  // Previously this turn streamed to the UI but was never saved, so the
                  // final AI response would be missing when reloading historical chats.
                  if (currentChatId) {
                    try {
                      const summaryResponse = await summaryResult.response;
                      for (const msg of summaryResponse.messages) {
                        if (msg.role !== 'assistant') continue;

                        // Extract text content (always an array of ContentPart in AI SDK)
                        let summaryText = '';
                        if (typeof msg.content === 'string') {
                          summaryText = msg.content;
                        } else if (Array.isArray(msg.content)) {
                          summaryText = (msg.content as any[])
                            .filter((p: any) => p.type === 'text')
                            .map((p: any) => p.text)
                            .join('\n\n');
                        }

                        if (summaryText.trim().length === 0) continue;

                        await prisma.message.create({
                          data: {
                            chatId: currentChatId,
                            role: 'assistant',
                            // Store as a simple text ContentPart array for clean history rendering
                            content: JSON.stringify({
                              role: 'assistant',
                              content: [{ type: 'text', text: summaryText }],
                            }),
                          },
                        });

                        // Also update the chat title from the clean final answer if still "New Chat"
                        const chat = await prisma.chat.findUnique({
                          where: { id: currentChatId },
                        });
                        if (chat && !chat.isCustomTitle && chat.title === 'New Chat') {
                          const finalTitle = generateAutoTitle(summaryText);
                          if (finalTitle !== 'New Chat') {
                            await prisma.chat.update({
                              where: { id: currentChatId },
                              data: { title: finalTitle },
                            });
                          }
                        }
                      }
                    } catch (persistErr) {
                      console.error('[chat] Failed to persist summary turn message:', persistErr);
                    }
                  }
                }

                // Final success signal
                writer.write({
                  type: 'data-custom',
                  id: 'final-status',
                  data: { status: 'DONE: Analysis successfully completed.' },
                });

                // BACKGROUND SUMMARIZATION: After a successful stream, update the
                // chat summary if this is an established conversation (> 5 messages)
                // This is fire-and-forget; we don't await it to avoid blocking the response.
                if (currentChatId) {
                  const chatForSummary = await prisma.chat.findUnique({
                    where: { id: currentChatId },
                    select: { _count: { select: { messages: true } } },
                  });
                  const shouldSummarize = (chatForSummary?._count.messages ?? 0) > 5;
                  if (shouldSummarize) {
                    updateChatSummary(currentChatId, model).catch((err) =>
                      console.error('[chat] Background summary generation failed:', err)
                    );
                  }
                }

                return; // SUCCESS - Both model and stream finished
              } catch (streamErr: unknown) {
                if (isQuotaError(streamErr)) {
                  console.warn(
                    `[chat] Mid-stream quota hit for ${config.modelId}. Rotating...`
                  );
                  // Allow the outer loop to continue to the next config
                  continue;
                }
                throw streamErr;
              }
            } catch (err: unknown) {
              const quotaError = isQuotaError(err);
              const errorText = getErrorMessage(err);

              console.warn(
                `[chat] Attempt ${i + 1} (${config.modelId}) failed:`,
                errorText
              );

              if (quotaError && !isLastAttempt) {
                // Continue to next config in loop
                continue;
              }

              // Final exhaustion or non-quota error
              let finalMessage = `AI Execution Error (${config.modelId}): ${errorText}`;

              if (quotaError) {
                finalMessage =
                  `All available AI model quotas (including fallback to ${config.modelId}) have been exhausted.\n\nPlease check your plan and billing details:\n\n` +
                  `• Gemini: https://ai.google.dev/gemini-api/docs/rate-limits\n` +
                  `• GPT: https://platform.openai.com/docs/guides/rate-limits\n` +
                  `• Claude: https://docs.anthropic.com/en/api/rate-limits`;
              }

              writer.write({
                type: 'data-custom',
                id: 'error',
                data: { error: finalMessage },
              });
              return;
            }
          }
        },
      }),
    });
  } catch (error: unknown) {
    console.error('Chat API Fatal error:', getErrorMessage(error));
    return NextResponse.json(
      { message: `Fatal Error: ${getErrorMessage(error)}` },
      { status: 500 }
    );
  }
}

function generateAutoTitle(content: string): string {
  // Strip markdown headers, code fences, blockquotes, bullet lists, bold, and common AI openers
  const AI_OPENER_PATTERNS = [
    /^(of course|certainly|sure|absolutely|great|hello|hi there|i'll|i will|let me|i can|understood)[!,.]?\s*/i,
    /^(here('s| is)|this is|below is)/i,
  ];

  const cleaned = content
    .split('\n')
    .map((line) => line.replace(/^[#*>`\-=_~|]+/, '').replace(/\*\*/g, '').trim())
    .filter((line) => line.length > 10) // Skip very short lines like headers or single words
    .join(' ');

  let title = cleaned.substring(0, 120); // Work with first ~120 chars

  for (const pattern of AI_OPENER_PATTERNS) {
    title = title.replace(pattern, '');
  }

  title = title.trim();

  if (title.length > 50) {
    // Truncate at the last word boundary before 50 chars
    const truncated = title.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 30 ? truncated.substring(0, lastSpace) : truncated) + '…';
  }

  return title || 'New Chat';
}

/**
 * @desc Generates a compressed summary of all messages in a chat and persists
 * it to the DB. Called in a fire-and-forget pattern after successful responses.
 * @param chatId - The ID of the chat to summarize.
 * @param model - The AI model instance to use for generation.
 */
async function updateChatSummary(chatId: string, model: any): Promise<void> {
  const allMessages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true },
  });

  if (allMessages.length < 6) return; // Not enough history to warrant a summary

  // Build a condensed transcript for the LLM to summarize
  const transcript = allMessages
    .map((m) => {
      try {
        const parsed = JSON.parse(m.content);
        const text = typeof parsed.content === 'string'
          ? parsed.content
          : (parsed.content as any[])?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ');
        return `${m.role.toUpperCase()}: ${text?.substring(0, 500) ?? ''}`;
      } catch {
        return `${m.role.toUpperCase()}: ${m.content.substring(0, 500)}`;
      }
    })
    .join('\n\n');

  const { text } = await import('ai').then(({ generateText }) =>
    generateText({
      model,
      prompt: `You are a compact summarizer. Condense the following conversation into 2-3 short paragraphs. Focus on the key topics, decisions, and conclusions. Do not include filler phrases or pleasantries. Be dense and factual.\n\n${transcript}`,
    })
  );

  await prisma.chat.update({
    where: { id: chatId },
    data: { summary: text },
  });
}
