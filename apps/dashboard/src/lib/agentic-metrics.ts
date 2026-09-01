import { AnalyticsEvent, ReflexionRun } from '@prisma/client';

export type EvaluatorHealthState =
  | 'NODDING_LOOP'
  | 'BLOCKED_EVALUATOR'
  | 'HEALTHY'
  | 'WATCH';

export interface EvaluatorHealthClassification {
  state: EvaluatorHealthState;
  err: number;
  sampleSize: number;
}

export interface ConvergenceMetrics {
  meanRevisionsToPass: number;
  meanScoreDelta: number;
}

/**
 * Calculates the Autonomous Work Ratio (AWR).
 * Formula: AGENT / all
 * Source: docs/designs/2026-07-08-agentic-dev-team-design.md section WS-6
 */
export function autonomousWorkRatio(events: AnalyticsEvent[]): number {
  if (events.length === 0) return 0;
  const agentCount = events.filter((e) => e.actorType === 'AGENT').length;
  return agentCount / events.length;
}

/**
 * Calculates the Autonomy Depth.
 * Formula: AUTONOMOUS / AGENT
 * Source: docs/designs/2026-07-08-agentic-dev-team-design.md section WS-6
 */
export function autonomyDepth(events: AnalyticsEvent[]): number {
  const agentEvents = events.filter((e) => e.actorType === 'AGENT');
  if (agentEvents.length === 0) return 0;
  const autonomousCount = agentEvents.filter(
    (e) => e.autonomy === 'AUTONOMOUS'
  ).length;
  return autonomousCount / agentEvents.length;
}

/**
 * Calculates the Evaluator Rejection Rate (ERR).
 * Formula: critique events with metadata.passed=false ÷ all loopPhase='critique' events
 * Source: docs/designs/2026-07-08-agentic-dev-team-design.md section WS-6
 */
export function evaluatorRejectionRate(events: AnalyticsEvent[]): number {
  const critiqueEvents = events.filter((e) => e.loopPhase === 'critique');
  if (critiqueEvents.length === 0) return 0;

  const rejectedCount = critiqueEvents.filter((e) => {
    if (e.metadata && typeof e.metadata === 'object') {
      return (e.metadata as Record<string, unknown>).passed === false;
    }
    return false;
  }).length;

  return rejectedCount / critiqueEvents.length;
}

/**
 * Classifies Evaluator Health based on ERR and sample size.
 * Formula: 'NODDING_LOOP' when err===0 && n>=20; 'BLOCKED_EVALUATOR' when err>=0.95 && n>=20; 'HEALTHY' within 0.15–0.85; 'WATCH' otherwise.
 * Source: docs/designs/2026-07-08-agentic-dev-team-design.md section WS-6
 */
export function classifyEvaluatorHealth(
  err: number,
  sampleSize: number
): EvaluatorHealthClassification {
  let state: EvaluatorHealthState = 'WATCH';

  if (sampleSize >= 20 && err === 0) {
    state = 'NODDING_LOOP';
  } else if (sampleSize >= 20 && err >= 0.95) {
    state = 'BLOCKED_EVALUATOR';
  } else if (err >= 0.15 && err <= 0.85) {
    state = 'HEALTHY';
  }

  return { state, err, sampleSize };
}

/**
 * Calculates Convergence efficiency metrics.
 * Formula: mean revisions-to-pass; mean first->final score delta (group by loopRunId).
 * Source: docs/designs/2026-07-08-agentic-dev-team-design.md section WS-6
 */
export function convergence(runs: ReflexionRun[]): ConvergenceMetrics {
  const passedRuns = runs.filter((r) => r.status === 'PASSED');
  if (passedRuns.length === 0) {
    return { meanRevisionsToPass: 0, meanScoreDelta: 0 };
  }

  let totalRevisions = 0;
  let totalScoreDelta = 0;
  let validScoreDeltasCount = 0;

  for (const run of passedRuns) {
    totalRevisions += run.revision;

    if (run.stateJson && typeof run.stateJson === 'object') {
      const state = run.stateJson as any;
      const scores = state.scores || state.history?.map((h: any) => h.score);
      if (Array.isArray(scores) && scores.length >= 2) {
        const firstScore = scores[0];
        const finalScore = scores[scores.length - 1];
        if (typeof firstScore === 'number' && typeof finalScore === 'number') {
          totalScoreDelta += finalScore - firstScore;
          validScoreDeltasCount++;
        }
      }
    }
  }

  return {
    meanRevisionsToPass: totalRevisions / passedRuns.length,
    meanScoreDelta:
      validScoreDeltasCount > 0 ? totalScoreDelta / validScoreDeltasCount : 0,
  };
}

/**
 * Calculates Human Touchpoints per Run (HTR).
 * Formula: interview events / distinct loopRunId.
 * Source: docs/designs/2026-07-08-agentic-dev-team-design.md section WS-6
 */
export function humanTouchpointsPerRun(events: AnalyticsEvent[]): number {
  const loopRunIds = new Set(
    events.filter((e) => e.loopRunId).map((e) => e.loopRunId)
  );
  if (loopRunIds.size === 0) return 0;

  const interviewEventsCount = events.filter(
    (e) => e.loopPhase === 'interview'
  ).length;

  return interviewEventsCount / loopRunIds.size;
}

/**
 * Calculates Friction Defect Rate.
 * Formula: metadata.frictionFiled===true per 100 agent runs
 * Source: docs/designs/2026-07-08-agentic-dev-team-design.md section WS-6
 */
export function frictionRate(events: AnalyticsEvent[]): number {
  const loopRunIds = new Set(
    events.filter((e) => e.loopRunId).map((e) => e.loopRunId)
  );
  if (loopRunIds.size === 0) return 0;

  const frictionEventsCount = events.filter((e) => {
    if (e.metadata && typeof e.metadata === 'object') {
      return (e.metadata as Record<string, unknown>).frictionFiled === true;
    }
    return false;
  }).length;

  return (frictionEventsCount / loopRunIds.size) * 100;
}

/**
 * Calculates Cost per Passed Plan.
 * Formula: sum(totalCostUsd by loopRunId, finalPassed) / passed runs
 * Source: docs/designs/2026-07-08-agentic-dev-team-design.md section WS-6
 */
export function costPerPassedPlan(runs: ReflexionRun[]): number {
  const passedRuns = runs.filter((r) => r.status === 'PASSED');
  if (passedRuns.length === 0) return 0;

  const totalCost = passedRuns.reduce((sum, run) => sum + (run.costUsd || 0), 0);
  return totalCost / passedRuns.length;
}
