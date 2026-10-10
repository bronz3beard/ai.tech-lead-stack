import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  reclaim,
  releaseLock,
  tryAcquireLock,
  waitForLock,
} from '../../packages/core/src/install/lock.mjs';

let lock;

beforeEach(() => {
  lock = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'tls-lock-')),
    'refresh.lock'
  );
});

/** A pid that existed and has exited. */
function deadPid() {
  return spawnSync(process.execPath, ['-e', 'process.exit(0)']).pid;
}

const writeLock = (content) => fs.writeFileSync(lock, content);
const lockPid = () => JSON.parse(fs.readFileSync(lock, 'utf8')).pid;

describe('tryAcquireLock', () => {
  test('takes a free lock, and a second attempt is refused until release', async () => {
    const held = await tryAcquireLock(lock);
    assert.ok(held);
    assert.equal(lockPid(), process.pid);
    assert.equal(await tryAcquireLock(lock), null);
    await held.release();
    assert.ok(!fs.existsSync(lock));
    assert.ok(await tryAcquireLock(lock));
  });

  test('never takes over an old lock whose owner is still running', async () => {
    writeLock(
      JSON.stringify({ pid: process.ppid, at: '2020-01-01T00:00:00Z' })
    );
    const old = new Date('2020-01-01');
    fs.utimesSync(lock, old, old);
    assert.equal(await tryAcquireLock(lock), null);
    assert.equal(lockPid(), process.ppid);
  });

  test('takes over a lock whose owner has exited', async () => {
    writeLock(JSON.stringify({ pid: deadPid(), at: new Date().toISOString() }));
    assert.ok(await tryAcquireLock(lock));
    assert.equal(lockPid(), process.pid);
  });

  test('takes over an empty lock only once it is past the write grace period', async () => {
    writeLock('');
    assert.equal(await tryAcquireLock(lock), null, 'a writer may be mid-write');
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lock, old, old);
    assert.ok(await tryAcquireLock(lock));
  });

  test('two concurrent takeovers of a dead lock: exactly one wins', async () => {
    for (let run = 0; run < 20; run += 1) {
      fs.rmSync(lock, { force: true });
      writeLock(
        JSON.stringify({ pid: deadPid(), at: new Date().toISOString() })
      );
      const results = await Promise.all([
        tryAcquireLock(lock),
        tryAcquireLock(lock),
      ]);
      assert.equal(results.filter(Boolean).length, 1, `run ${run}`);
    }
  });
});

describe('reclaim (the takeover race)', () => {
  test('a late takeover never removes a fresh lock taken after its read', async () => {
    // B read this dead lock, then A reclaimed it and took a fresh one.
    const stale = JSON.stringify({ pid: deadPid(), token: 'old' });
    const fresh = await tryAcquireLock(lock);
    assert.ok(fresh);

    await reclaim(lock, stale); // B acts on its outdated read

    assert.ok(await fresh.verify(), "A's fresh lock must still be A's");
    assert.deepEqual(
      fs.readdirSync(path.dirname(lock)).sort(),
      ['refresh.lock'],
      'no claim file is left behind'
    );
  });

  test('a takeover of the lock it inspected removes it', async () => {
    const stale = JSON.stringify({ pid: deadPid(), token: 'old' });
    writeLock(stale);
    await reclaim(lock, stale);
    assert.ok(!fs.existsSync(lock));
  });
});

describe('releaseLock and verify', () => {
  test("never removes someone else's lock", async () => {
    writeLock(JSON.stringify({ pid: process.ppid, token: 'x', at: 'now' }));
    await releaseLock(lock, 'x');
    assert.ok(fs.existsSync(lock), "someone else's lock must stay");
  });

  test('a late release never removes a later lock of the same process', async () => {
    const first = await tryAcquireLock(lock);
    await first.release();
    const second = await tryAcquireLock(lock);
    await first.release(); // stale callback called again
    assert.ok(fs.existsSync(lock));
    assert.ok(await second.verify());
    assert.equal(await first.verify(), false);
  });

  test('a release racing a replacement lock leaves the replacement intact', async () => {
    const first = await tryAcquireLock(lock);
    // Between first's acquisition and its release, the lock was removed and
    // the same process took a new one (same pid, different token).
    fs.rmSync(lock);
    const second = await tryAcquireLock(lock);
    await first.release();
    assert.ok(await second.verify(), 'the replacement lock must survive');
    assert.deepEqual(fs.readdirSync(path.dirname(lock)), ['refresh.lock']);
  });
});

describe('waitForLock', () => {
  test('waits for the holder to release, telling the user once', async () => {
    const holder = await tryAcquireLock(lock);
    let told = 0;
    setTimeout(() => holder.release(), 300);
    const held = await waitForLock({ file: lock, onWait: () => (told += 1) });
    assert.ok(await held.verify());
    assert.equal(told, 1);
  });

  test('gives up with a clear error when the lock stays held', async () => {
    writeLock(JSON.stringify({ pid: process.ppid, token: 'x', at: 'now' }));
    await assert.rejects(
      waitForLock({ file: lock, timeoutMs: 300 }),
      new RegExp(`pid ${process.ppid}.*updating editor files`)
    );
  });
});
