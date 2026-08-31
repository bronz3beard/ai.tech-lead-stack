import { z } from 'zod';

export type Tier = 'byo' | 'sub-max' | 'sub-pro';
export type TaskSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type RiskLevel = 0 | 1 | 2;

export const TierPolicySchema = z.object({
  maxTaskSize: z.enum(['XS', 'S', 'M', 'L', 'XL']),
  maxRiskLevel: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  maxLanes: z.number().int().positive(),
  maxCritiquePasses: z.number().int().positive(),
  escalateTo: z.enum(['byo', 'sub-max', 'sub-pro']).nullable(),
});

export type TierPolicy = z.infer<typeof TierPolicySchema>;

export const TIER_POLICY: Record<Tier, TierPolicy> = Object.freeze({
  'sub-pro': Object.freeze({
    maxTaskSize: 'M',
    maxRiskLevel: 1,
    maxLanes: 1,
    maxCritiquePasses: 1,
    escalateTo: 'sub-max',
  }),
  'sub-max': Object.freeze({
    maxTaskSize: 'XL',
    maxRiskLevel: 2,
    maxLanes: 2,
    maxCritiquePasses: 3,
    escalateTo: 'byo',
  }),
  byo: Object.freeze({
    maxTaskSize: 'XL',
    maxRiskLevel: 2,
    maxLanes: 99,
    maxCritiquePasses: 99,
    escalateTo: null,
  }),
});

const TASK_SIZE_WEIGHTS: Record<TaskSize, number> = {
  XS: 0,
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
};

export interface TaskAssessment {
  size: TaskSize;
  risk: RiskLevel;
}

export function assessTask(input: { sizeScore: number; riskSignals: string[] }): TaskAssessment {
  // Score -> Size Mapping: 0-1->XS, 2-3->S, 4-5->M, 6-8->L, 9+->XL
  let size: TaskSize = 'XL';
  if (input.sizeScore <= 1) size = 'XS';
  else if (input.sizeScore <= 3) size = 'S';
  else if (input.sizeScore <= 5) size = 'M';
  else if (input.sizeScore <= 8) size = 'L';

  // Risk Mapping
  let risk: RiskLevel = 0;
  const risk2Pattern = /auth|payment|billing|secret|token|migration|infra|database|schema|prod/i;
  
  if (input.riskSignals.some((signal) => risk2Pattern.test(signal))) {
    risk = 2;
  } else if (input.riskSignals.length > 0) {
    risk = 1;
  }

  return { size, risk };
}

export interface TierEnforcementResult {
  allowed: boolean;
  reason?: string;
  escalateTo?: Tier;
}

export function enforceTier(tier: Tier, assessment: TaskAssessment): TierEnforcementResult {
  const policy = TIER_POLICY[tier];
  
  const assessmentSizeWeight = TASK_SIZE_WEIGHTS[assessment.size];
  const policySizeWeight = TASK_SIZE_WEIGHTS[policy.maxTaskSize];

  if (assessmentSizeWeight > policySizeWeight) {
    return {
      allowed: false,
      reason: `Task size ${assessment.size} exceeds tier maximum of ${policy.maxTaskSize}.`,
      escalateTo: policy.escalateTo ?? undefined,
    };
  }

  if (assessment.risk > policy.maxRiskLevel) {
    return {
      allowed: false,
      reason: `Task risk level ${assessment.risk} exceeds tier maximum of ${policy.maxRiskLevel}.`,
      escalateTo: policy.escalateTo ?? undefined,
    };
  }

  return { allowed: true };
}

export function deriveLoopParams(tier: Tier): { maxRevisions: number; maxLanes: number; autoEscalate: boolean } {
  const policy = TIER_POLICY[tier];
  return {
    maxRevisions: policy.maxCritiquePasses,
    maxLanes: policy.maxLanes,
    autoEscalate: tier === 'sub-max',
  };
}
