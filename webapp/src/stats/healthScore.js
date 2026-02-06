/**
 * Compute branch health score using weighted formula:
 *   availability * 0.5 + errorResistance * 0.3 + trendFactor * 0.2
 */
export function healthScore(avgAvailability, errorsPerValve, trendClass) {
  const tillgScore = avgAvailability * 0.5
  const felScore = (100 - Math.min(errorsPerValve, 100)) * 0.3

  let trendFactor = 50 // neutral
  if (trendClass === 'ökande') trendFactor = 75
  else if (trendClass === 'minskande') trendFactor = 25
  const trendScore = trendFactor * 0.2

  return Math.round((tillgScore + felScore + trendScore) * 10) / 10
}
