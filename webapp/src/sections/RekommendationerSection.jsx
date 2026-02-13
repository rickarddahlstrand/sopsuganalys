import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '../context/DataContext'
import { fmt } from '../utils/formatters'
import { SECTION_INFO, TABLE_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import DataTable from '../components/common/DataTable'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import InfoButton from '../components/common/InfoButton'

const PRIO_COLORS = {
  1: 'critical',
  2: 'warning',
  3: 'info',
  4: 'ok',
}

const TABS = [
  { label: 'Alla', value: null },
  { label: 'Prio 1', value: 1 },
  { label: 'Prio 2', value: 2 },
  { label: 'Prio 3', value: 3 },
  { label: 'Prio 4', value: 4 },
]

export default function RekommendationerSection() {
  const { state } = useData()
  const printMode = state.printMode
  const [filter, setFilter] = useState(null)
  const rek = state.rekommendationer

  if (!rek) return <SectionWrapper id="rekommendationer" title="Rekommendationer" icon={ClipboardCheck} info={SECTION_INFO.rekommendationer}><EmptyState loading={state.isLoading} /></SectionWrapper>

  const recs = rek.recommendations || []
  const goals = rek.goals || []
  const agenda = rek.agenda

  const filtered = printMode ? recs : (filter == null ? recs : recs.filter(r => r.prioritet === filter))

  const recCard = (rec, i) => (
    <div
      key={`${rec.prioritet}-${rec.mal}-${i}`}
      className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-5"
    >
      <div className="flex items-center gap-3 mb-2">
        <StatusBadge status={PRIO_COLORS[rec.prioritet]} label={`Prio ${rec.prioritet}`} />
        <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">{rec.kategori}</span>
      </div>
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{rec.mal}</h4>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{rec.rekommendation}</p>

      {rec.dataunderlag && (
        <p className="text-xs text-slate-500 dark:text-slate-500 mb-2 italic">{rec.dataunderlag}</p>
      )}

      {rec.atgarder?.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Åtgärder:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {rec.atgarder.map((a, j) => (
              <li key={j} className="text-xs text-slate-600 dark:text-slate-400">{a}</li>
            ))}
          </ul>
        </div>
      )}

      {rec.forvantadEffekt && (
        <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          Förväntad effekt: {rec.forvantadEffekt}
        </div>
      )}
    </div>
  )

  return (
    <SectionWrapper id="rekommendationer" title="Rekommendationer" icon={ClipboardCheck} info={SECTION_INFO.rekommendationer}>
      {/* Priority filter tabs — hidden in printMode */}
      {!printMode && (
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.label}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === tab.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/80'
              }`}
            >
              {tab.label}
              {tab.value != null && (
                <span className="ml-1 text-xs opacity-75">
                  ({recs.filter(r => r.prioritet === tab.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Recommendation cards — plain divs in printMode, animated in normal mode */}
      <div className="space-y-4">
        {printMode ? (
          filtered.map((rec, i) => recCard(rec, i))
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((rec, i) => (
              <motion.div
                key={`${rec.prioritet}-${rec.mal}-${i}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                {recCard(rec, i)}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Strategic goals */}
      {goals.length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Strategiska mål (KPI)<InfoButton text={TABLE_INFO['Strategiska mål']} size={14} /></h4>
          <DataTable
            columns={[
              { key: 'kpi', label: 'KPI' },
              { key: 'current', label: 'Nuläge' },
              { key: 'target3m', label: '3 mån' },
              { key: 'target6m', label: '6 mån' },
              { key: 'target12m', label: '12 mån' },
              { key: 'strategy', label: 'Strategi' },
            ]}
            data={goals}
          />
        </div>
      )}

      {/* Operator agenda */}
      {agenda && (
        <div className="mt-8">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Operatörsagenda<InfoButton text={TABLE_INFO['Operatörsagenda']} size={14} /></h4>

          {agenda.facilityStatus && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Total energi</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fmt(agenda.facilityStatus.totalKwh)} kWh</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Tömningar</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fmt(agenda.facilityStatus.totalEmptyings)}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">kWh/tömning</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{agenda.facilityStatus.avgKwhPerEmptying}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Tillgänglighet</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{agenda.facilityStatus.avgAvailability}%</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Totala fel</div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fmt(agenda.facilityStatus.totalErrors)}</div>
              </div>
            </div>
          )}

          {agenda.urgentActions?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">Akuta åtgärder ({agenda.urgentActions.length})</p>
              <div className="space-y-2">
                {agenda.urgentActions.map((a, i) => (
                  <div key={i} className="bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2 border border-red-200 dark:border-red-800">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{a.mal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agenda.plannedImprovements?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-2">Planerade förbättringar ({agenda.plannedImprovements.length})</p>
              <div className="space-y-2">
                {agenda.plannedImprovements.map((a, i) => (
                  <div key={i} className="bg-orange-50 dark:bg-orange-900/20 rounded-lg px-4 py-2 border border-orange-200 dark:border-orange-800">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{a.mal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionWrapper>
  )
}
