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

  // Run the analysis pipeline synchronously (the async/tick-yielding in
  // useAnalysis.js is only to keep the UI responsive during initial load;
  // here we want a single result to dispatch)
  const energiDrift = analyzeEnergiDrift(files)
  const ventiler = analyzeVentiler(files)
  const larm = analyzeLarm(files)
  const nivagivare = analyzeNivagivare(files)
  const sammanfattning = analyzeSammanfattning(files)
  const fraktionAnalys = analyzeFraktioner(files)
  const grenDjupanalys = analyzeGrenar(files)
  const manuellAnalys = analyzeManuell(files)
  const trendanalys = analyzeTrender(files, energiDrift, ventiler, larm)
  const rekommendationer = generateRekommendationer(trendanalys, ventiler, larm)
  const drifterfarenheter = analyzeDrifterfarenheter(
    trendanalys, ventiler, manuellAnalys, larm,
  )

  // Optional: event log analysis if CSV event-log files were included
  let eventLog = null
  for (const csv of csvFiles || []) {
    try {
      if (await isEventLogFile(csv)) {
        const logData = await readEventLogFile(csv)
        eventLog = analyzeEventLog(logData.events)
        break
      }
    } catch (err) {
      console.warn(`Kunde inte läsa CSV-logg ${csv.name}:`, err)
    }
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
  }
}
