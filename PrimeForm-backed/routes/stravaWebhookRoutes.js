/**
 * Strava Webhook routes — mounted at /webhooks/strava
 * - GET: subscription verification (hub.mode, hub.verify_token, hub.challenge)
 * - POST: event delivery; respond 200 immediately, process async
 */

const express = require('express');
const { handleStravaWebhookEvent } = require('../services/stravaWebhookService');

/**
 * @param {object} deps - { db, admin }
 * @returns {express.Router}
 */
function createStravaWebhookRouter(deps) {
  const router = express.Router();
  const { db, admin } = deps;

  const verifyToken = process.env.STRAVA_VERIFY_TOKEN;

  // GET /webhooks/strava — Strava subscription verification
  router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe' || !challenge) {
      return res.status(400).json({ error: 'Missing hub.mode or hub.challenge' });
    }
    if (!verifyToken || token !== verifyToken) {
      return res.status(403).json({ error: 'Invalid verify_token' });
    }
    res.status(200).json({ 'hub.challenge': challenge });
  });

  // POST /webhooks/strava — event delivery; acknowledge within 1–2s
  router.post('/', (req, res) => {
    res.status(200).end();

    if (!db || !admin) {
      console.warn('[STRAVA_WEBHOOK] db/admin not ready, skipping');
      return;
    }

    const payload = req.body;
    setImmediate(() => {
      handleStravaWebhookEvent({ db, admin, payload }).catch((err) => {
        console.error('[STRAVA_WEBHOOK] handler error:', err.message);
      });
    });
  });

  return router;
}

module.exports = { createStravaWebhookRouter };
