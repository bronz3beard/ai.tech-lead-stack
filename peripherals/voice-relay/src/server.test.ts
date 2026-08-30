import 'dotenv/config';
import test, { before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app, proposals, refreshSkills } from './server.js';
import crypto from 'node:crypto';
import http from 'node:http';
import type { Proposal } from './types.js';

const TOKEN = process.env.RELAY_TOKEN!;
const server = http.createServer(app);

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  await refreshSkills();
});

after(() => {
  server.close();
});

test('POST /apply refuses if proposalId is missing or unknown', async () => {

  const res = await request(server)
    .post('/apply')
    .set('x-relay-token', TOKEN)
    .send({ approve: true });
    
  assert.strictEqual(res.status, 404);
  assert.match(res.body.error, /unknown or expired proposalId/);
});

test('POST /apply refuses if approve is false', async () => {
  const id = crypto.randomUUID();
  proposals.set(id, {
    id,
    createdAt: Date.now(),
    backendId: 'local',
    skillId: 'dev-team',
    prompt: 'test prompt',
    cwd: '/tmp',
    summary: 'summary',
    status: 'proposed'
  });

  const res = await request(server)
    .post('/apply')
    .set('x-relay-token', TOKEN)
    .send({ proposalId: id, approve: false });
    
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'rejected');
  assert.strictEqual(proposals.get(id)?.status, 'rejected');
});

test('POST /apply refuses if proposal is not in proposed state', async () => {
  const id = crypto.randomUUID();
  proposals.set(id, {
    id,
    createdAt: Date.now(),
    backendId: 'local',
    skillId: 'dev-team',
    prompt: 'test prompt',
    cwd: '/tmp',
    summary: 'summary',
    status: 'rejected'
  });

  const res = await request(server)
    .post('/apply')
    .set('x-relay-token', TOKEN)
    .send({ proposalId: id, approve: true });
    
  assert.strictEqual(res.status, 409);
  assert.match(res.body.error, /proposal already rejected/);
});

// Mock projects and backends for /command testing
import { __setMockProjects } from './projects.js';
import { __setMockBackends } from './server.js';
import type { AgentBackend, AgentResult, ProposalResult, RunInput } from './types.js';

const mockBackend: AgentBackend = {
  id: 'mock',
  label: 'Mock Backend',
  writesSupported: true,
  detect: async () => ({ detected: true, authPath: 'none-local' }),
  ask: async (input: RunInput): Promise<AgentResult> => ({ ok: true, text: 'mock answer' }),
  propose: async (input: RunInput): Promise<ProposalResult> => ({ ok: true, text: 'mock diff', summary: 'mock summary', diffPreview: 'mock diff' }),
  apply: async (input: RunInput): Promise<AgentResult> => ({ ok: true, text: 'mock applied' }),
};

test('POST /command returns need-project guard when no project is matched', async () => {
  __setMockProjects([{ id: 'test-repo', path: '/tmp/test-repo', name: 'test repo', aliases: ['test'] }]);
  __setMockBackends([mockBackend]);
  
  const res = await request(server)
    .post('/command')
    .set('x-relay-token', TOKEN)
    .send({ transcript: 'do something random' });
    
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.kind, 'need-project');
  assert.ok(res.body.message.includes("I'm not sure which project"));
});

test('POST /command resolves project and defaults to ask skill (writes: false)', async () => {
  __setMockProjects([{ id: 'test-repo', path: '/tmp/test-repo', name: 'test repo', aliases: ['test'] }]);
  
  const res = await request(server)
    .post('/command')
    .set('x-relay-token', TOKEN)
    .send({ transcript: 'test repo how does the auth work' });
    
  assert.strictEqual(res.status, 200);
  // 'ask' goes through local backend which will just return an answer, but we mocked the backend or it will attempt to fetch local ollama
  // Since Ollama isn't running in CI, it should return an error gracefully
  assert.strictEqual(res.body.kind, 'answer');
  assert.strictEqual(res.body.projectName, 'test repo');
  assert.strictEqual(res.body.skill, 'ask');
  assert.ok('ok' in res.body); 
});

test('POST /command resolves write skill and generates a proposal', async () => {
  __setMockProjects([{ id: 'test-repo', path: '/tmp/test-repo', name: 'test repo', aliases: ['test'] }]);
  
  const res = await request(server)
    .post('/command')
    .set('x-relay-token', TOKEN)
    .send({ transcript: 'test repo dev team add a rate limiter' });
    
  assert.strictEqual(res.status, 200);
  // 'dev team' -> writes:true -> propose
  assert.strictEqual(res.body.kind, 'proposal');
  assert.ok(res.body.proposalId);
  assert.strictEqual(res.body.skill, 'dev-team');
  
  // Verify it was stored
  const stored = proposals.get(res.body.proposalId);
  assert.ok(stored);
  assert.strictEqual(stored.status, 'proposed');
});

test('POST /command with mode=iris bypasses project resolution', async () => {
  __setMockProjects([{ id: 'test-repo', path: '/tmp/test-repo', name: 'test repo', aliases: ['test'] }]);
  __setMockBackends([mockBackend]);

  const res = await request(server)
    .post('/command')
    .set('x-relay-token', TOKEN)
    .send({ transcript: 'how many weeks in a year', mode: 'iris' });
    
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.kind, 'answer');
  assert.strictEqual(res.body.projectName, 'I.R.I.S');
  assert.strictEqual(res.body.text, 'mock answer');
});
