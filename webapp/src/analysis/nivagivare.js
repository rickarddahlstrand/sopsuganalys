/**
 * Hälsoanalys av nivågivare (level sensors) per ventil.
 *
 * Bakgrund:
 *   En nivågivare sitter i lagringsenheten vid varje inkastpunkt och triggar
 *   automatisk tömning när kärlet är fullt. Ventilen öppnas då via AUTO_OPEN_CMD.
 *   Trasiga givare orsakar en av följande symtom:
 *
 *   - "Tyst givare": rapporterar aldrig full → autoCmd ≈ 0 trots användning
 *     (driften sker manuellt, eller inte alls)
 *   - "Höga nivåer fastnar": full men inget töms → LEVEL_ERROR och
 *     LONG_TIME_SINCE_LAST_COLLECTION stiger, kan även ge FULL_NOT_EMPTIED
 *   - "Låga nivåer/falska fulltrigger": onaturligt många autoCmd per månad
 *     (givaren rapporterar full när den inte är det)
 *   - "Saknad rapportering vissa månader": availability = 0 eller
 *     ventilen dyker upp i vissa månader men inte andra
 *
 * Källor: Sheet9 (kommandon + HIGH_LEVEL/LOW_LEVEL-räknare), Sheet11
 * (availability + felkoder LEVEL_ERROR, LONG_TIME_SINCE_LAST_COLLECTION).
 */

import { buildValveFractionMap } from '../utils/valveFraction'

const LEVEL_ERROR_KEY = 'LEVEL_ERROR'
const LONG_TIME_KEY = 'LONG_TIME_SINCE_LAST_COLLECTION'

export function analyzeNivagivare(parsedFiles) {
  if (!parsedFiles || parsedFiles.length === 0) {
    return emptyResult()
  }

  const totalMonths = parsedFiles.length
  const perValve = {}
  const monthKeys = []

  for (const file of parsedFiles) {
    monthKeys.push({ sortKey: file.sortKey, month: file.month, monthNum: file.monthNum })

    const cmdLookup = {}
    for (const r9 of file.sheets.sheet9) {
      cmdLookup[r9.id] = r9
    }

    const seenInMonth = new Set()
    for (const r11 of file.sheets.sheet11) {
      seenInMonth.add(r11.id)
      const c = cmdLookup[r11.id] || { manCmd: 0, autoCmd: 0, inletOpen: 0 }
      recordMonth(perValve, r11.id, r11.info, file, r11, c)
    }
    // Valves present in Sheet9 but not Sheet11
    for (const r9 of file.sheets.sheet9) {
      if (seenInMonth.has(r9.id)) continue
      recordMonth(perValve, r9.id, r9.info, file, null, r9)
    }
  }

  const valveRows = Object.values(perValve).map(v => buildValveRow(v, totalMonths))

  const silentSensors = valveRows.filter(v => v.silent).sort((a, b) => a.totalCmd - b.totalCmd)
  const highLevelSuspects = valveRows
    .filter(v => v.highLevelScore > 0)
    .sort((a, b) => b.highLevelScore - a.highLevelScore)
  const lowLevelSuspects = valveRows
    .filter(v => v.lowLevelScore > 0)
    .sort((a, b) => b.lowLevelScore - a.lowLevelScore)
  const stuckSensors = valveRows
    .filter(v => v.stuckScore > 0)
    .sort((a, b) => b.stuckScore - a.stuckScore)
  const missingReporting = valveRows
    .filter(v => v.missingMonths > 0)
    .sort((a, b) => b.missingMonths - a.missingMonths)

  const suspects = valveRows
    .filter(v => v.suspicionScore > 0)
    .sort((a, b) => b.suspicionScore - a.suspicionScore)

  const monthlyLevelErrors = buildMonthlyErrorSeries(parsedFiles)

  // Fraktions-mappning (från delad util). Returnerar Map<valveId, fraction>.
  const fractionMap = buildValveFractionMap(parsedFiles)

  // Ventiler med noteringar — bara de som har minst en > 0 under hela perioden
  // för respektive fält. Används för att filtrera bort obetydliga ventiler.
  const valvesWithLongTime = new Set(
    valveRows.filter(v => v.totalLongTime > 0).map(v => v.valveId)
  )
  const totalHighPerValve = sumPerValve(parsedFiles, 'highLevel')
  const totalLowPerValve = sumPerValve(parsedFiles, 'lowLevel')
  const valvesWithHigh = new Set(
    Object.entries(totalHighPerValve).filter(([, v]) => v > 0).map(([k]) => k)
  )
  const valvesWithLow = new Set(
    Object.entries(totalLowPerValve).filter(([, v]) => v > 0).map(([k]) => k)
  )

  const longTimePerMonthByFraction = buildLongTimePerMonthByFraction(
    parsedFiles, valvesWithLongTime, fractionMap
  )
  const highLevelMonthly = buildMonthlyFieldSeries(
    parsedFiles, 'highLevel', valvesWithHigh
  )
  const lowLevelMonthly = buildMonthlyFieldSeries(
    parsedFiles, 'lowLevel', valvesWithLow
  )

  // Per-branch aggregation
  const branchMap = {}
  for (const v of valveRows) {
    if (v.branch < 0) continue
    if (!branchMap[v.branch]) {
      branchMap[v.branch] = {
        branch: v.branch,
        valveCount: 0,
        silent: 0,
        suspects: 0,
        levelErrors: 0,
      }
    }
    const b = branchMap[v.branch]
    b.valveCount++
    if (v.silent) b.silent++
    if (v.suspicionScore > 0) b.suspects++
    b.levelErrors += v.totalLevelErrors
  }
  const branchSummary = Object.values(branchMap)
    .map(b => ({
      ...b,
      silentPct: b.valveCount > 0 ? round1(b.silent / b.valveCount * 100) : 0,
      suspectPct: b.valveCount > 0 ? round1(b.suspects / b.valveCount * 100) : 0,
    }))
    .sort((a, b) => b.suspectPct - a.suspectPct)

  const totalValves = valveRows.length
  const silentCount = silentSensors.length
  const suspectCount = suspects.length
  const totalLevelErrors = valveRows.reduce((s, v) => s + v.totalLevelErrors, 0)

  return {
    totalValves,
    totalMonths,
    silentCount,
    silentPct: totalValves > 0 ? round1(silentCount / totalValves * 100) : 0,
    suspectCount,
    suspectPct: totalValves > 0 ? round1(suspectCount / totalValves * 100) : 0,
    totalLevelErrors,
    valveRows,
    suspects,
    silentSensors,
    highLevelSuspects,
    lowLevelSuspects,
    stuckSensors,
    missingReporting,
    branchSummary,
    monthlyLevelErrors,
    longTimePerMonthByFraction,
    highLevelMonthly,
    lowLevelMonthly,
    monthKeys: monthKeys.sort((a, b) => a.sortKey - b.sortKey),
  }
}

function recordMonth(perValve, id, info, file, r11, cmdRow) {
  if (!perValve[id]) {
    const { branch, valveNum } = parseValveId(id)
    perValve[id] = {
      valveId: id,
      branch,
      valveNum,
      info: '',
      months: [],
    }
  }
  if (info && !perValve[id].info) {
    perValve[id].info = info
  }

  const manCmd = cmdRow?.manCmd ?? 0
  const autoCmd = cmdRow?.autoCmd ?? 0
  const inletOpen = cmdRow?.inletOpen ?? 0
  const availability = r11?.availability ?? null
  const levelError = r11?.errors?.[LEVEL_ERROR_KEY] ?? 0
  const longTime = r11?.errors?.[LONG_TIME_KEY] ?? 0
  const totalErrors = r11?.totalErrors ?? 0

  perValve[id].months.push({
    sortKey: file.sortKey,
    month: file.month,
    monthNum: file.monthNum,
    availability,
    manCmd,
    autoCmd,
    inletOpen,
    levelError,
    longTime,
    totalErrors,
    hasAvail: availability != null,
  })
}

function buildValveRow(v, totalMonths) {
  const months = v.months
  const totalMan = months.reduce((s, m) => s + m.manCmd, 0)
  const totalAuto = months.reduce((s, m) => s + m.autoCmd, 0)
  const totalInlet = months.reduce((s, m) => s + m.inletOpen, 0)
  const totalCmd = totalMan + totalAuto
  const totalLevelErrors = months.reduce((s, m) => s + m.levelError, 0)
  const totalLongTime = months.reduce((s, m) => s + m.longTime, 0)

  const reportedMonths = months.filter(m => m.hasAvail).length
  const missingMonths = Math.max(totalMonths - reportedMonths, 0)
  const zeroAvailMonths = months.filter(m => m.availability === 0).length
  const avgAvailability = reportedMonths > 0
    ? round2(months.filter(m => m.hasAvail).reduce((s, m) => s + m.availability, 0) / reportedMonths)
    : null

  // "Tyst givare": ingen autoCmd alls i hela perioden, men det finns kommandon
  // eller åtminstone aktivitet på grenen. Alt: noll total aktivitet.
  const silent = totalAuto === 0 && reportedMonths > 0

  // Misstänkta höga nivåer: LEVEL_ERROR och/eller LONG_TIME_SINCE
  // LONG_TIME kan även vara naturligt (lov/semester) men kombinationen med
  // LEVEL_ERROR eller obefintlig tömning är en tydlig signal.
  const highLevelScore = totalLevelErrors * 2 + (totalLongTime > 0 && totalAuto === 0 ? totalLongTime : 0)

  // Misstänkta låga/falska triggers: extremt många autoCmd jämfört med
  // ventilens typiska mönster. Här använder vi enkel heuristik: autoCmd > 3x
  // mediannivå per ventil över perioden.
  const autoCounts = months.map(m => m.autoCmd).filter(v => v > 0)
  const median = autoCounts.length > 0 ? medianOf(autoCounts) : 0
  const maxAuto = autoCounts.length > 0 ? Math.max(...autoCounts) : 0
  const lowLevelScore = median > 0 && maxAuto > median * 3 ? maxAuto : 0

  // "Fastnat"-värden: samma autoCmd-antal exakt lika i många månader
  // (ovanligt, tyder på att givaren slagit över i ett fast tillstånd)
  const stuckScore = detectStuck(months)

  // Sammanvägd misstänksamhetspoäng (0 = inga problem)
  let suspicionScore = 0
  if (silent && totalMan > 0) suspicionScore += 50 // tysta med manuell användning
  if (silent && totalMan === 0 && reportedMonths > 0) suspicionScore += 15 // helt tyst, svårt att avgöra
  suspicionScore += totalLevelErrors * 5
  if (highLevelScore > 0) suspicionScore += Math.min(highLevelScore, 30)
  if (lowLevelScore > 0) suspicionScore += 15
  if (stuckScore > 0) suspicionScore += 20
  if (missingMonths > 0 && totalMonths >= 3) suspicionScore += missingMonths * 5
  if (zeroAvailMonths > 0) suspicionScore += zeroAvailMonths * 10

  const manualPct = totalCmd > 0 ? round1(totalMan / totalCmd * 100) : 0

  // Sammanfattning av misstankar för UI
  const reasons = []
  if (silent && totalMan > 0) reasons.push('Tyst givare (drivs manuellt)')
  else if (silent && reportedMonths > 0) reasons.push('Rapporterar aldrig nivå')
  if (totalLevelErrors > 0) reasons.push(`${totalLevelErrors} nivåfel`)
  if (highLevelScore > 0 && !silent) reasons.push('Misstänkt hög nivå')
  if (lowLevelScore > 0) reasons.push('Misstänkt låg nivå / falska triggers')
  if (stuckScore > 0) reasons.push('Fastnat värde')
  if (missingMonths > 0 && totalMonths >= 3) reasons.push(`Saknas ${missingMonths} mån`)
  if (zeroAvailMonths > 0) reasons.push(`${zeroAvailMonths} mån 0% tillgänglighet`)

  return {
    valveId: v.valveId,
    branch: v.branch,
    valveNum: v.valveNum,
    info: v.info,
    totalMan,
    totalAuto,
    totalInlet,
    totalCmd,
    manualPct,
    totalLevelErrors,
    totalLongTime,
    avgAvailability,
    reportedMonths,
    missingMonths,
    zeroAvailMonths,
    silent,
    highLevelScore,
    lowLevelScore,
    stuckScore,
    suspicionScore,
    reasons: reasons.join(', '),
    reasonList: reasons,
  }
}

function detectStuck(months) {
  const withCmd = months.filter(m => m.autoCmd > 0)
  if (withCmd.length < 3) return 0
  const counts = {}
  for (const m of withCmd) {
    counts[m.autoCmd] = (counts[m.autoCmd] || 0) + 1
  }
  const maxSame = Math.max(...Object.values(counts))
  // Samma exakta värde i 3+ månader på rad är osannolikt i normal drift
  if (maxSame >= 3) return maxSame
  return 0
}

function buildMonthlyErrorSeries(parsedFiles) {
  const byMonth = {}
  for (const file of parsedFiles) {
    if (!byMonth[file.sortKey]) {
      byMonth[file.sortKey] = {
        sortKey: file.sortKey,
        month: file.month,
        monthNum: file.monthNum,
        levelError: 0,
        longTime: 0,
        silentValves: 0,
      }
    }
    const entry = byMonth[file.sortKey]
    let silentInMonth = 0
    for (const r11 of file.sheets.sheet11) {
      entry.levelError += r11.errors?.[LEVEL_ERROR_KEY] || 0
      entry.longTime += r11.errors?.[LONG_TIME_KEY] || 0
    }
    // Count valves in this month with autoCmd=0 (inferrable only within the month)
    for (const r9 of file.sheets.sheet9) {
      if (r9.autoCmd === 0 && (r9.manCmd > 0 || r9.inletOpen > 0)) silentInMonth++
    }
    entry.silentValves = silentInMonth
  }
  return Object.values(byMonth).sort((a, b) => a.sortKey - b.sortKey)
}

/**
 * Summera ett numeriskt fält (t.ex. "highLevel" eller "lowLevel") från Sheet9
 * per ventil över hela perioden. Används för att filtrera bort ventiler som
 * saknar noteringar helt.
 */
function sumPerValve(parsedFiles, field) {
  const totals = {}
  for (const file of parsedFiles) {
    for (const r of file.sheets.sheet9 || []) {
      if (!r.id) continue
      totals[r.id] = (totals[r.id] || 0) + (r[field] || 0)
    }
  }
  return totals
}

/**
 * Stackat månatligt totalantal LONG_TIME_SINCE_LAST_COLLECTION fördelat per
 * fraktion. Bara ventiler i `valveFilter` räknas (de som har noteringar under
 * perioden). Ventiler utan känd fraktion samlas under etiketten "Okänd".
 * Returnerar { months: ['2025-01', ...], fractions: ['Rest', 'Plastic'],
 *              data: [{ month, Rest: 3, Plastic: 1, ... }] }.
 */
function buildLongTimePerMonthByFraction(parsedFiles, valveFilter, fractionMap) {
  const byMonth = {}
  const fractions = new Set()

  for (const file of parsedFiles) {
    const key = file.sortKey
    if (!byMonth[key]) {
      byMonth[key] = { sortKey: key, month: file.month, monthNum: file.monthNum, _fracs: {} }
    }
    for (const r11 of file.sheets.sheet11 || []) {
      if (!valveFilter.has(r11.id)) continue
      const v = r11.errors?.[LONG_TIME_KEY] || 0
      if (v <= 0) continue
      const frac = fractionMap?.get(r11.id) || 'Okänd'
      fractions.add(frac)
      byMonth[key]._fracs[frac] = (byMonth[key]._fracs[frac] || 0) + v
    }
  }

  const sortedFracs = [...fractions].sort()
  const data = Object.values(byMonth)
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(m => {
      const entry = { month: m.month, sortKey: m.sortKey, monthNum: m.monthNum }
      for (const f of sortedFracs) entry[f] = m._fracs[f] || 0
      return entry
    })

  return { months: data.map(d => d.month), fractions: sortedFracs, data }
}

/**
 * Månatlig summa av ett Sheet9-fält (t.ex. "highLevel", "lowLevel") över bara
 * ventiler som har noteringar någon gång i perioden.
 */
function buildMonthlyFieldSeries(parsedFiles, field, valveFilter) {
  const byMonth = {}
  for (const file of parsedFiles) {
    const key = file.sortKey
    if (!byMonth[key]) {
      byMonth[key] = {
        sortKey: key,
        month: file.month,
        monthNum: file.monthNum,
        count: 0,
      }
    }
    for (const r9 of file.sheets.sheet9 || []) {
      if (!valveFilter.has(r9.id)) continue
      byMonth[key].count += r9[field] || 0
    }
  }
  return Object.values(byMonth).sort((a, b) => a.sortKey - b.sortKey)
}

function parseValveId(vid) {
  const parts = String(vid).split(':')
  if (parts.length !== 2) return { branch: -1, valveNum: -1 }
  const branch = parseInt(parts[0], 10)
  const valveNum = parseInt(parts[1], 10)
  return {
    branch: isNaN(branch) ? -1 : branch,
    valveNum: isNaN(valveNum) ? -1 : valveNum,
  }
}

function medianOf(arr) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function round1(n) { return Math.round(n * 10) / 10 }
function round2(n) { return Math.round(n * 100) / 100 }

function emptyResult() {
  return {
    totalValves: 0,
    totalMonths: 0,
    silentCount: 0,
    silentPct: 0,
    suspectCount: 0,
    suspectPct: 0,
    totalLevelErrors: 0,
    valveRows: [],
    suspects: [],
    silentSensors: [],
    highLevelSuspects: [],
    lowLevelSuspects: [],
    stuckSensors: [],
    missingReporting: [],
    branchSummary: [],
    monthlyLevelErrors: [],
    longTimePerMonthByFraction: { months: [], fractions: [], data: [] },
    highLevelMonthly: [],
    lowLevelMonthly: [],
    monthKeys: [],
  }
}
