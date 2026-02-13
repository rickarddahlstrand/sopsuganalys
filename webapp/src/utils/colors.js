// Semantic colors per analysis category
export const CATEGORY_COLORS = {
  energi: '#eab308',      // yellow-500
  ventiler: '#3b82f6',    // blue-500
  larm: '#ef4444',        // red-500
  fraktioner: '#06b6d4',  // cyan-500
  grenar: '#f97316',      // orange-500
  manuell: '#a855f7',     // purple-500
  trend: '#10b981',       // emerald-500
}

export const FRACTION_COLORS = [
  '#06b6d4', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f97316',
  '#ef4444', '#ec4899', '#a855f7', '#6366f1',
]

export const ERROR_COLORS = {
  DOES_NOT_CLOSE: '#ef4444',
  DOES_NOT_OPEN: '#f97316',
  LEVEL_ERROR: '#eab308',
  LONG_TIME_SINCE_LAST_COLLECTION: '#3b82f6',
  ERROR_FEEDBACK_FROM_USER: '#a855f7',
}

// Swedish translations for error type names
export const ERROR_NAMES_SV = {
  DOES_NOT_CLOSE: 'Stänger ej',
  DOES_NOT_OPEN: 'Öppnar ej',
  LEVEL_ERROR: 'Nivåfel',
  LONG_TIME_SINCE_LAST_COLLECTION: 'Ej tömd länge',
  ERROR_FEEDBACK_FROM_USER: 'Användarfel',
}

// Swedish translations for Sheet1 KPI labels
export const KPI_NAMES_SV = {
  'No of apartments': 'Antal lägenheter',
  'Number of apartments': 'Antal lägenheter',
  'No of inlets': 'Antal inkastar',
  'Number of inlets': 'Antal inkastar',
  'No of valves': 'Antal ventiler',
  'Number of valves': 'Antal ventiler',
  'No of branches': 'Antal grenar',
  'Number of branches': 'Antal grenar',
  'No of fractions': 'Antal fraktioner',
  'Number of fractions': 'Antal fraktioner',
  'No of transports': 'Antal transporter',
  'Number of transports': 'Antal transporter',
  'Total energy': 'Total energi',
  'Energy consumption': 'Energiförbrukning',
  'Energy': 'Energi',
  'Total weight': 'Total vikt',
  'Weight': 'Vikt',
  'Operation time': 'Drifttid',
  'Operating time': 'Drifttid',
  'Vacuum level': 'Vakuumnivå',
  'Average vacuum': 'Genomsnittligt vakuum',
  'Max vacuum': 'Max vakuum',
  'Min vacuum': 'Min vakuum',
  'Collection cycles': 'Tömningscykler',
  'Emptyings': 'Tömningar',
  'Total emptyings': 'Totala tömningar',
  'Availability': 'Tillgänglighet',
  'System availability': 'Systemtillgänglighet',
  'Alarms': 'Larm',
  'Total alarms': 'Totala larm',
  'Period': 'Period',
  'Month': 'Månad',
  'Year': 'År',
}

// Helper to translate KPI label
export function translateKpiLabel(label) {
  // Try exact match
  if (KPI_NAMES_SV[label]) return KPI_NAMES_SV[label]

  // Try case-insensitive match
  const lowerLabel = label.toLowerCase()
  for (const [en, sv] of Object.entries(KPI_NAMES_SV)) {
    if (en.toLowerCase() === lowerLabel) return sv
  }

  // Return original if no translation found
  return label
}

export const STATUS_COLORS = {
  critical: '#ef4444',
  warning: '#f97316',
  ok: '#22c55e',
}

export function healthColor(score) {
  if (score < 70) return STATUS_COLORS.critical
  if (score < 85) return STATUS_COLORS.warning
  return STATUS_COLORS.ok
}

export function availabilityColor(pct) {
  if (pct < 95) return STATUS_COLORS.critical
  if (pct < 99) return STATUS_COLORS.warning
  return STATUS_COLORS.ok
}

export function manualColor(pct) {
  if (pct > 50) return STATUS_COLORS.critical
  if (pct > 20) return STATUS_COLORS.warning
  return STATUS_COLORS.ok
}
