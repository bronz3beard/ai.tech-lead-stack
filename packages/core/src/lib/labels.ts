/**
 * Normalizes a telemetry label (model, agent) for storage and display.
 * Trims non-empty strings; otherwise returns "unknown".
 *
 * @param value - Raw value from an MCP client or chat route (may be missing or non-string)
 * @returns Trimmed string or "unknown"
 */
export function displayLabel(value: unknown): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return 'unknown';
}
