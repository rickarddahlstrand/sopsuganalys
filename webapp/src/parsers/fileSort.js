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
 */
function extractMonthYearFromFilename(fileName) {
  const cleaned = fileName.replace(/\s*\(\d+\)\s*/g, '').replace(/\.xlsx?$/i, '')

  const pattern1 = cleaned.match(/_(\d{1,2})_(\d{4})$/)
  if (pattern1) {
    const monthNum = parseInt(pattern1[1], 10)
    const year = parseInt(pattern1[2], 10)
    if (monthNum >= 1 && monthNum <= 12 && year >= 2000 && year <= 2099) {
      return { monthNum, year }
    }
  }

  const pattern2 = cleaned.match(/_(\d{4})[-_](\d{1,2})$/)
  if (pattern2) {
    const year = parseInt(pattern2[1], 10)
    const monthNum = parseInt(pattern2[2], 10)
    if (monthNum >= 1 && monthNum <= 12 && year >= 2000 && year <= 2099) {
      return { monthNum, year }
    }
  }

  const pattern3 = cleaned.match(/_(\d{1,2})_(\d{4})/)
  if (pattern3) {
    const monthNum = parseInt(pattern3[1], 10)
    const year = parseInt(pattern3[2], 10)
    if (monthNum >= 1 && monthNum <= 12 && year >= 2000 && year <= 2099) {
      return { monthNum, year }
    }
  }

  const lowerCleaned = cleaned.toLowerCase()
  for (const [name, num] of Object.entries({ ...MONTH_NAMES_EN, ...MONTH_NAMES_SV })) {
    if (lowerCleaned.includes(name)) {
      const yearMatch = cleaned.match(/\b(20\d{2})\b/)
      if (yearMatch) {
        return { monthNum: num, year: parseInt(yearMatch[1], 10) }
      }
    }
  }

  const isoPattern = cleaned.match(/\b(20\d{2})[-_](\d{1,2})\b/)
  if (isoPattern) {
    const year = parseInt(isoPattern[1], 10)
    const monthNum = parseInt(isoPattern[2], 10)
    if (monthNum >= 1 && monthNum <= 12) {
      return { monthNum, year }
    }
  }

  const spacePattern = cleaned.match(/[\s_-](\d{1,2})\s+(20\d{2})/)
  if (spacePattern) {
    const monthNum = parseInt(spacePattern[1], 10)
    const year = parseInt(spacePattern[2], 10)
    if (monthNum >= 1 && monthNum <= 12) {
      return { monthNum, year }
    }
  }

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
 *
 * Output:
 *   {
 *     files: [{ monthNum, year, sortKey, month, fileName, sheets }, ...],
 *     facilityName,
 *     monthlyHistory: [{ monthLabel, sortKey, monthNum, year, month, energyTotal,
 *                        energyAuto, energyManual, energyIdle, timeAuto, timeManual,
 *                        timeIdle, perFraction: { [frac]: { hours, energy, emptyings } } }, ...]
 *   }
 *
 * - files[].sheets innehaller fortfarande per-fil sheet9/sheet11/sheet13-snapshots.
 * - monthlyHistory ar dedupad pa monthLabel (= "YY-Mon") och innehaller
 *   kombinerad data fran ALLA filers Sheet3 + Sheet5 historik-rader.
 * - sheet3/sheet5 pa file-objektet innehaller fortfarande den ursprungliga
 *   per-fil strukturen for kod som behover veta vilken manad filen rapporterar.
 */
export function sortFilesByMonth(parsedFiles) {
  let facilityName = null

  const extracted = parsedFiles
    .map(f => {
      const header = extractSheet1Header(f.workbook)

      if (header.facilityName && !facilityName) {
        facilityName = header.facilityName
      }

      const sheets = {
        sheet1: extractSheet1(f.workbook),
        sheet3: extractSheet3(f.workbook),
        sheet5: extractSheet5(f.workbook),
        sheet7: extractSheet7(f.workbook),
        sheet9: extractSheet9(f.workbook),
        sheet11: extractSheet11(f.workbook),
        sheet13: extractSheet13(f.workbook),
      }

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

  // Safety net: if multiple files mapped to the same month, fall back to filename
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

  const years = new Set(extracted.map(f => f.year))
  const multiYear = years.size > 1

  for (const f of extracted) {
    f.monthName = multiYear
      ? `${MANAD_NAMN[f.monthNum]} ${String(f.year).slice(-2)}`
      : MANAD_NAMN[f.monthNum]
    f.month = f.monthName
  }

  const monthlyHistory = buildCombinedMonthlyHistory(extracted, multiYear)

  return {
    files: extracted,
    facilityName,
    monthlyHistory,
  }
}

/**
 * Bygg en kombinerad, dedupad historik fran alla filers Sheet3 + Sheet5.
 *
 * Varje fil innehaller upp till 13 manads-rader. Manaderna ar i de flesta fall
 * identiska over filer som rapporterar samma manad, men nagra filer kan ha
 * tomma celler. Vi valjer for varje monthLabel det varde som har storst
 * dataunderlag (icke-noll-energi prioriteras), och tar samtliga unika manader.
 *
 * Returnerar array sorterad kronologiskt med berikat displaynamn.
 */
function buildCombinedMonthlyHistory(files, multiYear) {
  // Begränsa till perioden användaren faktiskt laddat upp — Sheet3/Sheet5-historiken
  // kan sträcka sig 12+ månader bakåt vilket annars ger 25+ månaders energi
  // men bara 14 månaders ventil/larm/manuell-data (inkonsekvent UX).
  const uploadedKeys = new Set(files.map(f => f.sortKey))

  // Forsta pass: samla alla rader per monthLabel
  const collectS3 = new Map()
  const collectS5 = new Map()

  for (const f of files) {
    for (const m3 of f.sheets?.sheet3?.monthlyHistory || []) {
      if (!m3.monthLabel || !uploadedKeys.has(m3.sortKey)) continue
      if (!collectS3.has(m3.monthLabel)) collectS3.set(m3.monthLabel, [])
      collectS3.get(m3.monthLabel).push(m3)
    }
    for (const m5 of f.sheets?.sheet5?.monthlyHistory || []) {
      if (!m5.monthLabel || !uploadedKeys.has(m5.sortKey)) continue
      if (!collectS5.has(m5.monthLabel)) collectS5.set(m5.monthLabel, [])
      collectS5.get(m5.monthLabel).push(m5)
    }
  }

  // Andra pass: valj basta varde per manad
  const allLabels = new Set([...collectS3.keys(), ...collectS5.keys()])
  const result = []

  for (const label of allLabels) {
    const s3Cands = collectS3.get(label) || []
    const s5Cands = collectS5.get(label) || []

    // Valj Sheet3-varde: forsta med energyTotal > 0, annars forsta varde
    const m3 = s3Cands.find(c => (c.energyTotal || 0) > 0) || s3Cands[0]
    // Sheet5: valj forsta som har nagon icke-noll perFraction
    const m5 = s5Cands.find(c => {
      const total = Object.values(c.perFraction || {}).reduce((s, d) => s + (d.emptyings || 0), 0)
      return total > 0
    }) || s5Cands[0]

    const sortKey = m3?.sortKey ?? m5?.sortKey
    if (sortKey == null) continue
    const year = Math.floor(sortKey / 100)
    const monthNum = sortKey % 100
    const monthName = multiYear
      ? `${MANAD_NAMN[monthNum]} ${String(year).slice(-2)}`
      : MANAD_NAMN[monthNum]

    result.push({
      monthLabel: label,
      sortKey,
      monthNum,
      year,
      month: monthName,
      energyAuto: m3?.energyAuto || 0,
      energyManual: m3?.energyManual || 0,
      energyIdle: m3?.energyIdle || 0,
      energyTotal: m3?.energyTotal || 0,
      timeAuto: m3?.timeAuto || 0,
      timeManual: m3?.timeManual || 0,
      timeIdle: m3?.timeIdle || 0,
      operationTime: (m3?.timeAuto || 0) + (m3?.timeManual || 0) + (m3?.timeIdle || 0),
      perFraction: m5?.perFraction || {},
    })
  }

  return result.sort((a, b) => a.sortKey - b.sortKey)
}
