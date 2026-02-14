/**
 * Low-frequency fallback: sync Strava activities for users with tokens whose last webhook was >12h ago.
 * Respects stravaBackoffUntil. Fetches only after lastStravaSyncedAt.
 * Run every 6h from server (setInterval).
 */

const stravaService = require('./stravaService');

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * @param {object} db - Firestore
 * @param {object} admin - firebase-admin
 * @returns {Promise<{ synced: number, skipped: number, errors: number }>}
 */
async function runStravaFallbackSync(db, admin) {
  if (!db) return { synced: 0, skipped: 0, errors: 0 };
  const now = Date.now();
  const cutoffWebhook = now - TWELVE_HOURS_MS;
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const usersSnap = await db.collection('users').where('strava.connected', '==', true).get();
    for (const doc of usersSnap.docs) {
      const uid = doc.id;
      const data = doc.data() || {};
          if (data.stravaBackoffUntil != null && Number(data.stravaBackoffUntil) > now) {
        skipped++;
        continue;
      }
      const lastWebhookAt = data.stravaLastWebhookAt;
      let webhookOldEnough = true;
      if (lastWebhookAt != null) {
        let ms = null;
        if (typeof lastWebhookAt.toMillis === 'function') ms = lastWebhookAt.toMillis();
        else if (typeof lastWebhookAt.toDate === 'function') ms = lastWebhookAt.toDate().getTime();
        else if (lastWebhookAt.seconds != null) ms = lastWebhookAt.seconds * 1000;
        if (ms != null && ms > cutoffWebhook) webhookOldEnough = false;
      }
      if (!webhookOldEnough) continue;

      const lastSyncedAt = data.lastStravaSyncedAt;
      let afterTimestamp = null;
      if (lastSyncedAt != null) {
        if (typeof lastSyncedAt.toMillis === 'function') afterTimestamp = lastSyncedAt.toMillis();
        else if (typeof lastSyncedAt.toDate === 'function') afterTimestamp = lastSyncedAt.toDate().getTime();
        else if (Number.isFinite(Number(lastSyncedAt))) afterTimestamp = Number(lastSyncedAt);
      }
      if (afterTimestamp == null) afterTimestamp = now - 30 * 24 * 60 * 60 * 1000;

      try {
        await stravaService.syncActivitiesAfter(uid, db, admin, { afterTimestamp });
        synced++;
      } catch (err) {
        console.warn('[STRAVA_FALLBACK]', uid, err.message);
        errors++;
      }
    }
  } catch (err) {
    console.error('[STRAVA_FALLBACK] job error:', err.message);
  }
  if (synced > 0 || errors > 0) {
    console.log(`[STRAVA_FALLBACK] synced=${synced} skipped=${skipped} errors=${errors}`);
  }
  return { synced, skipped, errors };
}

module.exports = { runStravaFallbackSync, SIX_HOURS_MS };
