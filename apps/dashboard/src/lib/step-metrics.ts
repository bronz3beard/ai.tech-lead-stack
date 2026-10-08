import type { StepMetric } from '@/components/dashboard/StepAnalyticsTable';
import type { TraceData } from './analytics-service';

/**
 * Analysis steps per run, grouped by skill and lifecycle phase.
 * A reflexion run emits one event per engine phase, so events are grouped by
 * loopRunId and the run counts once with its highest step total. A web-chat
 * analysis turn is one event and counts as one run.
 */
export function computeStepMetrics(traces: TraceData[]): StepMetric[] {
  const runs = new Map<string, { steps: number; phase: string; skill: string }>();

  for (const t of traces) {
    const raw = t.metadata?.totalSteps;
    if (raw === undefined) continue;
    const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    const steps = Number.isNaN(parsed) ? 0 : parsed;
    const runId = t.loopRunId || t.id;
    const intentPhase = t.metadata?.intentPhase;
    const phase = typeof intentPhase === 'string' && intentPhase ? intentPhase : 'unspecified';

    const existing = runs.get(runId);
    if (!existing || steps > existing.steps) {
      runs.set(runId, { steps, phase, skill: t.name });
    }
  }

  const grouped = new Map<string, { skillName: string; intentPhase: string; runs: number; steps: number }>();
  for (const run of runs.values()) {
    const key = `${run.skill}|${run.phase}`;
    const g = grouped.get(key) ?? { skillName: run.skill, intentPhase: run.phase, runs: 0, steps: 0 };
    g.runs += 1;
    g.steps += run.steps;
    grouped.set(key, g);
  }

  return [...grouped.values()]
    .map((g) => ({
      skillName: g.skillName,
      intentPhase: g.intentPhase,
      totalExecutions: g.runs,
      averageSteps: g.steps / g.runs,
      totalSteps: g.steps,
    }))
    .sort((a, b) => b.totalSteps - a.totalSteps);
}
