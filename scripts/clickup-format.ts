/**
 *
 * SINGLE SOURCE OF TRUTH for rendering structured content into ClickUp-correct
 * markdown. Every skill that outputs to ClickUp (qa-handover-generator, and any
 * other ClickUp-doc/task-producing skill) MUST render through this module rather
 * than hand-formatting, so formatting is consistent, testable, and fixable in one
 * place.
 *
 * Pillars:
 * - MinimumCD / Production Ethos: deterministic + unit-tested. Formatting is not
 *   re-derived by an LLM each run; it is a pure function with fixture tests.
 * - Agent Skills: consumed by skills, not reimplemented per skill.
 *
 * CLICKUP TABLE RENDERING (verified behaviour)
 * ClickUp DOCUMENT tables (Docs, Wikis, task descriptions) render natively as
 * markdown pipe-tables — so 'pipe' mode is correct for those destinations. Two
 * hard limits apply and are enforced by `renderTable`:
 *   - ClickUp Docs:                 up to 8 columns.
 *   - Task descriptions / comments: up to 4 columns.
 * (This is distinct from ClickUp "Table View", which turns tasks into a grid and
 * is NOT a rich-text table — a handover is a written doc, so we always target
 * document/rich-text tables, never Table View.)
 *
 * Modes, isolated here so table behaviour is changed in exactly one place:
 *   - 'pipe' : native markdown pipe-table. Correct for Doc/task-description
 *              destinations, subject to the column limit for the destination.
 *   - 'list' : fallback — each row as a labelled bullet block. Always renders,
 *              and is used automatically when a table exceeds the destination's
 *              column limit (or when a non-table rich context is targeted).
 * Do not scatter table syntax anywhere else; change it here only.
 */

export type TableMode = 'pipe' | 'list';

/** ClickUp destination — determines the max columns a pipe-table may use. */
export type ClickUpTarget = 'doc' | 'task';

/** Column caps for ClickUp document tables, by destination. */
export const CLICKUP_MAX_TABLE_COLUMNS: Record<ClickUpTarget, number> = {
  doc: 8,
  task: 4,
};

export interface FormatOptions {
  /** How to render tables. Default 'pipe' for docs (native markdown tables). */
  tableMode?: TableMode;
  /** Destination context, used to enforce the column limit. Default 'doc'. */
  target?: ClickUpTarget;
}

export interface Table {
  headers: string[];
  rows: string[][];
}

export interface ChecklistItem {
  text: string;
  checked?: boolean;
}

/** Escape characters that would corrupt ClickUp markdown output. */
function escapeInline(text: string): string {
  // Only escape pipes inside table cells and stray backticks are handled by
  // callers via `code()`. Keep this conservative — over-escaping harms readability.
  return text.replace(/\|/g, '\\|');
}

export function h1(text: string): string {
  return `# ${text.trim()}`;
}

export function h2(text: string): string {
  return `## ${text.trim()}`;
}

export function h3(text: string): string {
  return `### ${text.trim()}`;
}

export function bold(text: string): string {
  return `**${text}**`;
}

/** Inline code — for hook/query/function names. */
export function code(text: string): string {
  return `\`${text}\``;
}

/** A fenced code block (e.g. for a sample URL or snippet). */
export function codeBlock(text: string, lang = ''): string {
  return `\`\`\`${lang}\n${text}\n\`\`\``;
}

export function bullets(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n');
}

/**
 * ClickUp checklist. `- [ ]` / `- [x]` renders as interactive checkboxes in
 * ClickUp Doc bodies. (If a future verification shows a Doc context where this
 * does not render, this is the single place to adjust.)
 */
export function checklist(items: ChecklistItem[]): string {
  return items.map((i) => `- [${i.checked ? 'x' : ' '}] ${i.text}`).join('\n');
}

export function link(text: string, url: string): string {
  return `[${text}](${url})`;
}

/**
 * Render a table for ClickUp. See the module-level table notes.
 *
 * Default mode is 'pipe' (native markdown table — correct for ClickUp Docs and
 * task descriptions). If the table has more columns than the destination allows
 * (8 for docs, 4 for tasks), it AUTOMATICALLY falls back to 'list' mode so the
 * content is never silently truncated by ClickUp's column cap. Passing
 * mode='list' explicitly always uses the bullet fallback.
 */
export function renderTable(
  table: Table,
  mode: TableMode = 'pipe',
  target: ClickUpTarget = 'doc'
): string {
  if (table.headers.length === 0) return '';

  const columnLimit = CLICKUP_MAX_TABLE_COLUMNS[target];
  const exceedsLimit = table.headers.length > columnLimit;

  // Native markdown pipe-table, but only when requested AND within the column cap.
  if (mode === 'pipe' && !exceedsLimit) {
    const header = `| ${table.headers.map(escapeInline).join(' | ')} |`;
    const divider = `| ${table.headers.map(() => '---').join(' | ')} |`;
    const body = table.rows
      .map((row) => `| ${row.map(escapeInline).join(' | ')} |`)
      .join('\n');
    return [header, divider, body].join('\n');
  }

  // 'list' fallback: each row becomes a labelled bullet block. Always renders,
  // and is used automatically when a pipe-table would exceed the column limit.
  return table.rows
    .map((row) => {
      const lines = table.headers.map((headerCell, idx) => {
        const value = row[idx] ?? '';
        return `- ${bold(headerCell + ':')} ${value}`;
      });
      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * Section builder: a heading followed by a body, with consistent spacing.
 */
export function section(
  heading: string,
  body: string,
  level: 2 | 3 = 2
): string {
  const head = level === 2 ? h2(heading) : h3(heading);
  return `${head}\n\n${body}`;
}

/**
 * Assemble a full document from ordered blocks, with exactly one blank line
 * between blocks and a single trailing newline. Keeps output clean for ClickUp
 * ingestion and for the file fallback.
 */
export function assembleDocument(blocks: string[]): string {
  return (
    blocks
      .map((b) => b.trimEnd())
      .filter((b) => b.length > 0)
      .join('\n\n') + '\n'
  );
}
