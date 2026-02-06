import { readSheet, readSheet1 } from './xlsParser'

function findCol(headers, ...patterns) {
  return headers.find(h => {
    const low = h.toLowerCase()
    return patterns.some(p => low.includes(p))
  })
}

function toNum(val) {
  if (val == null || val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

/** Sheet3 (header_row 3): Energy (kWh), Operation Time (h) */
export function extractSheet3(workbook) {
  const rows = readSheet(workbook, 'Sheet3', 3)
  const sample = rows[0] || {}
  const headers = Object.keys(sample)

  const energyCol = findCol(headers, 'energy', 'kwh')
  const timeCol = findCol(headers, 'operation', 'time')

  let totalEnergy = 0, totalTime = 0
  for (const row of rows) {
    const e = toNum(row[energyCol])
    const t = toNum(row[timeCol])
    if (e != null) totalEnergy += e
    if (t != null) totalTime += t
  }
  return { totalEnergy: Math.round(totalEnergy * 10) / 10, totalTime: Math.round(totalTime * 10) / 10 }
}

/** Sheet5 (header_row 3): Fraction, Hours, kWh, Emptyings, Emptying/minute */
export function extractSheet5(workbook) {
  const rows = readSheet(workbook, 'Sheet5', 3)
  if (!rows.length) return []
  const headers = Object.keys(rows[0])

  const fracCol = findCol(headers, 'fraction')
  const hoursCol = headers.find(h => h.toLowerCase().trim() === 'hours')
  const kwhCol = findCol(headers, 'kwh')
  const emptyCol = headers.find(h => {
    const l = h.toLowerCase()
    return (l.includes('emptying') || l.includes('emptyings')) && !l.includes('minute')
  })
  const epmCol = findCol(headers, 'minute')

  const result = []
  for (const row of rows) {
    const frac = fracCol ? String(row[fracCol] ?? '').trim() : ''
    if (!frac || frac === 'nan') continue
    if (frac.toLowerCase() === 'month' || /^\d{2}-\w+$/.test(frac)) continue

    result.push({
      fraction: frac,
      hours: toNum(row[hoursCol]),
      kWh: toNum(row[kwhCol]),
      emptyings: toNum(row[emptyCol]),
      emptyingPerMinute: toNum(row[epmCol]),
    })
  }
  return result
}

/** Sheet7 (header_row 4): Name, ID, Starts, Hours, kWh */
export function extractSheet7(workbook) {
  const rows = readSheet(workbook, 'Sheet7', 4)
  if (!rows.length) return []
  const headers = Object.keys(rows[0])

  const nameCol = findCol(headers, 'name')
  const startsCol = findCol(headers, 'start')
  const hoursCol = findCol(headers, 'hour')
  const kwhCol = findCol(headers, 'kwh')

  const result = []
  for (const row of rows) {
    const name = nameCol ? String(row[nameCol] ?? '').trim() : ''
    if (!name || name === 'nan' || name.toLowerCase() === 'total') continue

    const starts = toNum(row[startsCol]) || 0
    const hours = toNum(row[hoursCol]) || 0
    const kwh = toNum(row[kwhCol]) || 0

    result.push({ name, starts, hours, kWh: kwh })
  }
  return result
}

/** Sheet9 (header_row 3): ID, Info, MAN_OPEN_CMD, AUTO_OPEN_CMD, INLET_OPEN */
export function extractSheet9(workbook) {
  const rows = readSheet(workbook, 'Sheet9', 3)
  if (!rows.length) return []
  const headers = Object.keys(rows[0])

  const idCol = headers.find(h => h.toLowerCase().trim() === 'id')
  const infoCol = findCol(headers, 'info')

  // Command columns
  const cmdCols = {}
  for (const h of headers) {
    const up = h.trim().toUpperCase()
    if (up === 'MAN_OPEN_CMD') cmdCols.manCmd = h
    else if (up === 'AUTO_OPEN_CMD') cmdCols.autoCmd = h
    else if (up === 'INLET_OPEN') cmdCols.inletOpen = h
  }

  const result = []
  for (const row of rows) {
    const vid = idCol ? String(row[idCol] ?? '').trim() : ''
    if (!vid || vid === 'nan') continue

    result.push({
      id: vid,
      info: infoCol ? String(row[infoCol] ?? '').trim().replace(/^nan$/, '') : '',
      manCmd: toNum(row[cmdCols.manCmd]) || 0,
      autoCmd: toNum(row[cmdCols.autoCmd]) || 0,
      inletOpen: toNum(row[cmdCols.inletOpen]) || 0,
    })
  }
  return result
}

const ERROR_COL_NAMES = [
  'DOES_NOT_CLOSE', 'DOES_NOT_OPEN', 'LEVEL_ERROR',
  'LONG_TIME_SINCE_LAST_COLLECTION', 'ERROR_FEEDBACK_FROM_USER',
]

/** Sheet11 (header_row 3): ID, Info, Availability [%], error columns */
export function extractSheet11(workbook) {
  const rows = readSheet(workbook, 'Sheet11', 3)
  if (!rows.length) return []
  const headers = Object.keys(rows[0])

  const idCol = headers.find(h => h.toLowerCase().trim() === 'id')
  const infoCol = findCol(headers, 'info')
  const availCol = findCol(headers, 'availability')

  // Find error columns
  const foundErrorCols = {}
  for (const h of headers) {
    if (ERROR_COL_NAMES.includes(h)) foundErrorCols[h] = h
  }

  // Also check availability/command columns
  const manCol = headers.find(h => h.trim().toUpperCase() === 'MAN_OPEN_CMD')
  const autoCol = headers.find(h => h.trim().toUpperCase() === 'AUTO_OPEN_CMD')

  const result = []
  for (const row of rows) {
    const vid = idCol ? String(row[idCol] ?? '').trim() : ''
    if (!vid || vid === 'nan') continue

    const avail = toNum(row[availCol])
    if (avail == null) continue

    const errors = {}
    let totalErrors = 0
    for (const [errName, colName] of Object.entries(foundErrorCols)) {
      const v = toNum(row[colName]) || 0
      errors[errName] = v
      totalErrors += v
    }

    result.push({
      id: vid,
      info: infoCol ? String(row[infoCol] ?? '').trim().replace(/^nan$/, '') : '',
      availability: avail,
      errors,
      totalErrors,
      manCmd: toNum(row[manCol]) || 0,
      autoCmd: toNum(row[autoCol]) || 0,
    })
  }
  return result
}

/** Sheet13 (header_row 7): Alarm category, Current period, Average based on previous year */
export function extractSheet13(workbook) {
  const rows = readSheet(workbook, 'Sheet13', 7)
  if (!rows.length) return []
  const headers = Object.keys(rows[0])

  const catCol = findCol(headers, 'alarm', 'category')
  const currentCol = findCol(headers, 'current', 'period')
  const avgCol = findCol(headers, 'average', 'previous')

  const result = []
  for (const row of rows) {
    const cat = catCol ? String(row[catCol] ?? '').trim() : ''
    if (!cat || cat === 'nan') continue

    const current = toNum(row[currentCol])
    if (current == null) continue

    result.push({
      category: cat,
      currentPeriod: current,
      previousAvg: toNum(row[avgCol]),
    })
  }
  return result
}

/** Sheet1: special merged-cell reader */
export function extractSheet1(workbook) {
  return readSheet1(workbook)
}
