export const SCHEMA_VERSION = 1

const ANALYSIS_KEYS = [
  'energiDrift',
  'ventiler',
  'larm',
  'sammanfattning',
  'fraktionAnalys',
  'grenDjupanalys',
  'manuellAnalys',
  'trendanalys',
  'rekommendationer',
  'drifterfarenheter',
]

export function computeSummaryKpi(state) {
  const ed = state.energiDrift
  const v = state.ventiler
  const l = state.larm
  const t = state.trendanalys
  return {
    totalEnergy: ed?.totalEnergy ?? null,
    totalEmptyings: ed?.totalEmptyings ?? null,
    overallAvail: v?.overallAvail ?? null,
    totalAlarms: l?.totalAlarms ?? null,
    valveCount: v?.uniqueValves ?? null,
    branchCount: t?.branchAnalysis?.length ?? null,
  }
}

export function serializeAnalysis(state) {
  const payload = {
    schema_version: SCHEMA_VERSION,
    facility_name: state.facilityName || 'Okänd anläggning',
    date_range_start: '',
    date_range_end: '',
    file_count: state.parsedFiles?.length ?? 0,
    summary_kpi: computeSummaryKpi(state),
  }

  // Extract date range from energy data
  const months = state.energiDrift?.energy
  if (months?.length) {
    payload.date_range_start = months[0].month
    payload.date_range_end = months[months.length - 1].month
  }

  // Copy each analysis result (never parsedFiles)
  for (const key of ANALYSIS_KEYS) {
    payload[key] = state[key] ?? null
  }

  return payload
}

export function deserializeAnalysis(record) {
  const result = {
    facilityName: record.facility_name,
  }

  for (const key of ANALYSIS_KEYS) {
    result[key] = record[key] ?? null
  }

  return result
}
