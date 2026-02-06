export const lightTheme = {
  text: { fontSize: 12, fill: '#334155' },
  axis: {
    ticks: { text: { fontSize: 11, fill: '#64748b' } },
    legend: { text: { fontSize: 12, fill: '#334155' } },
  },
  grid: { line: { stroke: '#e2e8f0', strokeWidth: 1 } },
  legends: { text: { fontSize: 11, fill: '#334155' } },
  tooltip: {
    container: {
      background: '#ffffff',
      color: '#334155',
      fontSize: 12,
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
  },
}

export const darkTheme = {
  text: { fontSize: 12, fill: '#cbd5e1' },
  axis: {
    ticks: { text: { fontSize: 11, fill: '#94a3b8' } },
    legend: { text: { fontSize: 12, fill: '#cbd5e1' } },
  },
  grid: { line: { stroke: '#334155', strokeWidth: 1 } },
  legends: { text: { fontSize: 11, fill: '#cbd5e1' } },
  tooltip: {
    container: {
      background: '#1e293b',
      color: '#e2e8f0',
      fontSize: 12,
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
    },
  },
}

export function getNivoTheme(dark) {
  return dark ? darkTheme : lightTheme
}
