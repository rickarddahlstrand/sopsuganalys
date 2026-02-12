import { useState } from 'react'
import { Hand, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, pct } from '../utils/formatters'
import { manualColor } from '../utils/colors'
import { SECTION_INFO, CHART_INFO, KPI_INFO, TABLE_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import EmptyState from '../components/common/EmptyState'
import InfoButton from '../components/common/InfoButton'
import SortToggle from '../components/common/SortToggle'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'

function applySortBar(data, valueKey, sortMode) {
  if (sortMode === 'default') return data
  const sorted = [...data]
  sorted.sort((a, b) => sortMode === 'asc' ? a[valueKey] - b[valueKey] : b[valueKey] - a[valueKey])
  return sorted
}

export default function ManuellSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const man = state.manuellAnalys

  const [top15Sort, setTop15Sort] = useState('default')
  const [branchSort, setBranchSort] = useState('default')
  const [showAllValves, setShowAllValves] = useState(false)
  const [showAllBranches, setShowAllBranches] = useState(false)
  const [showAllTable, setShowAllTable] = useState(false)

  if (!man) return <SectionWrapper id="manuell" title="Manuella körningar" icon={Hand} info={SECTION_INFO.manuell}><EmptyState loading={state.isLoading} /></SectionWrapper>

  // Stacked bar: auto + manual per month
  const stackedData = man.monthly.map(m => ({
    month: m.month,
    Automatiska: m.autoTotal,
    Manuella: m.manTotal,
  }))

  // Manual% trend line
  const manPctLine = [{
    id: 'Manuell%',
    data: man.monthly.map(m => ({ x: m.month, y: m.manualPct })),
  }]

  // Top manual valves horizontal bar
  const allManualValves = man.topManualValves || []
  const valveLimit = showAllValves ? allManualValves.length : 15
  const topValveDataRaw = allManualValves.slice(0, valveLimit).map(v => ({
    valve: v.valveId,
    manualPct: v.manualPct,
    color: manualColor(v.manualPct),
  }))
  const topValveData = applySortBar(topValveDataRaw, 'manualPct', top15Sort)

  // Per-branch horizontal bar
  const allBranches = man.branchSummary.filter(b => b.manualPct > 0)
  const branchLimit = showAllBranches ? allBranches.length : 15
  const branchDataRaw = allBranches
    .slice(0, branchLimit)
    .map(b => ({
      branch: `Gren ${b.branch}`,
      manualPct: b.manualPct,
    }))
  const branchData = applySortBar(branchDataRaw, 'manualPct', branchSort)

  // Table data
  const tableValveLimit = showAllTable ? allManualValves.length : 15
  const tableValves = allManualValves.slice(0, tableValveLimit)

  return (
    <SectionWrapper id="manuell" title="Manuella körningar" icon={Hand} info={SECTION_INFO.manuell}>
      <KpiGrid>
        <KpiCard label="Manuella kommandon" value={fmt(man.totalMan)} icon={Hand} color="purple" info={KPI_INFO['Manuella kommandon']} />
        <KpiCard label="Totala kommandon" value={fmt(man.totalAll)} icon={Hand} color="blue" info={KPI_INFO['Totala kommandon']} />
        <KpiCard label="Manuell andel" value={`${man.yearPct}%`} icon={Hand} color="orange" info={KPI_INFO['Manuell andel']} />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 [&>:last-child:nth-child(odd)]:md:col-span-2">
        <ChartCard title="Automatiska vs manuella kommandon (stacked)" height={300} info={CHART_INFO['Automatiska vs manuella kommandon (stacked)']}>
          <ResponsiveBar
            data={stackedData}
            keys={['Automatiska', 'Manuella']}
            indexBy="month"
            theme={theme}
            groupMode="stacked"
            borderRadius={2}
            padding={0.3}
            margin={{ top: 10, right: 90, bottom: 35, left: 60 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
            colors={['#3b82f6', '#a855f7']}
            legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 90, itemWidth: 80, itemHeight: 18, symbolSize: 12, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
          />
        </ChartCard>

        <ChartCard title="Manuell andel per månad (%)" height={300} info={CHART_INFO['Manuell andel per månad (%)']}>
          <ResponsiveLine
            data={manPctLine}
            theme={theme}
            colors={['#a855f7']}
            margin={{ top: 10, right: 10, bottom: 35, left: 55 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            pointSize={6}
            pointColor={{ theme: 'background' }}
            pointBorderWidth={2}
            pointBorderColor={{ from: 'serieColor' }}
            enableArea
            areaOpacity={0.1}
            yScale={{ type: 'linear', min: 0, max: 'auto' }}
            useMesh
            enableSlices="x"
          />
        </ChartCard>

        {topValveData.length > 0 && (
          <ChartCard
            title={`Topp ventiler — manuell% (${topValveData.length} st)`}
            height={Math.max(300, topValveData.length * 25)}
            info={CHART_INFO['Topp-15 ventiler (manuell%)']}
            controls={<>
              <SortToggle sortMode={top15Sort} onChange={setTop15Sort} />
              {allManualValves.length > 15 && (
                <button onClick={() => setShowAllValves(s => !s)} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors">
                  {showAllValves ? <><ChevronUp className="w-3 h-3" />Visa 15</> : <><ChevronDown className="w-3 h-3" />Alla ({allManualValves.length})</>}
                </button>
              )}
            </>}
          >
            <ResponsiveBar
              data={topValveData}
              keys={['manualPct']}
              indexBy="valve"
              layout="horizontal"
              theme={theme}
              borderRadius={3}
              padding={0.3}
              margin={{ top: 10, right: 30, bottom: 30, left: 70 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5 }}
              enableLabel={true}
              label={d => `${d.value}%`}
              labelTextColor="#fff"
              colors={({ data }) => data.color}
            />
          </ChartCard>
        )}

        {branchData.length > 0 && (
          <ChartCard
            title={`Manuell andel per gren (${branchData.length} st)`}
            height={Math.max(250, branchData.length * 25)}
            info={CHART_INFO['Manuell andel per gren']}
            controls={<>
              <SortToggle sortMode={branchSort} onChange={setBranchSort} />
              {allBranches.length > 15 && (
                <button onClick={() => setShowAllBranches(s => !s)} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors">
                  {showAllBranches ? <><ChevronUp className="w-3 h-3" />Visa 15</> : <><ChevronDown className="w-3 h-3" />Alla ({allBranches.length})</>}
                </button>
              )}
            </>}
          >
            <ResponsiveBar
              data={branchData}
              keys={['manualPct']}
              indexBy="branch"
              layout="horizontal"
              theme={theme}
              borderRadius={3}
              padding={0.3}
              margin={{ top: 10, right: 30, bottom: 30, left: 80 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5 }}
              enableLabel={true}
              label={d => `${d.value}%`}
              labelTextColor="#fff"
              colors={['#a855f7']}
            />
          </ChartCard>
        )}
      </div>

      {tableValves.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">Manuella ventiler<InfoButton text={TABLE_INFO['Manuella ventiler']} size={14} /></h4>
            {allManualValves.length > 15 && (
              <button
                onClick={() => setShowAllTable(s => !s)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                {showAllTable ? <><ChevronUp className="w-3 h-3" />Visa färre</> : <><ChevronDown className="w-3 h-3" />Visa alla ({allManualValves.length})</>}
              </button>
            )}
          </div>
          <DataTable
            columns={[
              { key: 'valveId', label: 'Ventil' },
              { key: 'branch', label: 'Gren' },
              { key: 'manTotal', label: 'Manuella', render: v => fmt(v) },
              { key: 'autoTotal', label: 'Automatiska', render: v => fmt(v) },
              { key: 'manualPct', label: 'Manuell%', render: v => `${v}%` },
              { key: 'avgAvailability', label: 'Tillgänglighet', render: v => v != null ? pct(v) : '–' },
            ]}
            data={tableValves}
          />
        </div>
      )}
    </SectionWrapper>
  )
}
