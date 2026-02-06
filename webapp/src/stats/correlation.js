/**
 * Pearson correlation coefficient + p-value.
 */
export function pearsonCorrelation(x, y) {
  const n = x.length
  if (n < 3) return { r: NaN, p: 1 }

  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sx += x[i]; sy += y[i]
    sxy += x[i] * y[i]
    sxx += x[i] * x[i]
    syy += y[i] * y[i]
  }

  const denom = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy))
  if (denom === 0) return { r: 0, p: 1 }

  const r = (n * sxy - sx * sy) / denom
  const df = n - 2
  const t = r * Math.sqrt(df / (1 - r * r + 1e-15))
  // Simplified p-value approximation
  const p = approxTwoSidedP(Math.abs(t), df)

  return { r: Math.round(r * 10000) / 10000, p: Math.round(p * 1000000) / 1000000 }
}

/**
 * Spearman rank correlation.
 * Computes Pearson correlation on ranked arrays.
 */
export function spearmanCorrelation(x, y) {
  const rx = rank(x)
  const ry = rank(y)
  return pearsonCorrelation(rx, ry)
}

function rank(arr) {
  const indexed = arr.map((v, i) => ({ v, i }))
  indexed.sort((a, b) => a.v - b.v)

  const ranks = new Array(arr.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++
    const avgRank = (i + j + 1) / 2  // 1-based average rank
    for (let k = i; k < j; k++) {
      ranks[indexed[k].i] = avgRank
    }
    i = j
  }
  return ranks
}

/**
 * Interpret correlation strength.
 */
export function interpretCorrelation(r) {
  const abs = Math.abs(r)
  let strength
  if (abs > 0.7) strength = 'stark'
  else if (abs > 0.4) strength = 'måttlig'
  else strength = 'svag'

  const direction = r > 0 ? 'positiv' : 'negativ'
  return `${strength} ${direction}`
}

/**
 * Compute correlations for multiple pairs.
 * Input: { name: [xArr, yArr] }
 * Output: { name: { pearsonR, pearsonP, spearmanR, spearmanP, interpretation } }
 */
export function computeCorrelations(pairs) {
  const results = {}
  for (const [name, [x, y]] of Object.entries(pairs)) {
    // Filter out NaN pairs
    const cleanX = [], cleanY = []
    for (let i = 0; i < x.length; i++) {
      if (!isNaN(x[i]) && !isNaN(y[i]) && x[i] != null && y[i] != null) {
        cleanX.push(x[i])
        cleanY.push(y[i])
      }
    }
    if (cleanX.length < 3) {
      results[name] = { pearsonR: NaN, pearsonP: 1, spearmanR: NaN, spearmanP: 1, interpretation: 'otillräcklig_data' }
      continue
    }
    const pr = pearsonCorrelation(cleanX, cleanY)
    const sr = spearmanCorrelation(cleanX, cleanY)
    results[name] = {
      pearsonR: pr.r,
      pearsonP: pr.p,
      spearmanR: sr.r,
      spearmanP: sr.p,
      interpretation: interpretCorrelation(pr.r),
    }
  }
  return results
}

// Approximate two-sided p-value for t-distribution
function approxTwoSidedP(t, df) {
  if (df <= 0) return 1
  // Using approximation: p ≈ 2 * (1 - normalCDF(t * (1 - 1/(4*df))))
  const adjusted = t * (1 - 1 / (4 * df))
  return 2 * (1 - normalCDF(adjusted))
}

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}
