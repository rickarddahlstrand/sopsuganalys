/**
 * Port of scripts/manuell_analys.py
 * Sources: Sheet9 (commands), Sheet11 (availability), Sheet3 (operation time)
 */

import { linregress } from '../stats/linregress'
import { detectAnomalies } from '../stats/anomaly'
import { buildValveFractionMap, getValveFraction } from '../utils/valveFraction'

export function analyzeManuell(parsedFiles) {
  const manualData = []
  const fractionMap = buildValveFractionMap(parsedFiles)

  for (const file of parsedFiles) {
    const { monthNum, sortKey, month, sheets } = file

    // Build availability lookup from Sheet11
    const availLookup = {}
    for (const r11 of sheets.sheet11) {
      availLookup[r11.id] = r11.availability
    }

    // Sheet9: per-valve commands
    for (const r9 of sheets.sheet9) {
      const totalCmd = r9.manCmd + r9.autoCmd
      const { branch, valveNum } = parseValveId(r9.id)

      manualData.push({
        monthNum,
        sortKey,
        month,
        valveId: r9.id,
        branch,
        fraction: getValveFraction(r9.id, fractionMap),
        manCmd: r9.manCmd,
        autoCmd: r9.autoCmd,
        inletOpen: r9.inletOpen,
        totalCmd,
        manualPct: totalCmd > 0 ? Math.round(r9.manCmd / totalCmd * 10000) / 100 : 0,
        availability: availLookup[r9.id] ?? null,
      })
    }
  }

  // Collect operation time per month from Sheet3
  const operationTime = parsedFiles.map(f => ({
    monthNum: f.monthNum,
    sortKey: f.sortKey,
    month: f.month,
    hours: f.sheets.sheet3.totalTime,
  }))

  // Monthly KPIs
  const monthlyMap = {}
  for (const r of manualData) {
    if (!monthlyMap[r.sortKey]) {
      monthlyMap[r.sortKey] = {
        monthNum: r.monthNum, sortKey: r.sortKey, month: r.month,
        manTotal: 0, autoTotal: 0, inletTotal: 0,
        valves: new Set(), manValves: new Set(), avails: [],
      }
    }
    const m = monthlyMap[r.sortKey]
    m.manTotal += r.manCmd
    m.autoTotal += r.autoCmd
    m.inletTotal += r.inletOpen
    m.valves.add(r.valveId)
    if (r.manCmd > 0) m.manValves.add(r.valveId)
    if (r.availability != null) m.avails.push(r.availability)
  }

  const monthly = Object.values(monthlyMap).map(m => {
    const totalCmd = m.manTotal + m.autoTotal
    const opTime = operationTime.find(o => o.sortKey === m.sortKey)?.hours || 0
    return {
      monthNum: m.monthNum,
      sortKey: m.sortKey,
      month: m.month,
      manTotal: m.manTotal,
      autoTotal: m.autoTotal,
      totalCmd,
      manualPct: totalCmd > 0 ? Math.round(m.manTotal / totalCmd * 10000) / 100 : 0,
      valveCount: m.valves.size,
      manValveCount: m.manValves.size,
      manValvePct: m.valves.size > 0 ? Math.round(m.manValves.size / m.valves.size * 1000) / 10 : 0,
      avgAvailability: m.avails.length > 0 ? Math.round(avg(m.avails) * 100) / 100 : null,
      operationTime: opTime,
      manPerHour: opTime > 0 ? Math.round(m.manTotal / opTime * 1000) / 1000 : 0,
    }
  }).sort((a, b) => a.sortKey - b.sortKey)

  // Per-valve summary
  const valveMap = {}
  for (const r of manualData) {
    if (!valveMap[r.valveId]) {
      valveMap[r.valveId] = {
        valveId: r.valveId, branch: r.branch,
        manTotal: 0, autoTotal: 0, inletTotal: 0,
        avails: [], months: new Set(),
      }
    }
    const v = valveMap[r.valveId]
    v.manTotal += r.manCmd
    v.autoTotal += r.autoCmd
    v.inletTotal += r.inletOpen
    if (r.availability != null) v.avails.push(r.availability)
    v.months.add(r.monthNum)
  }

  const valveSummary = Object.values(valveMap).map(v => {
    const totalCmd = v.manTotal + v.autoTotal
    return {
      valveId: v.valveId,
      branch: v.branch,
      manTotal: v.manTotal,
      autoTotal: v.autoTotal,
      totalCmd,
      manualPct: totalCmd > 0 ? Math.round(v.manTotal / totalCmd * 10000) / 100 : 0,
      avgAvailability: v.avails.length > 0 ? Math.round(avg(v.avails) * 10) / 10 : null,
      activeMonths: v.months.size,
      manPerMonth: v.months.size > 0 ? Math.round(v.manTotal / v.months.size * 10) / 10 : 0,
    }
  }).sort((a, b) => b.manualPct - a.manualPct)

  // Per-branch summary
  const branchMap = {}
  for (const r of manualData) {
    if (!branchMap[r.branch]) {
      branchMap[r.branch] = { branch: r.branch, manTotal: 0, autoTotal: 0, valves: new Set() }
    }
    branchMap[r.branch].manTotal += r.manCmd
    branchMap[r.branch].autoTotal += r.autoCmd
    branchMap[r.branch].valves.add(r.valveId)
  }

  const branchSummary = Object.values(branchMap).map(b => {
    const totalCmd = b.manTotal + b.autoTotal
    return {
      branch: b.branch,
      manTotal: b.manTotal,
      autoTotal: b.autoTotal,
      totalCmd,
      manualPct: totalCmd > 0 ? Math.round(b.manTotal / totalCmd * 10000) / 100 : 0,
      valveCount: b.valves.size,
      manPerValve: b.valves.size > 0 ? Math.round(b.manTotal / b.valves.size * 10) / 10 : 0,
    }
  }).sort((a, b) => b.manualPct - a.manualPct)

  // Year totals
  const totalMan = monthly.reduce((s, m) => s + m.manTotal, 0)
  const totalAuto = monthly.reduce((s, m) => s + m.autoTotal, 0)
  const totalAll = totalMan + totalAuto

  // All valves with significant manual commands, sorted by manualPct desc
  const topManualValves = valveSummary.filter(v => v.totalCmd > 10)

  // Extra analyser för att förstå drivkrafter bakom manuell körning
  const perFractionMonthly = computeFractionMonthly(manualData)
  const risingTrendValves = computeRisingTrendValves(manualData)
  const spikeMonths = computeSpikeMonths(monthly)
  const seasonalComparison = computeSeasonalComparison(monthly)

  return {
    manualData,
    monthly,
    valveSummary,
    branchSummary,
    totalMan,
    totalAuto,
    totalAll,
    yearPct: totalAll > 0 ? Math.round(totalMan / totalAll * 10000) / 100 : 0,
    topManualValves,
    perFractionMonthly,
    risingTrendValves,
    spikeMonths,
    seasonalComparison,
  }
}

/**
 * Manuell andel per fraktion per månad.
 * Returnerar:
 *   {
 *     fractions: ['Rest', 'Organic', ...],   // alla fraktioner, + ev. 'Okänd' sist
 *     months:    [{ sortKey, month }, ...],  // sorterat på sortKey
 *     series:    { [fraction]: [{ sortKey, month, manualPct, manTotal, totalCmd }, ...] }
 *   }
 */
function computeFractionMonthly(manualData) {
  const map = {}
  const monthMap = {}
  for (const r of manualData) {
    const frac = r.fraction || 'Okänd'
    const key = `${frac}|${r.sortKey}`
    if (!map[key]) {
      map[key] = {
        fraction: frac,
        sortKey: r.sortKey,
        month: r.month,
        manTotal: 0,
        autoTotal: 0,
      }
    }
    map[key].manTotal += r.manCmd
    map[key].autoTotal += r.autoCmd
    if (!monthMap[r.sortKey]) monthMap[r.sortKey] = { sortKey: r.sortKey, month: r.month }
  }

  const rows = Object.values(map).map(m => {
    const total = m.manTotal + m.autoTotal
    return {
      fraction: m.fraction,
      sortKey: m.sortKey,
      month: m.month,
      manTotal: m.manTotal,
      autoTotal: m.autoTotal,
      totalCmd: total,
      manualPct: total > 0 ? Math.round(m.manTotal / total * 10000) / 100 : 0,
    }
  })

  const fractionsSet = [...new Set(rows.map(r => r.fraction))]
  // Sortera så att "Okänd" hamnar sist
  const fractions = fractionsSet
    .filter(f => f !== 'Okänd')
    .sort()
  if (fractionsSet.includes('Okänd')) fractions.push('Okänd')

  const months = Object.values(monthMap).sort((a, b) => a.sortKey - b.sortKey)

  const series = {}
  for (const frac of fractions) {
    series[frac] = rows
      .filter(r => r.fraction === frac)
      .sort((a, b) => a.sortKey - b.sortKey)
  }

  return { fractions, months, series }
}

/**
 * Topp-ventiler med stigande manuell-trend.
 * Beräknar linjär lutning (slope) på manualPct över tid per ventil.
 * Returnerar ventiler med positiv, signifikant lutning sorterat på störst slope.
 */
function computeRisingTrendValves(manualData) {
  const perValve = {}
  for (const r of manualData) {
    if (!perValve[r.valveId]) perValve[r.valveId] = { valveId: r.valveId, branch: r.branch, fraction: r.fraction, months: [] }
    perValve[r.valveId].months.push({ sortKey: r.sortKey, month: r.month, manualPct: r.manualPct, totalCmd: r.totalCmd, manCmd: r.manCmd })
  }

  const results = []
  for (const v of Object.values(perValve)) {
    const sorted = v.months.sort((a, b) => a.sortKey - b.sortKey)
    // Kräv minst 4 månader och minst några kommandon för meningsfull trend
    if (sorted.length < 4) continue
    const totalCmds = sorted.reduce((s, m) => s + m.totalCmd, 0)
    if (totalCmds < 20) continue

    const xs = sorted.map((_, i) => i)
    const ys = sorted.map(m => m.manualPct)
    const { slope, r, pValue, trendClass } = linregress(xs, ys)

    const firstPct = sorted[0].manualPct
    const lastPct = sorted[sorted.length - 1].manualPct
    const change = lastPct - firstPct

    results.push({
      valveId: v.valveId,
      branch: v.branch,
      fraction: v.fraction,
      slope,
      r,
      pValue,
      trendClass,
      months: sorted.length,
      firstPct,
      lastPct,
      change: Math.round(change * 100) / 100,
      totalManual: sorted.reduce((s, m) => s + m.manCmd, 0),
    })
  }

  // Filtrera: stigande trend (slope > 0) och en rimlig förändring
  const rising = results.filter(r => r.slope > 0 && r.change > 0.5)
  rising.sort((a, b) => b.slope - a.slope)
  return rising.slice(0, 10)
}

/**
 * Månader där manuell andel avviker >1 stddev från genomsnittet.
 */
function computeSpikeMonths(monthly) {
  if (!monthly || monthly.length < 3) return []

  const values = monthly.map(m => m.manualPct)
  const labels = monthly.map(m => m.month)
  const meanVal = avg(values)
  const std = Math.sqrt(avg(values.map(v => (v - meanVal) ** 2)))

  // Använd tröskel 1.0 för att få fler relevanta toppar
  const anomalies = detectAnomalies(values, labels, 1.0)
  // Bara positiva avvikelser (spikar uppåt, inte dalar)
  return anomalies
    .filter(a => a.type === 'hög')
    .map(a => {
      const entry = monthly[a.index]
      return {
        month: a.label,
        sortKey: entry.sortKey,
        monthNum: entry.monthNum,
        manualPct: entry.manualPct,
        manTotal: entry.manTotal,
        totalCmd: entry.totalCmd,
        zScore: a.zScore,
        deltaFromMean: Math.round((entry.manualPct - meanVal) * 100) / 100,
      }
    })
    .sort((a, b) => b.zScore - a.zScore)
}

/**
 * Säsongsjämförelse sommar (juni-aug) vs vinter (dec-feb) för manuell andel.
 */
function computeSeasonalComparison(monthly) {
  if (!monthly || monthly.length === 0) return null
  const summer = monthly.filter(m => [6, 7, 8].includes(m.monthNum))
  const winter = monthly.filter(m => [12, 1, 2].includes(m.monthNum))

  const summerAvg = summer.length > 0 ? avg(summer.map(m => m.manualPct)) : null
  const winterAvg = winter.length > 0 ? avg(winter.map(m => m.manualPct)) : null

  let delta = null
  let deltaPct = null
  if (summerAvg != null && winterAvg != null) {
    delta = summerAvg - winterAvg
    deltaPct = winterAvg > 0 ? (delta / winterAvg) * 100 : null
  }

  // Enkel signifikanstest: Welchs t ungefärligt via std
  let significant = false
  if (summer.length >= 2 && winter.length >= 2) {
    const sVals = summer.map(m => m.manualPct)
    const wVals = winter.map(m => m.manualPct)
    const sMean = avg(sVals)
    const wMean = avg(wVals)
    const sVar = avg(sVals.map(v => (v - sMean) ** 2))
    const wVar = avg(wVals.map(v => (v - wMean) ** 2))
    const se = Math.sqrt(sVar / sVals.length + wVar / wVals.length)
    if (se > 0) {
      const t = Math.abs(sMean - wMean) / se
      significant = t > 2.0 // grov tumregel
    }
  }

  return {
    summerAvg: summerAvg != null ? Math.round(summerAvg * 100) / 100 : null,
    winterAvg: winterAvg != null ? Math.round(winterAvg * 100) / 100 : null,
    summerCount: summer.length,
    winterCount: winter.length,
    delta: delta != null ? Math.round(delta * 100) / 100 : null,
    deltaPct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
    significant,
    summerMonths: summer.map(m => m.month),
    winterMonths: winter.map(m => m.month),
  }
}

function parseValveId(vid) {
  const parts = String(vid).split(':')
  if (parts.length !== 2) return { branch: -1, valveNum: -1 }
  return { branch: parseInt(parts[0], 10), valveNum: parseInt(parts[1], 10) }
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
