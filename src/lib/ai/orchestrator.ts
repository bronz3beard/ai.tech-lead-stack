export interface OrchestratorModels {
  creatorModel: string;
  auditorModel: string;
}

export function getOrchestratorModels(): OrchestratorModels {
  const creatorModel = process.env.REQUIREMENTS_DEVELOPMENT_MODEL || 'gemini';
  const auditorModel = process.env.CODE_AUDIT_MODEL || 'claude';
  return { creatorModel, auditorModel };
}

export function validateDistinctModels(creator: string, auditor: string): void {
  if (creator === auditor) {
    throw new Error(
      `Orchestration Validation Failed: The Creator model (${creator}) and the Auditor model (${auditor}) must be distinct to ensure objective code review.`
    );
  }
}
