import matter from 'gray-matter';
import fs from 'node:fs';
import path from 'node:path';
import type { ResolvedSkill, SkillEntry } from './types.js';

// The tech-lead-stack repo root (where .agents/ and .ai/ live). Override with STACK_REPO env.
const STACK_REPO = process.env.STACK_REPO!;

// Hand-authored overlay of spoken aliases + writes flags, keyed by canonical id.
// This is the ONLY file you maintain by hand; everything else is derived from the repo.
const OVERLAY_PATH = new URL('../voice-aliases.json', import.meta.url);

interface Overlay {
  [id: string]: {
    aliases?: string[];
    writes?: boolean;
    type?: 'workflow' | 'skill';
    skill?: string;
  };
}

function loadOverlay(): Overlay {
  try {
    return JSON.parse(fs.readFileSync(OVERLAY_PATH, 'utf8'));
  } catch {
    return {};
  }
}

// Scan .agents/workflows/*.md, read frontmatter { name, description }.
function scanWorkflows(): Record<
  string,
  { name: string; description?: string }
> {
  const dir = path.join(STACK_REPO, '.agents', 'workflows');
  const out: Record<string, { name: string; description?: string }> = {};
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return out;
  }
  for (const f of files) {
    try {
      const fm = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
      const name = (fm.data?.name as string) || f.replace(/\.md$/, '');
      out[name] = {
        name,
        description: fm.data?.description as string | undefined,
      };
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

// Build the registry: workflow frontmatter (source of truth for ids) + overlay (aliases/writes).
export function buildRegistry(): SkillEntry[] {
  const overlay = loadOverlay();
  const workflows = scanWorkflows();
  const ids = new Set<string>([
    ...Object.keys(workflows),
    ...Object.keys(overlay),
  ]);

  const entries: SkillEntry[] = [];
  for (const id of ids) {
    const ov = overlay[id] || {};
    const wf = workflows[id];
    const aliases = new Set<string>([
      id,
      id.replace(/-/g, ' '),
      `/${id}`,
      `slash ${id}`,
      ...(ov.aliases || []),
    ]);
    entries.push({
      id,
      aliases: [...aliases],
      type: ov.type || 'workflow',
      workflow: wf ? wf.name : id,
      skill: ov.skill,
      // DEFAULT SAFE: if we don't KNOW a skill is read-only, treat it as writing => gated.
      writes: ov.writes ?? true,
      description: wf?.description,
    });
  }
  return entries;
}

// Resolve a spoken transcript to a skill + the remaining prompt.
// Matches the longest alias that the transcript starts with (after light normalisation).
export function resolveSkill(
  transcript: string,
  registry: SkillEntry[]
): ResolvedSkill | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s/]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const t = norm(transcript);

  let best: { entry: SkillEntry; alias: string } | null = null;
  for (const entry of registry) {
    for (const alias of entry.aliases) {
      const a = norm(alias);
      // accept "use the <alias> skill", "<alias>", "<alias> ..."
      const patterns = [
        a,
        `use the ${a} skill`,
        `use ${a}`,
        `run ${a}`,
        `${a} skill`,
      ];
      for (const p of patterns) {
        if (t === p || t.startsWith(p + ' ')) {
          if (!best || p.length > norm(best.alias).length)
            best = { entry, alias: p };
        }
      }
    }
  }
  if (!best) return null;
  const stripped = t.slice(norm(best.alias).length).trim();
  return { entry: best.entry, prompt: stripped || transcript };
}
