import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const projectId = 'test-proj-' + Date.now();
  const userId = 'test-user';

  await prisma.project.create({
    data: {
      id: projectId,
      name: 'Test Project',
      githubUrl: 'https://github.com/test/test',
    }
  });

  const chatId = 'test-chat-id-' + Date.now();

  // Create dummy chat
  await prisma.chat.create({
    data: {
      id: chatId,
      title: 'New Chat',
      userId: userId,
      projectId: projectId
    }
  });

  const messageCount = 10;

  // Benchmark N+1 create
  const startNPlus1 = performance.now();
  for (let i = 0; i < messageCount; i++) {
    await prisma.message.create({
      data: {
        chatId: chatId,
        role: 'assistant',
        content: JSON.stringify({
          role: 'assistant',
          content: [{ type: 'text', text: `Summary text ${i}` }],
        }),
      },
    });

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });
    if (chat && !chat.isCustomTitle && chat.title === 'New Chat') {
      // simulate auto title
      const finalTitle = `New Chat`;
    }
  }
  const endNPlus1 = performance.now();

  const chatId2 = 'test-chat-id-2-' + Date.now();
  await prisma.chat.create({
    data: {
      id: chatId2,
      title: 'New Chat',
      userId: userId,
      projectId: projectId
    }
  });

  // Benchmark createMany
  const startCreateMany = performance.now();
  const messagesToCreate = [];
  let lastText = '';
  for (let i = 0; i < messageCount; i++) {
    const summaryText = `Summary text ${i}`;
    messagesToCreate.push({
      chatId: chatId2,
      role: 'assistant',
      content: JSON.stringify({
        role: 'assistant',
        content: [{ type: 'text', text: summaryText }],
      }),
    });
    lastText = summaryText;
  }

  if (messagesToCreate.length > 0) {
    await prisma.message.createMany({
      data: messagesToCreate,
    });

    const chat = await prisma.chat.findUnique({
      where: { id: chatId2 },
    });
    if (chat && !chat.isCustomTitle && chat.title === 'New Chat') {
      const finalTitle = `New Chat`;
    }
  }
  const endCreateMany = performance.now();

  console.log(`N+1 Time: ${(endNPlus1 - startNPlus1).toFixed(2)}ms`);
  console.log(`createMany Time: ${(endCreateMany - startCreateMany).toFixed(2)}ms`);
  console.log(`Improvement: ${(((endNPlus1 - startNPlus1) - (endCreateMany - startCreateMany)) / (endNPlus1 - startNPlus1) * 100).toFixed(2)}%`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
