import { prisma } from '../../../lib/prisma';
import { StateStore, ReflexionStateV2, ReflexionStateV2Schema } from './schema';

export class DbStateStore implements StateStore {
  async load(runId: string): Promise<ReflexionStateV2 | null> {
    const run = await prisma.reflexionRun.findUnique({
      where: { id: runId }
    });
    if (!run || !run.stateJson) return null;

    try {
      return ReflexionStateV2Schema.parse(run.stateJson);
    } catch (err) {
      console.error(`[DbStateStore] Failed to parse stateJson for runId ${runId}:`, err);
      return null;
    }
  }

  async save(state: ReflexionStateV2): Promise<void> {
    const latestScore = state.critiques[state.critiques.length - 1]?.score || null;

    // Determine status from phase if stopReason is set etc, or map phase to DB status
    let status = 'RUNNING';
    if (state.phase === 'APPROVED') status = 'APPROVED';
    else if (state.phase === 'AWAITING_ANSWERS') status = 'AWAITING_INTERVIEW';
    else if (state.stopReason === 'passed') status = 'PASSED';
    else if (state.stopReason === 'budget-exceeded') status = 'BUDGET_CAP';
    else if (state.stopReason === 'max-revisions') status = 'REVISION_CAP';
    else if (state.stopReason) status = 'STOPPED';

    await prisma.reflexionRun.upsert({
      where: { id: state.runId },
      create: {
        id: state.runId,
        brief: state.brief,
        status: status,
        stateJson: state as any,
        latestScore: latestScore,
        revision: state.revision,
        costUsd: state.usage.costUsd,
      },
      update: {
        brief: state.brief,
        status: status,
        stateJson: state as any,
        latestScore: latestScore,
        revision: state.revision,
        costUsd: state.usage.costUsd,
      }
    });
  }
}
