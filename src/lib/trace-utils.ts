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

  let normalized = name.toLowerCase().trim();

  // Extract name component from common patterns
  if (normalized.includes('/')) {
    normalized = normalized.split('/').pop() || normalized;
  }

  return normalized
    .replace(/^@/, '')
    .replace(/^ai\./, '')
    .replace(/-(mcp|analytics)$/, '')
    .trim();
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
  
  const normalized = skillName.toLowerCase().trim().replace(/\.md$/, '');
  
  // Dynamic Sync: Any skill accessible via MCP that passes isSkillTrace is active.
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
  const normalizedName = (name || '').toLowerCase().trim();
  const normalizedSkillName = (skillName || '').toLowerCase().trim();

  // Relaxed filtering: only block if explicitly "unknown" or skeletal
  if (normalizedName === 'unknown' || normalizedSkillName === 'unknown') {
    return true;
  }

  // Filter out meta-skill patterns
  const forbidden = ['skill', 'skill.md', 'skill:skill', 'generation:skill', 'skill:skill.md', 'generation:skill.md'];
  if (forbidden.includes(normalizedName) || forbidden.includes(normalizedSkillName)) {
    return true;
  }

  return false;
}
