/**
 * Compute a compact KPI summary for listing facilities without loading the
 * full analysis. Stored as JSON in facility_uploads.summary_kpi.
 */
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
