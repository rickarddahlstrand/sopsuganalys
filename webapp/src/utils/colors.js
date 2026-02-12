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
