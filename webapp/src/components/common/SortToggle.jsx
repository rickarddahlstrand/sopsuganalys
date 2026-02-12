import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

/**
 * Tiny sort toggle for chart headers.
 * sortMode cycles: 'default' → 'asc' → 'desc' → 'default'
 */
export default function SortToggle({ sortMode, onChange }) {
  const next = sortMode === 'default' ? 'asc' : sortMode === 'asc' ? 'desc' : 'default'
  const label = sortMode === 'asc' ? 'Stigande' : sortMode === 'desc' ? 'Fallande' : 'Original'
  const Icon = sortMode === 'asc' ? ArrowUp : sortMode === 'desc' ? ArrowDown : ArrowUpDown

  return (
    <button
      onClick={() => onChange(next)}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors"
      title={`Sortering: ${label}`}
    >
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </button>
  )
}
