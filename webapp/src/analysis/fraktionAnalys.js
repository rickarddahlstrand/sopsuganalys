/**
 * Fraktionsanalys.
 *
 * Sources:
 *   - monthlyHistory: kombinerad historik med perFraction per manad
 *   - parsedFiles[].sheets.sheet5.fractions: per-fil summa (anvand bara for emptyingPerMinute-snitt om historiken saknar det)
 */

import { splitByHalfPeriod } from '../utils/halfPeriod'

export function analyzeFraktioner(parsedFiles, monthlyHistory) {
  const history = monthlyHistory || []
  const rows = []

  // Bygg en lookup over emptyingPerMinute per fraktion fran per-fil summan (Sheet5 R4-R6).
  // Det ar inte per-manad i historiken men ar samma fraktions effektivitet for filens manad.
  const epmByFracMonth = {}
  for (const file of parsedFiles || []) {
    const fracs = file.sheets?.sheet5?.fractions || []
    for (const f of fracs) {
      // Vi kanner inte exakt vilken manad summan motsvarar — det ar filens rapportmanad.
      const key = `${f.fraction}|${file.sortKey}`
      epmByFracMonth[key] = f.emptyingPerMinute
    }
  }

  for (const m of history) {
    for (const [frac, data] of Object.entries(m.perFraction || {})) {
      const emptyings = Math.round(data.emptyings || 0)
      const kWh = data.energy || 0
      const hours = data.hours
      const kwhPerEmpty = emptyings > 0 ? Math.round((kWh / emptyings) * 1000) / 1000 : null
      const epmKey = `${frac}|${m.sortKey}`
      const epm = epmByFracMonth[epmKey] ?? null

      rows.push({
        monthNum: m.monthNum,
        sortKey: m.sortKey,
        month: m.month,
        fraction: frac,
        hoursHighFill: hours != null ? Math.round(hours * 100) / 100 : null,
        kWh: Math.round(kWh * 10) / 10,
        emptyings,
        emptyingPerMinute: epm != null ? Math.round(epm * 10000) / 10000 : null,
        kWhPerEmptying: kwhPerEmpty,
      })
    }
  }

  const fractions = [...new Set(rows.map(r => r.fraction))].sort()

  const seasonal = {}
  for (const frac of fractions) {
    const fracRows = rows.filter(r => r.fraction === frac)
    const { h1, h2 } = splitByHalfPeriod(fracRows)
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

  const fillAnalysis = {}
  for (const frac of fractions) {
    const filled = rows.filter(r => r.fraction === frac && r.hoursHighFill != null)
    if (filled.length === 0) continue

    const hours = filled.map(r => r.hoursHighFill)
    const maxRow = filled.reduce((best, r) => r.hoursHighFill > best.hoursHighFill ? r : best, filled[0])

    fillAnalysis[frac] = {
      mean: Math.round(avg(hours) * 100) / 100,
      max: Math.round(Math.max(...hours) * 100) / 100,
      min: Math.round(Math.min(...hours) * 100) / 100,
      topMonth: maxRow.month,
    }
  }

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
