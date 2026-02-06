/**
 * Compute moving average with given window size.
 * Uses min_periods=1 behavior (like pandas default for rolling).
 */
export function movingAverage(values, window = 3) {
  const result = []
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1)
    let sum = 0, count = 0
    for (let j = start; j <= i; j++) {
      if (values[j] != null && !isNaN(values[j])) {
        sum += values[j]
        count++
      }
    }
    result.push(count > 0 ? Math.round((sum / count) * 10) / 10 : null)
  }
  return result
}
