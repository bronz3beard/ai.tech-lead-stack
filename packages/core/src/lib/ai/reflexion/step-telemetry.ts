import type { RecordEventParams } from '../../telemetry-service';
import type { StepEvent } from './engine';

const TEAM_ROLE: Partial<Record<StepEvent['phase'], string>> = {
  critique: 'critic',
  scored: 'critic',
  adjudicate: 'adjudicator',
  interview: 'interviewer',
};

/**
 * Maps one reflexion engine step to a telemetry event. Shared by the MCP
 * handlers and the web routes so every surface records the same shape.
 *
 * Cache tokens are only tracked run-wide (ReflexionRun.stateJson.usage), so
 * per-step cost here is priced without cache discounts.
 *
 * `loopPhase` is always the engine phase (`scored` carries the critic verdict);
 * the lifecycle phase the run belongs to goes to `metadata.intentPhase`.
 */
export function reflexionStepTelemetry(input: {
  event: StepEvent;
  loopRunId: string;
  /** Latest revision seen in this run; marker events such as `adjudicate` carry none. */
  revision: number;
  intentPhase?: string;
  criticDegraded?: boolean;
  projectName?: string;
  userEmail?: string;
}): RecordEventParams {
  const { event } = input;
  const usage = 'usage' in event ? event.usage : undefined;
  const critique = 'critique' in event ? event.critique : undefined;

  return {
    skillName: 'reflexion-loop',
    // Phases with usage are real LLM calls; the rest are markers.
    kind: usage ? 'llm_generation' : 'loop_step',
    usageFromProvider: Boolean(usage),
    sessionId: input.loopRunId,
    projectName: input.projectName,
    userEmail: input.userEmail,
    duration: 0,
    status: 'SUCCESS',
    actorType: 'AGENT',
    autonomy: 'AUTONOMOUS',
    loopRunId: input.loopRunId,
    loopPhase: event.phase,
    teamRole: TEAM_ROLE[event.phase],
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
    model: usage?.modelId,
    metadata: {
      revision: input.revision,
      totalSteps: input.revision,
      score: critique?.score,
      passed: critique?.passed,
      criticFallback: input.criticDegraded ? true : undefined,
      intentPhase: input.intentPhase,
    },
  };
}
