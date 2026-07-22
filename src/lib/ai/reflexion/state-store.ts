import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StateStore, ReflexionStateV2, ReflexionStateV2Schema } from './schema';

export function resolveStateDir(dir: string): string {
  const resolved = path.resolve(dir);

  let current = resolved;
  let isInsideClient = false;

  while (current !== path.parse(current).root) {
    try {
      const pkgPath = path.join(current, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name && !pkg.name.includes('tech-lead-stack')) {
          isInsideClient = true;
          break;
        }
      }
    } catch {
      // ignore parse error
    }
    current = path.dirname(current);
  }

  if (isInsideClient) {
    const safeBase = path.join(os.tmpdir(), 'tech-lead-stack-reflexion');
    return path.join(safeBase, path.basename(dir));
  }

  return resolved;
}

export class FileStateStore implements StateStore {
  private dir: string;

  constructor(dir: string) {
    this.dir = resolveStateDir(dir);
  }

  async load(runId: string): Promise<ReflexionStateV2 | null> {
    const statePath = path.join(this.dir, 'state.json');
    if (fs.existsSync(statePath)) {
      const content = fs.readFileSync(statePath, 'utf-8');
      try {
        const parsed = JSON.parse(content);
        return ReflexionStateV2Schema.parse(parsed);
      } catch (err) {
        console.error(`[FileStateStore] Failed to parse state.json:`, err);
        return null;
      }
    }

    // v1 migration: no state.json, but check for plan.md and critique.json
    const planPath = path.join(this.dir, 'plan.md');
    const critiquePath = path.join(this.dir, 'critique.json');

    if (fs.existsSync(planPath) && fs.existsSync(critiquePath)) {
      try {
        const plan = fs.readFileSync(planPath, 'utf-8');
        const critiqueContent = fs.readFileSync(critiquePath, 'utf-8');
        const critiqueObj = JSON.parse(critiqueContent);

        // Extract what we can from critique.json (v1 format: ReflexionResult)
        // ReflexionResult shape: { runId?, brief, rounds, scores, finalScore, finalPassed, revisionsUsed, verdict, idePrompt, models, stopReason, interview? }
        // Critique in v1 is inside rounds: { revision, draft, critique }
        const rounds = critiqueObj.rounds || [];
        const critiques = rounds.map((r: any) => r.critique);

        const minimalState: ReflexionStateV2 = {
          version: 2,
          runId: critiqueObj.runId || runId || 'migrated-run',
          brief: critiqueObj.brief || '',
          phase: 'AWAITING_ANSWERS',
          plan: plan,
          critiques: critiques,
          revision: critiqueObj.revisionsUsed || rounds.length,
          params: {
            passThreshold: 8,
            maxRevisions: 3,
          },
          usage: {
            totalTokens: 0,
            costUsd: 0,
            perPhase: []
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return minimalState;
      } catch (err) {
        console.error(`[FileStateStore] Failed to migrate v1 output:`, err);
        return null;
      }
    }

    return null;
  }

  async save(state: ReflexionStateV2): Promise<void> {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    const statePath = path.join(this.dir, 'state.json');
    const tmpPath = path.join(this.dir, 'state.json.tmp');

    // Write to tmp file, then atomic rename
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpPath, statePath);
  }
}
