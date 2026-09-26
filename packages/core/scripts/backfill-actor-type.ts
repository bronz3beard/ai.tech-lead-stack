import { prisma } from '../src/lib/prisma';

export function determineActorTelemetry(event: any) {
  let actorType = 'HUMAN';
  let autonomy = 'DIRECTED';

  const metadata =
    typeof event.metadata === 'object' && event.metadata !== null
      ? event.metadata
      : {};

  if (metadata.source === 'mcp') {
    actorType = 'AGENT';
    autonomy = 'DIRECTED';
  } else if (
    event.skillName === 'reflexion-loop' ||
    event.skillName === 'skill:reflexion-loop'
  ) {
    actorType = 'AGENT';
    autonomy = 'AUTONOMOUS';
  }

  return { actorType, autonomy };
}

async function main() {
  const isApply = process.argv.includes('--apply');

  console.log(
    `Starting AnalyticsEvent actor backfill... [${isApply ? 'APPLY' : 'DRY RUN'}]`
  );

  const eventsToBackfill = await prisma.analyticsEvent.findMany({
    where: {
      actorType: null,
      autonomy: null,
    },
    select: {
      id: true,
      skillName: true,
      metadata: true,
    },
  });

  if (eventsToBackfill.length === 0) {
    console.log('No events to backfill.');
    console.log(
      `\nSummary Table:\n-------------------------------------------------\n| Actor Type | Autonomy    | Count |`
    );
    console.log(
      `-------------------------------------------------\n| No updates needed.                             |\n-------------------------------------------------`
    );
    return;
  }

  let humanDirectedCount = 0;
  let agentDirectedCount = 0;
  let agentAutonomousCount = 0;

  const operations = [];

  for (const event of eventsToBackfill) {
    const { actorType, autonomy } = determineActorTelemetry(event);

    if (actorType === 'HUMAN' && autonomy === 'DIRECTED') {
      humanDirectedCount++;
    } else if (actorType === 'AGENT' && autonomy === 'DIRECTED') {
      agentDirectedCount++;
    } else if (actorType === 'AGENT' && autonomy === 'AUTONOMOUS') {
      agentAutonomousCount++;
    }

    operations.push(
      prisma.analyticsEvent.update({
        where: { id: event.id },
        data: { actorType, autonomy },
      })
    );
  }

  console.log(
    `\nSummary Table:\n-------------------------------------------------`
  );
  console.log(`| Actor Type | Autonomy    | Count |`);
  console.log(`-------------------------------------------------`);
  console.log(
    `| HUMAN      | DIRECTED    | ${humanDirectedCount.toString().padEnd(5)} |`
  );
  console.log(
    `| AGENT      | DIRECTED    | ${agentDirectedCount.toString().padEnd(5)} |`
  );
  console.log(
    `| AGENT      | AUTONOMOUS  | ${agentAutonomousCount.toString().padEnd(5)} |`
  );
  console.log(`-------------------------------------------------\n`);

  if (isApply) {
    console.log(`Applying updates to ${eventsToBackfill.length} records...`);

    // Batch operations in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      await prisma.$transaction(chunk);
    }
    console.log('Update complete.');
  } else {
    console.log('Run with --apply to execute the updates.');
  }
}

if (require.main === module) {
  main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
