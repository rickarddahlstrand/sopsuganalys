/**
 * Compute autocorrelation for lags 1 through maxLag.
 * Detects seasonal patterns if peak correlation > 0.3.
 */
export function detectSeasonalPatterns(values, maxLag = 6) {
  const n = values.length
  if (n < 6) return { hasSeasonalPattern: false }

  // Mean-center
  let sum = 0, count = 0
  for (const v of values) {
    if (v != null && !isNaN(v)) { sum += v; count++ }
  }
  const mean = count > 0 ? sum / count : 0
  const centered = values.map(v => (v != null && !isNaN(v)) ? v - mean : 0)

  // Denominator
  let norm = 0
  for (const v of centered) norm += v * v
  if (norm === 0) return { hasSeasonalPattern: false }

  const autocorr = []
  for (let lag = 1; lag <= Math.min(maxLag, n - 1); lag++) {
    let c = 0
    for (let i = 0; i < n - lag; i++) {
      c += centered[i] * centered[i + lag]
    }
    autocorr.push({
      lag,
      correlation: Math.round((c / norm) * 10000) / 10000,
    })
  }

  const peak = autocorr.reduce((best, cur) =>
    cur.correlation > best.correlation ? cur : best
  , autocorr[0])

  return {
    hasSeasonalPattern: peak.correlation > 0.3,
    strongestLag: peak.lag,
    correlation: peak.correlation,
    allLags: autocorr,
  }
}
