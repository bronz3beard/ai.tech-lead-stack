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
  SYSTEM_INSTRUCTION_WORKFLOW_PREFIX,
} from './constants';
import {
  getChatTools,
  getErrorMessage,
  initializeModel,
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

          // Initialize AI Environment
          const model = await initializeModel(user);
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
              finalSystemInstruction = `${SYSTEM_INSTRUCTION_WORKFLOW_PREFIX}\n\n${workflowContent}\n\nIMPORTANT: Skip steps and provide the finale report.\n\n${finalSystemInstruction}`;
            }
          }

          let stepCount = 0;

          const result = await streamText({
            model,
            system: finalSystemInstruction,
            messages: convertedMessages,
            tools,
            // Default maxRetries (2) retries immediately on 429 and burns free-tier quota
            // (e.g. "Failed after 3 attempts") instead of honoring Retry-After.
            maxRetries: 0,
            stopWhen: stepCountIs(MAX_ANALYTICAL_STEPS),
            onStepFinish: async (event) => {
              // Log analytical progress to UI
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

              // Persist all generated messages from this step
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

          writer.merge(result.toUIMessageStream());
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
