const svNum = new Intl.NumberFormat('sv-SE')
const svDec1 = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const svDec2 = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function fmt(n) {
  if (n == null || isNaN(n)) return '–'
  return svNum.format(Math.round(n))
}

export function fmt1(n) {
  if (n == null || isNaN(n)) return '–'
  return svDec1.format(n)
}

export function fmt2(n) {
  if (n == null || isNaN(n)) return '–'
  return svDec2.format(n)
}

export function pct(n, decimals = 1) {
  if (n == null || isNaN(n)) return '–'
  return n.toFixed(decimals) + '%'
}

export function delta(current, previous) {
  if (current == null || previous == null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function deltaLabel(pctChange) {
  if (pctChange == null) return ''
  const sign = pctChange >= 0 ? '+' : ''
  return `${sign}${pctChange.toFixed(1)}%`
}
