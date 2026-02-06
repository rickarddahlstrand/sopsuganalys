import { MANAD_NAMN } from '../utils/months'
import {
  extractSheet1, extractSheet3, extractSheet5, extractSheet7,
  extractSheet9, extractSheet11, extractSheet13,
} from './sheetReaders'

/**
 * Extract month number and year from filename like "rapport_1_2025.xls"
 * Supports any year (2020–2099).
 */
function extractMonthYear(fileName) {
  const m = fileName.match(/_(\d{1,2})_(\d{4})\.xls/i)
  if (!m) return null
  const monthNum = parseInt(m[1], 10)
  const year = parseInt(m[2], 10)
  if (monthNum < 1 || monthNum > 12) return null
  return { monthNum, year }
}

/**
 * Sort parsed files by year and month, extract all sheet data.
 * Input: array of { fileName, workbook, sheetNames }
 * Output: sorted array of { monthNum, year, sortKey, month, fileName, sheets }
 *   - sortKey: year*100 + monthNum (unique across years)
 *   - month: display label, e.g. "Jan" (single year) or "Jan 25" (multi-year)
 */
export function sortFilesByMonth(parsedFiles) {
  const extracted = parsedFiles
    .map(f => {
      const my = extractMonthYear(f.fileName)
      if (!my) return null

      return {
        monthNum: my.monthNum,
        year: my.year,
        sortKey: my.year * 100 + my.monthNum,
        fileName: f.fileName,
        sheets: {
          sheet1: extractSheet1(f.workbook),
          sheet3: extractSheet3(f.workbook),
          sheet5: extractSheet5(f.workbook),
          sheet7: extractSheet7(f.workbook),
          sheet9: extractSheet9(f.workbook),
          sheet11: extractSheet11(f.workbook),
          sheet13: extractSheet13(f.workbook),
        },
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.sortKey - b.sortKey)

  // Determine if multi-year
  const years = new Set(extracted.map(f => f.year))
  const multiYear = years.size > 1

  // Add display label
  for (const f of extracted) {
    f.monthName = multiYear
      ? `${MANAD_NAMN[f.monthNum]} ${String(f.year).slice(-2)}`
      : MANAD_NAMN[f.monthNum]
    f.month = f.monthName
  }

  return extracted
}
