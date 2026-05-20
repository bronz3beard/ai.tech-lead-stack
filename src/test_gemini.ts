import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, tool, jsonSchema } from 'ai';

async function main() {
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "dummy",
  });
  
  const model = google('gemini-2.5-flash');

  try {
    const result = await streamText({
      model,
      messages: [
        { role: 'user', content: 'List files' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call_1',
              toolName: 'list_sandbox_files',
              input: {},
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call_1',
              toolName: 'list_sandbox_files',
              output: { type: 'json', value: { success: true } },
            },
          ],
        },
        {
          role: 'assistant',
          content: 'Here are the files...',
        },
      ],
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

    console.log("Success! Stream created.");
  } catch (error: any) {
    console.error("Error thrown:", error.message);
  }
}

main();
