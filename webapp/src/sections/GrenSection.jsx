import { useState } from 'react'
import { GitBranch, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, fmt1, pct } from '../utils/formatters'
import { healthColor } from '../utils/colors'
import { SECTION_INFO, CHART_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import SortToggle from '../components/common/SortToggle'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveHeatMap } from '@nivo/heatmap'
import { ResponsivePie } from '@nivo/pie'

function applySortBar(data, valueKey, sortMode) {
  if (sortMode === 'default') return data
  const sorted = [...data]
  sorted.sort((a, b) => sortMode === 'asc' ? a[valueKey] - b[valueKey] : b[valueKey] - a[valueKey])
  return sorted
}

export default function GrenSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const gren = state.grenDjupanalys
  const trend = state.trendanalys

  const [healthSort, setHealthSort] = useState('default')
  const [manualSort, setManualSort] = useState('default')
  const [showAllHealth, setShowAllHealth] = useState(false)
  const [showAllError, setShowAllError] = useState(false)
  const [showAllManual, setShowAllManual] = useState(false)

  if (!gren) return <SectionWrapper id="grenar" title="Grenanalys" icon={GitBranch} info={SECTION_INFO.grenar}><EmptyState loading={state.isLoading} /></SectionWrapper>

  const profiles = gren.profiles || []
  const branchAnalysis = trend?.branchAnalysis || []

  // Heatmap: branch × month availability — use sortKey for unique months across years
  const sortedMonths = [...new Map(gren.branchData.map(r => [r.sortKey, r.month])).entries()].sort((a, b) => a[0] - b[0])
  const heatmapData = gren.branches.map(branch => ({
    id: `Gren ${branch}`,
    data: sortedMonths.map(([sk, label]) => {
      const row = gren.branchData.find(r => r.branch === branch && r.sortKey === sk)
      return { x: label, y: row?.avgAvailability || 0 }
    }),
  }))

  // Health score ranking (horizontal bar)
  const allHealthData = branchAnalysis.map(b => ({
    branch: `Gren ${b.branch}`,
    score: Math.round(b.healthScore),
    color: healthColor(b.healthScore),
  }))
  const healthLimit = showAllHealth ? allHealthData.length : 20
  const healthDataRaw = allHealthData.slice(0, healthLimit)
  const healthData = applySortBar(healthDataRaw, 'score', healthSort)

  // Branch type pie
  const typeCount = {}
  for (const p of profiles) {
    typeCount[p.branchType] = (typeCount[p.branchType] || 0) + 1
  }
  const pieData = Object.entries(typeCount).map(([type, count]) => ({
    id: type, label: type, value: count,
  }))

  // Error trend worst branches
  const errorTrendLimit = showAllError ? branchAnalysis.length : 5
  const topErrorBranches = branchAnalysis.slice(0, errorTrendLimit).map(b => b.branch)
  const errorTrendLines = topErrorBranches.map(branch => ({
    id: `Gren ${branch}`,
    data: gren.branchData
      .filter(r => r.branch === branch)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(r => ({ x: r.month, y: r.totalErrors })),
  })).filter(l => l.data.length > 0)

  // Manual% per branch (horizontal bar)
  const allManualBranches = profiles
    .filter(p => p.manualPct > 0)
    .sort((a, b) => b.manualPct - a.manualPct)
  const manualLimit = showAllManual ? allManualBranches.length : 15
  const manualDataRaw = allManualBranches
    .slice(0, manualLimit)
    .map(p => ({ branch: `Gren ${p.branch}`, manualPct: p.manualPct }))
  const manualData = applySortBar(manualDataRaw, 'manualPct', manualSort)

  // Season grouped bar
  const seasonData = profiles.filter(p => p.summerCmd > 0 || p.winterCmd > 0).map(p => ({
    branch: `Gren ${p.branch}`,
    Sommar: p.summerCmd,
    Vinter: p.winterCmd,
  }))

  return (
    <SectionWrapper id="grenar" title="Grenanalys" icon={GitBranch} info={SECTION_INFO.grenar}>
      <KpiGrid>
        <KpiCard label="Grenar" value={fmt(gren.totalBranches)} icon={GitBranch} color="orange" />
        <KpiCard label="Grentyper" value={Object.keys(typeCount).length} icon={GitBranch} color="blue" />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <ChartCard title="Tillgänglighet per gren × månad (heatmap)" height={Math.max(350, gren.branches.length * 22)} info={CHART_INFO['Tillgänglighet per gren × månad (heatmap)']}>
          {heatmapData.length > 0 && (
            <ResponsiveHeatMap
              data={heatmapData}
              theme={theme}
              margin={{ top: 10, right: 60, bottom: 35, left: 80 }}
              axisTop={null}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              valueFormat=".1f"
              colors={({ value }) => {
                if (value == null || value === 0) return '#f1f5f9'
                // More nuanced color scale based on typical availability values
                if (value < 90) return '#dc2626'     // röd - kritiskt
                if (value < 93) return '#ef4444'     // ljusröd
                if (value < 95) return '#f97316'     // orange - varning
                if (value < 97) return '#fb923c'     // ljusorange
                if (value < 98) return '#facc15'     // gul
                if (value < 99) return '#a3e635'     // limegrön
                if (value < 99.5) return '#4ade80'   // ljusgrön
                return '#22c55e'                      // grön - utmärkt
              }}
              emptyColor="#f1f5f9"
              borderWidth={1}
              borderColor={dark ? '#334155' : '#e2e8f0'}
              labelTextColor={({ value }) => value != null && value < 97 ? '#fff' : (dark ? '#1e293b' : '#1e293b')}
              hoverTarget="cell"
              animate={false}
            />
          )}
        </ChartCard>

        <ChartCard
          title={`Hälsopoäng per gren (${healthData.length} st)`}
          height={Math.max(300, healthData.length * 25)}
          info={CHART_INFO['Hälsopoäng per gren']}
          controls={<>
            <SortToggle sortMode={healthSort} onChange={setHealthSort} />
            {allHealthData.length > 20 && (
              <button onClick={() => setShowAllHealth(s => !s)} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors">
                {showAllHealth ? <><ChevronUp className="w-3 h-3" />Visa 20</> : <><ChevronDown className="w-3 h-3" />Alla ({allHealthData.length})</>}
              </button>
            )}
          </>}
        >
          {healthData.length > 0 && (
            <ResponsiveBar
              data={healthData}
              keys={['score']}
              indexBy="branch"
              layout="horizontal"
              theme={theme}
              borderRadius={3}
              padding={0.3}
              margin={{ top: 10, right: 30, bottom: 30, left: 80 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5 }}
              enableLabel={true}
              label={d => `${d.value}p`}
              labelTextColor="#fff"
              colors={({ data }) => data.color}
            />
          )}
        </ChartCard>

        <ChartCard title="Grentyper (fördelning)" height={300} info={CHART_INFO['Grentyper (fördelning)']}>
          {pieData.length > 0 && (
            <ResponsivePie
              data={pieData}
              theme={theme}
              innerRadius={0.5}
              padAngle={2}
              cornerRadius={4}
              margin={{ top: 20, right: 80, bottom: 20, left: 20 }}
              colors={{ scheme: 'set2' }}
              arcLinkLabelsTextColor={dark ? '#94a3b8' : '#64748b'}
              arcLinkLabelsColor={{ from: 'color' }}
              arcLabelsTextColor="#fff"
            />
          )}
        </ChartCard>

        <ChartCard
          title={`Feltrend sämsta grenar (${topErrorBranches.length} st)`}
          height={300}
          info={CHART_INFO['Feltrend topp-5 sämsta grenar']}
          controls={branchAnalysis.length > 5 && (
            <button onClick={() => setShowAllError(s => !s)} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors">
              {showAllError ? <><ChevronUp className="w-3 h-3" />Visa 5</> : <><ChevronDown className="w-3 h-3" />Alla ({branchAnalysis.length})</>}
            </button>
          )}
        >
          {errorTrendLines.length > 0 && (
            <ResponsiveLine
              data={errorTrendLines}
              theme={theme}
              margin={{ top: 10, right: 90, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={5}
              colors={{ scheme: 'set1' }}
              useMesh
              enableSlices="x"
              legends={[{ anchor: 'right', direction: 'column', translateX: 90, itemWidth: 80, itemHeight: 16, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
            />
          )}
        </ChartCard>

        {manualData.length > 0 && (
          <ChartCard
            title={`Manuell andel per gren (${manualData.length} st)`}
            height={Math.max(250, manualData.length * 25)}
            info={CHART_INFO['Manuell andel per gren']}
            controls={<>
              <SortToggle sortMode={manualSort} onChange={setManualSort} />
              {allManualBranches.length > 15 && (
                <button onClick={() => setShowAllManual(s => !s)} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors">
                  {showAllManual ? <><ChevronUp className="w-3 h-3" />Visa 15</> : <><ChevronDown className="w-3 h-3" />Alla ({allManualBranches.length})</>}
                </button>
              )}
            </>}
          >
            <ResponsiveBar
              data={manualData}
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

        {seasonData.length > 0 && (
          <ChartCard title="Sommar vs vinter per gren (kommandon)" height={300} info={CHART_INFO['Sommar vs vinter per gren (kommandon)']}>
            <ResponsiveBar
              data={seasonData}
              keys={['Sommar', 'Vinter']}
              indexBy="branch"
              theme={theme}
              groupMode="grouped"
              borderRadius={3}
              padding={0.3}
              margin={{ top: 10, right: 80, bottom: 35, left: 80 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              enableLabel={false}
              colors={['#f97316', '#3b82f6']}
              legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 80, itemWidth: 70, itemHeight: 18, symbolSize: 12, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
            />
          </ChartCard>
        )}
      </div>

      {profiles.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Grenprofiler</h4>
          <DataTable
            columns={[
              { key: 'branch', label: 'Gren', render: v => `Gren ${v}` },
              { key: 'branchType', label: 'Typ' },
              { key: 'valveCount', label: 'Ventiler' },
              { key: 'avgAvailability', label: 'Tillg.', render: v => pct(v) },
              { key: 'totalErrors', label: 'Fel', render: v => fmt(v) },
              { key: 'manualPct', label: 'Manuell%', render: v => `${v}%` },
              { key: 'seasonType', label: 'Säsong' },
            ]}
            data={profiles}
          />
        </div>
      )}
    </SectionWrapper>
  )
}
