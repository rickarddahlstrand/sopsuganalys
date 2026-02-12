import { Search } from 'lucide-react'
import { useData } from '../context/DataContext'
import { fmt, fmt1, fmt2, pct } from '../utils/formatters'
import { SECTION_INFO, KPI_INFO, TABLE_INFO } from '../utils/descriptions'
import { ERROR_NAMES_SV } from '../utils/colors'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import DataTable from '../components/common/DataTable'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import InfoButton from '../components/common/InfoButton'

export default function DrifterfarenheterSection() {
  const { state } = useData()
  const drift = state.drifterfarenheter

  if (!drift) return <SectionWrapper id="drifterfarenheter" title="Drifterfarenheter" icon={Search} info={SECTION_INFO.drifterfarenheter}><EmptyState loading={state.isLoading} /></SectionWrapper>

  const { manualVsErrors, energy, manualTrend, alarms, findings } = drift

  // Risk valves table
  const riskValves = manualVsErrors?.riskValves || []

  // Error correlation table
  const corrRows = manualVsErrors?.correlations
    ? Object.entries(manualVsErrors.correlations).map(([type, data]) => ({
        errorType: type,
        pearsonR: data.pearsonR?.toFixed(3) || '–',
        pValue: data.pValue != null ? (data.pValue < 0.001 ? '<0.001' : data.pValue.toFixed(3)) : '–',
        totalCount: fmt(data.totalCount),
      }))
    : []

  // Alarm patterns
  const errorDist = alarms?.errorDistribution || []

  return (
    <SectionWrapper id="drifterfarenheter" title="Drifterfarenheter" icon={Search} info={SECTION_INFO.drifterfarenheter}>
      {/* Findings cards */}
      {findings?.length > 0 && (
        <div className="space-y-3 mb-6">
          {findings.map((f, i) => (
            <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={f.priority === 1 ? 'critical' : f.priority === 2 ? 'warning' : 'info'} label={`Prio ${f.priority}`} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{f.area}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{f.finding}</p>
            </div>
          ))}
        </div>
      )}

      {/* Energy efficiency KPIs */}
      {energy?.kwhPerEmptyingMean != null && (
        <KpiGrid>
          <KpiCard label="kWh/tömning (medel)" value={fmt2(energy.kwhPerEmptyingMean)} icon={Search} color="yellow" info={KPI_INFO['kWh/tömning (medel)']} />
          <KpiCard label="Bästa månad" value={`${energy.bestMonth} (${fmt2(energy.kwhPerEmptyingMin)})`} icon={Search} color="emerald" info={KPI_INFO['Bästa energimånad']} />
          <KpiCard label="Sämsta månad" value={`${energy.worstMonth} (${fmt2(energy.kwhPerEmptyingMax)})`} icon={Search} color="red" info={KPI_INFO['Sämsta energimånad']} />
          <KpiCard label="Spridning" value={`${energy.spreadPct}%`} icon={Search} color="orange" info={KPI_INFO['Energispridning']} />
        </KpiGrid>
      )}

      {/* Manual trend KPIs */}
      {manualTrend?.yearPct != null && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Manuella körningar<InfoButton text={TABLE_INFO['Manuella körningar']} size={14} /></h4>
          <KpiGrid>
            <KpiCard label="Manuell andel (år)" value={`${manualTrend.yearPct}%`} icon={Search} color="purple" info={KPI_INFO['Manuell andel (år)']} />
            <KpiCard label="H1" value={`${manualTrend.h1Pct}%`} icon={Search} color="blue" info={KPI_INFO['Manuell H1']} />
            <KpiCard label="H2" value={`${manualTrend.h2Pct}%`} icon={Search} color="cyan" info={KPI_INFO['Manuell H2']} />
            <KpiCard label="Sämsta månad" value={`${manualTrend.worstMonth} (${manualTrend.worstMonthPct}%)`} icon={Search} color="red" info={KPI_INFO['Sämsta manuellmånad']} />
          </KpiGrid>
        </div>
      )}

      {/* Risk valves */}
      {riskValves.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Riskventiler (hög manuell + hög tillgänglighet)<InfoButton text={TABLE_INFO['Riskventiler']} size={14} /></h4>
          <DataTable
            columns={[
              { key: 'valve', label: 'Ventil' },
              { key: 'branch', label: 'Gren' },
              { key: 'manualPct', label: 'Manuell%', render: v => `${v}%` },
              { key: 'availability', label: 'Tillgänglighet', render: v => v != null ? pct(v) : '–' },
              { key: 'totalErrors', label: 'Fel', render: v => fmt(v) },
              { key: 'dominantError', label: 'Dominerande fel', render: v => ERROR_NAMES_SV[v] || v },
            ]}
            data={riskValves}
          />
        </div>
      )}

      {/* Error correlations */}
      {corrRows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Korrelation: manuella ingrepp vs feltyper<InfoButton text={TABLE_INFO['Korrelation manuella vs feltyper']} size={14} /></h4>
          <DataTable
            columns={[
              { key: 'errorType', label: 'Feltyp', render: v => ERROR_NAMES_SV[v] || v },
              { key: 'pearsonR', label: 'Pearson r' },
              { key: 'pValue', label: 'p-värde' },
              { key: 'totalCount', label: 'Antal fel' },
            ]}
            data={corrRows}
          />
        </div>
      )}

      {/* Alarm patterns */}
      {alarms?.totalAlarms != null && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Larmmönster<InfoButton text={TABLE_INFO['Larmmönster']} size={14} /></h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">Totala larm</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{fmt(alarms.totalAlarms)}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">Medel/mån</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{fmt(alarms.meanPerMonth)}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">Januari-faktor</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{alarms.januaryFactorVsRest}x</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">Anomalier</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{alarms.anomalyCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error type distribution */}
      {errorDist.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Feltypsfördelning<InfoButton text={TABLE_INFO['Feltypsfördelning']} size={14} /></h4>
          <DataTable
            columns={[
              { key: 'type', label: 'Feltyp', render: v => ERROR_NAMES_SV[v] || v },
              { key: 'count', label: 'Antal', render: v => fmt(v) },
              { key: 'pct', label: 'Andel', render: v => `${v}%` },
            ]}
            data={errorDist}
          />
        </div>
      )}
    </SectionWrapper>
  )
}
