import { prisma } from '../../../lib/prisma';
import { StateStore, ReflexionStateV2, ReflexionStateV2Schema } from './schema';

export class DbStateStore implements StateStore {
  async load(runId: string): Promise<ReflexionStateV2 | null> {
    const run = await prisma.reflexionRun.findUnique({
      where: { id: runId }
    });
    if (!run || !run.stateJson) return null;

    try {
      const parsed = ReflexionStateV2Schema.parse(run.stateJson);
      (parsed as any)._dbVersion = run.version;
      return parsed;
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

    const currentVersion = (state as any)._dbVersion;

    if (currentVersion === undefined) {
      // First save: create the record
      await prisma.reflexionRun.create({
        data: {
          id: state.runId,
          brief: state.brief,
          status: status,
          stateJson: state as any,
          latestScore: latestScore,
          revision: state.revision,
          version: 0,
          costUsd: state.usage.costUsd,
        }
      });
      (state as any)._dbVersion = 0;
    } else {
      // Subsequent saves: optimistic update
      const { count } = await prisma.reflexionRun.updateMany({
        where: { id: state.runId, version: currentVersion },
        data: {
          brief: state.brief,
          status: status,
          stateJson: state as any,
          latestScore: latestScore,
          revision: state.revision,
          version: currentVersion + 1,
          costUsd: state.usage.costUsd,
        }
      });
      
      if (count === 0) {
        throw new Error(`ReflexionRun ${state.runId} modified concurrently`);
      }
      (state as any)._dbVersion = currentVersion + 1;
    }
  }
}
