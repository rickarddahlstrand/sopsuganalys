// Split uploaded months into first/second half chronologically.
// Uses sortKey (year*100 + monthNum) so multi-year spans work correctly —
// calendar-based monthNum <= 6 filtering breaks when data crosses year boundaries
// (e.g. Aug 2025 - Jul 2026: monthNum <= 6 would place Jan-Jun 2026 before Aug-Dec 2025).

export function halfPeriodCut(sortKeys) {
  const distinct = [...new Set(sortKeys)].sort((a, b) => a - b)
  if (distinct.length < 2) return null
  return distinct[Math.floor(distinct.length / 2)]
}

export function splitByHalfPeriod(rows, getSortKey = r => r.sortKey) {
  const cut = halfPeriodCut(rows.map(getSortKey))
  if (cut == null) return { h1: rows, h2: [] }
  return {
    h1: rows.filter(r => getSortKey(r) < cut),
    h2: rows.filter(r => getSortKey(r) >= cut),
  }
}
