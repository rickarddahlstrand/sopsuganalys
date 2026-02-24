import { MANAD_NAMN } from '../utils/months'
import {
  extractSheet1, extractSheet1Header, extractSheet3, extractSheet5, extractSheet7,
  extractSheet9, extractSheet11, extractSheet13,
} from './sheetReaders'

// English month names for parsing
const MONTH_NAMES_EN = {
  'january': 1, 'february': 2, 'march': 3, 'april': 4,
  'may': 5, 'june': 6, 'july': 7, 'august': 8,
  'september': 9, 'october': 10, 'november': 11, 'december': 12,
  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4,
  'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}

// Swedish month names for parsing
const MONTH_NAMES_SV = {
  'januari': 1, 'februari': 2, 'mars': 3, 'april': 4,
  'maj': 5, 'juni': 6, 'juli': 7, 'augusti': 8,
  'september': 9, 'oktober': 10, 'november': 11, 'december': 12,
}

/**
 * Extract month number and year from Sheet1 content, with filename as fallback.
 * Tries header area first, then key-value pairs, then filename as last resort.
 */
function extractMonthYearFromContent(header, sheet1Data, fileName) {
  // First, try the period from the header area
  if (header?.period) {
    const parsed = parseDateString(header.period)
    if (parsed) return parsed
  }

  // Look for period/date in Sheet1 key-value pairs
  const periodLabels = ['period', 'month', 'date', 'månad', 'datum', 'rapport']

  for (const row of sheet1Data || []) {
    const label = String(row.label || '').toLowerCase()

    // Check if this row contains period info
    if (periodLabels.some(p => label.includes(p))) {
      const value = String(row.value || '').trim()
      const parsed = parseDateString(value)
      if (parsed) return parsed
    }
  }

  // Also check if any value in Sheet1 looks like a date
  for (const row of sheet1Data || []) {
    const value = String(row.value || '').trim()
    const parsed = parseDateString(value)
    if (parsed) return parsed
  }

  // Fallback to filename parsing (last resort)
  return extractMonthYearFromFilename(fileName)
}

/**
 * Parse various date string formats:
 * - "January 2025", "2025-01", "01/2025", "2025/01"
 * - "Jan 2025", "januari 2025"
 */
function parseDateString(str) {
  if (!str) return null
  const s = str.toLowerCase().trim()

  // Try "Month YYYY" format (e.g., "January 2025", "januari 2025")
  for (const [name, num] of Object.entries({ ...MONTH_NAMES_EN, ...MONTH_NAMES_SV })) {
    if (s.includes(name)) {
      const yearMatch = s.match(/\b(20\d{2})\b/)
      if (yearMatch) {
        return { monthNum: num, year: parseInt(yearMatch[1], 10) }
      }
    }
  }

  // Try "YYYY-MM" or "YYYY/MM" format
  const isoMatch = s.match(/\b(20\d{2})[-/](\d{1,2})\b/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const monthNum = parseInt(isoMatch[2], 10)
    if (monthNum >= 1 && monthNum <= 12) {
      return { monthNum, year }
    }
  }

  // Try "MM/YYYY" or "MM-YYYY" format
  const revMatch = s.match(/\b(\d{1,2})[-/](20\d{2})\b/)
  if (revMatch) {
    const monthNum = parseInt(revMatch[1], 10)
    const year = parseInt(revMatch[2], 10)
    if (monthNum >= 1 && monthNum <= 12) {
      return { monthNum, year }
    }
  }

  return null
}

/**
 * Extract month number and year from filename.
 * Supports various patterns:
 * - "rapport_1_2025.xls" / "Service_-_monthly_report_HammarbyGard_1_2026 (1).xls"
 * - "rapport_januari_2025.xls" / "report_October_2025.xls"
 * - "report_2025-01.xls" / "report_2025_01.xls"
 * - "Service - monthly report Facility 1 2026.xls"
 */
function extractMonthYearFromFilename(fileName) {
  // Remove common suffixes like "(1)", "(2)", etc. and file extension
  const cleaned = fileName.replace(/\s*\(\d+\)\s*/g, '').replace(/\.xlsx?$/i, '')

  // Try pattern: _MM_YYYY or _M_YYYY at end of filename
  const pattern1 = cleaned.match(/_(\d{1,2})_(\d{4})$/)
  if (pattern1) {
    const monthNum = parseInt(pattern1[1], 10)
    const year = parseInt(pattern1[2], 10)
    if (monthNum >= 1 && monthNum <= 12 && year >= 2000 && year <= 2099) {
      return { monthNum, year }
    }
  }

  // Try pattern: _YYYY_MM or _YYYY-MM at end
  const pattern2 = cleaned.match(/_(\d{4})[-_](\d{1,2})$/)
  if (pattern2) {
    const year = parseInt(pattern2[1], 10)
    const monthNum = parseInt(pattern2[2], 10)
    if (monthNum >= 1 && monthNum <= 12 && year >= 2000 && year <= 2099) {
      return { monthNum, year }
    }
  }

  // Try to find _M_YYYY or _MM_YYYY anywhere in filename
  const pattern3 = cleaned.match(/_(\d{1,2})_(\d{4})/)
  if (pattern3) {
    const monthNum = parseInt(pattern3[1], 10)
    const year = parseInt(pattern3[2], 10)
    if (monthNum >= 1 && monthNum <= 12 && year >= 2000 && year <= 2099) {
      return { monthNum, year }
    }
  }

  // Try month name (EN/SV) + year in filename
  // e.g. "rapport_januari_2025" or "report_October_2025"
  const lowerCleaned = cleaned.toLowerCase()
  for (const [name, num] of Object.entries({ ...MONTH_NAMES_EN, ...MONTH_NAMES_SV })) {
    if (lowerCleaned.includes(name)) {
      const yearMatch = cleaned.match(/\b(20\d{2})\b/)
      if (yearMatch) {
        return { monthNum: num, year: parseInt(yearMatch[1], 10) }
      }
    }
  }

  // Try YYYY-MM or YYYY_MM anywhere in filename
  const isoPattern = cleaned.match(/\b(20\d{2})[-_](\d{1,2})\b/)
  if (isoPattern) {
    const year = parseInt(isoPattern[1], 10)
    const monthNum = parseInt(isoPattern[2], 10)
    if (monthNum >= 1 && monthNum <= 12) {
      return { monthNum, year }
    }
  }

  // Try with spaces as separators: "something M YYYY" or "something MM YYYY"
  const spacePattern = cleaned.match(/[\s_-](\d{1,2})\s+(20\d{2})/)
  if (spacePattern) {
    const monthNum = parseInt(spacePattern[1], 10)
    const year = parseInt(spacePattern[2], 10)
    if (monthNum >= 1 && monthNum <= 12) {
      return { monthNum, year }
    }
  }

  // Try MM-YYYY with hyphen
  const revPattern = cleaned.match(/\b(\d{1,2})-(20\d{2})\b/)
  if (revPattern) {
    const monthNum = parseInt(revPattern[1], 10)
    const year = parseInt(revPattern[2], 10)
    if (monthNum >= 1 && monthNum <= 12) {
      return { monthNum, year }
    }
  }

  return null
}

/**
 * Sort parsed files by year and month, extract all sheet data.
 * Input: array of { fileName, workbook, sheetNames }
 * Output: sorted array of { monthNum, year, sortKey, month, fileName, sheets }
 *   - sortKey: year*100 + monthNum (unique across years)
 *   - month: display label, e.g. "Jan" (single year) or "Jan 25" (multi-year)
 */
export function sortFilesByMonth(parsedFiles) {
  // Track facility name (should be same across all files)
  let facilityName = null

  const extracted = parsedFiles
    .map(f => {
      // Extract header info first (facility name and period)
      const header = extractSheet1Header(f.workbook)

      // Store facility name from first file that has it
      if (header.facilityName && !facilityName) {
        facilityName = header.facilityName
      }

      // Extract sheet data
      const sheets = {
        sheet1: extractSheet1(f.workbook),
        sheet3: extractSheet3(f.workbook),
        sheet5: extractSheet5(f.workbook),
        sheet7: extractSheet7(f.workbook),
        sheet9: extractSheet9(f.workbook),
        sheet11: extractSheet11(f.workbook),
        sheet13: extractSheet13(f.workbook),
      }

      // Try to extract month/year from filename first, then content
      const my = extractMonthYearFromContent(header, sheets.sheet1, f.fileName)
      if (!my) {
        console.warn(`[Sopsuganalys] Kunde inte avgöra månad för fil: ${f.fileName}`)
        return null
      }

      return {
        monthNum: my.monthNum,
        year: my.year,
        sortKey: my.year * 100 + my.monthNum,
        fileName: f.fileName,
        sheets,
      }
    })
    .filter(Boolean)

  // Safety net: if multiple files mapped to the same month, the content-based
  // extraction likely picked up a static/wrong header. Fall back to filename.
  if (extracted.length > 1) {
    const monthCounts = new Map()
    for (const f of extracted) {
      if (!monthCounts.has(f.sortKey)) monthCounts.set(f.sortKey, [])
      monthCounts.get(f.sortKey).push(f)
    }

    const hasDuplicates = [...monthCounts.values()].some(files => files.length > 1)
    if (hasDuplicates) {
      for (const [, files] of monthCounts) {
        if (files.length <= 1) continue
        // Try filename-based extraction for files sharing the same month
        for (const f of files) {
          const fromFilename = extractMonthYearFromFilename(f.fileName)
          if (fromFilename) {
            f.monthNum = fromFilename.monthNum
            f.year = fromFilename.year
            f.sortKey = fromFilename.year * 100 + fromFilename.monthNum
          }
        }
      }
    }
  }

  extracted.sort((a, b) => a.sortKey - b.sortKey)

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

  // Return both the files and metadata
  return {
    files: extracted,
    facilityName,
  }
}
