import * as XLSX from 'xlsx'

/**
 * Parse a single .xls file into a workbook and extract sheets.
 * Returns { fileName, workbook, sheets: { Sheet1, Sheet3, ... } }
 */
export async function parseXlsFile(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  return {
    fileName: file.name,
    workbook,
    sheetNames: workbook.SheetNames,
  }
}

/**
 * Read a worksheet as an array of objects, starting from the given header row.
 * Mirrors Python's common.read_sheet().
 */
export function readSheet(workbook, sheetName, headerRow) {
  const ws = workbook.Sheets[sheetName]
  if (!ws) return []

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

  // Read headers from headerRow
  const headers = []
  for (let col = range.s.c; col <= range.e.c; col++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c: col })
    const cell = ws[addr]
    headers.push(cell ? String(cell.v).trim() : '')
  }

  // Read data rows after header
  const rows = []
  for (let row = headerRow + 1; row <= range.e.r; row++) {
    const obj = {}
    let hasData = false
    for (let col = range.s.c; col <= range.e.c; col++) {
      const key = headers[col - range.s.c]
      if (!key) continue
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = ws[addr]
      const val = cell ? cell.v : null
      obj[key] = val
      if (val != null && val !== '') hasData = true
    }
    if (hasData) rows.push(obj)
  }

  return rows
}

/**
 * Read Sheet1 which has merged cells - special handling.
 * Labels in columns 0-5, Value in col 6, Comment in col 8.
 */
export function readSheet1(workbook) {
  const ws = workbook.Sheets['Sheet1']
  if (!ws) return []

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const rows = []

  for (let row = 10; row <= range.e.r; row++) {
    // Scan columns 0-5 for label parts
    const labelParts = []
    for (let col = 0; col < 6; col++) {
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = ws[addr]
      if (cell && cell.v != null && String(cell.v).trim()) {
        labelParts.push(String(cell.v).trim())
      }
    }
    const label = labelParts.join(' ').trim()
    if (!label) continue

    // Value in column 6
    let value = null
    const valAddr = XLSX.utils.encode_cell({ r: row, c: 6 })
    const valCell = ws[valAddr]
    if (valCell && valCell.v != null && valCell.v !== '') {
      value = valCell.v
    }

    // Comment in column 8
    let comment = ''
    if (range.e.c >= 8) {
      const comAddr = XLSX.utils.encode_cell({ r: row, c: 8 })
      const comCell = ws[comAddr]
      if (comCell && comCell.v != null && String(comCell.v).trim()) {
        comment = String(comCell.v).trim()
      }
    }

    if (value != null || comment) {
      rows.push({ label, value, comment })
    }
  }

  return rows
}
