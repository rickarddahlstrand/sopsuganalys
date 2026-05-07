/**
 * Period-väljare för "Senaste N månader" eller "Hela perioden".
 *
 * Props:
 *  - value: aktuellt fönster i månader, eller null för hela perioden
 *  - onChange: (newValue: number|null) => void
 *  - totalMonths: antal uppladdade månader (för att avgöra vilka val som visas)
 *  - options: valfri lista av fönsteralternativ. Default [3, 6, 12]
 *  - label: valfri rubriktext, default "Period:"
 */
export default function WindowPicker({ value, onChange, totalMonths, options = [3, 6, 12], label = 'Period:' }) {
  if (!totalMonths) return null

  const validOptions = options.filter(o => o < totalMonths)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 gap-0.5">
        {validOptions.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              value === opt
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {opt} mån
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            value == null
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Hela ({totalMonths})
        </button>
      </div>
    </div>
  )
}
