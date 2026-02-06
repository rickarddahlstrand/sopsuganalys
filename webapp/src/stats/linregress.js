/**
 * Linear regression with R², p-value via t-test.
 * Returns { slope, intercept, r, r2, pValue, trendClass }
 */
export function linregress(xArr, yArr) {
  const n = xArr.length
  if (n < 3) return { slope: 0, intercept: 0, r: 0, r2: 0, pValue: 1, trendClass: 'otillräcklig_data' }

  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sx += xArr[i]
    sy += yArr[i]
    sxy += xArr[i] * yArr[i]
    sxx += xArr[i] * xArr[i]
    syy += yArr[i] * yArr[i]
  }

  const denom = n * sxx - sx * sx
  if (denom === 0) return { slope: 0, intercept: sy / n, r: 0, r2: 0, pValue: 1, trendClass: 'stabil' }

  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n

  // Pearson r
  const denomR = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy))
  const r = denomR === 0 ? 0 : (n * sxy - sx * sy) / denomR
  const r2 = r * r

  // p-value via t-distribution approximation
  const df = n - 2
  const t = r * Math.sqrt(df / (1 - r2 + 1e-15))
  const pValue = tDistPValue(Math.abs(t), df)

  let trendClass = 'stabil'
  if (pValue <= 0.05) {
    trendClass = slope > 0 ? 'ökande' : 'minskande'
  }

  return {
    slope: round4(slope),
    intercept: round4(intercept),
    r: round4(r),
    r2: round4(r2),
    pValue: round6(pValue),
    trendClass,
  }
}

function round4(n) { return Math.round(n * 10000) / 10000 }
function round6(n) { return Math.round(n * 1000000) / 1000000 }

/**
 * Approximate two-sided p-value for t-distribution.
 * Uses the incomplete beta function regularized form.
 */
function tDistPValue(t, df) {
  const x = df / (df + t * t)
  const p = incompleteBetaReg(df / 2, 0.5, x)
  return Math.min(1, Math.max(0, p))
}

function incompleteBetaReg(a, b, x) {
  if (x === 0) return 0
  if (x === 1) return 1
  // Use continued fraction (Lentz's algorithm)
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta)

  // Use continued fraction representation
  let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1)
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d
  f = d

  for (let m = 1; m <= 200; m++) {
    // Even step
    let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m))
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30
    f *= d * c

    // Odd step
    num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1))
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30
    const delta = d * c
    f *= delta

    if (Math.abs(delta - 1) < 1e-10) break
  }

  return front * f / a
}

function lnGamma(z) {
  // Lanczos approximation
  const g = 7
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
  }
  z -= 1
  let x = coef[0]
  for (let i = 1; i < g + 2; i++) {
    x += coef[i] / (z + i)
  }
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
