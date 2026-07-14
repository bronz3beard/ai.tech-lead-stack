import { z } from 'zod';

/**
 * The critic's structured grade of one draft plan, scored against the Four
 * Pillars. Five sub-scores force the model to grade each pillar separately
 * instead of emitting one vague "7/10". Used with the AI SDK's
 * `generateObject`, which constrains the model to this exact shape.
 */
export const LoopParamsSchema = z.object({
  passThreshold: z.number().default(8),
  maxRevisions: z.number().default(3),
  maxCostUsd: z.number().optional(),
  maxTotalTokens: z.number().optional(),
  focus: z.array(z.string()).optional(),
});
export type LoopParams = z.infer<typeof LoopParamsSchema>;

export const LoopParamsPatchSchema = LoopParamsSchema.partial().strict();
export type LoopParamsPatch = z.infer<typeof LoopParamsPatchSchema>;

export const StopReasonSchema = z.enum([
  'passed',
  'user-approve',
  'user-stop',
  'budget-exceeded',
  'max-revisions',
  'refine-contract-violation',
]);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  target: z.enum(['plan', 'loop']),
  ref: z.string(),
  question: z.string(),
  why: z.string(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const InterviewSchema = z.object({
  runId: z.string(),
  revision: z.number(),
  recommendation: z.enum(['approve', 'refine-plan', 'tune-loop', 'stop']),
  questions: z.array(QuestionSchema), // limit enforced in INTERVIEWER_SYSTEM prompt + sliced in code
});
export type Interview = z.infer<typeof InterviewSchema>;

export const AnswersSchema = z.object({
  runId: z.string(),
  decisions: z.array(z.object({ id: z.string(), answer: z.string() })),
  directive: z.enum(['approve', 'stop']).optional(),
});
export type Answers = z.infer<typeof AnswersSchema>;

export const UsageSnapshotSchema = z.object({
  totalTokens: z.number(),
  costUsd: z.number(),
  perPhase: z.array(
    z.object({ phase: z.string(), tokens: z.number(), costUsd: z.number() })
  ),
});
export type UsageSnapshot = z.infer<typeof UsageSnapshotSchema>;

export const CritiqueSchema = z.object({
  gstackDiagnosis: z
    .number()
    .describe(
      'Pillar 1 (G-Stack / Diagnosis-First): did the plan do Phase-0 stack discovery and ground every decision in the ACTUAL project rather than generic advice? Score between 0 and 10.'
    ),
  atomicBatches: z
    .number()
    .describe(
      'Pillar 2 (MinimumCD): are steps atomic (<100 LOC), vertically sliced, independently deployable, each with a verification gate? Penalise any "big bang" integration. Score between 0 and 10.'
    ),
  productionEthos: z
    .number()
    .describe(
      'Pillar 3 (Production-Grade Ethos): senior-engineer discipline. No "add tests later", no shortcuts, evidence required at every gate. Score between 0 and 10.'
    ),
  modernWeb: z
    .number()
    .describe(
      'Pillar 4 (Modern Web Guidance): modern, performant, accessible, secure APIs over legacy workarounds. Score between 0 and 10.'
    ),
  score: z
    .number()
    .describe(
      'Overall quality 0-10. Holistic, NOT the average of sub-scores. One fatal flaw scores low even if other pillars are perfect. Score between 0 and 10.'
    ),
  passed: z
    .boolean()
    .describe('True only if the plan is genuinely ready to hand to engineers.'),
  actionableFix: z
    .string()
    .describe(
      'ONE specific, technical sentence naming the single weakest point the generator must rewrite next. No lists. Empty string only if passed.'
    ),
});

export type Critique = z.infer<typeof CritiqueSchema>;

export const ReflexionStateV2Schema = z.object({
  version: z.literal(2),
  runId: z.string(),
  brief: z.string(),
  phase: z.string(),
  plan: z.string(),
  critiques: z.array(CritiqueSchema),
  revision: z.number(),
  params: LoopParamsSchema,
  usage: UsageSnapshotSchema,
  interview: InterviewSchema.optional(),
  stopReason: StopReasonSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReflexionStateV2 = z.infer<typeof ReflexionStateV2Schema>;

export interface StateStore {
  load(runId: string): Promise<ReflexionStateV2 | null>;
  save(state: ReflexionStateV2): Promise<void>;
}
