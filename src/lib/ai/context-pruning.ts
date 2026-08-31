/**
 * Prunes the raw stack context to fit within maxChars by retaining the
 * beginning and end of the string (Middle Truncation).
 *
 * @example
 * const rawContext = "A".repeat(500) + "B".repeat(500); // 1000 chars
 * // If rawContext exceeds maxChars, it prunes the middle:
 * const pruned = pruneStackContext(rawContext, 100);
 * // Result retains ~50 chars from the beginning and ~50 from the end,
 * // separated by a truncation marker.
 *
 * @remarks
 * **Framework-Agnostic Design:**
 * - This function is completely stack-agnostic. It does not parse or filter based on specific languages, frameworks, or keywords.
 * - Configuration files (e.g., package.json, go.mod) typically hold crucial identifiers at the top and bottom, which are preserved through this middle-truncation approach.
 */
export const GEMINI_CACHE_MIN_TOKENS = 4096; // Based on current Google AI limits

/**
 * Estimates the token count for a given string (rough approximation chars / 4).
 */
export function estimatePrefixTokens(system: string, stablePrefix: string = ''): number {
  return Math.floor((system.length + stablePrefix.length) / 4);
}

/**
 * Prunes the raw stack context to fit within maxChars by retaining the
 * beginning and end of the string (Middle Truncation).
 *
 * @example
 * const rawContext = "A".repeat(500) + "B".repeat(500); // 1000 chars
 * // If rawContext exceeds maxChars, it prunes the middle:
 * const pruned = pruneStackContext(rawContext, 100);
 * // Result retains ~50 chars from the beginning and ~50 from the end,
 * // separated by a truncation marker.
 *
 * @remarks
 * **Framework-Agnostic Design:**
 * - This function is completely stack-agnostic. It does not parse or filter based on specific languages, frameworks, or keywords.
 * - Configuration files (e.g., package.json, go.mod) typically hold crucial identifiers at the top and bottom, which are preserved through this middle-truncation approach.
 */
export function pruneStackContext(raw: string, maxChars: number, preserveForCache: boolean = false): string {
  if (!raw || raw.length <= maxChars) {
    return raw;
  }

  // If preserving for cache, calculate if current chars > token limit
  if (preserveForCache) {
    const rawTokens = Math.floor(raw.length / 4);
    if (rawTokens >= GEMINI_CACHE_MIN_TOKENS) {
      // If we are above the cache min limit, we should ensure we don't prune below it.
      // E.g. if maxChars is 10000 but limit is 16384, we just use raw length or max(maxChars, limit * 4).
      const minCharsForCache = GEMINI_CACHE_MIN_TOKENS * 4;
      if (maxChars < minCharsForCache) {
        maxChars = minCharsForCache;
      }
      
      // If after lifting maxChars to minCharsForCache, raw is now <= maxChars, return raw
      if (raw.length <= maxChars) {
        return raw;
      }
    }
  }

  const marker = '\n\n...[Context truncated due to length]...\n\n';

  // If maxChars is so small that it can't even fit the marker properly, just hard truncate
  if (maxChars <= marker.length) {
    return raw.substring(0, maxChars);
  }

  const half = Math.floor((maxChars - marker.length) / 2);

  return raw.substring(0, half) + marker + raw.substring(raw.length - half);
}
