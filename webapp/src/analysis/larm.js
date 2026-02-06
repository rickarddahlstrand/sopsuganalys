/**
 * Port of scripts/larm.py
 * Source: Sheet13 (alarm categories per month)
 */

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

  // Monthly totals
  const monthlyMap = {}
  for (const a of alarms) {
    if (!monthlyMap[a.sortKey]) monthlyMap[a.sortKey] = { monthNum: a.monthNum, sortKey: a.sortKey, month: a.month, total: 0, categories: {} }
    monthlyMap[a.sortKey].total += a.currentPeriod
    monthlyMap[a.sortKey].categories[a.category] = (monthlyMap[a.sortKey].categories[a.category] || 0) + a.currentPeriod
  }
  const monthlyTotals = Object.values(monthlyMap).sort((a, b) => a.sortKey - b.sortKey)

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

  // H1 vs H2
  const h1 = monthlyTotals.filter(m => m.monthNum <= 6)
  const h2 = monthlyTotals.filter(m => m.monthNum > 6)
  const h1Avg = h1.length > 0 ? h1.reduce((s, m) => s + m.total, 0) / h1.length : 0
  const h2Avg = h2.length > 0 ? h2.reduce((s, m) => s + m.total, 0) / h2.length : 0

  let trend = 'stabil'
  if (h2Avg > h1Avg * 1.1) trend = 'ökande'
  else if (h2Avg < h1Avg * 0.9) trend = 'minskande'

  return {
    alarms,
    categories,
    monthlyTotals,
    categoryTotals,
    prevMonthly,
    totalAlarms,
    h1Avg: Math.round(h1Avg),
    h2Avg: Math.round(h2Avg),
    trend,
  }
}
