import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Seeding Agentic Health fixtures...');

  const user = await prisma.user.findFirst();
  if (!user) {
    console.error(
      'No user found to associate fixtures with. Please create a user first.'
    );
    process.exit(1);
  }

  // Clear existing fixtures if re-running
  await prisma.reflexionRun.deleteMany({
    where: { brief: { startsWith: '[Fixture]' } },
  });
  await prisma.analyticsEvent.deleteMany({
    where: { projectName: '[Fixture Project]' },
  });

  const now = new Date();

  // 1. Healthy evaluator scenario (ERR ~50%)
  const healthyRunId = 'run-healthy';
  await prisma.reflexionRun.create({
    data: {
      id: healthyRunId,
      userId: user.id,
      brief: '[Fixture] Healthy Run (Normal Revisions)',
      status: 'PASSED',
      revision: 2,
      costUsd: 1.5,
      latestScore: 9,
      stateJson: { history: [{ score: 6 }, { score: 8 }, { score: 9 }] },
      createdAt: now,
    },
  });

  const healthyEvents = [];
  for (let i = 0; i < 20; i++) {
    healthyEvents.push({
      actorType: 'AGENT',
      autonomy: 'AUTONOMOUS',
      loopPhase: 'critique',
      loopRunId: healthyRunId,
      projectName: '[Fixture Project]',
      metadata: { passed: i % 2 === 0 }, // 50% rejection
      userId: user.id,
    });
  }

  // 2. Nodding loop scenario (ERR 0%)
  const noddingRunId = 'run-nodding';
  await prisma.reflexionRun.create({
    data: {
      id: noddingRunId,
      userId: user.id,
      brief: '[Fixture] Nodding Loop Run',
      status: 'PASSED',
      revision: 0,
      costUsd: 0.1,
      latestScore: 10,
      stateJson: { history: [{ score: 10 }] },
      createdAt: new Date(now.getTime() - 86400000), // yesterday
    },
  });

  const noddingEvents = [];
  for (let i = 0; i < 25; i++) {
    noddingEvents.push({
      actorType: 'AGENT',
      autonomy: 'AUTONOMOUS',
      loopPhase: 'critique',
      loopRunId: noddingRunId,
      projectName: '[Fixture Project]',
      metadata: { passed: true }, // 0% rejection
      userId: user.id,
      createdAt: new Date(now.getTime() - 86400000),
    });
  }

  // 3. Blocked evaluator scenario (ERR 100%)
  const blockedRunId = 'run-blocked';
  await prisma.reflexionRun.create({
    data: {
      id: blockedRunId,
      userId: user.id,
      brief: '[Fixture] Blocked Evaluator Run',
      status: 'REVISION_CAP',
      revision: 25,
      costUsd: 5.5,
      latestScore: 3,
      stateJson: { history: [{ score: 3 }] },
      createdAt: new Date(now.getTime() - 86400000 * 2),
    },
  });

  const blockedEvents = [];
  for (let i = 0; i < 25; i++) {
    blockedEvents.push({
      actorType: 'AGENT',
      autonomy: 'AUTONOMOUS',
      loopPhase: 'critique',
      loopRunId: blockedRunId,
      projectName: '[Fixture Project]',
      metadata: { passed: false }, // 100% rejection
      userId: user.id,
      createdAt: new Date(now.getTime() - 86400000 * 2),
    });
  }

  // Also seed some interview / friction events to test those metrics
  const otherEvents = [
    {
      actorType: 'HUMAN',
      autonomy: 'DIRECTED',
      loopPhase: 'interview',
      loopRunId: healthyRunId,
      projectName: '[Fixture Project]',
      userId: user.id,
    },
    {
      actorType: 'AGENT',
      autonomy: 'AUTONOMOUS',
      loopRunId: blockedRunId,
      projectName: '[Fixture Project]',
      metadata: { frictionFiled: true },
      userId: user.id,
    },
  ];

  await prisma.analyticsEvent.createMany({
    data: [
      ...healthyEvents,
      ...noddingEvents,
      ...blockedEvents,
      ...otherEvents,
    ],
  });

  console.log('Seeded fixtures successfully.');
  console.log(
    'To view them, load the dashboard and check the Agentic Health section.'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
