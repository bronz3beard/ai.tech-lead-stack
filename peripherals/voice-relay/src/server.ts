import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { buildBackends } from './backends.js';
import { getProjects, refreshProjects } from './projects.js';
import { buildRegistry, resolveSkill } from './registry.js';
import type { AgentBackend, Proposal, SkillEntry } from './types.js';

if (!fs.existsSync('.env')) {
  console.error(
    'Missing .env file. Please copy .env.example to .env and configure it.'
  );
  process.exit(1);
}

const PORT = Number(process.env.PORT || 4599);
const TOKEN = process.env.RELAY_TOKEN;
if (!TOKEN || TOKEN === 'changeme-shared-token') {
  console.error('RELAY_TOKEN is missing or invalid in .env');
  process.exit(1);
}

let registry: SkillEntry[] = [];
export async function refreshSkills() {
  registry = await buildRegistry();
  return registry;
}

let backends: AgentBackend[] = [];
let _mockBackends: AgentBackend[] | null = null;
export function __setMockBackends(mocks: AgentBackend[] | null) {
  _mockBackends = mocks;
}

export const proposals = new Map<string, Proposal>();

function pickBackend(id?: string): AgentBackend {
  const list = _mockBackends || backends;
  const targetId = id || process.env.PREFERRED_BACKEND;
  if (targetId) {
    const b = list.find((x) => x.id === targetId);
    if (b) return b;
  }
  return list.find((x) => x.id !== 'local') ?? list[0];
}

export const app = express();
app.use(express.json({ limit: '1mb' }));

// simple shared-token auth (LAN / Tailscale only; the phone holds no vendor secrets, just this token)
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (req.header('x-relay-token') !== TOKEN)
    return res.status(401).json({ error: 'bad token' });
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// What the codebase agent resolves to right now — the app shows this on the mode switch.
app.get('/backend', async (_req, res) => {
  const detected = await Promise.all(
    backends.map(async (b) => ({
      id: b.id,
      label: b.label,
      writes: b.writesSupported,
      ...(await b.detect()),
    }))
  );
  const active = pickBackend();
  const activeInfo = detected.find((d) => d.id === active.id);
  res.json({ active: activeInfo, available: detected });
});

app.get('/skills', async (_req, res) => res.json({ skills: await refreshSkills() }));
app.post('/skills/refresh', async (_req, res) =>
  res.json({ skills: await refreshSkills() })
);

app.get('/projects', (_req, res) => res.json(refreshProjects()));
app.post('/projects/refresh', (_req, res) => res.json(refreshProjects()));

// GATE step 1: command pipeline (unified)
app.post('/command', async (req, res, next) => {
  try {
    const {
      transcript,
      projectId: explicitProjectId,
      backend: backendId,
    } = req.body ?? {};
    if (!transcript)
      return res.status(400).json({ error: 'transcript is required' });

    const allProjects = refreshProjects(); // ensure fresh projects
    let matchedProject = null;
    let remainingTranscript = transcript;

    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const t = norm(transcript);

    let bestAliasMatch: { p: any; alias: string } | null = null;

    for (const p of allProjects) {
      const aliasesToMatch = [p.name, ...(p.aliases || [])];
      for (const a of aliasesToMatch) {
        const na = norm(a);
        if (!na) continue;
        if (t === na || t.startsWith(na + ' ')) {
          if (!bestAliasMatch || na.length > norm(bestAliasMatch.alias).length) {
            bestAliasMatch = { p, alias: na };
          }
        }
      }
    }

    if (bestAliasMatch) {
      matchedProject = bestAliasMatch.p;
      remainingTranscript = t.slice(norm(bestAliasMatch.alias).length).trim();
    } else if (explicitProjectId) {
      matchedProject = allProjects.find(
        (p) => p.id === explicitProjectId || p.path === explicitProjectId
      );
    }

    if (!matchedProject) {
      return res.json({
        kind: 'need-project',
        message:
          "I'm not sure which project you'd like me to work in. Tell me the project, then the skill, then what you'd like - for example, 'Homegrid, plan, add rate limiting.'",
        projects: allProjects,
      });
    }

    const currentRegistry = await refreshSkills(); // ensure fresh skills
    const resolved = resolveSkill(remainingTranscript, currentRegistry);
    const skill = resolved?.entry ?? {
      id: 'ask',
      aliases: [],
      type: 'workflow',
      workflow: 'ask',
      writes: false,
    };

    const prompt = resolved?.prompt ?? remainingTranscript;
    const cwd = matchedProject.path;
    const backend = pickBackend(backendId);

    if (!skill.writes) {
      const result = await backend.ask({ prompt, cwd, skill });
      return res.json({
        kind: 'answer',
        skill: skill.id,
        backend: backend.id,
        projectName: matchedProject.name,
        ...result,
      });
    } else {
      if (!backend.writesSupported) {
        return res.status(400).json({
          error: `backend '${backend.id}' is read-only; use a read-only skill`,
        });
      }

      const r = await backend.propose({ prompt, cwd, skill });
      if (!r.ok) return res.status(500).json(r);

      const id = crypto.randomUUID();
      proposals.set(id, {
        id,
        createdAt: Date.now(),
        backendId: backend.id,
        skillId: skill.id,
        prompt,
        cwd,
        summary: r.summary,
        status: 'proposed',
      });

      return res.json({
        kind: 'proposal',
        proposalId: id,
        projectName: matchedProject.name,
        skill: skill.id,
        backend: backend.id,
        summary: r.summary,
        plan: r.diffPreview,
      });
    }
  } catch (err) {
    next(err);
  }
});

// GATE step 2: apply. Requires a matching proposalId AND explicit approve:true. No other path writes.
app.post('/apply', async (req, res, next) => {
  try {
    const { proposalId, approve } = req.body ?? {};
    const p = proposalId && proposals.get(proposalId);
    if (!p)
      return res.status(404).json({ error: 'unknown or expired proposalId' });
    if (p.status !== 'proposed')
      return res.status(409).json({ error: `proposal already ${p.status}` });

    if (approve !== true) {
      p.status = 'rejected';
      return res.json({ proposalId, status: 'rejected' });
    }
    const backend = pickBackend(p.backendId);
    const skill = registry.find((s) => s.id === p.skillId)!;
    p.status = 'approved';
    const result = await backend.apply({ prompt: p.prompt, cwd: p.cwd, skill });
    p.status = result.ok ? 'applied' : 'proposed'; // leave re-approvable on failure
    res.json({ proposalId, status: p.status, ...result });
  } catch (err) {
    next(err);
  }
});

// Global error handler for human-readable errors, no raw stack traces
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

buildBackends().then(async (b) => {
  backends = b;
  if (process.env.NODE_ENV !== 'test') {
    // Refresh projects synchronously before boot log
    refreshProjects();
    await refreshSkills();

    // Detect backends for structured log
    const detectedBackends = await Promise.all(
      backends.map(async (bk) => {
        const d = await bk.detect();
        return d.detected ? bk.label : null;
      })
    );
    const activeBackendsStr = detectedBackends.filter(Boolean).join(', ');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 voice-relay started on :${PORT}`);
      console.log(`📁 Roots: ${process.env.PROJECT_ROOTS || 'none'}`);
      console.log(`📦 Projects found: ${getProjects().length}`);
      console.log(`🛠️  Skills loaded: ${registry.length}`);
      console.log(`🤖 Backends active: ${activeBackendsStr || 'None'}\n`);
    });
  }
});
