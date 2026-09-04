import { z } from 'zod';

export const artifactTypeEnum = z.enum([
  'intent-brief',
  'spec',
  'plan',
  'slice-set',
  'diff',
  'evidence',
  'review-report',
  'qa-handover',
  'changelog',
  'release',
  'design-tokens',
  'screenshot-set',
  'kb-item'
]);

export const phaseEnum = z.enum([
  'intent',
  'specify',
  'plan',
  'build',
  'maintain',
  'review',
  'scale',
  'deploy',
  'polish'
]);

export const kindEnum = z.enum(['skill', 'orchestrator', 'policy', 'report']);
export const domainEnum = z.enum(['eng', 'product', 'hiring', 'shared']);
export const ownershipDriveEnum = z.enum(['human', 'ai', 'human-ai']);
export const ownershipApproveEnum = z.enum(['human', 'ai', 'none']);
export const ownershipEscalateEnum = z.enum(['human', 'ai', 'none']);
export const targetsEnum = z.enum(['local', 'subscription', 'api']);
export const minModelClassEnum = z.enum(['small', 'mid', 'large']);

const baseSchema = z.object({
  name: z.string(),
  description: z.string(),
  cost: z.string().regex(/^~[0-9]+\s+tokens$/),
  modes: z.array(z.enum(['read-only', 'write', 'mcp'])).min(1),
  surface: z.enum(['public', 'internal']),
  category: z.string().optional(),
  how: z.string().optional(),
  useCase: z.string().optional(),
  phase: phaseEnum.optional(),
  kind: kindEnum.default('skill'),
  domain: domainEnum.optional(),
  spans: z.array(phaseEnum).optional(),
  ownership: z.object({
    drive: ownershipDriveEnum,
    approve: ownershipApproveEnum,
    escalate: ownershipEscalateEnum.optional(),
  }).optional(),
  targets: z.array(targetsEnum).optional(),
  minModelClass: minModelClassEnum.optional(),
  consumes: z.array(artifactTypeEnum).optional(),
  emits: z.array(artifactTypeEnum).optional(),
  requires: z.array(z.string()).optional(),
  suggests: z.array(z.string()).optional(),
  policies: z.array(z.string()).optional(),
});

export const frontmatterSchema = baseSchema.superRefine((data, ctx) => {
  if (data.kind === 'orchestrator') {
    if (!data.spans || data.spans.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Orchestrators must define 'spans'.",
        path: ['spans'],
      });
    }
  } else {
    if (!data.phase) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Skills (non-orchestrators) must define a 'phase'.",
        path: ['phase'],
      });
    }
  }
});

export type SkillFrontmatter = z.infer<typeof frontmatterSchema>;
