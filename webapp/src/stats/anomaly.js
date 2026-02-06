/**
 * Detect anomalies using z-score method.
 * Returns array of { index, label, value, zScore, type }
 */
export function detectAnomalies(values, labels = null, threshold = 2.0) {
  const n = values.length
  if (n < 3) return []

  // Compute mean and std
  let sum = 0, count = 0
  for (let i = 0; i < n; i++) {
    if (values[i] != null && !isNaN(values[i])) {
      sum += values[i]
      count++
    }
  }
  if (count === 0) return []
  const mean = sum / count

  let sumSq = 0
  for (let i = 0; i < n; i++) {
    if (values[i] != null && !isNaN(values[i])) {
      sumSq += (values[i] - mean) ** 2
    }
  }
  const std = Math.sqrt(sumSq / count)
  if (std === 0) return []

  const anomalies = []
  for (let i = 0; i < n; i++) {
    if (values[i] == null || isNaN(values[i])) continue
    const z = (values[i] - mean) / std
    if (Math.abs(z) > threshold) {
      anomalies.push({
        index: i,
        label: labels ? labels[i] : i,
        value: Math.round(values[i] * 100) / 100,
        zScore: Math.round(z * 100) / 100,
        type: z > 0 ? 'hög' : 'låg',
      })
    }
  }
  return anomalies
}
