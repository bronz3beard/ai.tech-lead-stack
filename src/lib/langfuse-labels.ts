/**
 * Normalizes a Langfuse metadata field for display or ingestion.
 * Trims non-empty strings; otherwise returns "unknown".
 *
 * @param value - Raw value from Langfuse or MCP (may be missing or non-string)
 * @returns Trimmed string or "unknown"
 */
export function langfuseLabel(value: unknown): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return 'unknown';
}
