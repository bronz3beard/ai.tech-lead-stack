import { z } from 'zod';

/**
 * The critic's structured grade of one draft plan, scored against the Four
 * Pillars. Five sub-scores force the model to grade each pillar separately
 * instead of emitting one vague "7/10". Used with the AI SDK's
 * `generateObject`, which constrains the model to this exact shape.
 */
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
