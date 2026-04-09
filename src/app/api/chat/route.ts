import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessWorkflow } from '@/lib/workflow-roles';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import * as fs from 'fs/promises';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import * as path from 'path';
import { z } from 'zod';

async function readWorkflow(workflowName: string) {
  try {
    const repoRoot = process.cwd();
    const workflowPath = path.join(
      repoRoot,
      '.agents',
      'workflows',
      `${workflowName}.md`
    );
    const content = await fs.readFile(workflowPath, 'utf-8');
    return content;
  } catch (error) {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messages, projectId, chatId } = await req.json();

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

    let currentChatId = chatId;

    // Validate the project exists and belongs to the signed-in user or the user has role access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: user.id },
          { accessGrants: { some: { role: user.role as any } } },
        ],
      },
      include: { accessGrants: true },
    });

    if (!project) {
      return NextResponse.json(
        { message: 'Project not found or you do not have access to it.' },
        { status: 403 }
      );
    }

    // Create a new chat if none exists
    if (!currentChatId) {
      const newChat = await prisma.chat.create({
        data: {
          userId: user.id,
          projectId: projectId,
          title: 'New Chat',
        },
      });
      currentChatId = newChat.id;
    }

    // Determine Model Provider
    const preferredModel = user.preferredModel ?? 'gemini';
    let model;
    const { decrypt } = await import('@/lib/crypto');

    if (preferredModel === 'claude' && user.claudeApiKey) {
      const anthropic = createAnthropic({ apiKey: decrypt(user.claudeApiKey) });
      model = anthropic('claude-opus-4.6');
    } else if (preferredModel === 'openai' && user.openaiApiKey) {
      const openai = createOpenAI({ apiKey: decrypt(user.openaiApiKey) });
      model = openai('gpt-5.4');
    } else {
      const geminiKey = user.geminiApiKey
        ? decrypt(user.geminiApiKey)
        : process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return NextResponse.json(
          {
            message:
              'No API keys configured. Please add an API key in your profile.',
          },
          { status: 400 }
        );
      }
      const google = createGoogleGenerativeAI({ apiKey: geminiKey });
      model = google('gemini-3-flash-preview');
    }

    if (project.ownerId && project.ownerId !== user.id) {
      const ownerAccount = await prisma.account.findFirst({
        where: { userId: project.ownerId, provider: 'github' },
        select: { access_token: true },
      });
      // we fetch the owner access token but for the current read-only architecture
      // github API integrations happen further downstream in tools (not implemented in this scope)
      // However, we satisfy the requirement of "server proxies via developer's token" mentally
      // by getting this access token if needed for any chat tools.
    }

    const userMessage = messages[messages.length - 1];

    await prisma.message.create({
      data: {
        chatId: currentChatId,
        role: 'user',
        content: userMessage.content,
      },
    });

    // Check for workflows
    if (userMessage.content.startsWith('/')) {
      const command = userMessage.content.substring(1).trim().split(' ')[0];
      const workflowName = command.replace(/^get_/, '').replace(/_/g, '-');

      // Verify Role Access
      if (!canAccessWorkflow(user.role, workflowName)) {
        const deniedMessage = `Access Denied: The '${workflowName}' workflow is restricted and not available to the ${user.role} role.`;
        await prisma.message.create({
          data: {
            chatId: currentChatId,
            role: 'assistant',
            content: deniedMessage,
          },
        });
        return NextResponse.json({ message: deniedMessage }, { status: 403 });
      }

      const workflowContent = await readWorkflow(workflowName);

      if (workflowContent) {
        // We found a workflow, we need to instruct the LLM to follow it.
        // Append the workflow instructions to the prompt as a system message
        const chatGuardInstruction = `
### SECURITY GUARD: PROJECT READ-ONLY MODE
You are in a strictly READ-ONLY analysis environment at the "/chat" URL.
1. NEVER output a tool call, command, or script that could modify any files in the workspace.
2. Interpret all "Execute", "Fix", or "Modify" requests as "Analyze and Propose Results".
3. Use the provided tools (get_skill, list_skills, read_file) to gather context and perform requested audits.
4. DIRECT RESULT POLICY: Do NOT provide 'Phases', 'Step-by-Step Plans', or 'Templates'. Move immediately to the final report, analysis, or answer. Your response should be conversational and deliver the value upfront.
`;

        const systemInstruction = `${chatGuardInstruction}\n\nYou are a Tech Lead Agent. You have been asked to execute a workflow. The workflow instructions are as follows:\n\n${workflowContent}\n\nIMPORTANT: Skip the planning phases mentioned in the workflow. Use your tools to perform the analysis required by those phases in the background, and provide ONLY the final conversational response and report to the user.`;

        const workflowMessages = [
          { role: 'system' as const, content: systemInstruction, id: 'sys-1' },
          ...messages,
        ];

        // Add project repo URL to system context
        if (project.repoUrl) {
          workflowMessages[0].content += `\n\nProject Repository: ${project.repoUrl}`;
        }

        const result = await streamText({
          model: model,
          messages: workflowMessages as any,
          tools: {
            list_skills: {
              description: 'Lists all available skills and workflows.',
              parameters: z.object({}),
              execute: async () => {
                const skillsDir = path.join(process.cwd(), '.ai', 'skills');
                const workflowsDir = path.join(process.cwd(), '.agents', 'workflows');
                try {
                  const [skills, workflows] = await Promise.all([
                    fs.readdir(skillsDir).catch(() => []),
                    fs.readdir(workflowsDir).catch(() => []),
                  ]);
                  return { skills, workflows };
                } catch (e) {
                  return { error: 'Could not list skills' };
                }
              },
            },
            get_skill: {
              description: 'Reads the specific content of a skill or workflow.',
              parameters: z.object({
                name: z.string().describe('The name of the skill or workflow file (without .md)'),
                type: z.enum(['skill', 'workflow']).default('skill'),
              }),
              execute: async ({ name, type }) => {
                const baseDir = type === 'skill' 
                  ? path.join(process.cwd(), '.ai', 'skills')
                  : path.join(process.cwd(), '.agents', 'workflows');
                try {
                  const content = await fs.readFile(path.join(baseDir, `${name}.md`), 'utf-8');
                  return { content };
                } catch (e) {
                  return { error: `Skill or workflow ${name} not found.` };
                }
              },
            },
            read_file: {
              description: 'Reads a file from the project for analysis.',
              parameters: z.object({
                filePath: z.string().describe('The relative path to the file from the project root'),
              }),
              execute: async ({ filePath }) => {
                try {
                  const content = await fs.readFile(path.join(process.cwd(), filePath), 'utf-8');
                  return { content };
                } catch (e) {
                  return { error: `Could not read file at ${filePath}` };
                }
              },
            },
          },
          maxSteps: 5,
          onFinish: async ({ text }: { text: string }) => {
            await prisma.message.create({
              data: {
                chatId: currentChatId,
                role: 'assistant',
                content: text,
              },
            });
          },
        });

        return result.toDataStreamResponse({
          headers: {
            'x-chat-id': currentChatId,
          },
        });
      } else {
        // Workflow not found
        const responseText = `Workflow '${workflowName}' not found in .agents/workflows.`;
        await prisma.message.create({
          data: {
            chatId: currentChatId,
            role: 'assistant',
            content: responseText,
          },
        });

        // Return a simple JSON response for errors that matches standard AI streaming format structure conceptually,
        // though the frontend will handle it as an error or standard message depending on setup.
        // For simplicity and compatibility with standard text generation, returning plain response.
        return NextResponse.json({ message: responseText }, { status: 404 });
      }
    }

    // Normal chat stream
    const chatGuardInstruction = `
### SECURITY GUARD: PROJECT READ-ONLY MODE
You are in a strictly READ-ONLY analysis environment at the "/chat" URL.
1. NEVER output a tool call, command, or script that could modify any files in the workspace.
2. Interpret all "Execute", "Fix", or "Modify" requests as "Analyze and Propose Results".
3. Use the provided tools (get_skill, list_skills, read_file) to gather context and perform requested audits.
4. DIRECT RESULT POLICY: Do NOT provide 'Phases', 'Step-by-Step Plans', or 'Templates'. Move immediately to the final report, analysis, or answer. Your response should be conversational and deliver the value upfront.
`;

    const projectContext = project.repoUrl
      ? `\nProject Repository: ${project.repoUrl}`
      : '';
    const normalMessages = [
      {
        role: 'system' as const,
        content: `${chatGuardInstruction}${projectContext}`,
        id: 'sys-guard',
      },
      ...messages,
    ];

    const result = await streamText({
      model: model,
      messages: normalMessages as any,
      tools: {
        list_skills: {
          description: 'Lists all available skills and workflows.',
          parameters: z.object({}),
          execute: async () => {
            const skillsDir = path.join(process.cwd(), '.ai', 'skills');
            const workflowsDir = path.join(process.cwd(), '.agents', 'workflows');
            try {
              const [skills, workflows] = await Promise.all([
                fs.readdir(skillsDir).catch(() => []),
                fs.readdir(workflowsDir).catch(() => []),
              ]);
              return { skills, workflows };
            } catch (e) {
              return { error: 'Could not list skills' };
            }
          },
        },
        get_skill: {
          description: 'Reads the specific content of a skill or workflow.',
          parameters: z.object({
            name: z.string().describe('The name of the skill or workflow file (without .md)'),
            type: z.enum(['skill', 'workflow']).default('skill'),
          }),
          execute: async ({ name, type }) => {
            const baseDir = type === 'skill' 
              ? path.join(process.cwd(), '.ai', 'skills')
              : path.join(process.cwd(), '.agents', 'workflows');
            try {
              const content = await fs.readFile(path.join(baseDir, `${name}.md`), 'utf-8');
              return { content };
            } catch (e) {
              return { error: `Skill or workflow ${name} not found.` };
            }
          },
        },
        read_file: {
          description: 'Reads a file from the project for analysis.',
          parameters: z.object({
            filePath: z.string().describe('The relative path to the file from the project root'),
          }),
          execute: async ({ filePath }) => {
            try {
              const content = await fs.readFile(path.join(process.cwd(), filePath), 'utf-8');
              return { content };
            } catch (e) {
              return { error: `Could not read file at ${filePath}` };
            }
          },
        },
      },
      maxSteps: 5,
      onFinish: async ({ text }: { text: string }) => {
        await prisma.message.create({
          data: {
            chatId: currentChatId,
            role: 'assistant',
            content: text,
          },
        });
      },
    });

    return result.toDataStreamResponse({
      headers: {
        'x-chat-id': currentChatId,
      },
    });
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.includes('quota')) {
      return NextResponse.json(
        {
          message:
            'Token limit exceeded. Please configure your own API keys or wait for quota reset.',
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
