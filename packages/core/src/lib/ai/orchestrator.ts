import { User } from '@prisma/client';

import { resolveModelId } from './model-resolver';
import { providerOf } from './model-registry';
import { TIER_POLICY, type Tier } from './tier-policy';

export interface OrchestratorModels {
  creatorModel: string;
  auditorModel: string;
}

/**
 * Resolves the orchestrator's creator (planner) and auditor models through the
 * single shared resolver, so env / project / user precedence is applied
 * consistently everywhere. `creator` maps to the `planner` responsibility and
 * `auditor` to `auditor`.
 *
 * BEHAVIOUR NOTE: the auditor system default is now Claude (unified with the
 * reflexion critic). The old hardcoded 'jules' default is gone — set
 * CODE_AUDIT_MODEL=jules, or an auditor entry in project/user routing, to keep it.
 */
export function getOrchestratorModels(
  user?: Pick<User, 'requirementsModel' | 'auditModel'> | null
): OrchestratorModels {
  const ctx = { user: (user ?? undefined) as User | undefined };
  return {
    creatorModel: resolveModelId('planner', ctx),
    auditorModel: resolveModelId('auditor', ctx),
  };
}

export function validateDistinctModels(creator: string, auditor: string, tier: Tier): void {
  if (TIER_POLICY[tier].isolation !== 'same-model' && creator === auditor) {
    throw new Error(
      `Orchestration Validation Failed: The Creator model (${creator}) and the Auditor model (${auditor}) must be distinct to ensure objective code review.`
    );
  }
  
  if (TIER_POLICY[tier].isolation === 'distinct-vendor') {
    const creatorVendor = providerOf(creator);
    const auditorVendor = providerOf(auditor);
    if (creatorVendor === auditorVendor) {
      throw new Error(
        `Orchestration Validation Failed: The Creator model (${creator}, provider: ${creatorVendor}) and the Auditor model (${auditor}, provider: ${auditorVendor}) must be from distinct AI vendors under the ${tier} tier to ensure objective code review.`
      );
    }
  }
}
