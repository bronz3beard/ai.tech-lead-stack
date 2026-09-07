import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@zenithfoundry/tech-lead-stack/db';
import { resumeReflexion } from '@zenithfoundry/tech-lead-stack/ai/reflexion/engine';
import { runnerFromUser } from '@zenithfoundry/tech-lead-stack/ai/reflexion/providers-user';
import { DbStateStore } from '@zenithfoundry/tech-lead-stack/ai/reflexion/db-state-store';
import { AnswersSchema } from '@zenithfoundry/tech-lead-stack/ai/reflexion/schema';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = AnswersSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid answers payload', details: parseResult.error }, { status: 400 });
    }
    const answers = parseResult.data;

    const run = await prisma.reflexionRun.findUnique({
      where: { id: answers.runId },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (run.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stateStore = new DbStateStore();
    const state = await stateStore.load(run.id);

    if (!state) {
      return NextResponse.json({ error: 'Failed to load run state' }, { status: 500 });
    }

    const runner = runnerFromUser(user);



    let revisionCounter = state.revision;
    const result = await resumeReflexion(
      runner,
      state,
      answers,
      {
        brief: state.brief,
        maxRevisions: state.params.maxRevisions,
        passThreshold: state.params.passThreshold,
        mode: 'interview',
        stateStore,
      },
      (e) => {
        let teamRole: string | undefined;
        let phaseStr = e.phase;

        if ('revision' in e) {
          revisionCounter = e.revision;
        }

        if (e.phase === 'critique' || e.phase === 'scored') teamRole = 'critic';
        if (e.phase === 'adjudicate') teamRole = 'adjudicator';
        if (e.phase === 'interview') teamRole = 'interviewer';



        import('@zenithfoundry/tech-lead-stack/telemetry-service').then((m) => m.telemetryService.recordEvent({
           skillName: 'reflexion-loop',
           duration: 0,
           status: 'SUCCESS',
           actorType: 'AGENT',
           autonomy: 'AUTONOMOUS',
           loopRunId: run.id,
           loopPhase: phaseStr,
           teamRole,
           promptTokens: ('usage' in e && e.usage) ? e.usage.promptTokens : undefined,
           completionTokens: ('usage' in e && e.usage) ? e.usage.completionTokens : undefined,
           model: ('usage' in e && e.usage) ? e.usage.modelId : undefined,
           metadata: {
             revision: revisionCounter,
             score: ('critique' in e) ? e.critique.score : undefined,
             passed: ('critique' in e) ? e.critique.passed : undefined
           }
        })).catch(() => {});


      }
    );

    if (result.interview && result.interview.questions.length > 0) {
      return NextResponse.json({
        runId: run.id,
        status: 'AWAITING_INTERVIEW',
        interview: result.interview,
        scores: result.scores,
        verdict: result.verdict
      });
    }

    return NextResponse.json({ mode: 'advisory', ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resume failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
