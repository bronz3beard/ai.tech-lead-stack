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

/**
 * Common TTS-unfriendly preamble phrases.
 * Case-insensitive, anchored to start of string (after optional whitespace).
 */
const PREAMBLE_PATTERNS = [
  /^\s*(?:here(?:'s|\s+(?:is|are))\b.*?(?:[:\n]|\s$))/i,
  /^\s*(?:here(?:'s|\s+(?:is|are))\b\s*)/i,
  /^\s*(?:sure|certainly|absolutely|of\s+course|great\s+question|yes)\b[,!.\s]*/i,
  /^\s*(?:note|output|alternative\s+formats?)\b\s*:/i,
  /^\s*(?:the\s+answer\s+is\b.*?(?:[:\n]|\s$))/i,
  /^\s*(?:\*?this\s+sequence\b.*?(?:[:\n]|\s$|\*))/i,
];
/**
 * Fast check for any markdown or list formatting characters.
 */
export function hasMarkdown(text: string): boolean {
  return (
    /[*#`]|_[^_]+_|\[[^\]]+\]\([^)]+\)/.test(text) ||
    BULLET_RE.test(text) ||
    ORDINAL_RE.test(text) ||
    /(?:^|\n)\s*#{1,6}\s+/.test(text)
  );
}
/**
 * Common TTS-unfriendly epilogue phrases.
 * Anchored to the end of the string (before optional whitespace/punctuation).
 */
const EPILOGUE_PATTERNS = [
  /(?:let\s+me\s+know|hope\s+this\s+helps|feel\s+free|don'?t\s+hesitate)\b.*$/i,
  /(?:if\s+you\s+(?:have|need)\s+(?:any|more))\b.*$/i,
  /(?:you\s+(?:can|may|could)\s+(?:stop|choose|include|also|find))\b.*$/i,
  /(?:have\s+a\s+(?:great|good|wonderful)\s+day)\b.*$/i,
  /(?:done|that'?s\s+it)[!.\s]*$/i,
  /(?:\*?this\s+sequence\b.*)$/i,
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
 *
 * @param prompt - The user's original question / instruction.
 * @returns The detected task class.
 */
export function detectTaskClass(prompt: string): TaskClass {
  const p = prompt.toLowerCase().trim();

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

  // Sequence / enumeration
  if (
    /\bcount\b/.test(p) ||
    /\blist\b/.test(p) ||
    /\benumerat/.test(p) ||
    /\bname\s+the\b/.test(p) ||
    /\bfirst\s+\d+\b/.test(p) ||
    /\bbackwards?\b/.test(p)
  ) {
    return 'sequence';
  }

  // Arithmetic / calculation
  if (
    /\bcalculat/.test(p) ||
    /\bcomput/.test(p) ||
    /\bwhat\s+is\s+\d/.test(p) ||
    /\bsquare\s+root\b/.test(p) ||
    /\d\s*[+\-*/]\s*\d/.test(p)
  ) {
    return 'arithmetic';
  }

  // Definition / explanation
  if (
    /\bwhat\s+is\s+a\b/.test(p) ||
    /\bexplain\b/.test(p) ||
    /\bdefine\b/.test(p) ||
    /\bdescribe\b/.test(p) ||
    /\bwhat\s+are\b/.test(p) ||
    /\bhow\s+many\b/.test(p) ||
    /\bdifference\s+between\b/.test(p)
  ) {
    return 'definition';
  }

  return 'freeform';
}

/* ------------------------------------------------------------------ */
/* Universal validation                                                */
/* ------------------------------------------------------------------ */

/**
 * Validates spoken text against universal TTS-cleanliness rules.
 * These rules apply to ALL responses regardless of task class.
 *
 * @param spoken - The spoken text to validate.
 * @returns Validation result with issues list and confidence level.
 */
export function validateSpoken(spoken: string): ValidationResult {
  const issues: string[] = [];

  if (!spoken || spoken.trim().length === 0) {
    return { ok: false, issues: ['spoken text is empty'], confidence: 'high' };
  }

  // Markdown formatting
  if (hasMarkdown(spoken)) {
    issues.push(
      'contains markdown or list formatting (*, #, `, _, -, 1., or []())'
    );
  }

  // Preamble
  for (const pat of PREAMBLE_PATTERNS) {
    if (pat.test(spoken)) {
      issues.push('contains preamble phrase');
      break;
    }
  }

  // Epilogue
  for (const pat of EPILOGUE_PATTERNS) {
    if (pat.test(spoken)) {
      issues.push('contains epilogue phrase');
      break;
    }
  }

  // Raw code syntax
  if (CODE_SYNTAX_RE.test(spoken)) {
    issues.push('contains raw code syntax');
  }

  // Succinctness — soft threshold, triggers low confidence not hard fail
  const wordCount = spoken.trim().split(/\s+/).length;
  const isOverBudget = wordCount > SUCCINCTNESS_BUDGET;

  const ok = issues.length === 0;
  const confidence: 'high' | 'low' =
    ok && !isOverBudget ? 'high' : isOverBudget && ok ? 'low' : 'high';

  return { ok, issues, confidence };
}

/* ------------------------------------------------------------------ */
/* Per-task-class validation                                           */
/* ------------------------------------------------------------------ */

/**
 * Applies task-class-specific validation rules on top of the universal ones.
 *
 * @param spoken - The spoken text to validate.
 * @param prompt - The original user prompt.
 * @param taskClass - The detected (or overridden) task class.
 * @returns Combined validation result.
 */
export function validateByTaskClass(
  spoken: string,
  prompt: string,
  taskClass: TaskClass
): ValidationResult {
  // Start with universal validation
  const base = validateSpoken(spoken);
  const issues = [...base.issues];

  switch (taskClass) {
    case 'sequence': {
      // Check for ascending ordinal run (the root cause pattern)
      if (hasAscendingRun(spoken)) {
        issues.push(
          'contains ascending ordinal run (1,2,3…) — likely list index leak'
        );
      }
      // Stricter word count check for simple sequences
      const wordCount = spoken.trim().split(/\s+/).length;
      if (wordCount > 30) {
        issues.push('sequence spoken text exceeds 30 words (too verbose)');
      }
      break;
    }
    case 'code': {
      // Code tasks: spoken should describe, not contain raw code
      // (already caught by CODE_SYNTAX_RE in universal, but double-check)
      if (/[{};]/.test(spoken)) {
        issues.push('spoken contains code syntax characters ({, }, ;)');
      }
      break;
    }
    case 'definition': {
      // Definitions should be brief in spoken form
      const sentences = spoken
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 0);
      if (sentences.length > 3) {
        issues.push('definition spoken text exceeds 3 sentences');
      }
      break;
    }
    case 'arithmetic': {
      const wordCount = spoken.trim().split(/\s+/).length;
      if (wordCount > 25) {
        issues.push('arithmetic spoken text exceeds 25 words (too verbose)');
      }
      break;
    }
    case 'freeform':
      // Universal rules suffice
      break;
  }

  const ok = issues.length === 0;
  const confidence: 'high' | 'low' =
    ok && base.confidence === 'high' ? 'high' : 'low';

  return { ok, issues, confidence };
}

/* ------------------------------------------------------------------ */
/* Ascending run detector                                              */
/* ------------------------------------------------------------------ */

/**
 * Detects an ascending 1,2,3… run in the text, which typically indicates
 * ordered-list indices leaked into spoken text.
 *
 * Looks for 3+ consecutive ascending integers separated by non-digit chars.
 *
 * @param text - The text to scan.
 * @returns True if an ascending run of 3+ is found.
 */
export function hasAscendingRun(text: string): boolean {
  const numbers = text.match(/\d+/g);
  if (!numbers || numbers.length < 3) return false;

  const nums = numbers.map(Number);
  let runLength = 1;

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) {
      runLength++;
      if (runLength >= 3) return true;
    } else {
      runLength = 1;
    }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/* Sanitizer (regex-based cleanup — the always-available fallback)     */
/* ------------------------------------------------------------------ */

/**
 * Best-effort regex cleanup of spoken text. Strips markdown formatting,
 * ordinal indices, preamble, epilogue, and code blocks. Used as the
 * last-resort fallback (Tier C) when LLM guards are unavailable.
 *
 * @param spoken - The raw spoken text to clean.
 * @returns Cleaned spoken text safe for TTS.
 */
export function sanitizeSpoken(spoken: string): string {
  let s = spoken;

  // Strip preamble phrases repeatedly in case they are stacked (e.g. "Sure, here is")
  let prevS = '';
  while (s !== prevS) {
    prevS = s;
    for (const pat of PREAMBLE_PATTERNS) {
      s = s.replace(pat, '');
    }
  }

  // Strip epilogue phrases repeatedly (e.g. "Done! Let me know...")
  let prevE = '';
  while (s !== prevE) {
    prevE = s;
    for (const pat of EPILOGUE_PATTERNS) {
      s = s.replace(pat, '');
    }
  }

  // Strip conversational parenthetical options (e.g. "(or stop at one)")
  s = s.replace(/\s*\(\s*or\s+[^)]+\)/gi, '');

  s = s.trim();

  // Fast pre-check: if no markdown/list chars exist, skip the regex loop
  if (hasMarkdown(s)) {
    let depth = 0;
    const MAX_DEPTH = 5;

    while (depth < MAX_DEPTH) {
      const prev = s;

      // Strip ordered list indices: "1. " "2. " etc.
      s = s.replace(/(?:^|\n)\s*\d+\.\s+/g, '\n');

      // Strip bullet prefixes: "- " "* "
      s = s.replace(/(?:^|\n)\s*[-*]\s+/g, '\n');

      // Strip markdown bold/italic markers
      s = s.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');

      // Strip markdown headers ENTIRELY (drop the whole line, as headers shouldn't be read aloud)
      s = s.replace(/(?:^|\n)\s*#{1,6}\s+[^\n]+/g, '\n');

      // Strip triple-backtick code blocks entirely IF they specify a programming language
      // (preserves content of generic ``` or ```markdown blocks in case the LLM wrapped the answer)
      s = s.replace(/```(?!markdown\b|md\b|text\b)[a-z]*\n?[\s\S]*?```/gi, '');

      // Strip remaining triple-backtick openings and closings (including tags like ```markdown) without deleting content
      s = s.replace(/```[a-z]*\n?/gi, '');

      // Strip backtick code spans (inline code)
      s = s.replace(/`([^`]+)`/g, '$1');

      // Strip markdown links: [text](url) → text
      s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

      // Strip underscored emphasis: _text_ → text
      s = s.replace(/_([^_]+)_/g, '$1');

      // If the string didn't change, we've stripped all matching layers
      if (s === prev) {
        break;
      }
      depth++;
    }
  }

  // Collapse whitespace
  s = s
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  // Strip preambles and epilogues as a hard guard
  for (const pat of PREAMBLE_PATTERNS) {
    s = s.replace(pat, '');
  }
  for (const pat of EPILOGUE_PATTERNS) {
    s = s.replace(pat, '');
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
