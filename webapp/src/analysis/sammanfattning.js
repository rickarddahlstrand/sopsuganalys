/**
 * Port of scripts/sammanfattning.py
 * Source: Sheet1 (merged cells) → KPIs
 */

export function analyzeSammanfattning(parsedFiles) {
  const allRows = []

  for (const file of parsedFiles) {
    const { monthNum, sortKey, month, sheets } = file
    for (const row of sheets.sheet1) {
      allRows.push({
        monthNum,
        sortKey,
        month,
        key: row.label,
        value: row.value,
        comment: row.comment,
      })
    }
  }

  // Identify KPIs
  const kpiMap = {}
  for (const row of allRows) {
    if (!kpiMap[row.key]) kpiMap[row.key] = []
    kpiMap[row.key].push({ monthNum: row.monthNum, sortKey: row.sortKey, month: row.month, value: row.value })
  }

  const kpis = []
  for (const [key, entries] of Object.entries(kpiMap)) {
    const values = entries.map(e => e.value).filter(v => v != null)
    const numericValues = values.map(Number).filter(n => !isNaN(n))

    const isNumeric = numericValues.length > 0 && numericValues.length >= values.length * 0.5

    if (isNumeric) {
      kpis.push({
        key,
        type: 'numeric',
        monthCount: values.length,
        min: Math.round(Math.min(...numericValues) * 100) / 100,
        max: Math.round(Math.max(...numericValues) * 100) / 100,
        mean: Math.round(avg(numericValues) * 100) / 100,
        unit: guessUnit(key),
        monthlyValues: entries.map(e => ({
          monthNum: e.monthNum,
          sortKey: e.sortKey,
          month: e.month,
          value: Number(e.value),
        })).filter(e => !isNaN(e.value)).sort((a, b) => a.sortKey - b.sortKey),
      })
    } else {
      kpis.push({
        key,
        type: 'text',
        monthCount: values.length,
        unit: '',
        monthlyValues: entries.sort((a, b) => a.sortKey - b.sortKey),
      })
    }
  }

  // Sort: numeric first, then by max value descending
  const numericKpis = kpis.filter(k => k.type === 'numeric').sort((a, b) => b.max - a.max)
  const textKpis = kpis.filter(k => k.type === 'text')

  return {
    allRows,
    kpis,
    numericKpis,
    textKpis,
    top6: numericKpis.slice(0, 6),
    totalKeys: kpis.length,
  }
}

function guessUnit(key) {
  const low = key.toLowerCase()
  if (low.includes('kwh') || low.includes('energy')) return 'kWh'
  if (low.includes('kpa') || low.includes('vacuum')) return 'kPa'
  if (low.includes('ton') || low.includes('weight')) return 'ton'
  if (low.includes('hour') || low.includes('time')) return 'h'
  if (low.includes('%') || low.includes('percent')) return '%'
  if (low.includes('transport')) return 'st'
  return ''
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
