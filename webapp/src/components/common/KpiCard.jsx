import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react'
import InfoButton from './InfoButton'
import { useData } from '../../context/DataContext'

/**
 * KpiCard
 *
 * Props:
 *  - label, value, info, icon, color
 *  - delta: gammal "vs föregående period"-procentdelta (rendreras som tidigare)
 *  - compareValue: jämförelse med annan anläggning
 *  - historicValue: hela periodens värde när primärvärdet är "senaste 3 mån"
 *  - historicLabel: prefix-text för historicValue (default "Hela perioden")
 *  - recentLabel: prefix-text för primary value (default "Senaste 3 mån")
 *  - showRecentBadge: visa "Senaste 3 mån"-badge ovanför värdet
 *  - trendDelta: numerisk skillnad recent − historic. Positiv → uppåt, neg → nedåt.
 *      Anges som ett tal eller objekt { value, unit, betterWhen: 'higher'|'lower' }.
 */
export default function KpiCard({
  label, value, delta, icon: Icon, color = 'emerald', info, compareValue,
  historicValue, historicLabel = 'Hela perioden', recentLabel = 'Senaste 3 mån',
  showRecentBadge = false, trendDelta = null,
}) {
  const { state } = useData()
  const printMode = state.printMode
  const colorMap = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400',
    blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    red: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
    orange: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400',
    purple: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400',
  }

  // Normalisera trendDelta till objekt
  let td = null
  if (trendDelta != null) {
    if (typeof trendDelta === 'number') {
      td = { value: trendDelta, unit: '', betterWhen: 'higher' }
    } else {
      td = { value: trendDelta.value, unit: trendDelta.unit || '', betterWhen: trendDelta.betterWhen || 'higher' }
    }
  }

  let trendArrow = null
  if (td != null && td.value != null && !Number.isNaN(td.value)) {
    const v = td.value
    const isImprovement = (td.betterWhen === 'higher' && v > 0) || (td.betterWhen === 'lower' && v < 0)
    const isWorsening = (td.betterWhen === 'higher' && v < 0) || (td.betterWhen === 'lower' && v > 0)
    const tone = Math.abs(v) < 0.05 ? 'stable' : isImprovement ? 'good' : isWorsening ? 'bad' : 'stable'
    const cls = tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-red-500' : 'text-slate-400'
    const Arrow = tone === 'stable' ? ArrowRight : (v > 0 ? ArrowUp : ArrowDown)
    const sign = v > 0 ? '+' : ''
    const formatted = typeof v === 'number' ? v.toFixed(Math.abs(v) < 1 ? 2 : 1) : v
    trendArrow = (
      <div className={`flex items-center gap-1 mt-1 text-xs ${cls}`}>
        <Arrow className="w-3 h-3" />
        <span>{sign}{formatted}{td.unit}</span>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <span className="flex items-center gap-1">
            <p className={`text-sm text-slate-500 dark:text-slate-400 ${printMode ? '' : 'truncate'}`}>{label}</p>
            {info && <InfoButton text={info} size={13} />}
          </span>
          {showRecentBadge && (
            <span className="inline-block mt-1 mb-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {recentLabel}
            </span>
          )}
          <p className={`text-xl md:text-2xl font-bold mt-1 ${printMode ? '' : 'break-words'}`}>{value}</p>
          {historicValue != null && (
            <p className={`text-xs mt-0.5 text-slate-500 dark:text-slate-400 ${printMode ? '' : 'break-words'}`}>
              {historicLabel}: <span className="font-medium text-slate-600 dark:text-slate-300">{historicValue}</span>
            </p>
          )}
          {trendArrow}
          {compareValue != null && (
            <p className={`text-sm mt-0.5 text-blue-500 dark:text-blue-400 ${printMode ? '' : 'break-words'}`}>
              vs {compareValue}
            </p>
          )}
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
