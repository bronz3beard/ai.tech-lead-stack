import { User } from '@prisma/client';
import { MODELS } from '@/app/api/chat/constants';

export interface OrchestratorModels {
  creatorModel: string;
  auditorModel: string;
}

export function getOrchestratorModels(user?: Pick<User, 'requirementsModel' | 'auditModel'> | null): OrchestratorModels {
  const resolve = (m: string | null | undefined) => {
    switch (m) {
      case 'gemini': return MODELS.GEMINI;
      case 'claude': return MODELS.CLAUDE;
      case 'openai': return MODELS.OPENAI;
      case 'jules': return MODELS.JULES;
      default: return m || MODELS.GEMINI;
    }
  };

  const creatorModel = resolve(user?.requirementsModel || process.env.REQUIREMENTS_DEVELOPMENT_MODEL);
  const auditorModel = resolve(user?.auditModel || process.env.CODE_AUDIT_MODEL || 'jules');

  return { creatorModel, auditorModel };
}

export function validateDistinctModels(creator: string, auditor: string): void {
  if (creator === auditor) {
    throw new Error(
      `Orchestration Validation Failed: The Creator model (${creator}) and the Auditor model (${auditor}) must be distinct to ensure objective code review.`
    );
  }
}
