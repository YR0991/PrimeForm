/**
 * Profile completeness and cycleData normalization.
 * Canonical key: cycleData.lastPeriodDate (ISO YYYY-MM-DD).
 */

/** Normalize cycleData: if lastPeriod set and lastPeriodDate missing, copy; then remove lastPeriod. */
function normalizeCycleData(cycleData) {
  if (!cycleData || typeof cycleData !== 'object') return cycleData;
  const next = { ...cycleData };
  if (next.lastPeriod != null && next.lastPeriodDate == null) {
    next.lastPeriodDate = typeof next.lastPeriod === 'string' ? next.lastPeriod : String(next.lastPeriod);
  }
  if (Object.prototype.hasOwnProperty.call(next, 'lastPeriod')) delete next.lastPeriod;
  return next;
}

/** Profile is complete when all required fields are present and valid. Uses cycleData.lastPeriodDate only. */
function isProfileComplete(profile) {
  if (!profile || typeof profile !== 'object') return false;

  const fullNameOk = typeof profile.fullName === 'string' && profile.fullName.trim().length >= 2;
  const emailOk = typeof profile.email === 'string' && profile.email.includes('@');
  const birthDateOk = typeof profile.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate);
  const disclaimerOk = profile.disclaimerAccepted === true;

  const redFlags = Array.isArray(profile.redFlags) ? profile.redFlags : [];
  const redFlagsOk = redFlags.length === 0;

  const goalsOk = Array.isArray(profile.goals) && profile.goals.length > 0 && profile.goals.length <= 2;

  const programmingTypeOk =
    typeof profile.programmingType === 'string' && profile.programmingType.trim().length > 0;

  const cycleData = profile.cycleData && typeof profile.cycleData === 'object' ? profile.cycleData : null;
  const cycleLastPeriodOk =
    cycleData && typeof cycleData.lastPeriodDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cycleData.lastPeriodDate);
  const cycleAvgOk = cycleData && Number.isFinite(Number(cycleData.avgDuration)) && Number(cycleData.avgDuration) >= 21;
  const contraceptionOk =
    cycleData && typeof cycleData.contraception === 'string' && cycleData.contraception.trim().length > 0;

  return (
    fullNameOk &&
    emailOk &&
    birthDateOk &&
    disclaimerOk &&
    redFlagsOk &&
    goalsOk &&
    programmingTypeOk &&
    cycleLastPeriodOk &&
    cycleAvgOk &&
    contraceptionOk
  );
}

module.exports = { isProfileComplete, normalizeCycleData };
