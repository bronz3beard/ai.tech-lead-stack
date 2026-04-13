import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

export const maxDuration = 300;

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
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: user.id },
          { accessGrants: { some: { role: user.role as Role } } },
        ],
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
    if (!currentChatId) {
      const newChat = await prisma.chat.create({
        data: { userId: user.id, projectId, title: 'New Chat' },
      });
      currentChatId = newChat.id;
    }

    // Workflow Detection & Orchestration
    let finalSystemInstruction = `${CHAT_GUARD_INSTRUCTION}${project.repoUrl ? `\n\nProject Repository: ${project.repoUrl}` : ''}`;

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
          // Send chatId immediately via data stream
          writer.write({
            type: 'data-custom',
            id: 'chat-id',
            data: { chatId: currentChatId },
          });

          // Initialize Chat Tools
          const tools = getChatTools();
 
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
 
             const workflowContent = await readWorkflow(workflowName);
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
             
             console.info(`[chat] Attempt ${i + 1}/${configs.length} using ${config.label} (${config.modelId})`);
 
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

              const result = await streamText({
                model,
                system: finalSystemInstruction,
                messages: convertedMessages,
                tools,
                maxRetries: 0, // Manual rotation handled here
                stopWhen: stepCountIs(MAX_ANALYTICAL_STEPS),
                onStepFinish: async (event) => {
                  if (event.toolCalls && event.toolCalls.length > 0) {
                    stepCount++;
                    writer.write({
                      type: 'data-custom',
                      id: `step-${stepCount}`,
                      data: {
                        status: `Analytical Step ${stepCount}: Processing ${event.toolCalls.length} tool(s)...`,
                      },
                    });
                  }

                  try {
                    for (const msg of event.response.messages) {
                      await prisma.message.create({
                        data: {
                          chatId: currentChatId ?? '',
                          role: msg.role as any,
                          content: JSON.stringify(msg),
                        },
                      });
                    }
                  } catch (err) {
                    console.error('Error persisting step messages:', err);
                  }
                },
              });

              // Once the model finished analytical turns, relay the final summary streams
              const uiStream = result.toUIMessageStream();
              
              // We check if the result contains text before streaming to handle the fallback check reliably.
              const finalText = await result.text;
              const hasEmittedText = finalText.trim().length > 0;

              try {
                for await (const chunk of uiStream) {
                  writer.write(chunk as any);
                }

                // FALLBACK: If the model finished but didn't produce a final summary text
                // (which can happen if it hits the step limit or misinterprets instructions),
                // we synthesize a completion notice so the user isn't left hanging.
                if (!hasEmittedText) {
                  writer.write({
                    role: 'assistant',
                    id: `fallback-${Date.now()}`,
                    parts: [{
                      type: 'text',
                      text: `### Analysis Complete\n\nThe analytical process has finished after ${stepCount} steps. However, a detailed final report was not generated by the model in this turn. Please review the tool outputs above for raw details.`
                    }],
                    content: 'Analysis Complete'
                  } as any);
                }

                // Final success signal
                writer.write({
                  type: 'data-custom',
                  id: 'final-status',
                  data: { status: 'DONE: Analysis successfully completed.' }
                });

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
                finalMessage = `All available AI model quotas (including fallback to ${config.modelId}) have been exhausted.\n\nPlease check your plan and billing details:\n\n` +
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
