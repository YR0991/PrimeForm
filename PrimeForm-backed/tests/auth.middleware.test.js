/**
 * Minimal smoke tests for auth middleware (requireUser, verifyIdToken).
 * Run: node tests/auth.middleware.test.js
 */

const assert = require('assert');
const { verifyIdToken, requireUser } = require('../middleware/auth');

function run(name, fn) {
  try {
    fn();
    console.log('  ok', name);
  } catch (err) {
    console.error('  FAIL', name, err.message);
    process.exitCode = 1;
  }
}

console.log('Auth middleware smoke tests\n');

run('requireUser returns 401 when req.user is missing', () => {
  const middleware = requireUser();
  const req = { user: undefined };
  const res = {
    statusCode: null,
    body: null,
    status(c) {
        this.statusCode = c;
        return this;
      },
    json(b) {
        this.body = b;
        return this;
      }
  };
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 401);
  assert.ok(res.body && res.body.error === 'Unauthorized');
  assert.strictEqual(nextCalled, false);
});

run('requireUser calls next when req.user.uid is set', () => {
  const middleware = requireUser();
  const req = { user: { uid: 'uid123' } };
  let nextCalled = false;
  middleware(req, {}, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

run('verifyIdToken(admin) returns a function', () => {
  const mockAdmin = { auth: () => ({ verifyIdToken: () => Promise.reject(new Error('bad')) }) };
  const middleware = verifyIdToken(mockAdmin);
  assert.strictEqual(typeof middleware, 'function');
});

run('verifyIdToken returns 401 when Authorization header is missing', (done) => {
  const mockAdmin = { auth: () => ({ verifyIdToken: () => Promise.resolve({ uid: 'u1' }) }) };
  const middleware = verifyIdToken(mockAdmin);
  const req = { headers: {} };
  const res = {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
  };
  middleware(req, res, () => {
    assert.strictEqual(res.statusCode, 401);
    assert.ok(res.body && res.body.error === 'Unauthorized');
    done();
  });
});

run('verifyIdToken returns 401 when Bearer token is invalid', (done) => {
  const mockAdmin = {
    auth: () => ({
      verifyIdToken: () => Promise.reject(Object.assign(new Error('invalid'), { code: 'auth/invalid' }))
    })
  };
  const middleware = verifyIdToken(mockAdmin);
  const req = { headers: { authorization: 'Bearer invalid-token' } };
  const res = {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
  };
  middleware(req, res, () => {
    assert.strictEqual(res.statusCode, 401);
    done();
  });
});

run('verifyIdToken sets req.user when token is valid', (done) => {
  const decoded = { uid: 'user123', email: 'u@example.com' };
  const mockAdmin = {
    auth: () => ({ verifyIdToken: () => Promise.resolve(decoded) })
  };
  const middleware = verifyIdToken(mockAdmin);
  const req = { headers: { authorization: 'Bearer valid-token' } };
  const res = {
    statusCode: null,
    status(c) { this.statusCode = c; return this; },
    json() { return this; }
  };
  middleware(req, res, () => {
    assert.strictEqual(req.user.uid, 'user123');
    assert.strictEqual(req.user.email, 'u@example.com');
    assert.ok(req.user.claims);
    done();
  });
});

console.log('\nDone.');
