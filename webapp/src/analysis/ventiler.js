/**
 * Port of scripts/ventiler.py
 * Sources: Sheet9 (commands), Sheet11 (availability + errors)
 */

const ERROR_NAMES = [
  'DOES_NOT_CLOSE', 'DOES_NOT_OPEN', 'LEVEL_ERROR',
  'LONG_TIME_SINCE_LAST_COLLECTION', 'ERROR_FEEDBACK_FROM_USER',
]

export function analyzeVentiler(parsedFiles) {
  const availability = []  // per valve per month
  const errors = []        // per valve per month per error type
  const commands = []       // per valve per month

  for (const file of parsedFiles) {
    const { monthNum, sortKey, month, sheets } = file

    // Sheet11: availability + errors
    for (const row of sheets.sheet11) {
      availability.push({
        monthNum,
        sortKey,
        month,
        valveId: row.id,
        availability: row.availability,
      })

      for (const [errType, count] of Object.entries(row.errors)) {
        if (count > 0) {
          errors.push({
            monthNum,
            sortKey,
            month,
            valveId: row.id,
            errorType: errType,
            count,
          })
        }
      }
    }

    // Sheet9: commands
    for (const row of sheets.sheet9) {
      commands.push({
        monthNum,
        sortKey,
        month,
        valveId: row.id,
        manCmd: row.manCmd,
        autoCmd: row.autoCmd,
        inletOpen: row.inletOpen,
      })
    }
  }

  // Mean availability per valve
  const valveAvail = {}
  for (const a of availability) {
    if (!valveAvail[a.valveId]) valveAvail[a.valveId] = []
    valveAvail[a.valveId].push(a.availability)
  }
  const valveAvgAvail = Object.entries(valveAvail).map(([id, vals]) => ({
    valveId: id,
    avgAvailability: round2(avg(vals)),
  }))

  // Total errors per valve
  const valveErrors = {}
  for (const e of errors) {
    valveErrors[e.valveId] = (valveErrors[e.valveId] || 0) + e.count
  }

  // Per-valve summary: availability + total errors
  const valveSummary = valveAvgAvail.map(v => ({
    ...v,
    totalErrors: valveErrors[v.valveId] || 0,
  })).sort((a, b) => a.avgAvailability - b.avgAvailability)

  // Monthly aggregated availability
  const monthlyAvail = {}
  for (const a of availability) {
    if (!monthlyAvail[a.sortKey]) monthlyAvail[a.sortKey] = { monthNum: a.monthNum, sortKey: a.sortKey, month: a.month, vals: [] }
    monthlyAvail[a.sortKey].vals.push(a.availability)
  }
  const monthlyAvailSummary = Object.values(monthlyAvail)
    .map(m => ({
      monthNum: m.monthNum,
      sortKey: m.sortKey,
      month: m.month,
      mean: round2(avg(m.vals)),
      min: round2(Math.min(...m.vals)),
      max: round2(Math.max(...m.vals)),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)

  // Monthly errors by type
  const monthlyErrors = {}
  for (const e of errors) {
    if (!monthlyErrors[e.sortKey]) monthlyErrors[e.sortKey] = { monthNum: e.monthNum, sortKey: e.sortKey, month: e.month }
    monthlyErrors[e.sortKey][e.errorType] = (monthlyErrors[e.sortKey][e.errorType] || 0) + e.count
  }
  const monthlyErrorsSorted = Object.values(monthlyErrors).sort((a, b) => a.sortKey - b.sortKey)

  // Error type totals
  const errorTypeTotals = {}
  for (const e of errors) {
    errorTypeTotals[e.errorType] = (errorTypeTotals[e.errorType] || 0) + e.count
  }

  // Overall stats
  const allAvails = availability.map(a => a.availability)
  const overallAvail = round2(avg(allAvails))
  const uniqueValves = new Set(availability.map(a => a.valveId)).size
  const totalErrors = errors.reduce((s, e) => s + e.count, 0)

  return {
    availability,
    errors,
    commands,
    valveSummary,
    monthlyAvailSummary,
    monthlyErrors: monthlyErrorsSorted,
    errorTypeTotals,
    overallAvail,
    uniqueValves,
    totalErrors,
    worstValves: valveSummary, // sorted ascending by availability — full list
    errorNames: ERROR_NAMES,
  }
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function round2(n) { return Math.round(n * 100) / 100 }
