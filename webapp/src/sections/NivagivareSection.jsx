import { useState } from 'react'
import { Gauge, AlertTriangle, VolumeX, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, fmt1, pct } from '../utils/formatters'
import { SECTION_INFO, CHART_INFO, KPI_INFO, TABLE_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import EmptyState from '../components/common/EmptyState'
import InfoButton from '../components/common/InfoButton'
import StatusBadge from '../components/common/StatusBadge'
import { COMPARE_COLORS } from './CompareSection'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'

const DEFAULT_LIMIT = 15

export default function NivagivareSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const n = state.nivagivare
  const { compareMode, compareData, compareFacilities } = state
  const cn = compareData?.nivagivare

  const printMode = state.printMode
  const [showAllSuspects, setShowAllSuspects] = useState(false)
  const [showAllSilent, setShowAllSilent] = useState(false)
  const [showAllHigh, setShowAllHigh] = useState(false)
  const [showAllLow, setShowAllLow] = useState(false)

  if (!n) {
    return (
      <SectionWrapper id="nivagivare" title="Nivågivare" icon={Gauge} info={SECTION_INFO.nivagivare}>
        <EmptyState loading={state.isLoading} />
      </SectionWrapper>
    )
  }

  const suspectLimit = showAllSuspects ? n.suspects.length : DEFAULT_LIMIT
  const suspects = n.suspects.slice(0, suspectLimit)

  const silentLimit = showAllSilent ? n.silentSensors.length : DEFAULT_LIMIT
  const silentSensors = n.silentSensors.slice(0, silentLimit)

  const highLimit = showAllHigh ? n.highLevelSuspects.length : DEFAULT_LIMIT
  const highSuspects = n.highLevelSuspects.slice(0, highLimit)

  const lowLimit = showAllLow ? n.lowLevelSuspects.length : DEFAULT_LIMIT
  const lowSuspects = n.lowLevelSuspects.slice(0, lowLimit)

  // Monthly line: level errors + silent valves
  const levelErrorLine = [
    {
      id: compareMode ? (state.facilityName || 'Nivåfel') : 'Nivåfel',
      data: n.monthlyLevelErrors.map(m => ({ x: m.month, y: m.levelError })),
    },
  ]
  if (compareMode && compareFacilities?.length > 0) {
    for (const cf of compareFacilities) {
      const cfn = cf.data?.nivagivare
      if (cfn?.monthlyLevelErrors?.length) {
        levelErrorLine.push({
          id: cf.name || 'Jämförelse',
          data: cfn.monthlyLevelErrors.map(m => ({ x: m.month, y: m.levelError })),
        })
      }
    }
  }

  // Monthly bar: silent valves per month (only current facility for clarity)
  const silentBarData = n.monthlyLevelErrors.map(m => ({
    month: m.month,
    Tysta: m.silentValves,
    Nivåfel: m.levelError,
  }))

  // Top branches suspects (horizontal bar)
  const branchBar = (n.branchSummary || [])
    .filter(b => b.suspects > 0)
    .slice(0, 15)
    .map(b => ({
      branch: `Gren ${b.branch}`,
      Misstänkta: b.suspects,
    }))

  const suspectColumns = [
    { key: 'valveId', label: 'Ventil' },
    { key: 'branch', label: 'Gren', render: v => v >= 0 ? v : '–' },
    {
      key: 'suspicionScore',
      label: 'Misstanke',
      render: v => (
        <StatusBadge
          status={v >= 50 ? 'critical' : v >= 20 ? 'warning' : 'info'}
          label={fmt(v)}
        />
      ),
    },
    { key: 'reasons', label: 'Observation' },
    { key: 'totalLevelErrors', label: 'Nivåfel', render: v => fmt(v) },
    {
      key: 'manualPct',
      label: 'Manuell%',
      render: v => `${fmt1(v)}%`,
    },
    {
      key: 'avgAvailability',
      label: 'Tillg.',
      render: v => v != null ? pct(v) : '–',
    },
  ]

  const silentColumns = [
    { key: 'valveId', label: 'Ventil' },
    { key: 'branch', label: 'Gren', render: v => v >= 0 ? v : '–' },
    { key: 'totalMan', label: 'Manuella', render: v => fmt(v) },
    { key: 'totalAuto', label: 'Auto', render: v => fmt(v) },
    { key: 'reportedMonths', label: 'Rapp. mån', render: (_, row) => `${row.reportedMonths}/${row.reportedMonths + row.missingMonths}` },
    { key: 'info', label: 'Info', render: v => v || '–' },
  ]

  const highColumns = [
    { key: 'valveId', label: 'Ventil' },
    { key: 'branch', label: 'Gren', render: v => v >= 0 ? v : '–' },
    { key: 'totalLevelErrors', label: 'Nivåfel', render: v => fmt(v) },
    { key: 'totalLongTime', label: 'Sen tömning', render: v => fmt(v) },
    { key: 'totalAuto', label: 'Auto-tömn.', render: v => fmt(v) },
    { key: 'reasons', label: 'Observation' },
  ]

  const lowColumns = [
    { key: 'valveId', label: 'Ventil' },
    { key: 'branch', label: 'Gren', render: v => v >= 0 ? v : '–' },
    { key: 'lowLevelScore', label: 'Max auto/mån', render: v => fmt(v) },
    { key: 'totalAuto', label: 'Auto totalt', render: v => fmt(v) },
    { key: 'reasons', label: 'Observation' },
  ]

  return (
    <SectionWrapper id="nivagivare" title="Nivågivare" icon={Gauge} info={SECTION_INFO.nivagivare}>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">
        Nivågivaren triggar automatisk tömning när lagringsenheten är full. En trasig givare kan
        antingen vara tyst (rapporterar aldrig full), fastna (samma värde varje månad), eller
        rapportera för höga/låga nivåer. Tabellerna nedan pekar ut ventiler vars givare bör
        kontrolleras vid nästa driftmöte.
      </p>

      <KpiGrid>
        <KpiCard
          label="Ventiler med givare"
          value={fmt(n.totalValves)}
          icon={Gauge}
          color="blue"
          info={KPI_INFO['Ventiler med givare']}
          compareValue={compareMode && cn ? fmt(cn.totalValves) : undefined}
        />
        <KpiCard
          label="Tysta givare"
          value={fmt(n.silentCount)}
          delta={null}
          icon={VolumeX}
          color="orange"
          info={KPI_INFO['Tysta givare']}
          compareValue={compareMode && cn ? fmt(cn.silentCount) : undefined}
        />
        <KpiCard
          label="Andel tysta"
          value={pct(n.silentPct)}
          icon={VolumeX}
          color="orange"
          info={KPI_INFO['Andel tysta givare']}
          compareValue={compareMode && cn ? pct(cn.silentPct) : undefined}
        />
        <KpiCard
          label="Misstänkta givare"
          value={fmt(n.suspectCount)}
          icon={AlertTriangle}
          color="red"
          info={KPI_INFO['Misstänkta givare']}
          compareValue={compareMode && cn ? fmt(cn.suspectCount) : undefined}
        />
        <KpiCard
          label="Totala nivåfel"
          value={fmt(n.totalLevelErrors)}
          icon={AlertTriangle}
          color="red"
          info={KPI_INFO['Totala nivåfel']}
          compareValue={compareMode && cn ? fmt(cn.totalLevelErrors) : undefined}
        />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 [&>:last-child:nth-child(odd)]:md:col-span-2">
        <ChartCard title="Nivåfel per månad" height={300} info={CHART_INFO['Nivåfel per månad']}>
          {levelErrorLine[0].data.length > 0 && (
            <ResponsiveLine
              data={levelErrorLine}
              theme={theme}
              colors={compareMode && levelErrorLine.length > 1
                ? ['#eab308', ...COMPARE_COLORS.slice(0, levelErrorLine.length - 1)]
                : ['#eab308']}
              margin={{ top: 10, right: compareMode && levelErrorLine.length > 1 ? 90 : 10, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={6}
              pointColor={{ theme: 'background' }}
              pointBorderWidth={2}
              pointBorderColor={{ from: 'serieColor' }}
              yScale={{ type: 'linear', min: 0, max: 'auto' }}
              useMesh
              enableSlices="x"
              legends={compareMode && levelErrorLine.length > 1 ? [{
                anchor: 'right', direction: 'column', translateX: 90,
                itemWidth: 80, itemHeight: 16, symbolSize: 10,
                itemTextColor: dark ? '#94a3b8' : '#64748b',
              }] : []}
            />
          )}
        </ChartCard>

        <ChartCard title="Tysta givare vs nivåfel per månad" height={300} info={CHART_INFO['Tysta givare vs nivåfel per månad']}>
          {silentBarData.length > 0 && (
            <ResponsiveBar
              data={silentBarData}
              keys={['Tysta', 'Nivåfel']}
              indexBy="month"
              theme={theme}
              groupMode="grouped"
              borderRadius={2}
              padding={0.3}
              margin={{ top: 10, right: 90, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              enableLabel={false}
              colors={['#f97316', '#eab308']}
              legends={[{
                dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 90,
                itemWidth: 70, itemHeight: 16, symbolSize: 10,
                itemTextColor: dark ? '#94a3b8' : '#64748b',
              }]}
            />
          )}
        </ChartCard>

        {branchBar.length > 0 && (
          <ChartCard
            title="Misstänkta givare per gren"
            height={Math.max(250, branchBar.length * 25)}
            info={CHART_INFO['Misstänkta givare per gren']}
          >
            <ResponsiveBar
              data={branchBar}
              keys={['Misstänkta']}
              indexBy="branch"
              layout="horizontal"
              theme={theme}
              borderRadius={3}
              padding={0.3}
              margin={{ top: 10, right: 30, bottom: 30, left: 80 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5 }}
              enableLabel={true}
              label={d => `${d.value}`}
              labelTextColor="#fff"
              colors={['#ef4444']}
            />
          </ChartCard>
        )}
      </div>

      {suspects.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              Misstänkta givare
              <InfoButton text={TABLE_INFO['Misstänkta givare']} size={14} />
            </h4>
            {!printMode && n.suspects.length > DEFAULT_LIMIT && (
              <button
                onClick={() => setShowAllSuspects(s => !s)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                {showAllSuspects
                  ? <><ChevronUp className="w-3 h-3" />Visa färre</>
                  : <><ChevronDown className="w-3 h-3" />Visa alla ({n.suspects.length})</>}
              </button>
            )}
          </div>
          <DataTable columns={suspectColumns} data={suspects} />
        </div>
      )}

      {silentSensors.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              Tysta givare (rapporterar aldrig full)
              <InfoButton text={TABLE_INFO['Tysta givare']} size={14} />
            </h4>
            {!printMode && n.silentSensors.length > DEFAULT_LIMIT && (
              <button
                onClick={() => setShowAllSilent(s => !s)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                {showAllSilent
                  ? <><ChevronUp className="w-3 h-3" />Visa färre</>
                  : <><ChevronDown className="w-3 h-3" />Visa alla ({n.silentSensors.length})</>}
              </button>
            )}
          </div>
          <DataTable columns={silentColumns} data={silentSensors} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {highSuspects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-red-500" />
                Höga nivåer
                <InfoButton text={TABLE_INFO['Höga nivåer']} size={14} />
              </h4>
              {!printMode && n.highLevelSuspects.length > DEFAULT_LIMIT && (
                <button
                  onClick={() => setShowAllHigh(s => !s)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {showAllHigh
                    ? <><ChevronUp className="w-3 h-3" />Färre</>
                    : <><ChevronDown className="w-3 h-3" />Alla ({n.highLevelSuspects.length})</>}
                </button>
              )}
            </div>
            <DataTable columns={highColumns} data={highSuspects} />
          </div>
        )}

        {lowSuspects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                Låga nivåer / falska triggers
                <InfoButton text={TABLE_INFO['Låga nivåer']} size={14} />
              </h4>
              {!printMode && n.lowLevelSuspects.length > DEFAULT_LIMIT && (
                <button
                  onClick={() => setShowAllLow(s => !s)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {showAllLow
                    ? <><ChevronUp className="w-3 h-3" />Färre</>
                    : <><ChevronDown className="w-3 h-3" />Alla ({n.lowLevelSuspects.length})</>}
                </button>
              )}
            </div>
            <DataTable columns={lowColumns} data={lowSuspects} />
          </div>
        )}
      </div>
    </SectionWrapper>
  )
}
