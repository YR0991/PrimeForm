/**
 * Server-side OAuth state store for Strava connect flow.
 * Binds cryptographically random state to uid; one-time use, 10 min expiry.
 * Callback must resolve uid only via consumeState(); never trust query/body uid.
 */

const crypto = require('crypto');

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const STATE_BYTES = 32;

/** @type {Map<string, { uid: string, createdAt: number }>} */
const store = new Map();

/**
 * Generate a new state and bind it to uid. Store for later consumption in callback.
 * @param {string} uid - Firebase uid (from req.user.uid)
 * @param {{ createdAt?: number }} [opts] - Optional; createdAt for testing (e.g. backdated for expiry)
 * @returns {string} state - Random hex string to pass to Strava as state param
 */
function createState(uid, opts = {}) {
  const state = crypto.randomBytes(STATE_BYTES).toString('hex');
  store.set(state, { uid: String(uid), createdAt: opts.createdAt ?? Date.now() });
  return state;
}

/**
 * Consume state: validate, check expiry, delete (one-time use), return uid.
 * @param {string} [state] - state from callback query
 * @returns {{ uid: string } | { error: 'missing' | 'invalid' | 'expired' | 'reused' }}
 */
function consumeState(state) {
  if (!state || typeof state !== 'string') {
    return { error: 'missing' };
  }
  const trimmed = state.trim();
  if (!trimmed) return { error: 'missing' };

  const entry = store.get(trimmed);
  if (!entry) {
    return { error: 'invalid' }; // unknown state or already consumed (reused)
  }

  store.delete(trimmed); // one-time use: remove before returning

  if (Date.now() - entry.createdAt > STATE_TTL_MS) {
    return { error: 'expired' };
  }

  return { uid: entry.uid };
}

/**
 * Remove expired entries (call periodically if desired; consumeState also removes on use).
 */
function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.createdAt > STATE_TTL_MS) store.delete(key);
  }
}

module.exports = { createState, consumeState, pruneExpired, STATE_TTL_MS };
