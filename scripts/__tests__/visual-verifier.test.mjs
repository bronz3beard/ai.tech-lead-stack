import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectAuthWall } from '../visual-verifier.mjs';

describe('detectAuthWall', () => {
  it('should return false for benign path additions like /permits -> /permits/authored-by/me', async () => {
    const reason = await detectAuthWall({
      requestedUrl: 'http://localhost:3000/permits',
      finalUrl: 'http://localhost:3000/permits/authored-by/me',
      page: { locator: () => ({ count: async () => 0 }), evaluate: async () => false },
      httpStatus: 200
    });
    assert.strictEqual(reason, null);
  });

  it('should return false for query string additions', async () => {
    const reason = await detectAuthWall({
      requestedUrl: 'http://localhost:3000/admin',
      finalUrl: 'http://localhost:3000/admin?session=abc',
      page: { locator: () => ({ count: async () => 0 }), evaluate: async () => false },
      httpStatus: 200
    });
    assert.strictEqual(reason, null);
  });

  it('should return false for fragment additions', async () => {
    const reason = await detectAuthWall({
      requestedUrl: 'http://localhost:3000/tables',
      finalUrl: 'http://localhost:3000/tables#oauth-widget',
      page: { locator: () => ({ count: async () => 0 }), evaluate: async () => false },
      httpStatus: 200
    });
    assert.strictEqual(reason, null);
  });

  it('should return true for redirect to /login', async () => {
    const reason = await detectAuthWall({
      requestedUrl: 'http://localhost:3000/dashboard',
      finalUrl: 'http://localhost:3000/login',
      page: { locator: () => ({ count: async () => 0 }), evaluate: async () => false },
      httpStatus: 200
    });
    assert.strictEqual(reason, 'auth_wall');
  });

  it('should return true for SPA with DOM signal (password field)', async () => {
    const reason = await detectAuthWall({
      requestedUrl: 'http://localhost:3000/dashboard',
      finalUrl: 'http://localhost:3000/dashboard',
      page: { locator: () => ({ count: async () => 1 }), evaluate: async () => false },
      httpStatus: 200
    });
    assert.strictEqual(reason, 'auth_wall');
  });

  it('should return true for 403 HTTP status', async () => {
    const reason = await detectAuthWall({
      requestedUrl: 'http://localhost:3000/dashboard',
      finalUrl: 'http://localhost:3000/dashboard',
      page: { locator: () => ({ count: async () => 0 }), evaluate: async () => false },
      httpStatus: 403
    });
    assert.strictEqual(reason, 'auth_wall');
  });

  it('should return target_unreachable for 404', async () => {
    const reason = await detectAuthWall({
      requestedUrl: 'http://localhost:3000/dashboard',
      finalUrl: 'http://localhost:3000/dashboard',
      page: { locator: () => ({ count: async () => 0 }), evaluate: async () => false },
      httpStatus: 404
    });
    assert.strictEqual(reason, 'target_unreachable');
  });
});
