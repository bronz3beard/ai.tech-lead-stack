/**
 * Normalizes a project name for consistent grouping and filtering.
 * 
 * - Trims whitespace
 * - Converts to lowercase
 * - Extracts the base name from scoped packages (e.g., "@scope/name" -> "name")
 * 
 * @param name - The raw project name (e.g., "@bronz3beard/tech-lead-stack")
 * @returns The normalized project name (e.g., "tech-lead-stack")
 */
export function normalizeProjectName(name: string | undefined): string {
  if (!name || name === 'unknown' || name.trim() === '') return 'unknown';

  // Lowercase and trim
  let normalized = name.toLowerCase().trim();

  // If it's explicitly "all", keep it as "all" for dashboard scoping
  if (normalized === 'all') return 'all';

  // Specific project overrides (Priority sequence)
  if (normalized.includes('gilly')) return 'gilly';
  if (normalized.includes('tech-lead-stack')) return 'tech-lead-stack';

  // If it looks like a scoped package (e.g., @bronz3beard/tech-lead-stack), extract the project part
  if (normalized.startsWith('@') && normalized.includes('/')) {
    const parts = normalized.split('/');
    if (parts.length > 1) {
      normalized = parts[1];
    }
  }

  // Handle other common delimiters if needed (e.g., dot-separated or path-like)
  if (normalized.includes('/')) {
    const parts = normalized.split('/');
    normalized = parts[parts.length - 1];
  }

  // Final cleanup of common prefixes/suffixes
  return normalized
    .replace(/^ai\./, '')
    .replace(/-mcp$/, '')
    .trim();
}

/**
 * Checks if a skill name is active and should be tracked.
 * Includes common aliases for flexibility.
 */
export function isActiveSkill(skillName: string | undefined): boolean {
  if (!skillName) return false;
  
  const normalized = skillName.toLowerCase().trim().replace(/\.md$/, '');
  const ACTIVE_SKILLS = new Set([
    'agent-optimizer',
    'changelog-generator',
    'clean-code',
    'code-review-checklist',
    'codebase-onboarding-intelligence',
    'daily-standup',
    'feature-design-assistant',
    'mission-architect',
    'mission-control',
    'planning-expert',
    'pr-automator',
    'product-strategist',
    'regression-bug-fix',
    'security-audit',
    'technical-debt-auditor',
    'verification-auditor',
    'visual-verifier',
    // Aliases
    'regression-bug',
    'regression-fix',
    'qa-remediation',
    'dr-remediation'
  ]);

  return ACTIVE_SKILLS.has(normalized);
}

/**
 * Checks if a trace should be filtered out from dashboard metrics and telemetry.
 */
export function isSkillTrace(name?: string, skillName?: string): boolean {
  const forbidden = ['skill', 'skill.md', 'unnamed-trace', 'unknown'];
  
  const normalizedName = (name || '').toLowerCase().trim();
  const normalizedSkillName = (skillName || '').toLowerCase().trim();

  // If it's a skeletal skill trace, filter it out
  if (forbidden.includes(normalizedName) || forbidden.includes(normalizedSkillName)) {
    return true;
  }

  // Filter out meta-skill patterns
  const prefixedForbidden = ['skill:skill', 'generation:skill', 'skill:skill.md', 'generation:skill.md'];
  if (prefixedForbidden.includes(normalizedName)) {
    return true;
  }

  return false;
}
