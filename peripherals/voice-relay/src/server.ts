import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { buildBackends } from './backends.js';
import { getProjects, refreshProjects } from './projects.js';
import { buildRegistry, resolveSkill } from './registry.js';
import type { AgentBackend, Proposal } from './types.js';

if (!fs.existsSync('.env')) {
  console.error('Missing .env file. Please copy .env.example to .env and configure it.');
  process.exit(1);
}

const PORT = Number(process.env.PORT || 4599);
const TOKEN = process.env.RELAY_TOKEN;
if (!TOKEN || TOKEN === 'changeme-shared-token') {
  console.error('RELAY_TOKEN is missing or invalid in .env');
  process.exit(1);
}

const registry = buildRegistry();
let backends: AgentBackend[] = [];
const proposals = new Map<string, Proposal>();

function pickBackend(id?: string): AgentBackend {
  if (id) {
    const b = backends.find((x) => x.id === id);
    if (b) return b;
  }
  // default preference order: whatever the user is signed into, else local
  return backends.find((x) => x.id !== 'local') ?? backends[0];
}

const app = express();
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
  const active = pickBackend(process.env.PREFERRED_BACKEND);
  const activeInfo = detected.find((d) => d.id === active.id);
  res.json({ active: activeInfo, available: detected });
});

app.get('/skills', (_req, res) => res.json({ skills: registry }));
app.get('/projects', (_req, res) => res.json(getProjects()));
app.post('/projects/refresh', (_req, res) => res.json(refreshProjects()));

// Read-only path (writes:false skills, e.g. /ask): resolve, run, return spoken answer.
app.post('/ask', async (req, res) => {
  const { transcript, backend: backendId, cwd } = req.body ?? {};
  const resolved = resolveSkill(transcript ?? '', registry);
  const backend = pickBackend(backendId);
  const skill = resolved?.entry ?? {
    id: 'ask',
    aliases: [],
    type: 'workflow',
    workflow: 'ask',
    writes: false,
  };
  const prompt = resolved?.prompt ?? transcript ?? '';
  if (!cwd) return res.status(400).json({ error: 'cwd is required' });
  const result = await backend.ask({ prompt, cwd, skill });
  res.json({ skill: skill.id, backend: backend.id, ...result });
});

// GATE step 1: propose. For writes:true skills only. Runs plan-only; NEVER writes.
app.post('/propose', async (req, res) => {
  const { transcript, backend: backendId, cwd } = req.body ?? {};
  const resolved = resolveSkill(transcript ?? '', registry);
  if (!resolved)
    return res
      .status(400)
      .json({ error: 'could not resolve a skill from the transcript' });
  const backend = pickBackend(backendId);
  if (!backend.writesSupported)
    return res
      .status(400)
      .json({ error: `backend '${backend.id}' is read-only; use /ask` });

  if (!cwd) return res.status(400).json({ error: 'cwd is required' });
  const r = await backend.propose({
    prompt: resolved.prompt,
    cwd,
    skill: resolved.entry,
  });
  if (!r.ok) return res.status(500).json(r);

  const id = crypto.randomUUID();
  proposals.set(id, {
    id,
    createdAt: Date.now(),
    backendId: backend.id,
    skillId: resolved.entry.id,
    prompt: resolved.prompt,
    cwd,
    summary: r.summary,
    status: 'proposed',
  });
  res.json({
    proposalId: id,
    skill: resolved.entry.id,
    backend: backend.id,
    summary: r.summary,
    plan: r.diffPreview,
  });
});

// GATE step 2: apply. Requires a matching proposalId AND explicit approve:true. No other path writes.
app.post('/apply', async (req, res) => {
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
});

buildBackends().then((b) => {
  backends = b;
  app.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    let lanIp = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
    }
    console.log(`voice-relay on :${PORT} (token required) LAN URL: http://${lanIp}:${PORT}`);
    refreshProjects();
    console.log(`skills loaded: ${registry.length}  |  projects found: ${getProjects().length}`);
  });
});
