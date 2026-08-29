import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  abortedRequests,
  activeProcesses,
  buildBackends,
  killProcess,
} from './backends.js';
import { getProjects, refreshProjects, resolveProject } from './projects.js';
import { buildRegistry, resolveSkill } from './registry.js';
import type { AgentBackend, Proposal, SkillEntry } from './types.js';

// Ensure the necessary environment variables are set up.
if (!fs.existsSync('.env')) {
  console.error(
    'Missing .env file. Please copy .env.example to .env and configure it.'
  );
  process.exit(1);
}

const PORT = Number(process.env.PORT || 4601);
const TOKEN = process.env.RELAY_TOKEN;
if (!TOKEN || TOKEN === 'changeme-shared-token') {
  console.error('RELAY_TOKEN is missing or invalid in .env');
  process.exit(1);
}

/** In-memory cache of available skills loaded from the registry */
let registry: SkillEntry[] = [];

/**
 * Reloads the skill registry from the configured sources.
 * @returns A promise resolving to the updated list of skills.
 */
export async function refreshSkills() {
  registry = await buildRegistry();
  return registry;
}

/** List of active backends capable of handling commands */
let backends: AgentBackend[] = [];
let _mockBackends: AgentBackend[] | null = null;

/**
 * Injects mock backends for testing purposes.
 * @param mocks - The mock backends to use, or null to clear them.
 */
export function __setMockBackends(mocks: AgentBackend[] | null) {
  _mockBackends = mocks;
}

/** In-memory store for tracking command proposals awaiting user approval */
export const proposals = new Map<string, Proposal>();

/**
 * Selects the appropriate backend for a given request.
 * Falls back to PREFERRED_BACKEND environment variable or the first non-local backend.
 *
 * @param id - Optional explicit backend ID to use.
 * @returns The selected AgentBackend instance.
 */
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

/**
 * Simple shared-token authentication middleware.
 * Ensures that only clients (e.g., the mobile app) with the correct x-relay-token can access the API.
 * The /health endpoint is exempt from authentication.
 */
// simple shared-token auth (LAN / Tailscale only; the phone holds no vendor secrets, just this token)
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (req.header('x-relay-token') !== TOKEN)
    return res.status(401).json({ error: 'bad token' });
  next();
});

/** Health check endpoint. */
app.get('/health', (_req, res) => res.json({ ok: true }));

/**
 * Retrieves the currently active backend and a list of all detected, available backends.
 * What the codebase agent resolves to right now — the app shows this on the mode switch.
 */
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

/** Retrieves the current list of skills. */
app.get('/skills', async (_req, res) =>
  res.json({ skills: await refreshSkills() })
);

/** Force-refreshes the list of skills. */
app.post('/skills/refresh', async (_req, res) =>
  res.json({ skills: await refreshSkills() })
);

/** Retrieves the list of available projects. */
app.get('/projects', (_req, res) => res.json(refreshProjects()));

/** Force-refreshes the list of projects. */
app.post('/projects/refresh', (_req, res) => res.json(refreshProjects()));

/**
 * GATE step 1: command pipeline (unified)
 * Receives a natural language transcript and orchestrates its execution.
 * It resolves the target project, matches the intent to a skill, and delegates to the active backend.
 */
app.post('/command', async (req, res, next) => {
  try {
    const {
      transcript,
      projectId: explicitProjectId,
      backend: backendId,
      requestId,
      mode,
    } = req.body ?? {};

    console.log(
      `\n[Relay] /command received (requestId: ${requestId}) | transcript: ${transcript}`
    );

    // Prevent multiple requests with the same requestId from processing simultaneously
    if (requestId && activeProcesses.has(requestId)) {
      return res.status(409).json({ error: 'duplicate active requestId' });
    }

    // Handle early client disconnections by aborting the underlying process
    req.on('close', () => {
      console.log(
        `[Relay] HTTP connection closed by client (requestId: ${requestId})`
      );
      if (requestId) {
        abortedRequests.add(requestId);
        killProcess(requestId);
        // Clean up the aborted request record after 10 minutes to prevent memory leaks
        setTimeout(() => abortedRequests.delete(requestId), 10 * 60 * 1000);
      }
    });

    if (!transcript)
      return res.status(400).json({ error: 'transcript is required' });

    const isIrisMode = mode === 'iris' || explicitProjectId === 'iris';

    // If IRIS mode is enabled, skip project/skill resolution and talk directly to the agent
    if (isIrisMode) {
      const backend = pickBackend(backendId);

      // Check if the client disconnected before we could even start
      if (requestId && abortedRequests.has(requestId)) {
        return res
          .status(499)
          .json({ error: 'Request aborted by client before execution' });
      }

      const cwd = process.cwd();

      // Send a heartbeat space character every 15s to keep the connection alive
      // while the potentially long-running LLM inference completes
      res.setHeader('Content-Type', 'application/json');
      const heartbeatInterval = setInterval(() => res.write(' '), 15000);

      try {
        const result = await backend.ask({
          prompt: transcript,
          cwd,
          requestId,
        });
        clearInterval(heartbeatInterval);

        res.write(
          JSON.stringify({
            kind: 'answer',
            backend: backend.id,
            projectName: 'I.R.I.S',
            projectPath: cwd,
            ...result,
          })
        );
        return res.end();
      } catch (err: any) {
        clearInterval(heartbeatInterval);
        res.write(
          JSON.stringify({
            kind: 'error',
            error: err.message || 'Internal error',
          })
        );
        return res.end();
      }
    }

    // Ensure we are working with the latest projects and resolve which one the user is referring to
    const allProjects = refreshProjects(); // ensure fresh projects
    const projectResult = resolveProject(
      transcript,
      explicitProjectId,
      allProjects
    );

    // If ambiguous or no project is found, prompt the client for clarification
    if (projectResult.kind === 'need-project') {
      return res.json({
        kind: 'need-project',
        message: projectResult.message,
        projects: projectResult.projects,
      });
    }

    const matchedProject = projectResult.project!;
    const remainingTranscript = projectResult.remainingTranscript!;

    // Resolve which skill (workflow) best matches the user's remaining transcript
    const currentRegistry = await refreshSkills(); // ensure fresh skills
    const resolved = resolveSkill(remainingTranscript, currentRegistry);

    // Fallback to basic 'ask' workflow if no specific skill matches
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

    // Read-only skills are executed immediately without proposing a plan
    if (!skill.writes) {
      if (requestId && abortedRequests.has(requestId)) {
        return res
          .status(499)
          .json({ error: 'Request aborted by client before execution' });
      }

      // Keep the connection open during long execution
      res.setHeader('Content-Type', 'application/json');
      const heartbeatInterval = setInterval(() => res.write(' '), 15000);

      try {
        const result = await backend.ask({ prompt, cwd, skill, requestId });
        clearInterval(heartbeatInterval);

        res.write(
          JSON.stringify({
            kind: 'answer',
            skill: skill.id,
            backend: backend.id,
            projectName: matchedProject.name,
            projectPath: matchedProject.path,
            ...result,
          })
        );
        return res.end();
      } catch (err: any) {
        clearInterval(heartbeatInterval);
        res.write(
          JSON.stringify({
            kind: 'error',
            error: err.message || 'Internal error',
          })
        );
        return res.end();
      }
    } else {
      // For skills that modify the codebase, we first generate a proposal (plan)
      if (!backend.writesSupported) {
        return res.status(400).json({
          error: `backend '${backend.id}' is read-only; use a read-only skill`,
        });
      }

      if (requestId && abortedRequests.has(requestId)) {
        return res
          .status(499)
          .json({ error: 'Request aborted by client before execution' });
      }

      // Keep the connection open during proposal generation
      res.setHeader('Content-Type', 'application/json');
      const heartbeatInterval = setInterval(() => res.write(' '), 15000);

      try {
        // Ask the backend to draft a proposal based on the prompt
        const r = await backend.propose({ prompt, cwd, skill, requestId });
        clearInterval(heartbeatInterval);

        if (!r.ok) {
          res.write(
            JSON.stringify({
              kind: 'error',
              error: (r as any).error || 'Proposal failed',
              ...r,
            })
          );
          return res.end();
        }

        // Store the proposal in memory so it can be approved/applied later
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

        res.write(
          JSON.stringify({
            kind: 'proposal',
            proposalId: id,
            projectName: matchedProject.name,
            projectPath: matchedProject.path,
            skill: skill.id,
            backend: backend.id,
            summary: r.summary,
            plan: r.diffPreview,
          })
        );
        return res.end();
      } catch (err: any) {
        clearInterval(heartbeatInterval);
        res.write(
          JSON.stringify({
            kind: 'error',
            error: err.message || 'Internal error',
          })
        );
        return res.end();
      }
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GATE step 2: apply.
 * Requires a valid proposalId AND explicit approve:true from the client.
 * No other path performs writes to the codebase.
 */
app.post('/apply', async (req, res, next) => {
  try {
    const { proposalId, approve } = req.body ?? {};
    const p = proposalId && proposals.get(proposalId);

    // Ensure the proposal exists and hasn't expired/cleared from memory
    if (!p)
      return res.status(404).json({ error: 'unknown or expired proposalId' });

    // Only allow applying proposals that are still in the 'proposed' state
    if (p.status !== 'proposed')
      return res.status(409).json({ error: `proposal already ${p.status}` });

    if (approve !== true) {
      p.status = 'rejected';
      return res.json({ proposalId, status: 'rejected' });
    }

    // Execute the approved plan via the backend
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

/**
 * Cancels an ongoing request by killing its associated backend process.
 */
app.post('/cancel', (req, res) => {
  const { requestId } = req.body ?? {};
  if (requestId) {
    killProcess(requestId);
    return res.json({ ok: true });
  }
  return res.status(400).json({ error: 'requestId required' });
});

/**
 * Global error handler for human-readable errors, no raw stack traces exposed to client.
 */
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
);

/**
 * Initialize backends and start the Express server.
 */
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
