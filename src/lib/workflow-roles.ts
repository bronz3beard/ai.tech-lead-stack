export const WORKFLOW_ROLES: Record<string, string[]> = {
  // Global/All Roles
  "ask": ["DEVELOPER", "PM", "DESIGNER", "QA", "ADMIN"],

  // Shared workflows
  "accessibility-audit": ["DEVELOPER", "DESIGNER", "QA"],
  "audit-tech-debt": ["DEVELOPER", "PM"],
  "changelog": ["PM", "DEVELOPER"],
  "code-review": ["DEVELOPER", "QA"],
  "competitive-analysis": ["PM", "DEVELOPER"],
  "design-requirements-to-architecture": ["PM", "DESIGNER", "DEVELOPER"],
  "design-system-review": ["DEVELOPER", "DESIGNER", "QA"],
  "dev-team": ["PM", "DEVELOPER"],
  "feature-orchestrator": ["PM", "DEVELOPER"],
  "mission-architect": ["PM", "DEVELOPER"],
  "onboard-dev": ["DEVELOPER", "ADMIN"],
  "plan": ["PM", "DEVELOPER"],
  "plan-quick": ["PM", "DEVELOPER"],
  "pr-design-review-init": ["DEVELOPER", "DESIGNER", "QA"],
  "regression-bug-fix": ["DEVELOPER", "QA"],
  "security-audit": ["DEVELOPER", "ADMIN"],
  "solutioning-facilitator": ["PM", "DESIGNER", "QA", "DEVELOPER"],
  "standup-daily-summary": ["DEVELOPER", "PM", "QA"],
  "strategy-target-evaluation": ["DEVELOPER", "PM"],
  "style-logic-exporter": ["DEVELOPER", "DESIGNER"],
  "ui-spec-generator": ["PM", "DESIGNER", "DEVELOPER"],
  "verification-auditor": ["DEVELOPER", "QA"],
  "verify-changes": ["DEVELOPER", "QA"],
  "vertical-slice": ["PM", "DEVELOPER"],
  "weekly-leadership-report": ["PM", "DEVELOPER"],

  // Developer Only
  "clean-code-audit": ["DEVELOPER"],
  "pr-automator": ["DEVELOPER"],

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
  "changelog": "Transforms raw Git commit logs and pull request history into semantic release notes",
  "clean-code-audit": "Enforce SOLID principles and architectural audits",
  "code-review": "Pre-PR quality gatekeeper for spec compliance",
  "competitive-analysis": "Port of the blog's /competitive-analysis: compare this stack against external sources and queue accepted ideas",
  "design-requirements-to-architecture": "Translate requirements into UI components and architectural structures",
  "design-system-review": "AI-augmented 2-iteration design review with KI persistence and designer quality gate",
  "dev-team": "The flagship orchestration skill: an agent-agnostic dev team you manage as a TPM",
  "feature-orchestrator": "Three-Phase Feature Engine (Research -> Plan -> Implement)",
  "mission-architect": "Master Blueprint Engine that orchestrates Strategy -> Research -> Plan -> Deliver",
  "onboard-dev": "Accelerate ramp-up on new infrastructure/repositories",
  "plan": "Complete planning engine for deep pattern discovery and implementation plans",
  "plan-quick": "Ultra-lean strategic planning for speed and rapid MVC delivery",
  "pr-automator": "Automate PR creation with verification and code review",
  "pr-design-review-init": "Start an AI-powered design review from an existing GitHub PR URL",
  "regression-bug-fix": "Remediation engine for QA and regression feedback",
  "security-audit": "Scan agent configurations for security vulnerabilities",
  "solutioning-facilitator": "Facilitate a live, multi-role solutioning session with a running Solution Ledger of options, concerns, and decisions",
  "standup-daily-summary": "Analyze git activity for daily reports",
  "strategy-target-evaluation": "High-density product strategy and roadmap audit",
  "style-logic-exporter": "Extract design tokens and styles for Figma/Code alignment",
  "ui-spec-generator": "AI-powered structural UI Spec and component generator",
  "verification-auditor": "Verify environment setup and repository compliance",
  "verify-changes": "Visual smoke testing and automated screenshot/recording capture",
  "vertical-slice": "Decompose user stories into thin, independently deployable vertical slices",
  "weekly-leadership-report": "Synthesize team progress from Git history and ClickUp sprints into structured weekly reports",
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
  if (role === "ADMIN") return true;
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
  const isAllAccess = role === "ADMIN";

  for (const [workflow, roles] of Object.entries(WORKFLOW_ROLES)) {
    if (isAllAccess || roles.includes(role) || workflow === "ask") {
       available.push({
           name: workflow,
           description: WORKFLOW_DESCRIPTIONS[workflow] || "Execute workflow"
       });
    }
  }
  // Sort alphabetically by name
  return available.sort((a, b) => a.name.localeCompare(b.name));
}
