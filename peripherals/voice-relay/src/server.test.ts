import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app, proposals } from './server.js';
import crypto from 'node:crypto';
import type { Proposal } from './types.js';

const TOKEN = process.env.RELAY_TOKEN!;

test('POST /apply refuses if proposalId is missing or unknown', async () => {
  const res = await request(app)
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

  const res = await request(app)
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

  const res = await request(app)
    .post('/apply')
    .set('x-relay-token', TOKEN)
    .send({ proposalId: id, approve: true });
    
  assert.strictEqual(res.status, 409);
  assert.match(res.body.error, /proposal already rejected/);
});
