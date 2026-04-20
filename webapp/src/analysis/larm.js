/**
 * Port of scripts/larm.py
 * Source: Sheet13 (alarm categories per month)
 */

import { splitByHalfPeriod } from '../utils/halfPeriod'

/**
 * Avgör om en kategori räknas som en "stopp/kritisk" kategori.
 * Inkluderar alla kategorier som Mari räknar som driftkritiska:
 *   - Innehåller "stop" (case-insensitive) → t.ex. "Total stop", "Critical stop", "General stop"
 *   - Matchar exakt de förkortade varianterna som faktiskt finns i datan:
 *     "Critical" (motsvarar Critical stop), "General" (motsvarar General stop),
 *     "Emergency & Safety" (motsvarar Emergency & safety stop).
 *
 * Från verklig data (Sheet13, HammarbyGard 2025):
 *   Kategorier med värden: "Total stop", "Critical", "General".
 *   (Emergency & Safety finns som rubrik men saknar värden i Current period-kolumnen.)
 */
function isStopCategory(category) {
  if (!category) return false
  const c = String(category).toLowerCase()
  if (c.includes('stop')) return true
  if (c === 'critical') return true
  if (c === 'general') return true
  if (c.includes('emergency')) return true
  if (c.includes('safety')) return true
  return false
}

export function analyzeLarm(parsedFiles) {
  const alarms = []

  for (const file of parsedFiles) {
    const { monthNum, sortKey, month, sheets } = file

    for (const row of sheets.sheet13) {
      alarms.push({
        monthNum,
        sortKey,
        month,
        category: row.category,
        currentPeriod: Math.round(row.currentPeriod),
        previousAvg: row.previousAvg != null ? Math.round(row.previousAvg * 10) / 10 : null,
      })
    }
  }

  // Categories
  const categories = [...new Set(alarms.map(a => a.category))]

  // Stopp-kategorier (driftkritiska)
  const stopCategories = categories.filter(isStopCategory)

  // Monthly totals
  const monthlyMap = {}
  for (const a of alarms) {
    if (!monthlyMap[a.sortKey]) monthlyMap[a.sortKey] = { monthNum: a.monthNum, sortKey: a.sortKey, month: a.month, total: 0, categories: {} }
    monthlyMap[a.sortKey].total += a.currentPeriod
    monthlyMap[a.sortKey].categories[a.category] = (monthlyMap[a.sortKey].categories[a.category] || 0) + a.currentPeriod
  }
  const monthlyTotals = Object.values(monthlyMap).sort((a, b) => a.sortKey - b.sortKey)

  // Summa av stopp-kategorier per månad
  const stopCategoriesMonthly = monthlyTotals.map(m => {
    let stopSum = 0
    for (const cat of stopCategories) {
      stopSum += m.categories[cat] || 0
    }
    return {
      monthNum: m.monthNum,
      sortKey: m.sortKey,
      month: m.month,
      stopTotal: stopSum,
    }
  })

  // Category totals for the year
  const categoryTotals = {}
  for (const a of alarms) {
    categoryTotals[a.category] = (categoryTotals[a.category] || 0) + a.currentPeriod
  }

  // Previous year comparison (monthly) — keyed by sortKey for chart alignment
  const prevMonthly = {}
  for (const a of alarms) {
    if (a.previousAvg != null) {
      if (!prevMonthly[a.sortKey]) prevMonthly[a.sortKey] = 0
      prevMonthly[a.sortKey] += a.previousAvg
    }
  }

  // Total alarms
  const totalAlarms = alarms.reduce((s, a) => s + a.currentPeriod, 0)

  // H1 vs H2 — first half vs second half of uploaded period (chronological, not calendar).
  const { h1, h2 } = splitByHalfPeriod(monthlyTotals)
  const h1Avg = h1.length > 0 ? h1.reduce((s, m) => s + m.total, 0) / h1.length : 0
  const h2Avg = h2.length > 0 ? h2.reduce((s, m) => s + m.total, 0) / h2.length : 0

  let trend = 'stabil'
  if (h2Avg > h1Avg * 1.1) trend = 'ökande'
  else if (h2Avg < h1Avg * 0.9) trend = 'minskande'

  return {
    alarms,
    categories,
    stopCategories,
    monthlyTotals,
    stopCategoriesMonthly,
    categoryTotals,
    prevMonthly,
    totalAlarms,
    h1Avg: Math.round(h1Avg),
    h2Avg: Math.round(h2Avg),
    trend,
  }
}
