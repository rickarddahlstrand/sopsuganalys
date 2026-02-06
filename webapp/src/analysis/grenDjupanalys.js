/**
 * Port of scripts/gren_djupanalys.py
 * Sources: Sheet9+11 Info → branch types, health scores
 */

export function analyzeGrenar(parsedFiles) {
  // Collect valve info from Sheet9/11
  const valveInfo = collectValveInfo(parsedFiles)

  // Collect per-branch per-month data
  const branchData = collectBranchData(parsedFiles)

  // Identify branch characteristics
  const profiles = identifyBranchCharacteristics(valveInfo, branchData)

  // Unique branches
  const branches = [...new Set(branchData.map(r => r.branch))].sort((a, b) => a - b)

  return {
    valveInfo,
    branchData,
    profiles,
    branches,
    totalBranches: branches.length,
  }
}

function parseValveId(vid) {
  const parts = String(vid).split(':')
  if (parts.length !== 2) return { branch: -1, valveNum: -1 }
  return { branch: parseInt(parts[0], 10), valveNum: parseInt(parts[1], 10) }
}

function collectValveInfo(parsedFiles) {
  const infoRows = []
  const seenIds = new Set()

  for (const file of parsedFiles) {
    for (const row of file.sheets.sheet9) {
      if (seenIds.has(row.id) || !row.info) continue
      const { branch, valveNum } = parseValveId(row.id)
      infoRows.push({ valveId: row.id, branch, valveNum, info: row.info })
      seenIds.add(row.id)
    }
    for (const row of file.sheets.sheet11) {
      if (seenIds.has(row.id) || !row.info) continue
      const { branch, valveNum } = parseValveId(row.id)
      infoRows.push({ valveId: row.id, branch, valveNum, info: row.info })
      seenIds.add(row.id)
    }
  }
  return infoRows
}

function collectBranchData(parsedFiles) {
  const rows = []

  for (const file of parsedFiles) {
    const { monthNum, sortKey, month, sheets } = file

    // Build command lookup from sheet9
    const cmdLookup = {}
    for (const r9 of sheets.sheet9) {
      cmdLookup[r9.id] = { man: r9.manCmd, auto: r9.autoCmd }
    }

    // Aggregate per branch
    const branchMap = {}
    for (const row of sheets.sheet11) {
      const { branch } = parseValveId(row.id)
      if (branch < 0) continue

      if (!branchMap[branch]) {
        branchMap[branch] = {
          availSum: 0, availCount: 0,
          errors: 0, man: 0, auto: 0, valves: new Set(),
        }
      }
      branchMap[branch].availSum += row.availability
      branchMap[branch].availCount++
      branchMap[branch].errors += row.totalErrors
      const cmds = cmdLookup[row.id] || { man: 0, auto: 0 }
      branchMap[branch].man += cmds.man
      branchMap[branch].auto += cmds.auto
      branchMap[branch].valves.add(row.id)
    }

    for (const [branch, gd] of Object.entries(branchMap)) {
      const totalCmd = gd.man + gd.auto
      rows.push({
        monthNum,
        sortKey,
        month,
        branch: parseInt(branch, 10),
        avgAvailability: Math.round(gd.availSum / gd.availCount * 100) / 100,
        totalErrors: gd.errors,
        manCmd: gd.man,
        autoCmd: gd.auto,
        totalCmd,
        manualPct: totalCmd > 0 ? Math.round(gd.man / totalCmd * 1000) / 10 : 0,
        valveCount: gd.valves.size,
      })
    }
  }

  return rows
}

function identifyBranchCharacteristics(valveInfo, branchData) {
  // Collect info per branch
  const branchInfo = {}
  for (const vi of valveInfo) {
    if (vi.branch < 0) continue
    if (!branchInfo[vi.branch]) branchInfo[vi.branch] = []
    branchInfo[vi.branch].push(vi.info)
  }

  // Detect branch type from info text
  const branchTypes = {}
  for (const [branch, texts] of Object.entries(branchInfo)) {
    const combined = texts.join(' ').toLowerCase()
    if (/skola|school|förskola|förskolebarn/.test(combined)) {
      branchTypes[branch] = 'Skola/förskola'
    } else if (/kontor|office|butik|handel/.test(combined)) {
      branchTypes[branch] = 'Kontor/handel'
    } else if (/bostäder|lägenhet|brf|hush/.test(combined)) {
      branchTypes[branch] = 'Bostäder'
    } else {
      branchTypes[branch] = 'Övrigt'
    }
  }

  // Build profiles
  const allBranches = [...new Set(branchData.map(r => r.branch))].sort((a, b) => a - b)
  const profiles = []

  for (const branch of allBranches) {
    const bData = branchData.filter(r => r.branch === branch)
    if (!bData.length) continue

    const avgAvail = avg(bData.map(r => r.avgAvailability))
    const totalErrors = bData.reduce((s, r) => s + r.totalErrors, 0)
    const avgManualPct = avg(bData.map(r => r.manualPct))
    const maxValves = Math.max(...bData.map(r => r.valveCount))

    // Season analysis
    const summer = bData.filter(r => [6, 7, 8].includes(r.monthNum))
    const winter = bData.filter(r => [12, 1, 2].includes(r.monthNum))
    const summerCmd = summer.length > 0 ? avg(summer.map(r => r.totalCmd)) : 0
    const winterCmd = winter.length > 0 ? avg(winter.map(r => r.totalCmd)) : 0
    const meanCmd = avg(bData.map(r => r.totalCmd))

    const std = Math.sqrt(avg(bData.map(r => (r.totalCmd - meanCmd) ** 2)))
    const cv = meanCmd > 0 ? Math.round(std / meanCmd * 1000) / 10 : 0

    const summerRatio = meanCmd > 0 ? summerCmd / meanCmd : 0
    let seasonType = 'Jämn'
    if (summerRatio < 0.7) seasonType = 'Sommarsvacka'
    else if (summerRatio > 1.3) seasonType = 'Sommartopp'

    profiles.push({
      branch,
      valveCount: maxValves,
      avgAvailability: Math.round(avgAvail * 100) / 100,
      totalErrors,
      manualPct: Math.round(avgManualPct * 10) / 10,
      info: (branchInfo[branch] || []).join('; '),
      branchType: branchTypes[branch] || 'Okänd',
      seasonType,
      cv,
      summerCmd: Math.round(summerCmd),
      winterCmd: Math.round(winterCmd),
    })
  }

  return profiles
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
