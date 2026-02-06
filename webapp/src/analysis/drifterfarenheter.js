/**
 * Port of scripts/drifterfarenheter.py
 * Cross-correlates manual runs with error codes, energy efficiency, alarm patterns
 */

import { pearsonCorrelation } from '../stats/correlation'

const ERROR_TYPES = [
  'DOES_NOT_CLOSE', 'DOES_NOT_OPEN', 'LEVEL_ERROR',
  'LONG_TIME_SINCE_LAST_COLLECTION', 'ERROR_FEEDBACK_FROM_USER',
]

export function analyzeDrifterfarenheter(trendanalys, ventiler, manuellAnalys, larm) {
  const manualVsErrors = analyzeManualVsErrors(trendanalys, ventiler, manuellAnalys)
  const energy = analyzeEnergyEfficiency(trendanalys)
  const manualTrend = analyzeManualTrend(manuellAnalys)
  const alarms = analyzeAlarmPatterns(trendanalys, ventiler, larm)
  const findings = createSummary(manualVsErrors, energy, manualTrend, alarms)

  return {
    manualVsErrors,
    energy,
    manualTrend,
    alarms,
    findings,
  }
}

function analyzeManualVsErrors(trendanalys, ventiler, manuellAnalys) {
  if (!trendanalys?.valveMonthly?.length || !manuellAnalys?.valveSummary?.length) return {}

  // Aggregate errors per valve
  const errorPerValve = {}
  for (const v of trendanalys.valveMonthly) {
    if (!errorPerValve[v.valveId]) errorPerValve[v.valveId] = { totalErrors: 0, byType: {} }
    errorPerValve[v.valveId].totalErrors += v.totalErrors
    for (const [et, count] of Object.entries(v.errors)) {
      errorPerValve[v.valveId].byType[et] = (errorPerValve[v.valveId].byType[et] || 0) + count
    }
  }

  // Correlations: manual commands vs each error type
  const correlations = {}
  const manData = manuellAnalys.valveSummary
  for (const errType of ERROR_TYPES) {
    const manVals = [], errVals = []
    for (const v of manData) {
      const errs = errorPerValve[v.valveId]
      if (errs) {
        manVals.push(v.manTotal)
        errVals.push(errs.byType[errType] || 0)
      }
    }
    if (manVals.length >= 3 && manVals.some(v => v > 0) && errVals.some(v => v > 0)) {
      const { r, p } = pearsonCorrelation(manVals, errVals)
      correlations[errType] = {
        pearsonR: r,
        pValue: p,
        totalCount: errVals.reduce((s, v) => s + v, 0),
      }
    }
  }

  // Sort by absolute correlation
  const sortedCorr = Object.entries(correlations)
    .sort((a, b) => Math.abs(b[1].pearsonR) - Math.abs(a[1].pearsonR))

  // Risk valves: high manual % + 100% availability
  const riskValves = []
  for (const v of manData) {
    if (v.totalCmd <= 10 || v.manualPct <= 5 || (v.avgAvailability != null && v.avgAvailability < 99.9)) continue
    const errs = errorPerValve[v.valveId] || { totalErrors: 0, byType: {} }
    let dominantError = '', maxErr = 0
    for (const [et, count] of Object.entries(errs.byType)) {
      if (count > maxErr) { maxErr = count; dominantError = et }
    }
    riskValves.push({
      valve: v.valveId,
      branch: v.branch,
      manualPct: v.manualPct,
      availability: v.avgAvailability,
      totalErrors: errs.totalErrors,
      dominantError,
      dominantErrorCount: maxErr,
    })
  }
  riskValves.sort((a, b) => b.manualPct - a.manualPct)

  return {
    correlations: Object.fromEntries(sortedCorr),
    riskValves, // full sorted list
    drivingErrorType: sortedCorr[0]?.[0] || null,
    drivingCorrelation: sortedCorr[0]?.[1]?.pearsonR || 0,
  }
}

function analyzeEnergyEfficiency(trendanalys) {
  const fd = trendanalys?.facilityData
  if (!fd?.length) return {}

  const kwhPerE = fd.map(d => d.kwhPerEmptying)
  const energy = fd.map(d => d.energyKwh)
  const opTime = fd.map(d => d.operationTimeH)

  const bestIdx = kwhPerE.indexOf(Math.min(...kwhPerE))
  const worstIdx = kwhPerE.indexOf(Math.max(...kwhPerE))
  const spread = ((Math.max(...kwhPerE) - Math.min(...kwhPerE)) / avg(kwhPerE)) * 100

  // H1/H2 based on month-of-year, not positional slicing
  const h1Vals = fd.filter(d => d.monthNum <= 6).map(d => d.kwhPerEmptying)
  const h2Vals = fd.filter(d => d.monthNum > 6).map(d => d.kwhPerEmptying)
  const h1 = avg(h1Vals)
  const h2 = avg(h2Vals)
  const hChange = h1 > 0 ? ((h2 - h1) / h1) * 100 : 0

  const corrDrift = energy.length > 2 ? pearsonCorrelation(energy, opTime) : { r: 0, p: 1 }

  return {
    kwhPerEmptyingMean: Math.round(avg(kwhPerE) * 100) / 100,
    kwhPerEmptyingMin: Math.round(Math.min(...kwhPerE) * 100) / 100,
    kwhPerEmptyingMax: Math.round(Math.max(...kwhPerE) * 100) / 100,
    bestMonth: fd[bestIdx]?.month,
    worstMonth: fd[worstIdx]?.month,
    spreadPct: Math.round(spread * 10) / 10,
    halfYearChangePct: Math.round(hChange * 10) / 10,
    corrEnergyDrifttime: { r: corrDrift.r, p: corrDrift.p },
    totalKwh: Math.round(energy.reduce((s, v) => s + v, 0)),
    totalEmptyings: fd.reduce((s, d) => s + d.emptyings, 0),
  }
}

function analyzeManualTrend(manuellAnalys) {
  if (!manuellAnalys?.monthly?.length) return {}

  const m = manuellAnalys.monthly
  const h1 = avg(m.filter(r => r.monthNum <= 6).map(r => r.manualPct))
  const h2 = avg(m.filter(r => r.monthNum > 6).map(r => r.manualPct))
  const worst = m.reduce((w, r) => r.manualPct > w.manualPct ? r : w, m[0])

  return {
    totalManual: manuellAnalys.totalMan,
    totalCommands: manuellAnalys.totalAll,
    yearPct: manuellAnalys.yearPct,
    h1Pct: Math.round(h1 * 100) / 100,
    h2Pct: Math.round(h2 * 100) / 100,
    worstMonth: worst.month,
    worstMonthPct: worst.manualPct,
    topBranches: manuellAnalys.branchSummary.map(b => ({
      branch: b.branch,
      manualPct: b.manualPct,
      manTotal: b.manTotal,
      valveCount: b.valveCount,
    })),
  }
}

function analyzeAlarmPatterns(trendanalys, ventiler, larm) {
  const fd = trendanalys?.facilityData
  if (!fd?.length) return {}

  const alarmVals = fd.map(d => d.alarms)
  const total = alarmVals.reduce((s, v) => s + v, 0)
  const mean = avg(alarmVals)
  const median = [...alarmVals].sort((a, b) => a - b)[Math.floor(alarmVals.length / 2)]

  // January detection based on monthNum, not position
  const janEntries = fd.filter(d => d.monthNum === 1)
  const nonJanEntries = fd.filter(d => d.monthNum !== 1)
  const janAlarms = janEntries.reduce((s, d) => s + d.alarms, 0)
  const nonJanAlarms = nonJanEntries.map(d => d.alarms)
  const restMean = avg(nonJanAlarms)
  const janFactor = restMean > 0 ? janAlarms / (janEntries.length || 1) / restMean : 0

  const restStd = Math.sqrt(avg(nonJanAlarms.map(v => (v - restMean) ** 2)))
  const restCV = restMean > 0 ? restStd / restMean * 100 : 0

  const result = {
    totalAlarms: total,
    meanPerMonth: Math.round(mean),
    medianPerMonth: Math.round(median),
    januaryAlarms: janAlarms,
    januaryFactorVsRest: Math.round(janFactor * 10) / 10,
    febDecMean: Math.round(restMean),
    febDecCV: Math.round(restCV * 10) / 10,
    anomalyCount: trendanalys.anomalies.filter(a => a.target === 'larm_månad').length,
  }

  // Error type distribution
  if (ventiler?.errorTypeTotals) {
    const totalErr = Object.values(ventiler.errorTypeTotals).reduce((s, v) => s + v, 0)
    result.errorDistribution = Object.entries(ventiler.errorTypeTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        count,
        pct: totalErr > 0 ? Math.round(count / totalErr * 1000) / 10 : 0,
      }))
    result.totalValveErrors = totalErr
  }

  return result
}

function createSummary(manualVsErrors, energy, manualTrend, alarms) {
  const findings = []

  if (manualVsErrors?.drivingErrorType) {
    const r = manualVsErrors.drivingCorrelation
    findings.push({
      area: 'Manuella körningar',
      finding: `Manuella ingrepp drivs främst av ${manualVsErrors.drivingErrorType}-fel (r=${r.toFixed(2)}). Åtgärda dessa feltyper för att minska behovet av manuella körningar.`,
      priority: Math.abs(r) > 0.5 ? 1 : 2,
    })
  }

  if (manualVsErrors?.riskValves?.length) {
    findings.push({
      area: 'Dold risk',
      finding: `${manualVsErrors.riskValves.length} ventiler har hög manuell andel trots 100% tillgänglighet. Operatörer kompenserar för automatikproblem — dessa ventiler riskerar plötsligt bortfall om operatören missar ingripandet.`,
      priority: 1,
    })
  }

  if (energy?.spreadPct > 30) {
    findings.push({
      area: 'Energieffektivitet',
      finding: `kWh/tömning varierar ${Math.round(energy.spreadPct)}% mellan bästa (${energy.bestMonth}: ${energy.kwhPerEmptyingMin.toFixed(1)}) och sämsta (${energy.worstMonth}: ${energy.kwhPerEmptyingMax.toFixed(1)}) månad. H2 var ${Math.abs(energy.halfYearChangePct).toFixed(0)}% ${energy.halfYearChangePct < 0 ? 'bättre' : 'sämre'} än H1.`,
      priority: 2,
    })
  }

  if (alarms?.januaryFactorVsRest > 5) {
    findings.push({
      area: 'Larmanalys',
      finding: `Januari hade ${Math.round(alarms.januaryFactorVsRest)}x fler larm (${alarms.januaryAlarms.toLocaleString()}) jämfört med övriga månaders snitt (${alarms.febDecMean}). Exklusive januari är larmfrekvensen stabil (CV ${Math.round(alarms.febDecCV)}%).`,
      priority: 1,
    })
  }

  if (alarms?.errorDistribution?.length) {
    const [top] = alarms.errorDistribution
    findings.push({
      area: 'Felfördelning',
      finding: `${top.type} dominerar med ${top.pct}% av alla ventilfel (${top.count.toLocaleString()} st). Dessa indikerar att tömningsintervallen kan optimeras.`,
      priority: 2,
    })
  }

  findings.sort((a, b) => a.priority - b.priority)
  return findings
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
