/**
 * Port of scripts/fraktion_analys.py
 * Source: Sheet5 — all columns per fraction per month
 */

export function analyzeFraktioner(parsedFiles) {
  const rows = []

  for (const file of parsedFiles) {
    const { monthNum, sortKey, month, sheets } = file
    for (const row of sheets.sheet5) {
      const emptyings = row.emptyings || 0
      const kWh = row.kWh || 0
      const kwhPerEmpty = emptyings > 0 ? Math.round((kWh / emptyings) * 1000) / 1000 : null

      rows.push({
        monthNum,
        sortKey,
        month,
        fraction: row.fraction,
        hoursHighFill: row.hours != null ? Math.round(row.hours * 100) / 100 : null,
        kWh: Math.round(kWh * 10) / 10,
        emptyings: Math.round(emptyings),
        emptyingPerMinute: row.emptyingPerMinute != null ? Math.round(row.emptyingPerMinute * 10000) / 10000 : null,
        kWhPerEmptying: kwhPerEmpty,
      })
    }
  }

  const fractions = [...new Set(rows.map(r => r.fraction))].sort()

  // Seasonal analysis per fraction
  const seasonal = {}
  for (const frac of fractions) {
    const fracRows = rows.filter(r => r.fraction === frac)
    const h1 = fracRows.filter(r => r.monthNum <= 6)
    const h2 = fracRows.filter(r => r.monthNum > 6)
    const summer = fracRows.filter(r => [6, 7, 8].includes(r.monthNum))
    const winter = fracRows.filter(r => [12, 1, 2].includes(r.monthNum))

    const h1Tot = h1.reduce((s, r) => s + r.emptyings, 0)
    const h2Tot = h2.reduce((s, r) => s + r.emptyings, 0)
    const variation = Math.max(h1Tot, h2Tot, 1) > 0
      ? Math.round(Math.abs(h1Tot - h2Tot) / Math.max(h1Tot, h2Tot, 1) * 1000) / 10
      : 0

    seasonal[frac] = {
      h1Emptyings: h1Tot,
      h2Emptyings: h2Tot,
      halfYearVariation: variation,
      summerAvg: summer.length > 0 ? Math.round(summer.reduce((s, r) => s + r.emptyings, 0) / summer.length) : 0,
      winterAvg: winter.length > 0 ? Math.round(winter.reduce((s, r) => s + r.emptyings, 0) / winter.length) : 0,
    }
  }

  // Fill analysis
  const fillAnalysis = {}
  for (const frac of fractions) {
    const fracRows = rows.filter(r => r.fraction === frac)
    const hours = fracRows.map(r => r.hoursHighFill).filter(h => h != null)
    if (hours.length === 0) continue

    const maxIdx = hours.indexOf(Math.max(...hours))
    const maxRow = fracRows.filter(r => r.hoursHighFill != null)[maxIdx]

    fillAnalysis[frac] = {
      mean: Math.round(avg(hours) * 100) / 100,
      max: Math.round(Math.max(...hours) * 100) / 100,
      min: Math.round(Math.min(...hours) * 100) / 100,
      topMonth: maxRow ? maxRow.month : '?',
    }
  }

  // Throughput analysis
  const throughput = {}
  for (const frac of fractions) {
    const epm = rows.filter(r => r.fraction === frac && r.emptyingPerMinute != null).map(r => r.emptyingPerMinute)
    if (epm.length === 0) continue
    throughput[frac] = {
      mean: Math.round(avg(epm) * 10000) / 10000,
      min: Math.round(Math.min(...epm) * 10000) / 10000,
      max: Math.round(Math.max(...epm) * 10000) / 10000,
    }
  }

  return {
    rows,
    fractions,
    seasonal,
    fillAnalysis,
    throughput,
  }
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
