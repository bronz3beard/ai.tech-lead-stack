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

  // PM Only
  "pm-story-augmenter": ["PM"],
  "pm-effort-estimator": ["PM"],
  "pm-context-summarizer": ["PM"],
  "pm-risk-detector": ["PM"],
  "pm-action-item-mapper": ["PM"],
  "pm-task-specifier": ["PM"],
  "pm-backlog-auditor": ["PM"],
  "pm-progress-translator": ["PM"],
  "pm-newsletter-generator": ["PM"],
  "pm-design-system-auditor": ["PM"],
  "pm-release-note-drafter": ["PM"],
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
  "pm-story-augmenter": "Enhance user stories with technical depth and edge-case detection",
  "pm-effort-estimator": "Estimate development effort based on codebase history and complexity",
  "pm-context-summarizer": "Summarize recent technical progress and blockers for non-technical briefings",
  "pm-risk-detector": "Identify technical risks and bottlenecks that could impact upcoming deadlines",
  "pm-action-item-mapper": "Translate meeting notes into actionable technical tasks linked to code",
  "pm-task-specifier": "Draft high-fidelity technical specifications for new features",
  "pm-backlog-auditor": "Validate project backlog for logical consistency and feasibility",
  "pm-progress-translator": "Translate complex technical achievements into clear client updates",
  "pm-newsletter-generator": "Generate product-focused updates and highlights from recent code changes",
  "pm-design-system-auditor": "Check code implementation against design system standards and consistency",
  "pm-release-note-drafter": "Automatically draft user-centric release notes from merged features",
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
