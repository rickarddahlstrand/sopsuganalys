import { readSheet, readSheet1, readSheet1Header } from './xlsParser'
import * as XLSX from 'xlsx'

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

const MONTH_LABEL_RE = /^\d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i

function isMonthLabel(s) {
  return typeof s === 'string' && MONTH_LABEL_RE.test(s.trim())
}

const MONTH_ABBR = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

/**
 * Konvertera "25-Mar" till sortKey 202503. Returnerar null vid ogiltigt format.
 */
export function monthLabelToSortKey(label) {
  if (!label) return null
  const s = String(label).trim()
  const m = s.match(/^(\d{2})-([A-Za-z]{3})$/)
  if (!m) return null
  const yy = parseInt(m[1], 10)
  const monthNum = MONTH_ABBR[m[2].toLowerCase()]
  if (!monthNum) return null
  const year = 2000 + yy
  return year * 100 + monthNum
}

/**
 * Sheet3: ackumulerad historik per manad.
 *
 * Layout (header pa rad 3 + 4):
 *   R3: "Energy (kWh)" ovanfor kol 3, "Operation Time (h)" ovanfor kol 10
 *   R4: Month | Auto | Manual | Idle | Total | (mellanrum) | Auto | Manual | Idle
 *
 * Returnerar:
 *   {
 *     monthlyHistory: [{ monthLabel, sortKey, energyAuto, energyManual,
 *                        energyIdle, energyTotal, timeAuto, timeManual, timeIdle }, ...],
 *     totalEnergy, totalTime  -- bakat kompat: filens rapportmanad (sista manaden fore SUM)
 *   }
 */
export function extractSheet3(workbook) {
  const ws = workbook.Sheets['Sheet3']
  if (!ws) return { monthlyHistory: [], totalEnergy: 0, totalTime: 0 }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

  // Hitta header-rad och kolumner dynamiskt
  let headerRow = -1
  const cols = { month: -1, eAuto: -1, eManual: -1, eIdle: -1, eTotal: -1, tAuto: -1, tManual: -1, tIdle: -1 }

  // Forsta rad: hitta supergrupper Energy / Operation Time
  let energyStart = -1
  let timeStart = -1
  for (let r = 0; r <= Math.min(range.e.r, 6); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell) continue
      const v = String(cell.v || '').trim().toLowerCase()
      if (v.includes('energy') && v.includes('kwh') && energyStart < 0) energyStart = c
      if (v.includes('operation') && v.includes('time') && timeStart < 0) timeStart = c
    }
  }

  // Header-rad (nasta) — leta "Month", "Auto", "Manual", "Idle", "Total"
  for (let r = 0; r <= Math.min(range.e.r, 8); r++) {
    let saw = false
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell) continue
      const v = String(cell.v || '').trim()
      if (v === 'Month') { cols.month = c; saw = true; headerRow = r }
    }
    if (saw) break
  }
  if (headerRow < 0 || cols.month < 0) return { monthlyHistory: [], totalEnergy: 0, totalTime: 0 }

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })]
    if (!cell) continue
    const v = String(cell.v || '').trim()
    if (v !== 'Auto' && v !== 'Manual' && v !== 'Idle' && v !== 'Total') continue
    const isEnergy = energyStart >= 0 && timeStart >= 0 ? c < timeStart : true
    if (isEnergy) {
      if (v === 'Auto') cols.eAuto = c
      else if (v === 'Manual') cols.eManual = c
      else if (v === 'Idle') cols.eIdle = c
      else if (v === 'Total') cols.eTotal = c
    } else {
      if (v === 'Auto') cols.tAuto = c
      else if (v === 'Manual') cols.tManual = c
      else if (v === 'Idle') cols.tIdle = c
    }
  }

  const monthlyHistory = []
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const labelCell = ws[XLSX.utils.encode_cell({ r, c: cols.month })]
    const label = labelCell ? String(labelCell.v || '').trim() : ''
    if (!label || label.toUpperCase() === 'SUM') continue
    if (!isMonthLabel(label)) continue

    const get = c => c >= 0 ? toNum(ws[XLSX.utils.encode_cell({ r, c })]?.v) : null
    monthlyHistory.push({
      monthLabel: label,
      sortKey: monthLabelToSortKey(label),
      energyAuto: get(cols.eAuto) || 0,
      energyManual: get(cols.eManual) || 0,
      energyIdle: get(cols.eIdle) || 0,
      energyTotal: get(cols.eTotal) || 0,
      timeAuto: get(cols.tAuto) || 0,
      timeManual: get(cols.tManual) || 0,
      timeIdle: get(cols.tIdle) || 0,
    })
  }

  // Filens rapportmanad: sista raden (kronologiskt sist) bland month_rows
  const last = monthlyHistory[monthlyHistory.length - 1]
  const totalEnergy = last ? Math.round(last.energyTotal * 10) / 10 : 0
  const totalTime = last ? Math.round((last.timeAuto + last.timeManual + last.timeIdle) * 10) / 10 : 0

  return { monthlyHistory, totalEnergy, totalTime }
}

/**
 * Sheet5: bade fraktions-sammanfattning for rapportperioden OCH per-manad-historik.
 *
 * Layout:
 *   R3 header: "Fraction | Hours | kWh | Emptyings | Emptying/minute | kWh/emptying"
 *   R4-N: per-fraktion-sammanfattning (Rest/Plastic/Organic) for FILENS rapportperiod
 *   R9 supergrupper: "Organic" / "Plastic" / "Rest"
 *   R10 header: "Month | Organic Hours | Energy | Emptyings | Plastic Hours | Energy | Emptyings | Rest Hours | Energy | Emptyings"
 *   R11-M: per-manad data per fraktion
 *
 * Returnerar:
 *   {
 *     fractions: [{ fraction, hours, kWh, emptyings, emptyingPerMinute }, ...],
 *     monthlyHistory: [{ monthLabel, sortKey, perFraction: { [frac]: { hours, energy, emptyings } } }, ...]
 *   }
 */
export function extractSheet5(workbook) {
  const ws = workbook.Sheets['Sheet5']
  if (!ws) return { fractions: [], monthlyHistory: [] }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

  // 1. Hitta forsta "Fraction"-headern och las fraktioner under tills tom rad
  let fracHeaderRow = -1
  const fracCols = { fraction: -1, hours: -1, kWh: -1, emptyings: -1, epm: -1 }
  for (let r = 0; r <= Math.min(range.e.r, 8); r++) {
    let sawFraction = false
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell) continue
      const v = String(cell.v || '').trim()
      if (v === 'Fraction') { fracCols.fraction = c; sawFraction = true }
      else if (v === 'Hours' && fracCols.hours < 0) fracCols.hours = c
      else if (v === 'kWh' && fracCols.kWh < 0) fracCols.kWh = c
      else if (v === 'Emptyings' && fracCols.emptyings < 0) fracCols.emptyings = c
      else if (v.toLowerCase().includes('emptying') && v.toLowerCase().includes('minute') && fracCols.epm < 0) fracCols.epm = c
    }
    if (sawFraction) { fracHeaderRow = r; break }
  }

  const fractions = []
  if (fracHeaderRow >= 0 && fracCols.fraction >= 0) {
    for (let r = fracHeaderRow + 1; r <= range.e.r; r++) {
      const labelCell = ws[XLSX.utils.encode_cell({ r, c: fracCols.fraction })]
      const label = labelCell ? String(labelCell.v || '').trim() : ''
      if (!label) break  // tom rad => slut pa fraktionsavsnittet
      if (label.toLowerCase() === 'month' || isMonthLabel(label)) break
      if (label.toLowerCase() === 'sum' || label.toLowerCase() === 'total') continue

      const get = c => c >= 0 ? toNum(ws[XLSX.utils.encode_cell({ r, c })]?.v) : null
      fractions.push({
        fraction: label,
        hours: get(fracCols.hours),
        kWh: get(fracCols.kWh),
        emptyings: get(fracCols.emptyings),
        emptyingPerMinute: get(fracCols.epm),
      })
    }
  }

  // 2. Hitta historik-headern: rad med "Month" i kol 1 och "Hours"/"Energy"/"Emptyings"
  //    per fraktion. Supergrupperna ovanfor (Organic/Plastic/Rest) anger vilken
  //    fraktion varje kolumn-tripel galler.
  let histHeaderRow = -1
  let monthCol = -1
  for (let r = (fracHeaderRow >= 0 ? fracHeaderRow + 1 : 0); r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell && String(cell.v || '').trim() === 'Month') {
        histHeaderRow = r
        monthCol = c
        break
      }
    }
    if (histHeaderRow >= 0) break
  }

  const monthlyHistory = []
  if (histHeaderRow >= 0) {
    // Las supergrupp-rad: leta efter fraktionsnamn ovanfor varje kolumn
    // Scanna 1-2 rader ovan for supergrupp-etiketter
    const fracForCol = {}
    let currentFrac = null
    const supergroupRow = histHeaderRow - 1
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = supergroupRow >= 0 ? ws[XLSX.utils.encode_cell({ r: supergroupRow, c })] : null
      if (cell) {
        const v = String(cell.v || '').trim()
        if (v) currentFrac = v
      }
      if (currentFrac) fracForCol[c] = currentFrac
    }

    // Las header-rad och bygg kolumn -> { fraction, fieldName }
    const colSpec = {}
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: histHeaderRow, c })]
      if (!cell) continue
      const v = String(cell.v || '').trim()
      if (v === 'Hours' || v === 'Energy' || v === 'Emptyings') {
        const frac = fracForCol[c]
        if (frac) colSpec[c] = { fraction: frac, field: v.toLowerCase() }
      }
    }

    for (let r = histHeaderRow + 1; r <= range.e.r; r++) {
      const labelCell = ws[XLSX.utils.encode_cell({ r, c: monthCol })]
      const label = labelCell ? String(labelCell.v || '').trim() : ''
      if (!label || label.toUpperCase() === 'SUM') continue
      if (!isMonthLabel(label)) continue

      const perFraction = {}
      for (const [colStr, spec] of Object.entries(colSpec)) {
        const c = parseInt(colStr, 10)
        const v = toNum(ws[XLSX.utils.encode_cell({ r, c })]?.v)
        if (!perFraction[spec.fraction]) {
          perFraction[spec.fraction] = { hours: 0, energy: 0, emptyings: 0 }
        }
        if (spec.field === 'hours') perFraction[spec.fraction].hours = v || 0
        else if (spec.field === 'energy') perFraction[spec.fraction].energy = v || 0
        else if (spec.field === 'emptyings') perFraction[spec.fraction].emptyings = v || 0
      }

      monthlyHistory.push({
        monthLabel: label,
        sortKey: monthLabelToSortKey(label),
        perFraction,
      })
    }
  }

  return { fractions, monthlyHistory }
}

/** Sheet7 (header_row 4): Name, ID, Starts, Hours, kWh — per-fil snapshot */
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

/** Sheet9 (header_row 3): ID, Info, MAN_OPEN_CMD, AUTO_OPEN_CMD, INLET_OPEN — per-fil snapshot */
export function extractSheet9(workbook) {
  const rows = readSheet(workbook, 'Sheet9', 3)
  if (!rows.length) return []
  const headers = Object.keys(rows[0])

  const idCol = headers.find(h => h.toLowerCase().trim() === 'id')
  const infoCol = findCol(headers, 'info')

  const cmdCols = {}
  for (const h of headers) {
    const up = h.trim().toUpperCase()
    if (up === 'MAN_OPEN_CMD') cmdCols.manCmd = h
    else if (up === 'AUTO_OPEN_CMD') cmdCols.autoCmd = h
    else if (up === 'INLET_OPEN') cmdCols.inletOpen = h
    else if (up === 'HIGH_LEVEL') cmdCols.highLevel = h
    else if (up === 'LOW_LEVEL') cmdCols.lowLevel = h
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
      highLevel: toNum(row[cmdCols.highLevel]) || 0,
      lowLevel: toNum(row[cmdCols.lowLevel]) || 0,
    })
  }
  return result
}

const ERROR_COL_NAMES = [
  'DOES_NOT_CLOSE', 'DOES_NOT_OPEN', 'LEVEL_ERROR',
  'LONG_TIME_SINCE_LAST_COLLECTION', 'ERROR_FEEDBACK_FROM_USER',
]

/** Sheet11 (header_row 3): per-fil snapshot */
export function extractSheet11(workbook) {
  const rows = readSheet(workbook, 'Sheet11', 3)
  if (!rows.length) return []
  const headers = Object.keys(rows[0])

  const idCol = headers.find(h => h.toLowerCase().trim() === 'id')
  const infoCol = findCol(headers, 'info')
  const availCol = findCol(headers, 'availability')

  const foundErrorCols = {}
  for (const h of headers) {
    if (ERROR_COL_NAMES.includes(h)) foundErrorCols[h] = h
  }

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

/** Sheet13 (header_row 7): per-fil snapshot */
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

/** Sheet1 header: facility name and period */
export function extractSheet1Header(workbook) {
  return readSheet1Header(workbook)
}
