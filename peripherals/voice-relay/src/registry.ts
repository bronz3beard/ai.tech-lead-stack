import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
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

const STACK_REPO =
  process.env.STACK_REPO || path.resolve(getDirname(), '../../../');
const OVERLAY_PATH = path.resolve(getDirname(), '../voice-aliases.json');

interface Overlay {
  readOnly?: string[];
  [id: string]: any;
}

function loadOverlay(): Overlay {
  try {
    return JSON.parse(fs.readFileSync(OVERLAY_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function scanManifest(manifestPath: string, out: Set<string>) {
  try {
    const lines = fs.readFileSync(manifestPath, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;
      const [id] = line.split('|');
      if (id) {
        // Strip workflow- prefix from Antigravity workflows
        out.add(id.replace(/^workflow-/, ''));
      }
    }
  } catch {
    /* skip */
  }
}

async function fetchMcpSkills(): Promise<Set<string> | null> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', path.join(STACK_REPO, 'src/mcp-server/index.ts')],
    env: { ...process.env, REPOS_ROOT: process.env.REPOS_ROOT || '' },
  });

  const client = new Client(
    { name: 'voice-relay-skills', version: '0.1.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: 'list_skills',
      arguments: {},
    });

    if (
      result.isError ||
      !Array.isArray(result.content) ||
      result.content.length === 0
    ) {
      return null;
    }

    const content = result.content[0] as { type: string; text: string };
    if (content.type === 'text') {
      const skills = new Set<string>();
      // Parse output: "- accessibility-auditor [modes: ...]"
      const lines = content.text.split('\n');
      for (const line of lines) {
        const match = line.match(/^-\s+([a-zA-Z0-9-]+)/);
        if (match && match[1]) {
          skills.add(match[1]);
        }
      }
      return skills.size > 0 ? skills : null;
    }
    return null;
  } catch (e) {
    return null;
  } finally {
    try {
      await client.close();
    } catch {}
  }
}

export async function buildRegistry(): Promise<SkillEntry[]> {
  const overlay = loadOverlay();
  const readOnlyList = new Set(overlay.readOnly || []);
  let rawSkills = await fetchMcpSkills();

  if (!rawSkills) {
    rawSkills = new Set<string>();
    scanManifest(
      path.join(STACK_REPO, '.ai', 'cursor-skills.manifest'),
      rawSkills
    );
  }

  // Also include anything manually listed in overlay (except the readOnly array itself)
  for (const key of Object.keys(overlay)) {
    if (key !== 'readOnly') rawSkills.add(key);
  }

  const entries: SkillEntry[] = [];
  for (const id of rawSkills) {
    const ov = overlay[id] || {};
    const aliases = new Set<string>([
      id,
      id.replace(/-/g, ' '),
      `/${id}`,
      `slash ${id}`,
      ...(ov.aliases || []),
    ]);

    // determine type: if it's in the manifest as a workflow, or if we just default it
    // Without full paths, we'll default to workflow unless specified.
    const isReadOnly = readOnlyList.has(id);

    entries.push({
      id,
      aliases: [...aliases],
      type: ov.type || 'workflow',
      workflow: ov.workflow || id,
      skill: ov.skill || id,
      writes: !isReadOnly, // Default to true, gated by readOnly allowlist
      description: ov.description,
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
