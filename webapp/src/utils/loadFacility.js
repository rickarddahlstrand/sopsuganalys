import { getFacility, getFacilityFiles } from './pocketbase'
import { parseXlsFile } from '../parsers/xlsParser'
import { sortFilesByMonth } from '../parsers/fileSort'
import { isEventLogFile, readEventLogFile } from '../parsers/eventLogParser'
import { analyzeEnergiDrift } from '../analysis/energiDrift'
import { analyzeVentiler } from '../analysis/ventiler'
import { analyzeLarm } from '../analysis/larm'
import { analyzeSammanfattning } from '../analysis/sammanfattning'
import { analyzeFraktioner } from '../analysis/fraktionAnalys'
import { analyzeGrenar } from '../analysis/grenDjupanalys'
import { analyzeManuell } from '../analysis/manuellAnalys'
import { analyzeTrender } from '../analysis/trendanalys'
import { generateRekommendationer } from '../analysis/rekommendationer'
import { analyzeDrifterfarenheter } from '../analysis/drifterfarenheter'
import { analyzeNivagivare } from '../analysis/nivagivare'
import { analyzeEventLog } from '../analysis/eventLog'

/**
 * Load a facility from PocketBase by id: download files, parse them, run the
 * full analysis pipeline and return a result object matching the shape used by
 * LOAD_FROM_NETWORK / compareFacilities[i].data.
 *
 * Returns: { facilityName, energiDrift, ventiler, larm, sammanfattning,
 *   fraktionAnalys, grenDjupanalys, manuellAnalys, trendanalys,
 *   rekommendationer, drifterfarenheter, nivagivare, eventLog }
 */
export async function loadFacilityAnalysis(id) {
  const record = await getFacility(id)
  const { xlsFiles, csvFiles } = await getFacilityFiles(record)

  // Parse all XLS files in parallel
  const parsed = await Promise.all(xlsFiles.map(f => parseXlsFile(f)))

  // Sort by month and extract sheets (mirrors UploadSection flow)
  const sorted = sortFilesByMonth(parsed)
  const files = sorted.files
  const monthlyHistory = sorted.monthlyHistory || []

  // Run the analysis pipeline synchronously (the async/tick-yielding in
  // useAnalysis.js is only to keep the UI responsive during initial load;
  // here we want a single result to dispatch)
  const energiDrift = analyzeEnergiDrift(files, monthlyHistory)
  const ventiler = analyzeVentiler(files)
  const larm = analyzeLarm(files)
  const nivagivare = analyzeNivagivare(files)
  const sammanfattning = analyzeSammanfattning(files)
  const fraktionAnalys = analyzeFraktioner(files, monthlyHistory)
  const grenDjupanalys = analyzeGrenar(files)
  const manuellAnalys = analyzeManuell(files)
  const trendanalys = analyzeTrender(files, energiDrift, ventiler, larm, monthlyHistory)
  const rekommendationer = generateRekommendationer(trendanalys, ventiler, larm)
  const drifterfarenheter = analyzeDrifterfarenheter(
    trendanalys, ventiler, manuellAnalys, larm,
  )

  // Optional: event log analysis if CSV event-log files were included.
  // Accumulate events across all CSV files, then dedup + sort + analyze once
  // (mirrors UploadSection's multi-CSV handling).
  let eventLog = null
  let eventLogFiles = null
  const csvLogEntries = []
  for (const csv of csvFiles || []) {
    try {
      if (await isEventLogFile(csv)) {
        const logData = await readEventLogFile(csv)
        csvLogEntries.push({
          fileName: csv.name,
          events: logData.events,
          dateRange: logData.dateRange,
        })
      }
    } catch (err) {
      console.warn(`Kunde inte läsa CSV-logg ${csv.name}:`, err)
    }
  }
  if (csvLogEntries.length > 0) {
    const merged = csvLogEntries.flatMap(e => e.events)
    merged.sort((a, b) => a.tid - b.tid)
    const seen = new Set()
    const deduped = []
    for (const ev of merged) {
      const key = `${ev.tid.getTime()}|${ev.typ}|${ev.text}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(ev)
    }
    eventLog = analyzeEventLog(deduped)
    eventLogFiles = csvLogEntries
  }

  return {
    facilityName: sorted.facilityName || record.facility_name || 'Okänd anläggning',
    energiDrift,
    ventiler,
    larm,
    sammanfattning,
    fraktionAnalys,
    grenDjupanalys,
    manuellAnalys,
    trendanalys,
    rekommendationer,
    drifterfarenheter,
    nivagivare,
    eventLog,
    eventLogFiles,
  }
}
