/**
 * Shared formatters for metric display. Backend-first: no calculation.
 */

/**
 * Format a metric value for display.
 * @param {*} value - Raw value (number, string, or null/undefined)
 * @param {number} decimals - Number of decimal places (default 0)
 * @returns {string} "—" if value is null, undefined, or NaN; otherwise number formatted with decimals
 */
export function formatMetric(value, decimals = 0) {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return n.toFixed(decimals)
}
