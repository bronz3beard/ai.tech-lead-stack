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
  if (!name || name === 'unknown' || name.trim() === '') return 'global';

  let normalized = name.toLowerCase().trim();

  // If it's explicitly "all", keep it as "all" for dashboard scoping
  if (normalized === 'all') return 'all';

  // Specific project overrides for consistency
  if (normalized.includes('gilly')) return 'gilly';
  if (normalized.includes('tech-lead-stack')) return 'tech-lead-stack';

  // Extract name component from common patterns (e.g., "@scope/name" -> "name")
  if (normalized.includes('/')) {
    normalized = normalized.split('/').pop() || normalized;
  }

  return normalized
    .replace(/^@/, '')
    .replace(/^ai\./, '')
    .replace(/-(mcp|analytics|llms|bridge|code-review)$/, '')
    .replace(/[^a-z0-9]+/g, '-') // Convert spaces and special chars to dashes
    .replace(/^-+|-+$/g, '');   // Trim leading/trailing dashes
}

/**
 * Normalizes a skill name to kebab-case for consistent tracing and lookups.
 * 
 * @param name - The raw skill name (e.g., "Planning Expert", "planningExpert")
 * @returns The normalized skill name (e.g., "planning-expert")
 */
export function normalizeSkillName(name: string | undefined): string {
  if (!name || name.trim() === '') return 'unknown';

  return name
    .toLowerCase()
    .trim()
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dashes
    .replace(/^-+|-+$/g, '');   // Trim leading/trailing dashes
}

/**
 * Checks if a skill name is active and should be tracked.
 * 
 * Any skill that is not explicitly identified as a "system/meta-trace" via
 * isSkillTrace is considered active and will be tracked in telemetry.
 * 
 * @param skillName - The name of the skill to check.
 * @returns True if the skill is active and should be tracked.
 */
export function isActiveSkill(skillName: string | undefined): boolean {
  if (!skillName) return false;
  
  const normalized = normalizeSkillName(skillName);
  
  // Broad Validation: If it's not a known system/skeletal trace, it's active.
  return !isSkillTrace(undefined, normalized);
}

/**
 * Checks if a trace should be filtered out from dashboard metrics and telemetry.
 * 
 * Blocks traces that are explicitly "unknown" or match "meta-skill" patterns
 * used by the system for internal tracing or skeletal generation.
 * 
 * @param name - The full trace name (e.g., "skill:planning-expert")
 * @param skillName - The extracted skill name (e.g., "planning-expert")
 * @returns True if the trace is a system/meta trace and should be hidden.
 */
export function isSkillTrace(name?: string, skillName?: string): boolean {
  const normalizedName = normalizeSkillName(name);
  const normalizedSkill = normalizeSkillName(skillName);

  // Strictly filter out truly unknown/empty identities
  if (!name && !skillName) return true;
  if (normalizedName === 'unknown' && normalizedSkill === 'unknown') return true;

  const forbidden = ['skill', 'skill-md', 'skill-skill', 'generation-skill'];
  
  // If the trace name is forbidden, block it if skill identity is also forbidden or missing.
  if (forbidden.includes(normalizedName)) {
    if (!skillName || normalizedSkill === 'unknown' || forbidden.includes(normalizedSkill)) {
      return true;
    }
  }

  // If the skill itself is a generic placeholder, it's a meta-trace regardless of the trace name
  if (forbidden.includes(normalizedSkill)) {
    return true;
  }

  return false;
}
