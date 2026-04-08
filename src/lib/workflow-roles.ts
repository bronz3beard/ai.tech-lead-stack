export const WORKFLOW_ROLES: Record<string, string[]> = {
  // Global/All Roles
  "ask": ["DEVELOPER", "PM", "DESIGNER", "QA", "ADMIN"],

  // Shared workflows
  "accessibility-audit": ["DEVELOPER", "DESIGNER", "QA"],
  "audit-tech-debt": ["DEVELOPER", "PM"],
  "code-review": ["DEVELOPER", "QA"],
  "onboard-dev": ["DEVELOPER", "ADMIN"],
  "security-audit": ["DEVELOPER", "ADMIN"],
  "standup-daily-summary": ["DEVELOPER", "PM", "QA"],
  "strategy-target-evalutaion": ["DEVELOPER", "PM"],
  "style-logic-exporter": ["DEVELOPER", "DESIGNER"],

  // Developer Only
  "clean-code-audit": ["DEVELOPER"],
};

export const WORKFLOW_DESCRIPTIONS: Record<string, string> = {
  "accessibility-audit": "Deep semantic audit for A11y and contrast standards",
  "ask": "General codebase consultation and architectural advisor",
  "audit-tech-debt": "Quantify and track structural and technical debt",
  "clean-code-audit": "Enforce SOLID principles and architectural audits",
  "code-review": "Pre-PR quality gatekeeper for spec compliance",
  "onboard-dev": "Accelerate ramp-up on new infrastructure/repositories",
  "security-audit": "Scan agent configurations for security vulnerabilities",
  "standup-daily-summary": "Analyze git activity for daily reports",
  "strategy-target-evalutaion": "High-density product strategy and roadmap audit",
  "style-logic-exporter": "Extract design tokens and styles for Figma/Code alignment",
};

export interface WorkflowInfo {
  name: string;
  description: string;
}

export function canAccessWorkflow(role: string, workflowName: string): boolean {
  if (workflowName === "ask") return true;

  const allowedRoles = WORKFLOW_ROLES[workflowName];
  if (!allowedRoles) {
      // If a workflow isn't explicitly mapped, restrict it.
      // This ensures we only allow the safe subset defined above.
      return false;
  }

  return allowedRoles.includes(role);
}

export function getWorkflowsForRole(role: string): WorkflowInfo[] {
  const available: WorkflowInfo[] = [];
  for (const [workflow, roles] of Object.entries(WORKFLOW_ROLES)) {
    if (roles.includes(role) || workflow === "ask") {
       available.push({
           name: workflow,
           description: WORKFLOW_DESCRIPTIONS[workflow] || "Execute workflow"
       });
    }
  }
  // Sort alphabetically by name
  return available.sort((a, b) => a.name.localeCompare(b.name));
}
