import matter from 'gray-matter';
import fs from 'node:fs';
import path from 'node:path';
import type { ResolvedSkill, SkillEntry } from './types.js';

const getDirname = () => {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  const cwd = process.cwd();
  return cwd.endsWith('voice-relay') 
    ? path.join(cwd, 'src') 
    : path.join(cwd, 'peripherals/voice-relay/src');
};

// The tech-lead-stack repo root (where .agents/ and .ai/ live). Override with STACK_REPO env.
const STACK_REPO = process.env.STACK_REPO || path.resolve(getDirname(), '../../../');

const OVERLAY_PATH = path.resolve(getDirname(), '../voice-aliases.json');

interface Overlay {
  [id: string]: {
    aliases?: string[];
    writes?: boolean;
    type?: 'workflow' | 'skill';
    skill?: string;
    workflow?: string;
  };
}

function loadOverlay(): Overlay {
  try {
    return JSON.parse(fs.readFileSync(OVERLAY_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function scanDir(baseDir: string, type: 'workflow' | 'skill', out: Record<string, any>) {
  let files: string[] = [];
  try {
    files = fs.readdirSync(baseDir).filter((f) => f.endsWith('.md'));
  } catch {
    return;
  }
  for (const f of files) {
    try {
      const fm = matter(fs.readFileSync(path.join(baseDir, f), 'utf8'));
      const id = f.replace(/\.md$/, '');
      const name = (fm.data?.name as string) || id;
      out[id] = {
        id,
        type,
        workflow: type === 'workflow' ? name : undefined,
        skill: type === 'skill' ? name : undefined,
        description: fm.data?.description as string | undefined,
      };
    } catch {
      /* skip unreadable */
    }
  }
}

function scanManifest(manifestPath: string, out: Record<string, any>) {
  try {
    const lines = fs.readFileSync(manifestPath, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;
      const [id, relPath] = line.split('|');
      if (id && relPath) {
        const type = relPath.includes('workflows/') ? 'workflow' : 'skill';
        if (!out[id]) {
          out[id] = {
            id,
            type,
            workflow: type === 'workflow' ? path.basename(relPath, '.md') : undefined,
            skill: type === 'skill' ? path.basename(relPath, '.md') : undefined,
          };
        }
      }
    }
  } catch {
    /* skip */
  }
}

export function buildRegistry(): SkillEntry[] {
  const overlay = loadOverlay();
  const raw: Record<string, any> = {};

  scanDir(path.join(STACK_REPO, '.agents', 'workflows'), 'workflow', raw);
  scanDir(path.join(STACK_REPO, '.agents', 'pm-workflows'), 'workflow', raw);
  scanDir(path.join(STACK_REPO, '.agents', 'hr-workflows'), 'workflow', raw);
  scanDir(path.join(STACK_REPO, '.ai', 'skills'), 'skill', raw);
  
  scanManifest(path.join(STACK_REPO, '.ai', 'cursor-skills.manifest'), raw);

  const ids = new Set<string>([
    ...Object.keys(raw),
    ...Object.keys(overlay),
  ]);

  const entries: SkillEntry[] = [];
  for (const id of ids) {
    const ov = overlay[id] || {};
    const base = raw[id] || {};
    
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
      type: ov.type || base.type || 'workflow',
      workflow: ov.workflow || base.workflow,
      skill: ov.skill || base.skill,
      writes: ov.writes ?? true,
      description: base.description,
    });
  }
  return entries;
}

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
