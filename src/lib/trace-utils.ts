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

  // Aggressive keyword-based grouping for known projects
  if (normalized.includes('tech-lead-stack')) return 'tech-lead-stack';
  if (normalized.includes('gilly')) return 'gilly';

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
