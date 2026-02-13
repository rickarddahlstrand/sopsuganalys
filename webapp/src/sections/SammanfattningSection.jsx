import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { translateKpiLabel } from '../utils/colors'
import { SECTION_INFO, CHART_INFO, KPI_INFO, TABLE_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import EmptyState from '../components/common/EmptyState'
import InfoButton from '../components/common/InfoButton'
import { createTrendLineLayer } from '../components/charts/TrendLine'
import { ResponsiveBar } from '@nivo/bar'

const kpiTrendLine = createTrendLineLayer('value', '#1e40af')

const DEFAULT_CHART_LIMIT = 4

export default function SammanfattningSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const samm = state.sammanfattning
  const printMode = state.printMode
  const [showAllCharts, setShowAllCharts] = useState(false)

  if (!samm) return <SectionWrapper id="sammanfattning" title="Sammanfattning" icon={FileText} info={SECTION_INFO.sammanfattning}><EmptyState loading={state.isLoading} /></SectionWrapper>

  const top6 = samm.top6 || []

  // Filter KPIs that have changing values (min !== max) for charts
  const changingKpis = top6.filter(kpi => kpi.min !== kpi.max)

  return (
    <SectionWrapper id="sammanfattning" title="Sammanfattning" icon={FileText} info={SECTION_INFO.sammanfattning}>
      <KpiGrid>
        {top6.map(kpi => (
          <KpiCard
            key={kpi.key}
            label={translateKpiLabel(kpi.key)}
            value={`${kpi.mean} ${kpi.unit}`}
            icon={FileText}
            color="blue"
            info={KPI_INFO['Sammanfattning KPI']}
          />
        ))}
      </KpiGrid>

      {/* Charts only for KPIs with changing values */}
      {changingKpis.length > 0 && (
        <div className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>:last-child:nth-child(odd)]:md:col-span-2">
            {(showAllCharts ? changingKpis : changingKpis.slice(0, DEFAULT_CHART_LIMIT)).map(kpi => (
              <ChartCard key={kpi.key} title={`${translateKpiLabel(kpi.key)} ${kpi.unit ? `(${kpi.unit})` : ''}`} height={220} info={CHART_INFO['Sammanfattning — månatlig variation']}>
                <ResponsiveBar
                  data={kpi.monthlyValues.map(v => ({ month: v.month, value: v.value }))}
                  keys={['value']}
                  indexBy="month"
                  theme={theme}
                  colors={['#3b82f6']}
                  borderRadius={3}
                  padding={0.3}
                  margin={{ top: 10, right: 10, bottom: 30, left: 60 }}
                  axisLeft={{ tickSize: 0, tickPadding: 5 }}
                  axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
                  enableLabel={false}
                  layers={['grid', 'axes', 'bars', kpiTrendLine, 'markers', 'legends', 'annotations']}
                />
              </ChartCard>
            ))}
          </div>
          {!printMode && changingKpis.length > DEFAULT_CHART_LIMIT && (
            <div className="flex justify-center mt-3">
              <button
                onClick={() => setShowAllCharts(s => !s)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                {showAllCharts ? <><ChevronUp className="w-3.5 h-3.5" />Visa färre diagram</> : <><ChevronDown className="w-3.5 h-3.5" />Visa alla {changingKpis.length} diagram</>}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">KPI-tabell<InfoButton text={TABLE_INFO['KPI-tabell']} size={14} /></h4>
        <DataTable
          columns={[
            { key: 'key', label: 'KPI', render: v => translateKpiLabel(v) },
            { key: 'type', label: 'Typ', render: v => v === 'numeric' ? 'Numerisk' : 'Text' },
            { key: 'mean', label: 'Medel', render: v => v != null ? v : '–' },
            { key: 'min', label: 'Min', render: v => v != null ? v : '–' },
            { key: 'max', label: 'Max', render: v => v != null ? v : '–' },
            { key: 'unit', label: 'Enhet' },
          ]}
          data={samm.kpis}
        />
      </div>
    </SectionWrapper>
  )
}
