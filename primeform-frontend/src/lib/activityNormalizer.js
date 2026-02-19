/**
 * Single normalizer for activity rows (athlete dashboard + coach deep dive).
 * Ensures primeLoad, rawLoad, date, type are consistently derived from snake_case and camelCase.
 */
export function normalizeActivity(a) {
  if (!a || typeof a !== 'object') {
    return { primeLoad: null, rawLoad: null, date: null, type: 'Workout', _primeLoad: null, loadUsed: null }
  }
  const primeLoad =
    a.prime_load != null && Number.isFinite(Number(a.prime_load))
      ? Number(a.prime_load)
      : a.loadUsed != null && Number.isFinite(Number(a.loadUsed))
        ? Number(a.loadUsed)
        : a._primeLoad != null && Number.isFinite(Number(a._primeLoad))
          ? Number(a._primeLoad)
          : a.primeLoad != null && Number.isFinite(Number(a.primeLoad))
            ? Number(a.primeLoad)
            : null
  const rawLoad =
    a.load != null && Number.isFinite(Number(a.load))
      ? Number(a.load)
      : a.suffer_score != null && Number.isFinite(Number(a.suffer_score))
        ? Number(a.suffer_score)
        : a.loadRaw != null && Number.isFinite(Number(a.loadRaw))
          ? Number(a.loadRaw)
          : a._rawLoad != null && Number.isFinite(Number(a._rawLoad))
            ? Number(a._rawLoad)
            : null
  let date = a.date
  if (date == null || (typeof date === 'string' && date.length < 10)) {
    const local = a.start_date_local
    const start = a.start_date
    date = typeof local === 'string' && local.length >= 10
      ? local.slice(0, 10)
      : typeof start === 'string' && start.length >= 10
        ? start.slice(0, 10)
        : a.dayKey != null && String(a.dayKey).length >= 10
          ? String(a.dayKey).slice(0, 10)
          : null
  }
  if (date != null && typeof date !== 'string') {
    if (typeof date.toISOString === 'function') date = date.toISOString().slice(0, 10)
    else if (typeof date.toDate === 'function') date = date.toDate().toISOString().slice(0, 10)
    else date = null
  }
  if (date != null && typeof date === 'string' && date.length > 10) date = date.slice(0, 10)
  const type = a.type != null && a.type !== '' ? String(a.type) : 'Workout'
  const _primeLoad = primeLoad
  const loadUsed = primeLoad
  return {
    ...a,
    primeLoad,
    rawLoad,
    date,
    type,
    _primeLoad,
    loadUsed: loadUsed ?? a.loadUsed ?? a._primeLoad ?? a.prime_load ?? null,
  }
}

export function normalizeActivities(list) {
  return (Array.isArray(list) ? list : []).map(normalizeActivity)
}
