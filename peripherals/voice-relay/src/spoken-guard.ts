/**
 * @file spoken-guard.ts
 * @desc L1 — Local deterministic validator & sanitizer for TTS-bound spoken text.
 *
 * This module is the single source of truth for hardening voice-relay outputs against
 * LLM conversational artifacts. It operates purely on deterministic regex evaluation
 * with zero network overhead. All functions are idempotent and side-effect-free, designed
 * to run safely in real-time streaming paths or bulk evaluation harnesses.
 *
 * Capabilities:
 * - Heuristic task classification for identifying expected sequence or code outputs.
 * - Robust nested markdown stripping via max-depth recursive regex passes (O(N) safe).
 * - Fast-path checking `hasMarkdown` to ensure zero performance penalty on clean text.
 * - Preamble and epilogue removal to strip colloquial AI chatter.
 * - Validation scoring strictly normalized (1.0 = good, 0.0 = bad) aligning with Langfuse.
 */

/** Heuristic task classification for per-class spoken validation. */
export type TaskClass =
  | 'sequence'
  | 'arithmetic'
  | 'definition'
  | 'code'
  | 'freeform';

/**
 * Result of spoken text validation.
 * @desc `ok` is false when any hard rule is violated. `confidence` is 'low'
 * when the text is borderline (e.g. near the succinctness budget) — this
 * triggers L2 guard escalation even when `ok` is true.
 */
export interface ValidationResult {
  ok: boolean;
  issues: string[];
  confidence: 'high' | 'low';
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Maximum spoken word count before flagging low confidence. */
const SUCCINCTNESS_BUDGET = 50;

/** Patterns that indicate markdown / formatting leaked into spoken text. */
const MARKDOWN_RE = /[*#`]|_[^_\s]+_|\[[^\]]+\]\([^)]+\)/;

/** Bullet-point lines: "- item" or "* item" at line start. */
const BULLET_RE = /(?:^|\n)\s*[-*]\s+\S/;

/** Ordered-list indices: "1. " "2. " etc. at line start. */
const ORDINAL_RE = /(?:^|\n)\s*\d+\.\s/;

/** Markdown table rows: lines containing pipe-delimited cells. */
const TABLE_RE = /(?:^|\n)\s*\|.+\|/;

/** Markdown table separator: lines like | --- | --- | */
const TABLE_SEPARATOR_RE = /(?:^|\n)\s*\|[\s:]*-{2,}[\s:]*\|/;

/**
 * Common TTS-unfriendly preamble phrases.
 * Case-insensitive, anchored to start of string (after optional whitespace).
 */
const PREAMBLE_PATTERNS = [
  /^\s*(?:here(?:'s|\s+(?:is|are))\b.*?[.:\n])/i,
  /^\s*(?:here(?:'s|\s+(?:is|are))\b\s*)/i,
  /^\s*(?:sure|certainly|absolutely|of\s+course|great\s+question|yes)\b[,!.\s]*/i,
  /^\s*(?:note|output|alternative\s+formats?)\b\s*:/i,
  /^\s*(?:the\s+answer\s+is\b.*?:)/i,
  /^\s*(?:\*?(?:this|the)\s+(?:sequence|list|response|countdown|series)\b.*?[.:\n])/i,
  /^\s*this\s+(?:format|structure|layout|representation|design|syntax|approach|version|document)\s+(?:preserves|ensures|allows|provides|is|utilizes|helps|displays|shows|contains)\b.*?[.:\n]/i,
  /^\s*(?:we\s+begin\b.*?[.:\n])/i,
  /^\s*(?:below\s+is\b.*?[.:\n])/i,
  /^\s*(?:the\s+(?:following|complete|full)\b.*?[.:\n])/i,
  /^\s*(?:(?:i\s+can|let\s+me)\s+[a-z\s]+?[.:\n])/i,
  /^\s*(?:(?:starting|beginning|counting)\s+(?:at|from|down|backwards?)\b.*?[.:\n])/i,
];

/**
 * Fast check for any markdown or list formatting characters.
 */
export function hasMarkdown(text: string): boolean {
  return (
    MARKDOWN_RE.test(text) ||
    BULLET_RE.test(text) ||
    ORDINAL_RE.test(text) ||
    /(?:^|\n)\s*#{1,6}\s+/.test(text) ||
    TABLE_RE.test(text) ||
    TABLE_SEPARATOR_RE.test(text) ||
    /(?:^|\n)\s*[-*_]{3,}\s*(?:\n|$)/.test(text) ||
    /(?:^|\n)\s*>\s*/.test(text) ||
    /\\([*_`~#\[\]()<>])/.test(text)
  );
}

/**
 * Common TTS-unfriendly epilogue phrases.
 * Anchored to the end of the string (before optional whitespace/punctuation).
 */
const EPILOGUE_PATTERNS = [
  /(?:if\s+you(?:'d|\s+would|\s+should|\s+can)?\s+(?:have|need|want|like|wish|prefer|require|decide|desire))\b.*$/i,
  /(?:(?:let\s+me\s+know|hope\s+this\s+helps|feel\s+free|don'?t\s+hesitate|just\s+let\s+me\s+know|reach\s+out)\b.*)$/i,
  /(?:you\s+(?:can|may|could|might)\s+(?:stop|choose|include|also|find|continue|extend|proceed))\b.*$/i,
  /(?:have\s+a\s+(?:great|good|wonderful|nice)\s+(?:day|evening|weekend|time))\b.*$/i,
  /(?:done|that'?s\s+it)[!.\s]*$/i,
  /(?:\*?this\s+sequence\b.*)$/i,
  /(?:^|\n)\s*\\?\*?\s*(?:count\s+includes|total\s+count|note:)\b.*$/i,
  /(?:^|\n)\s*this\s+structure\s+ensures\s+clarity\b.*$/i,
  /(?:^|\n)\s*regardless\s+of\s+whether\s+the\s+content\s+is\s+processed\b.*$/i,
];

/**
 * Raw code syntax that shouldn't appear in spoken text.
 * Intentionally loose — catches common JS/TS/Python patterns.
 */
const CODE_SYNTAX_RE =
  /(?:^|\s)(?:function\s|const\s|let\s|var\s|=>|import\s|export\s|class\s|def\s|print\(|console\.log|return\s|if\s*\(|for\s*\(|while\s*\(|for\s+\w+\s+in\s+|range\(|\[\w+\s+for\s+|\{|\}|```)/m;

/* ------------------------------------------------------------------ */
/* Task class detection                                                */
/* ------------------------------------------------------------------ */

/**
 * Heuristic classifier that maps a user prompt to a task class.
 * Used to apply class-specific validation rules.
 */
export function detectTaskClass(prompt: string): TaskClass {
  const p = prompt.toLowerCase();

  // Sequence / countdown / listing tasks
  if (
    /\b(?:count(?:down|ing)?|backwards?|list\s+the|enumerate|sequence|name\s+the|from\s+\d+\s+to\s+\d+)\b/.test(
      p
    )
  ) {
    return 'sequence';
  }

  // Math / arithmetic tasks
  if (
    /\b(?:what\s+is\s+\d+|calculate|\d+\s*[\+\-\*\/]\s*\d+|sum\s+of|square\s+root)\b/.test(
      p
    )
  ) {
    return 'arithmetic';
  }

  // Definition / factual lookup tasks
  if (
    /\b(?:what\s+is\s+(?:a|an|the)|define|explain|who\s+is|how\s+many)\b/.test(
      p
    )
  ) {
    return 'definition';
  }

  // Code generation
  if (
    /\bwrite\s+a\b/.test(p) ||
    /\bcode\b/.test(p) ||
    /\bscript\b/.test(p) ||
    /\bfunction\b/.test(p) ||
    /\bimplement\b/.test(p) ||
    /\bprogram\b/.test(p)
  ) {
    return 'code';
  }

  return 'freeform';
}

/* ------------------------------------------------------------------ */
/* Universal validation (L1 Guard)                                     */
/* ------------------------------------------------------------------ */

/**
 * Validates that spoken text adheres to universal cleanliness rules.
 * Fast, deterministic, no LLM required.
 */
export function validateSpoken(text: string): ValidationResult {
  const issues: string[] = [];

  if (!text || text.trim().length === 0) {
    return { ok: false, issues: ['spoken text is empty'], confidence: 'high' };
  }

  const trimmed = text.trim();

  // Hard rule: no markdown / formatting characters
  if (hasMarkdown(trimmed)) {
    issues.push(
      'contains markdown or list formatting (*, #, `, _, -, 1., or []())'
    );
  }

  // Markdown tables
  if (TABLE_RE.test(trimmed) || TABLE_SEPARATOR_RE.test(trimmed)) {
    issues.push('contains markdown table formatting');
  }

  // Hard rule: no preambles
  for (const pat of PREAMBLE_PATTERNS) {
    if (pat.test(trimmed)) {
      issues.push('contains preamble phrase');
      break;
    }
  }

  // Hard rule: no epilogues
  for (const pat of EPILOGUE_PATTERNS) {
    if (pat.test(trimmed)) {
      issues.push('contains epilogue phrase');
      break;
    }
  }

  // Hard rule: no raw code syntax
  if (CODE_SYNTAX_RE.test(trimmed)) {
    issues.push('contains raw code syntax');
  }

  // Soft rule: succinctness budget
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const isSuccinct = wordCount <= SUCCINCTNESS_BUDGET;

  const ok = issues.length === 0;

  // Confidence is low if there are issues OR if it's over word budget
  const confidence: 'high' | 'low' = ok && isSuccinct ? 'high' : 'low';

  return { ok, issues, confidence };
}

/* ------------------------------------------------------------------ */
/* Per-task-class validation                                           */
/* ------------------------------------------------------------------ */

/**
 * Validates spoken text with task-class-specific constraints.
 */
export function validateByTaskClass(
  spoken: string,
  prompt: string,
  taskClass: TaskClass
): ValidationResult {
  // Start with universal checks
  const base = validateSpoken(spoken);
  const issues = [...base.issues];

  const wordCount = spoken.split(/\s+/).filter(Boolean).length;

  switch (taskClass) {
    case 'sequence': {
      // Sequence tasks must be strictly within word count
      if (wordCount > 25) {
        issues.push(
          `sequence exceeds 25 words (was ${wordCount}); likely contains conversational padding`
        );
      }
      // Check for accidental ascending runs in countdowns
      const p = prompt.toLowerCase();
      if (
        (p.includes('backwards') || p.includes('countdown')) &&
        hasAscendingRun(spoken)
      ) {
        issues.push(
          'countdown task contains ascending number sequence — likely counted up instead of down'
        );
      }
      break;
    }

    case 'arithmetic': {
      // Arithmetic answers should be short (under 15 words)
      if (wordCount > 15) {
        issues.push(
          `arithmetic answer exceeds 15 words (was ${wordCount}); should be direct answer only`
        );
      }
      break;
    }

    case 'definition': {
      // Definitions shouldn't exceed ~3 sentences
      const sentences = spoken.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      if (sentences.length > 3) {
        issues.push(
          `definition has ${sentences.length} sentences; should be at most 3 sentences`
        );
      }
      break;
    }

    case 'code': {
      // Code tasks must NEVER contain raw code in spoken text
      if (CODE_SYNTAX_RE.test(spoken)) {
        issues.push('code task contains raw code syntax in spoken text');
      }
      break;
    }

    case 'freeform':
    default:
      // Universal rules are sufficient
      break;
  }

  const ok = issues.length === 0;
  const isSuccinct = wordCount <= SUCCINCTNESS_BUDGET;
  const confidence: 'high' | 'low' = ok && isSuccinct ? 'high' : 'low';

  return { ok, issues, confidence };
}

/* ------------------------------------------------------------------ */
/* Sequence Direction Heuristic                                        */
/* ------------------------------------------------------------------ */

/**
 * Detects whether spoken text contains an ascending run of 3+ integers.
 * Used to catch when a model counted UP on a countdown request.
 */
export function hasAscendingRun(text: string): boolean {
  // Extract all integer tokens
  const tokens = text.match(/\b\d+\b/g);
  if (!tokens || tokens.length < 3) {
    return false;
  }

  const numbers = tokens.map(Number);
  let runLength = 1;

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === numbers[i - 1] + 1) {
      runLength++;
      if (runLength >= 3) {
        return true;
      }
    } else {
      runLength = 1;
    }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/* Sanitizer (deterministic repair)                                    */
/* ------------------------------------------------------------------ */

/**
 * Deterministically strips markdown, list syntax, preambles, and
 * epilogues from a text string to produce spoken-safe text.
 *
 * Guaranteed to be idempotent: `sanitizeSpoken(sanitizeSpoken(x)) === sanitizeSpoken(x)`
 */
export function sanitizeSpoken(text: string): string {
  if (!text) {
    return '';
  }

  let s = text;

  // Strip horizontal rules
  s = s.replace(/(?:^|\n)\s*[-*_]{3,}\s*(?:\n|$)/g, '\n');

  // Strip secondary visual representation sections that follow (e.g. "If you prefer a visual...")
  s = s.replace(
    /(?:^|\n)\s*(?:if\s+you\s+prefer\b|visual\s+representation\b|for\s+(?:a\s+)?visual\s+display\b)[\s\S]*$/gi,
    ''
  );

  // Strip conversational parenthetical options and visual annotations
  s = s.replace(/\s*\(\s*or\s+[^)]+\)/gi, '');
  s = s.replace(/\s*\([^)]*(?:reached|inclusive|including|step|count)[^)]*\)/gi, '');

  s = s.trim();

  // Strip "Summary", "Notes" sections entirely before line-by-line stripping
  s = s.replace(
    /(?:^|\n)\s*#{1,6}\s*(?:summary|notes?)\b[\s\S]*$/gi,
    ''
  );

  // Strip incomplete teaser code blocks with trailing ellipsis (e.g. "10, 9, 8, 7, ...")
  s = s.replace(/```(?:text|txt|plaintext)?\n?[\s\S]*?(?:\.{3,}|…)\s*```/gi, '');

  // Unwrap text/plain/markdown/general code blocks (preserving the inner answers)
  s = s.replace(
    /```(?:text|txt|plaintext|markdown|md)?\n?([\s\S]*?)```/gi,
    (m, inner) => (CODE_SYNTAX_RE.test(inner) ? '' : inner)
  );

  // Fast pre-check: if no markdown/list chars exist, skip the regex loop
  if (hasMarkdown(s)) {
    let depth = 0;
    const MAX_DEPTH = 5;

    while (depth < MAX_DEPTH) {
      const prev = s;

      // Strip programming code blocks entirely
      s = s.replace(/```[a-z]*\n?[\s\S]*?```/gi, '');

      // Strip markdown/md fence delimiters
      s = s.replace(/```(?:markdown|md|text|txt)?\n?/gi, '');

      // Strip horizontal rules
      s = s.replace(/(?:^|\n)\s*[-*_]{3,}\s*(?:\n|$)/g, '\n');

      // Strip blockquotes
      s = s.replace(/(?:^|\n)\s*>\s*/g, '\n');

      // Unescape markdown
      s = s.replace(/\\([*_`~#\[\]()<>])/g, '$1');

      // Strip trailing ellipsis sequences like "... " or ", ..."
      s = s.replace(/(?:,\s*)?(?:\.{3,}|…)/g, '');

      // Strip markdown table rows and separators (| cell | cell |)
      s = s.replace(/^\s*\|.*\|[ \t]*$/gm, '');

      // Strip ordered list indices: "1. " "2. " etc.
      s = s.replace(/(?:^|\n)\s*\d+\.\s+/g, '\n');

      // Strip bullet prefixes: "- " "* "
      s = s.replace(/(?:^|\n)\s*[-*]\s+/g, '\n');

      // Strip markdown bold/italic markers
      s = s.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');

      // Strip markdown headers ENTIRELY (drop the whole line, as headers shouldn't be read aloud)
      s = s.replace(/(?:^|\n)\s*#{1,6}\s+[^\n]+/g, '\n');

      // Strip backtick code spans (inline code)
      s = s.replace(/`([^`]+)`/g, '$1');

      // Strip markdown links: [text](url) → text
      s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

      // Strip underscored emphasis: _text_ → text
      s = s.replace(/_([^_]+)_/g, '$1');

      // Strip HTML tags
      s = s.replace(/<[^>]+>/g, ' ');

      // If the string didn't change, we've stripped all matching layers
      if (s === prev) {
        break;
      }
      depth++;
    }
  }

  // Strip trailing "Summary" sections if header was already missing
  s = s.replace(
    /(?:^|\n)\s*(?:#{1,6}\s+)?summary\b[^\n]*(?:\n[\s\S]*)?$/gi,
    ''
  );

  // Strip meta-formatting / screen-reader / markdown explanations
  s = s.replace(
    /(?:^|\n)\s*this\s+(?:format|structure|layout|representation|design|syntax|approach|version)\s+(?:preserves|ensures|allows|provides|is|utilizes|helps|displays|shows)\b[^\n]*/gi,
    ''
  );

  // Collapse whitespace
  s = s
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  // Strip preambles and epilogues as a hard guard repeatedly (max 5 passes)
  let prevFinal = null;
  let iters = 0;
  while (s !== prevFinal && iters < 5) {
    prevFinal = s;
    iters++;
    for (const pat of PREAMBLE_PATTERNS) {
      s = s.replace(pat, '');
    }
    for (const pat of EPILOGUE_PATTERNS) {
      s = s.replace(pat, '');
    }
    s = s.trim();
  }

  return s.trim();
}

/* ------------------------------------------------------------------ */
/* Langfuse-compatible score helpers (1.0 = good, 0.0 = bad)           */
/* ------------------------------------------------------------------ */

/**
 * Score: does the spoken text contain any ordered-list-index leak?
 * 1.0 = clean, 0.0 = leaked.
 */
export function scoreNoListIndexLeak(spoken: string): number {
  return ORDINAL_RE.test(spoken) ? 0.0 : 1.0;
}

/**
 * Score: does the spoken text contain preamble phrases?
 * 1.0 = clean, 0.0 = has preamble.
 */
export function scoreNoPreamble(spoken: string): number {
  return PREAMBLE_PATTERNS.some((p) => p.test(spoken)) ? 0.0 : 1.0;
}

/**
 * Score: does the spoken text leak raw code syntax?
 * 1.0 = clean, 0.0 = leaked.
 */
export function scoreNoCodeLeak(spoken: string): number {
  return CODE_SYNTAX_RE.test(spoken) ? 0.0 : 1.0;
}

/**
 * Score: does the spoken text leak markdown table formatting?
 * 1.0 = clean, 0.0 = leaked.
 */
export function scoreNoTableLeak(spoken: string): number {
  return TABLE_RE.test(spoken) || TABLE_SEPARATOR_RE.test(spoken) ? 0.0 : 1.0;
}
