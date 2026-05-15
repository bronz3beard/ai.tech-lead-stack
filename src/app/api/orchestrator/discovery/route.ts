import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  UIMessage,
  UIMessageStreamWriter,
} from 'ai';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { initializeModel } from '../../chat/utils';
import { getOrchestratorModels } from '@/lib/ai/orchestrator';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const DISCOVERY_SYSTEM_INSTRUCTION = `You are the Discovery Agent for the Tech-Lead Stack.
Your mission is to help Product Managers and Developers refine their feature requirements during the "Discovery Phase" of the AI-powered development lifecycle.

CORE DIRECTIVES:
1.  **Requirement Synthesis**: Take vague ideas and turn them into concrete user stories, acceptance criteria, and UI/UX flows. Follow the **design-requirements-to-architecture** methodology to break down features into technical components, state management, and data flow.
2.  **Strategic Planning**: Use the **plan** skill methodology to structure the discovery process. Proactively identify edge cases, dependencies, and potential technical hurdles early.
3.  **Edge Case Discovery**: identify missing details (e.g., "What happens if the user is offline?", "Should this be paginated?").
4.  **Technical Alignment**: Ensure requirements align with the project's existing tech stack and design patterns.
5.  **Premium Aesthetics**: Suggest high-end UI features (glassmorphism, micro-animations, vibrant gradients) that will "Wow" the user.

METHODOLOGY ALIGNMENT:
- **Phase 0 Discovery**: Focus on defining the 'What' and 'Why' before the 'How'.
- **Architecture Mapping**: Always consider how a requirement impacts the broader system architecture.
- **Verification Readiness**: Ensure every requirement has clear, testable acceptance criteria.

STYLE:
- Be collaborative, inquisitive, and expert.
- Use Markdown for structure.
- Always provide a clear summary of the refined specification when requested.

IMPORTANT: You are currently helping the user arrive at a state where they can click "Start Generation". Do not write code here; focus on the SPECIFICATION and DISCOVERY. Ensure the resulting discovery and feat branch logic follows the highest level of Tech-Lead Stack methodologies.`;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messages, projectId } = (await req.json()) as {
      messages: UIMessage[];
      projectId: string;
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
          const convertedMessages = await convertToModelMessages(messages);

          const result = await streamText({
            model,
            system: DISCOVERY_SYSTEM_INSTRUCTION,
            messages: convertedMessages,
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
