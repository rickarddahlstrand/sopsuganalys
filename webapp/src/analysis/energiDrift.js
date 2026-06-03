/**
 * Energi- & driftanalys.
 *
 * Sources:
 *   - monthlyHistory: kombinerad/dedupad historik fran alla filers Sheet3+Sheet5
 *   - parsedFiles[].sheets.sheet7: per-fil programstatistik (medelvarde av filerna)
 */

export function analyzeEnergiDrift(parsedFiles, monthlyHistory) {
  const history = monthlyHistory || []
  const energy = []
  const fractions = []
  const machines = []

  // Energi & drifttid per manad fran kombinerad historik
  for (const m of history) {
    energy.push({
      monthNum: m.monthNum,
      sortKey: m.sortKey,
      month: m.month,
      energyKwh: m.energyTotal || 0,
      operationTimeH: m.operationTime || 0,
    })

    // Per-fraktion tomningar per manad fran perFraction
    for (const [frac, data] of Object.entries(m.perFraction || {})) {
      const emptyings = Math.round(data.emptyings || 0)
      if (emptyings > 0) {
        fractions.push({
          monthNum: m.monthNum,
          sortKey: m.sortKey,
          month: m.month,
          fraction: frac,
          emptyings,
          kWh: data.energy || 0,
          hours: data.hours,
          emptyingPerMinute: null,
        })
      }
    }
  }

  // Maskiner: Sheet7 ar per-fil snapshot. Anvand alla filer for snitt.
  for (const file of parsedFiles || []) {
    const { monthNum, sortKey, month, sheets } = file
    for (const row of sheets.sheet7 || []) {
      machines.push({
        monthNum,
        sortKey,
        month,
        machine: row.name,
        starts: row.starts,
        hours: row.hours,
        kWh: row.kWh,
      })
    }
  }

  const totalEnergy = energy.reduce((s, e) => s + e.energyKwh, 0)
  const totalTime = energy.reduce((s, e) => s + e.operationTimeH, 0)
  const totalEmptyings = fractions.reduce((s, f) => s + f.emptyings, 0)

  const fractionTotals = {}
  for (const f of fractions) {
    fractionTotals[f.fraction] = (fractionTotals[f.fraction] || 0) + f.emptyings
  }

  const fractionNames = Object.entries(fractionTotals)
    .sort((a, b) => b[1] - a[1])
    .map(e => e[0])

  const monthlyFractions = {}
  for (const f of fractions) {
    if (!monthlyFractions[f.sortKey]) {
      monthlyFractions[f.sortKey] = { monthNum: f.monthNum, sortKey: f.sortKey, month: f.month }
    }
    monthlyFractions[f.sortKey][f.fraction] = (monthlyFractions[f.sortKey][f.fraction] || 0) + f.emptyings
  }

  const machineMap = {}
  for (const m of machines) {
    if (!machineMap[m.machine]) machineMap[m.machine] = { starts: [], hours: [], kWh: [] }
    machineMap[m.machine].starts.push(m.starts)
    machineMap[m.machine].hours.push(m.hours)
    machineMap[m.machine].kWh.push(m.kWh)
  }
  const machineAvg = Object.entries(machineMap).map(([name, data]) => ({
    name,
    avgStarts: Math.round(avg(data.starts)),
    avgHours: round1(avg(data.hours)),
    avgKwh: Math.round(avg(data.kWh)),
  }))

  return {
    energy,
    fractions,
    machines,
    totalEnergy: Math.round(totalEnergy),
    totalTime: Math.round(totalTime),
    totalEmptyings,
    fractionTotals,
    fractionNames,
    monthlyFractions: Object.values(monthlyFractions).sort((a, b) => a.sortKey - b.sortKey),
    machineAvg,
  }
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + (v || 0), 0) / arr.length
}

function round1(n) {
  return Math.round(n * 10) / 10
}
