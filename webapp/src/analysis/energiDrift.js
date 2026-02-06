/**
 * Port of scripts/energi_drift.py
 * Sources: Sheet3 (energy, op time), Sheet5 (fractions), Sheet7 (machines)
 */

export function analyzeEnergiDrift(parsedFiles) {
  const energy = []
  const fractions = []
  const machines = []

  for (const file of parsedFiles) {
    const { monthNum, sortKey, month, sheets } = file

    // Sheet3: total energy + operation time
    const s3 = sheets.sheet3
    energy.push({
      monthNum,
      sortKey,
      month,
      energyKwh: s3.totalEnergy,
      operationTimeH: s3.totalTime,
    })

    // Sheet5: per-fraction emptyings
    for (const row of sheets.sheet5) {
      if (row.emptyings && row.emptyings > 0) {
        fractions.push({
          monthNum,
          sortKey,
          month,
          fraction: row.fraction,
          emptyings: Math.round(row.emptyings),
          kWh: row.kWh || 0,
          hours: row.hours,
          emptyingPerMinute: row.emptyingPerMinute,
        })
      }
    }

    // Sheet7: machines
    for (const row of sheets.sheet7) {
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

  // Compute totals
  const totalEnergy = energy.reduce((s, e) => s + e.energyKwh, 0)
  const totalTime = energy.reduce((s, e) => s + e.operationTimeH, 0)
  const totalEmptyings = fractions.reduce((s, f) => s + f.emptyings, 0)

  // Fractions pivoted: { fraction: totalEmptyings }
  const fractionTotals = {}
  for (const f of fractions) {
    fractionTotals[f.fraction] = (fractionTotals[f.fraction] || 0) + f.emptyings
  }

  // Fraction names (sorted by total)
  const fractionNames = Object.entries(fractionTotals)
    .sort((a, b) => b[1] - a[1])
    .map(e => e[0])

  // Monthly stacked fraction data for charts
  const monthlyFractions = {}
  for (const f of fractions) {
    if (!monthlyFractions[f.sortKey]) monthlyFractions[f.sortKey] = { monthNum: f.monthNum, sortKey: f.sortKey, month: f.month }
    monthlyFractions[f.sortKey][f.fraction] = (monthlyFractions[f.sortKey][f.fraction] || 0) + f.emptyings
  }

  // Machine averages
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
