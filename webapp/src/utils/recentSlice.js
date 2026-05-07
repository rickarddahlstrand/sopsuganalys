/**
 * Hjälpare för att fokusera analys på de senaste N månaderna istället för
 * hela uppladdade perioden.
 */

export const DEFAULT_RECENT_WINDOW = 3

/**
 * Returnerar de senaste n filerna sorterat på sortKey desc → asc
 * (kronologisk ordning men begränsat). Om n >= length, returneras hela.
 */
export function recentMonths(parsedFiles, n) {
  if (!parsedFiles || parsedFiles.length === 0) return []
  if (n == null || n <= 0) return []
  const sorted = [...parsedFiles].sort((a, b) => a.sortKey - b.sortKey)
  if (n >= sorted.length) return sorted
  return sorted.slice(sorted.length - n)
}

/**
 * Returnerar default-fönstret (3 månader om data finns, dock max parsedFiles.length).
 * Returnerar null om ingen data finns.
 */
export function getDefaultWindow(parsedFiles) {
  if (!parsedFiles || parsedFiles.length === 0) return null
  return Math.min(DEFAULT_RECENT_WINDOW, parsedFiles.length)
}

/**
 * Returnerar de filer som ligger UTANFÖR de senaste n (dvs. äldre delen av perioden).
 * Används för att jämföra "tidigare" vs "senaste".
 */
export function previousMonths(parsedFiles, n) {
  if (!parsedFiles || parsedFiles.length === 0) return []
  if (n == null || n <= 0) return parsedFiles
  const sorted = [...parsedFiles].sort((a, b) => a.sortKey - b.sortKey)
  if (n >= sorted.length) return []
  return sorted.slice(0, sorted.length - n)
}
