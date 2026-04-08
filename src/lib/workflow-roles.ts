export const WORKFLOW_ROLES: Record<string, string[]> = {
  // DEVELOPER (Global Access)
  "pr-automator": ["DEVELOPER"],
  "clean-code-audit": ["DEVELOPER"],
  "onboard-dev": ["DEVELOPER", "ADMIN"],
  "audit-tech-debt": ["DEVELOPER", "PM"],
  "code-review": ["DEVELOPER", "QA"],
  "plan": ["DEVELOPER", "PM"],
  "mission-architect": ["DEVELOPER", "PM"],
  "design-requirements-to-architecture": ["DEVELOPER", "PM", "DESIGNER"],
  "strategy-target-evalutaion": ["DEVELOPER", "PM"],
  "style-logic-exporter": ["DEVELOPER", "DESIGNER"],
  "verify-changes": ["DEVELOPER", "DESIGNER", "QA"],
  "accessibility-audit": ["DEVELOPER", "DESIGNER", "QA"],
  "regression-bug-fix": ["DEVELOPER", "QA"],
  "changelog": ["DEVELOPER", "PM"],
  "standup-daily-summary": ["DEVELOPER", "PM", "QA"],
  "init": ["DEVELOPER", "ADMIN"],
  "init-tech-lead-stack": ["DEVELOPER", "ADMIN"],
  "security-audit": ["DEVELOPER", "ADMIN"],

  // PM
  // "strategy-target-evalutaion": ["PM"],
  // "design-requirements-to-architecture": ["PM"],
  // "mission-architect": ["PM"],
  // "plan": ["PM"],
  // "changelog": ["PM"],
  // "standup-daily-summary": ["PM"],
  // "audit-tech-debt": ["PM"],

  // DESIGNER
  // "style-logic-exporter": ["DESIGNER"],
  // "verify-changes": ["DESIGNER"],
  // "accessibility-audit": ["DESIGNER"],
  // "design-requirements-to-architecture": ["DESIGNER"],

  // QA
  // "verify-changes": ["QA"],
  // "regression-bug-fix": ["QA"],
  // "accessibility-audit": ["QA"],
  // "code-review": ["QA"],
  // "standup-daily-summary": ["QA"],

  // ADMIN
  // "init": ["ADMIN"],
  // "init-tech-lead-stack": ["ADMIN"],
  // "security-audit": ["ADMIN"],
  // "onboard-dev": ["ADMIN"],

  // ALL USERS
  "ask": ["DEVELOPER", "PM", "DESIGNER", "QA", "ADMIN"],
};

export function canAccessWorkflow(role: string, workflowName: string): boolean {
  if (workflowName === "ask") return true;

  const allowedRoles = WORKFLOW_ROLES[workflowName];
  if (!allowedRoles) {
      // By default, if a workflow isn't mapped, we might restrict it or default to DEVELOPER.
      // Based on instructions, DEVELOPER has "Global Access" to the list.
      return role === "DEVELOPER";
  }

  return allowedRoles.includes(role);
}

export function getWorkflowsForRole(role: string): string[] {
  const available: string[] = [];
  for (const [workflow, roles] of Object.entries(WORKFLOW_ROLES)) {
    if (roles.includes(role) || workflow === "ask") {
       available.push(workflow);
    }
  }
  return available;
}
