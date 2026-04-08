import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { streamText, Message as AIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { prisma } from "@/lib/prisma";
import { canAccessWorkflow } from "@/lib/workflow-roles";
import * as path from "path";
import * as fs from "fs/promises";

async function readWorkflow(workflowName: string) {
   try {
      const repoRoot = process.cwd();
      const workflowPath = path.join(repoRoot, ".agents", "workflows", `${workflowName}.md`);
      const content = await fs.readFile(workflowPath, "utf-8");
      return content;
   } catch (error) {
      return null;
   }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages, projectId, chatId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ message: "Project ID is required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    let currentChatId = chatId;

    // Create a new chat if none exists
    if (!currentChatId) {
       const newChat = await prisma.chat.create({
         data: {
           userId: user.id,
           projectId: projectId,
           title: "New Chat",
         }
       });
       currentChatId = newChat.id;
    }

    // Determine Model Provider
    let model;

    if (user.claudApiKey) {
      const anthropic = createAnthropic({ apiKey: user.claudApiKey });
      model = anthropic("claude-3-haiku-20240307");
    } else if (user.openaiApiKey) {
      const openai = createOpenAI({ apiKey: user.openaiApiKey });
      model = openai("gpt-4o-mini");
    } else {
      const geminiKey = user.geminiApiKey || process.env.GEMINI_API_KEY;

      if (!geminiKey) {
        return NextResponse.json({
          message: "No API keys configured. Please add an API key in your profile."
        }, { status: 400 });
      }

      const google = createGoogleGenerativeAI({ apiKey: geminiKey });
      model = google("gemini-1.5-flash");
    }

    const userMessage = messages[messages.length - 1];

    await prisma.message.create({
      data: {
        chatId: currentChatId,
        role: "user",
        content: userMessage.content,
      }
    });

    // Check for workflows
    if (userMessage.content.startsWith("/")) {
       const command = userMessage.content.substring(1).trim().split(" ")[0];
       const workflowName = command.replace(/^get_/, "").replace(/_/g, "-");

       // Verify Role Access
       if (!canAccessWorkflow(user.role, workflowName)) {
           const deniedMessage = `Access Denied: The '${workflowName}' workflow is restricted and not available to the ${user.role} role.`;
           await prisma.message.create({
               data: {
                   chatId: currentChatId,
                   role: "assistant",
                   content: deniedMessage,
               }
           });
           return NextResponse.json({ message: deniedMessage }, { status: 403 });
       }

       const workflowContent = await readWorkflow(workflowName);

       if (workflowContent) {
           // We found a workflow, we need to instruct the LLM to follow it.
           // Append the workflow instructions to the prompt as a system message
           const systemInstruction = `You are a Tech Lead Agent. You have been asked to execute a workflow. The workflow instructions are as follows:\n\n${workflowContent}\n\nPlease analyze the user's intent and follow the workflow steps. Respond directly to the user.`;

           const workflowMessages = [
               { role: 'system' as const, content: systemInstruction, id: 'sys-1' },
               ...messages
           ];

           // Simulate adding the repoUrl to the context for standard chat processing
           let repoContextStr = "";
           const project = await prisma.project.findUnique({
             where: { id: projectId }
           });

           if (project && project.repoUrl) {
              repoContextStr = `\n\nProject Repository: ${project.repoUrl}`;
              workflowMessages[0].content += repoContextStr;
           }

           const result = await streamText({
               model: model,
               messages: workflowMessages as any,
               onFinish: async ({ text }: { text: string }) => {
                   await prisma.message.create({
                       data: {
                           chatId: currentChatId,
                           role: "assistant",
                           content: text,
                       }
                   });
               },
           });

           return result.toTextStreamResponse({
               headers: {
                   'x-chat-id': currentChatId
               }
           });
       } else {
           // Workflow not found
           const responseText = `Workflow '${workflowName}' not found in .agents/workflows.`;
           await prisma.message.create({
               data: {
                   chatId: currentChatId,
                   role: "assistant",
                   content: responseText,
               }
           });

           // Return a simple JSON response for errors that matches standard AI streaming format structure conceptually,
           // though the frontend will handle it as an error or standard message depending on setup.
           // For simplicity and compatibility with standard text generation, returning plain response.
           return NextResponse.json({ message: responseText }, { status: 404 });
       }
    }

    // Normal chat stream
    const normalMessages = [...messages];
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });
    if (project && project.repoUrl && normalMessages.length > 0) {
      // Prepend context to the first message if needed, or add a system message
      const sysMsg = { role: 'system' as const, content: `Project Repository: ${project.repoUrl}`, id: 'sys-repo' };
      normalMessages.unshift(sysMsg);
    }

    const result = await streamText({
      model: model,
      messages: normalMessages as any,
      onFinish: async ({ text }: { text: string }) => {
        await prisma.message.create({
          data: {
            chatId: currentChatId,
            role: "assistant",
            content: text,
          }
        });
      },
    });

    return result.toTextStreamResponse({
       headers: {
          'x-chat-id': currentChatId
       }
    });

  } catch (error: unknown) {
    // console.error("Chat API error:", error);
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.includes("quota")) {
      return NextResponse.json({
        message: "Token limit exceeded. Please configure your own API keys or wait for quota reset."
      }, { status: 429 });
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
