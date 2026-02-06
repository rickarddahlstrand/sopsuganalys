/**
 * Port of scripts/manuell_analys.py
 * Sources: Sheet9 (commands), Sheet11 (availability), Sheet3 (operation time)
 */

export function analyzeManuell(parsedFiles) {
  const manualData = []

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
