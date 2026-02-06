import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KpiCard({ label, value, delta, icon: Icon, color = 'emerald' }) {
  const colorMap = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400',
    blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    red: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
    orange: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400',
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{label}</p>
          <p className="text-2xl font-bold mt-1 truncate">{value}</p>
          {delta != null && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${
              delta > 0 ? 'text-red-500' : delta < 0 ? 'text-emerald-500' : 'text-slate-400'
            }`}>
              {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              <span>{delta > 0 ? '+' : ''}{typeof delta === 'number' ? delta.toFixed(1) : delta}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.emerald}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  )
}
