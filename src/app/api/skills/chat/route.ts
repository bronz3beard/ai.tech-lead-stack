import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { agentTools } from '@/lib/ai/agent-tools';

export const maxDuration = 30;

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

When analyzing a skill, actively use these tools to provide factual, tool-backed feedback rather than guessing.
If the user wants you to fix their code, provide the fix in a way that allows them to apply it.`;

export async function POST(req: Request) {
  try {
    const { messages, provider, model, apiKey, currentContent } = await req.json();

    let aiProvider;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key is required' }), { status: 400 });
    }

    if (provider === 'openai') {
      aiProvider = createOpenAI({ apiKey })(model || 'gpt-4o');
    } else if (provider === 'anthropic') {
      aiProvider = createAnthropic({ apiKey })(model || 'claude-3-5-sonnet-20240620');
    } else if (provider === 'google') {
      aiProvider = createGoogleGenerativeAI({ apiKey })(model || 'gemini-1.5-pro');
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported provider' }), { status: 400 });
    }

    const customMessages = [
      ...messages,
    ];

    if (currentContent && messages.length > 0 && messages[messages.length - 1].role === 'user') {
      // Append current editor content to the last user message for context
      const lastMsg = customMessages.pop();
      if (lastMsg) {
        customMessages.push({
          ...lastMsg,
          content: `${lastMsg.content}\n\n[Current Editor Content]:\n\`\`\`markdown\n${currentContent}\n\`\`\``
        });
      }
    }

    const result = await streamText({
      model: aiProvider,
      system: systemPrompt,
      messages: customMessages,
      tools: agentTools as any,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Chat route error:', error);
    return new Response(JSON.stringify({ error: error.message || 'An error occurred' }), { status: 500 });
  }
}
