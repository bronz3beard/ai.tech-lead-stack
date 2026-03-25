/**
 * Checks if a trace should be filtered out from dashboard metrics and telemetry.
 * 
 * Filters out:
 * - Skill name equals "SKILL" or "SKILL.md" (case-insensitive)
 * - Trace name starts with "skill:SKILL" or "generation:SKILL" (case-insensitive)
 * - Metadata skillName equals "SKILL" (case-insensitive)
 * 
 * @param name - The trace name (e.g., "skill:planning-expert")
 * @param skillName - The specific skill name from metadata (e.g., "planning-expert")
 * @returns true if the trace should be filtered out
 */
export function isSkillTrace(name?: string, skillName?: string): boolean {
  const forbidden = ['skill', 'skill.md'];
  
  const normalizedName = (name || '').toLowerCase();
  const normalizedSkillName = (skillName || '').toLowerCase();

  // Check if it's explicitly one of the forbidden strings
  if (forbidden.includes(normalizedName) || forbidden.includes(normalizedSkillName)) {
    return true;
  }

  // Check if it's a prefixed skill or generation name (exact match for the "skill" or "skill.md" variant)
  const prefixedForbidden = ['skill:skill', 'generation:skill', 'skill:skill.md', 'generation:skill.md'];
  if (prefixedForbidden.includes(normalizedName)) {
    return true;
  }

  return false;
}
