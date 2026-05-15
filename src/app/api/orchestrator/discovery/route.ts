import { getOrchestratorModels } from '@/lib/ai/orchestrator';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  UIMessage,
  UIMessageStreamWriter,
  tool,
  jsonSchema,
  type ModelMessage,
} from 'ai';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { initializeModel } from '../../chat/utils';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const DISCOVERY_SYSTEM_INSTRUCTION = `You are the Discovery Agent for the Tech-Lead Stack.
Your mission is to help Product Managers and Developers refine their feature requirements and provide LIVE VISUAL PROTOTYPES using the WebContainer sandbox.

CORE DIRECTIVES:
1.  **Requirement Synthesis**: Take vague ideas and turn them into concrete user stories, acceptance criteria, and UI/UX flows. 
2.  **Visual Prototyping**: Whenever a UI component or layout is discussed, use the \`write_to_sandbox\` tool to create a visual mockup (e.g., a React component, CSS, or README) so the user can see your vision immediately.
3.  **Strategic Planning**: Use the **plan** skill methodology. Identify edge cases, dependencies, and potential technical hurdles early.
4.  **Edge Case Discovery**: Identify missing details (e.g., "What happens if the user is offline?").
5.  **Technical Alignment**: Ensure requirements align with the project's existing tech stack and design patterns.
6.  **Premium Aesthetics**: Suggest high-end UI features (glassmorphism, micro-animations, vibrant gradients) that will "Wow" the user.

OUTPUT FORMATTING (MANDATORY):
- Use **Structured Markdown** with clear vertical segments.
- Use **Bold Headers** (###) for major sections.
- Use **Bullet Points** for lists.
- Use **GitHub Alerts** (> [!TIP], > [!IMPORTANT]) to highlight key architectural decisions.
- DO NOT provide raw, unformatted walls of text.

METHODOLOGY ALIGNMENT:
- **Phase 0 Discovery**: Define the 'What' and 'Why' before the 'How'.
- **Architecture Mapping**: Consider impact on the broader system.
- **Verification Readiness**: Ensure every requirement has testable acceptance criteria.

IMPORTANT: You are helping the user arrive at a "Start Generation" state. Use the sandbox tool to provide intermediate visual feedback. Do not just describe; SHOW.`;

function getEnhancedSystemInstruction(context: {
  figmaUrl?: string;
  branchUrl?: string;
  componentName?: string;
}) {
  let instruction = DISCOVERY_SYSTEM_INSTRUCTION;
  
  if (context.componentName || context.figmaUrl || context.branchUrl) {
    instruction = `CONTEXT FOR THIS SESSION:
${context.componentName ? `- TARGET FEATURE: ${context.componentName}` : ''}
${context.figmaUrl ? `- FIGMA DESIGN: ${context.figmaUrl}` : ''}
${context.branchUrl ? `- EXISTING BRANCH: ${context.branchUrl}` : ''}

CRITICAL: Since the user has provided these resources, you MUST automatically analyze and use them to influence your technical specifications and visual prototyping. Reference these specific designs and existing code patterns throughout the discovery iteration.

---
${instruction}`;
  }
  
  return instruction;
}

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
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messages, projectId, figmaUrl, branchUrl, componentName } = (await req.json()) as {
      messages: UIMessage[];
      projectId: string;
      figmaUrl?: string;
      branchUrl?: string;
      componentName?: string;
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

    // Access Validation
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { message: 'Project not found.' },
        { status: 404 }
      );
    }

    // Resolve model using orchestrator logic
    const { creatorModel } = getOrchestratorModels(user);

    const model = await initializeModel(user, creatorModel, 0);

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
          const modelMessages: ModelMessage[] = messages.map((m: any) => {
            const text = extractTextFromParts(m.parts || []);
            return {
              role: m.role,
              content: text || (typeof m.content === 'string' ? m.content : ''),
            };
          });

          const result = await streamText({
            model,
            system: getEnhancedSystemInstruction({ figmaUrl, branchUrl, componentName }),
            messages: modelMessages,
            tools: {
              write_to_sandbox: tool({
                description: 'Writes a file to the ephemeral development environment (WebContainer) for live prototyping.',
                inputSchema: jsonSchema<{ path: string; content: string }>({
                  type: 'object',
                  properties: {
                    path: { type: 'string', description: 'The relative path of the file (e.g., "src/components/Gauge.tsx")' },
                    content: { type: 'string', description: 'The code or text content to write to the file.' },
                  },
                  required: ['path', 'content'],
                }),
                execute: async ({ path }: { path: string }) => {
                  // Handled on client, but required for type inference
                  return { success: true, path };
                },
              }),
            },
          });

          for await (const chunk of result.toUIMessageStream()) {
            writer.write(chunk as any);
          }
        },
      }),
    });
  } catch (error) {
    console.error('Discovery API POST Error:', error);
    return NextResponse.json(
      { message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
