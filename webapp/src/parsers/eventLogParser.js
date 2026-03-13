/**
 * Parser for CSV event log files from the waste vacuum system (sopsug).
 * Expected CSV format: "Tid","Typ","Text" with quoted fields.
 */

/**
 * Parse a single CSV line respecting quoted fields.
 * Returns an array of field values with surrounding quotes stripped.
 */
function parseCsvLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

/**
 * Parse a timestamp string "YYYY-MM-DD HH:MM:SS.mmm" into a Date object.
 */
function parseTimestamp(str) {
  const [datePart, timePart] = str.split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hms, ms] = timePart.split('.')
  const [hours, minutes, seconds] = hms.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, seconds, Number(ms) || 0)
}

/**
 * Parse raw CSV text from an event log file.
 * Returns an array of event objects sorted chronologically (oldest first):
 *   [{ tid: Date, typ: string, text: string }]
 */
export function parseEventLogCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')

  // Skip header row
  const dataLines = lines.slice(1)

  const events = dataLines.map((line) => {
    const [tidRaw, typ, text] = parseCsvLine(line)
    return {
      tid: parseTimestamp(tidRaw),
      typ,
      text,
    }
  })

  // Sort chronologically, oldest first
  events.sort((a, b) => a.tid - b.tid)

  return events
}

/**
 * Check if a File object is an event log CSV by inspecting its first line.
 * Returns Promise<boolean>.
 */
export async function isEventLogFile(file) {
  const slice = file.slice(0, 512)
  const text = await slice.text()
  const firstLine = text.split(/\r?\n/)[0].trim()
  return firstLine === '"Tid","Typ","Text"'
}

/**
 * Read and parse an event log CSV file.
 * Returns Promise<{ events, dateRange: { from: Date, to: Date } }>.
 */
export async function readEventLogFile(file) {
  const text = await file.text()
  const events = parseEventLogCsv(text)
  const dateRange = {
    from: events[0]?.tid ?? null,
    to: events[events.length - 1]?.tid ?? null,
  }
  return { events, dateRange }
}
