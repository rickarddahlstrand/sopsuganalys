/**
 * Port of scripts/trendanalys.py (~979 lines Python → ~350 lines JS)
 * Requires: energiDrift, ventiler, larm results
 */

import { linregress } from '../stats/linregress'
import { computeCorrelations } from '../stats/correlation'
import { detectAnomalies } from '../stats/anomaly'
import { detectSeasonalPatterns } from '../stats/autocorrelation'
import { movingAverage } from '../stats/movingAverage'
import { healthScore } from '../stats/healthScore'

export function analyzeTrender(parsedFiles, energiDrift, ventiler, larm) {
  // ---- Collect per-valve per-month data (like trendanalys.py collect_valve_monthly) ----
  const valveMonthly = collectValveMonthly(parsedFiles)

  // ---- Energy detail (like collect_energy_detail) ----
  const energyDetail = collectEnergyDetail(parsedFiles)

  // ---- Facility-level trends ----
  const energyValues = energyDetail.map(e => e.totalKwh)
  const emptyingsValues = energyDetail.map(e => e.totalEmptyings)
  const kwhPerEmptying = energyDetail.map(e => e.kwhPerEmptying)
  // Use sequential index (1,2,3,...) for regression x-values, not monthNum
  const monthNums = energyDetail.map((_, i) => i + 1)

  // Monthly alarm totals
  const alarmMonthly = larm.monthlyTotals.map(m => m.total)
  const alarmMonthNums = larm.monthlyTotals.map((_, i) => i + 1)

  // Compute linear trends
  const facilityTrends = {
    energi: linregress(monthNums, energyValues),
    tömningar: linregress(monthNums, emptyingsValues),
    kwh_per_tömning: linregress(monthNums, kwhPerEmptying),
    larm: linregress(alarmMonthNums, alarmMonthly),
  }

  // Moving averages
  const energyMA = movingAverage(energyValues, 3)
  const kwhPerEmptyMA = movingAverage(kwhPerEmptying, 3)
  const alarmMA = movingAverage(alarmMonthly, 3)

  // Facility-level data with trends
  const facilityData = energyDetail.map((e, i) => ({
    monthNum: e.monthNum,
    sortKey: e.sortKey,
    month: e.month,
    energyKwh: e.totalKwh,
    operationTimeH: e.operationTimeH,
    emptyings: e.totalEmptyings,
    kwhPerEmptying: e.kwhPerEmptying,
    alarms: larm.monthlyTotals[i]?.total || 0,
    energyMA3: energyMA[i],
    kwhPerEmptyMA3: kwhPerEmptyMA[i],
    alarmsMA3: alarmMA[i],
    energyTrend: facilityTrends.energi.intercept + facilityTrends.energi.slope * (i + 1),
    alarmTrend: facilityTrends.larm.intercept + facilityTrends.larm.slope * (i + 1),
  }))

  // ---- Per-valve trends ----
  const valveIds = [...new Set(valveMonthly.map(v => v.valveId))]
  const trendsPerValve = {}
  for (const vid of valveIds) {
    const vData = valveMonthly.filter(v => v.valveId === vid).sort((a, b) => a.sortKey - b.sortKey)
    const xArr = vData.map((_, i) => i + 1) // sequential index
    const yArr = vData.map(v => v.availability)
    trendsPerValve[vid] = linregress(xArr, yArr)
  }

  // ---- Branch analysis ----
  const branches = [...new Set(valveMonthly.filter(v => v.branch >= 0).map(v => v.branch))].sort((a, b) => a - b)
  const branchAnalysis = branches.map(branch => {
    const bData = valveMonthly.filter(v => v.branch === branch)
    const uniqueValves = new Set(bData.map(v => v.valveId)).size
    const avgAvail = avg(bData.map(v => v.availability))
    const minAvail = Math.min(...bData.map(v => v.availability))
    const totalErrors = bData.reduce((s, v) => s + v.totalErrors, 0)
    const errorsPerValve = uniqueValves > 0 ? Math.round(totalErrors / uniqueValves * 10) / 10 : 0

    // Per-month trend for this branch
    const monthlyAvg = {}
    for (const v of bData) {
      if (!monthlyAvg[v.sortKey]) monthlyAvg[v.sortKey] = []
      monthlyAvg[v.sortKey].push(v.availability)
    }
    const points = Object.entries(monthlyAvg).map(([sk, vals]) => [Number(sk), avg(vals)])
    points.sort((a, b) => a[0] - b[0])
    const branchTrend = linregress(points.map((_, i) => i + 1), points.map(p => p[1]))

    // Worst valve in branch
    const avgPerValve = {}
    for (const v of bData) {
      if (!avgPerValve[v.valveId]) avgPerValve[v.valveId] = []
      avgPerValve[v.valveId].push(v.availability)
    }
    let worstValve = ''
    let worstAvg = 101
    for (const [vid, vals] of Object.entries(avgPerValve)) {
      const a = avg(vals)
      if (a < worstAvg) { worstAvg = a; worstValve = vid }
    }

    const score = healthScore(avgAvail, errorsPerValve, branchTrend.trendClass)

    return {
      branch,
      valveCount: uniqueValves,
      avgAvailability: Math.round(avgAvail * 100) / 100,
      minAvailability: Math.round(minAvail * 100) / 100,
      totalErrors,
      errorsPerValve,
      worstValve,
      trendClass: branchTrend.trendClass,
      trendSlope: branchTrend.slope,
      healthScore: score,
    }
  }).sort((a, b) => a.healthScore - b.healthScore)

  // ---- Correlations ----
  const corrPairs = {}
  if (energyValues.length >= 3 && alarmMonthly.length >= 3) {
    corrPairs['energi_vs_tömningar'] = [energyValues, emptyingsValues]
    corrPairs['energi_vs_larm'] = [energyValues, alarmMonthly]
    corrPairs['tömningar_vs_larm'] = [emptyingsValues, alarmMonthly]
  }

  // Availability vs errors monthly
  const monthlyAvailVals = ventiler.monthlyAvailSummary.map(m => m.mean)
  const monthlyErrorTotals = ventiler.monthlyAvailSummary.map(m => {
    const errMonth = ventiler.monthlyErrors.find(e => e.sortKey === m.sortKey)
    if (!errMonth) return 0
    return Object.entries(errMonth).filter(([k]) => k !== 'monthNum' && k !== 'month' && k !== 'sortKey').reduce((s, [, v]) => s + v, 0)
  })
  if (monthlyAvailVals.length >= 3) {
    corrPairs['tillgänglighet_vs_fel'] = [monthlyAvailVals, monthlyErrorTotals]
  }

  const correlations = computeCorrelations(corrPairs)

  // ---- Anomalies ----
  const anomalies = []

  // Energy anomalies
  const energyLabels = energyDetail.map(e => e.month)
  for (const a of detectAnomalies(energyValues, energyLabels)) {
    anomalies.push({ ...a, target: 'energi_månad' })
  }

  // Alarm anomalies
  const alarmLabels = larm.monthlyTotals.map(m => m.month)
  for (const a of detectAnomalies(alarmMonthly, alarmLabels)) {
    anomalies.push({ ...a, target: 'larm_månad' })
  }

  // Valve availability anomalies (yearly average per valve)
  const valveYearAvg = {}
  for (const v of valveMonthly) {
    if (!valveYearAvg[v.valveId]) valveYearAvg[v.valveId] = []
    valveYearAvg[v.valveId].push(v.availability)
  }
  const avgArr = Object.values(valveYearAvg).map(vals => avg(vals))
  const vidArr = Object.keys(valveYearAvg)
  for (const a of detectAnomalies(avgArr, vidArr)) {
    anomalies.push({ ...a, target: 'ventil_tillgänglighet' })
  }

  // Seasonal patterns
  const seasonalEnergy = detectSeasonalPatterns(energyValues)

  return {
    facilityTrends,
    facilityData,
    valveMonthly,
    trendsPerValve,
    branchAnalysis,
    correlations,
    anomalies,
    seasonalEnergy,
    energyMA,
    kwhPerEmptyMA,
    alarmMA,
  }
}

function collectValveMonthly(parsedFiles) {
  const rows = []
  for (const file of parsedFiles) {
    const { monthNum, sortKey, month, sheets } = file

    // Build command lookup from sheet9
    const cmdLookup = {}
    for (const r9 of sheets.sheet9) {
      cmdLookup[r9.id] = r9.manCmd + r9.autoCmd
    }

    for (const r11 of sheets.sheet11) {
      const parts = String(r11.id).split(':')
      const branch = parts.length === 2 ? parseInt(parts[0], 10) : -1
      const valveNum = parts.length === 2 ? parseInt(parts[1], 10) : -1

      rows.push({
        monthNum,
        sortKey,
        month,
        valveId: r11.id,
        branch,
        valveNum,
        availability: r11.availability,
        totalErrors: r11.totalErrors,
        commands: cmdLookup[r11.id] || 0,
        errors: { ...r11.errors },
      })
    }
  }
  return rows
}

function collectEnergyDetail(parsedFiles) {
  return parsedFiles.map(file => {
    const { monthNum, sortKey, month, sheets } = file
    const totalKwh = sheets.sheet3.totalEnergy
    const totalEmptyings = sheets.sheet5.reduce((s, r) => s + (r.emptyings || 0), 0)
    const kwhPerEmptying = totalEmptyings > 0
      ? Math.round(totalKwh / totalEmptyings * 1000) / 1000
      : 0

    return {
      monthNum,
      sortKey,
      month,
      totalKwh,
      operationTimeH: sheets.sheet3.totalTime,
      totalEmptyings,
      kwhPerEmptying,
    }
  })
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
