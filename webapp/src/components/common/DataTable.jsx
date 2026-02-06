import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export default function DataTable({ columns, data, maxRows = 20 }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [showAll, setShowAll] = useState(false)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  let sorted = [...data]
  if (sortKey) {
    sorted.sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey]
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va
      return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
    })
  }

  const limit = showAll ? sorted.length : maxRows
  const displayed = sorted.slice(0, limit)
  const hasMore = data.length > maxRows

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50">
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 select-none whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key ? (
                    sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 opacity-30" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayed.map((row, i) => (
            <tr key={i} className={`border-t border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/25'}`}>
              {columns.map(col => (
                <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '–')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Visar {displayed.length} av {data.length} rader
          </span>
          <button
            onClick={() => setShowAll(s => !s)}
            className="text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {showAll ? 'Visa färre' : 'Visa alla'}
          </button>
        </div>
      )}
    </div>
  )
}
