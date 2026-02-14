/**
 * Strava OAuth state store tests: missing, invalid, expired, reused state.
 * Run: node tests/stravaOAuth.state.test.js
 */

const assert = require('assert');

function freshStore() {
  delete require.cache[require.resolve('../services/stravaOAuthState')];
  return require('../services/stravaOAuthState');
}

function run(name, fn) {
  try {
    fn();
    console.log('  ok', name);
  } catch (err) {
    console.error('  FAIL', name, err.message);
    process.exitCode = 1;
  }
}

console.log('Strava OAuth state tests\n');

run('missing state returns error missing', () => {
  const { consumeState } = freshStore();
  const out = consumeState();
  assert.strictEqual(out.error, 'missing');
});

run('empty string state returns error missing', () => {
  const { consumeState } = freshStore();
  assert.strictEqual(consumeState('').error, 'missing');
  assert.strictEqual(consumeState('   ').error, 'missing');
});

run('invalid state returns error invalid', () => {
  const { consumeState } = freshStore();
  const out = consumeState('not-a-valid-state-never-stored');
  assert.strictEqual(out.error, 'invalid');
});

run('valid state returns uid and is one-time use (reused -> invalid)', () => {
  const store = freshStore();
  const state = store.createState('user-123');
  assert.ok(state && state.length === 64 && /^[a-f0-9]+$/.test(state));

  const first = store.consumeState(state);
  assert.strictEqual(first.uid, 'user-123');
  assert.strictEqual(first.error, undefined);

  const reused = store.consumeState(state);
  assert.strictEqual(reused.error, 'invalid');
});

run('expired state returns error expired', () => {
  const store = freshStore();
  const { STATE_TTL_MS } = store;
  const state = store.createState('user-456', {
    createdAt: Date.now() - STATE_TTL_MS - 1000
  });
  const out = store.consumeState(state);
  assert.strictEqual(out.error, 'expired');
});

console.log('\nDone.');
