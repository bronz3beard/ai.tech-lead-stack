import { z } from 'zod';

export const ActorTypeEnum = z.enum(['HUMAN', 'AGENT']);
export const AutonomyEnum = z.enum(['DIRECTED', 'AUTONOMOUS']);
export const LoopPhaseEnum = z.enum([
  'generate',
  'critique',
  'route',
  'adjudicate',
  'interview',
  'resume',
  'lane',
]);
export const TeamRoleEnum = z.enum([
  'pm',
  'planner',
  'developer',
  'reviewer',
  'qa',
  'critic',
  'adjudicator',
  'interviewer',
]);

export const ActorTelemetrySchema = z.object({
  actorType: ActorTypeEnum.nullable().optional(),
  autonomy: AutonomyEnum.nullable().optional(),
  loopRunId: z.string().nullable().optional(),
  loopPhase: LoopPhaseEnum.nullable().optional(),
  teamRole: TeamRoleEnum.nullable().optional(),
});

export type ActorTelemetry = z.infer<typeof ActorTelemetrySchema>;

export function normalizeActorTelemetry(input: unknown): ActorTelemetry {
  const result = ActorTelemetrySchema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  // If parsing fails completely (e.g. not an object), return empty
  if (typeof input !== 'object' || input === null) {
    return {};
  }

  // Try to parse individual fields and strip invalid ones
  const record = input as Record<string, unknown>;
  const normalized: ActorTelemetry = {};

  if ('actorType' in record) {
    const parsed = ActorTypeEnum.safeParse(record.actorType);
    if (parsed.success) normalized.actorType = parsed.data;
  }
  if ('autonomy' in record) {
    const parsed = AutonomyEnum.safeParse(record.autonomy);
    if (parsed.success) normalized.autonomy = parsed.data;
  }
  if ('loopRunId' in record) {
    const parsed = z.string().safeParse(record.loopRunId);
    if (parsed.success) normalized.loopRunId = parsed.data;
  }
  if ('loopPhase' in record) {
    const parsed = LoopPhaseEnum.safeParse(record.loopPhase);
    if (parsed.success) normalized.loopPhase = parsed.data;
  }
  if ('teamRole' in record) {
    const parsed = TeamRoleEnum.safeParse(record.teamRole);
    if (parsed.success) normalized.teamRole = parsed.data;
  }

  return normalized;
}
