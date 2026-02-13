import { useState, useCallback } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, fmt1, pct } from '../utils/formatters'
import { ERROR_COLORS, ERROR_NAMES_SV } from '../utils/colors'
import { SECTION_INFO, CHART_INFO, KPI_INFO, TABLE_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import EmptyState from '../components/common/EmptyState'
import InfoButton from '../components/common/InfoButton'
import StatusBadge from '../components/common/StatusBadge'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'

const DEFAULT_CHART_LIMIT = 10
const DEFAULT_TABLE_LIMIT = 10

export default function VentilerSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const v = state.ventiler

  const printMode = state.printMode
  const [showAllChart, setShowAllChart] = useState(false)
  const [showAllTable, setShowAllTable] = useState(false)
  const [hiddenSeries, setHiddenSeries] = useState(new Set())

  const toggleSeries = useCallback((id) => {
    setHiddenSeries(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  if (!v) return <SectionWrapper id="ventiler" title="Ventilhälsa" icon={Activity} info={SECTION_INFO.ventiler}><EmptyState loading={state.isLoading} /></SectionWrapper>

  const allWorst = v.worstValves || []
  const chartLimit = showAllChart ? allWorst.length : DEFAULT_CHART_LIMIT
  const chartData = allWorst.slice(0, chartLimit)
  const tableLimit = showAllTable ? allWorst.length : DEFAULT_TABLE_LIMIT
  const tableData = allWorst.slice(0, tableLimit)

  // Availability line with min/max band
  const availPoints = v.monthlyAvailSummary.map(m => ({ x: m.month, y: m.mean }))
  const availLine = [{ id: 'Medel', data: availPoints }]
  const availMin = availPoints.length > 0 ? Math.min(...availPoints.map(d => d.y)) : 0

  const minMaxLayer = ({ xScale, yScale }) => {
    if (!v.monthlyAvailSummary.length) return null
    const points = v.monthlyAvailSummary.map(m => {
      const x = xScale(m.month)
      return x != null ? { x, yMin: yScale(m.min), yMax: yScale(m.max) } : null
    }).filter(Boolean)
    if (points.length < 2) return null

    let d = `M${points[0].x},${points[0].yMin}`
    for (let i = 1; i < points.length; i++) d += ` L${points[i].x},${points[i].yMin}`
    for (let i = points.length - 1; i >= 0; i--) d += ` L${points[i].x},${points[i].yMax}`
    d += ' Z'

    return <path d={d} fill={dark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'} />
  }

  // Error types stacked bar - translate to Swedish
  const errorKeys = v.errorNames
  const errorKeysSv = errorKeys.map(k => ERROR_NAMES_SV[k] || k)
  const errorBarData = v.monthlyErrors.map(m => {
    const obj = { month: m.month }
    for (let i = 0; i < errorKeys.length; i++) {
      obj[errorKeysSv[i]] = m[errorKeys[i]] || 0
    }
    return obj
  })
  const errorColors = errorKeys.map(k => ERROR_COLORS[k] || '#94a3b8')

  // Worst valves spaghetti lines - sort by sortKey for correct chronological order
  // Build month lookup from sorted data
  const sortedMonths = [...new Set(v.availability.map(a => a.sortKey))]
    .sort((a, b) => a - b)
    .map(sk => {
      const item = v.availability.find(a => a.sortKey === sk)
      return { sortKey: sk, month: item?.month || '' }
    })
  const monthLookup = Object.fromEntries(sortedMonths.map(m => [m.sortKey, m.month]))

  const worstLines = chartData.map(w => ({
    id: w.valveId,
    data: v.availability
      .filter(a => a.valveId === w.valveId)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(a => ({ x: a.sortKey, y: a.availability, month: a.month })),
  })).filter(l => l.data.length > 0)

  // Availability histogram (bucket per 1%)
  const buckets = {}
  for (const vs of v.valveSummary) {
    const b = Math.floor(vs.avgAvailability)
    buckets[b] = (buckets[b] || 0) + 1
  }
  const histData = Object.entries(buckets)
    .map(([b, count]) => ({ bucket: `${b}%`, count }))
    .sort((a, b) => parseInt(a.bucket) - parseInt(b.bucket))

  const chartTitle = showAllChart
    ? `${chartData.length} sämsta ventilerna (tillgänglighet)`
    : `${DEFAULT_CHART_LIMIT} sämsta ventilerna (tillgänglighet)`

  return (
    <SectionWrapper id="ventiler" title="Ventilhälsa" icon={Activity} info={SECTION_INFO.ventiler}>
      <KpiGrid>
        <KpiCard label="Ventiler" value={fmt(v.uniqueValves)} icon={Activity} color="blue" info={KPI_INFO['Ventiler']} />
        <KpiCard label="Medeltillgänglighet" value={pct(v.overallAvail)} icon={Activity} color="emerald" info={KPI_INFO['Medeltillgänglighet']} />
        <KpiCard label="Totala fel" value={fmt(v.totalErrors)} icon={Activity} color="red" info={KPI_INFO['Totala fel']} />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 [&>:last-child:nth-child(odd)]:md:col-span-2">
        <ChartCard title="Tillgänglighet per månad (medel/min/max)" height={300} info={CHART_INFO['Tillgänglighet per månad (medel/min/max)']}>
          <ResponsiveLine
            data={availLine}
            theme={theme}
            colors={['#3b82f6']}
            margin={{ top: 10, right: 10, bottom: 35, left: 55 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            pointSize={6}
            pointColor={{ theme: 'background' }}
            pointBorderWidth={2}
            pointBorderColor={{ from: 'serieColor' }}
            yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
            useMesh
            enableSlices="x"
            layers={['grid', 'markers', 'axes', minMaxLayer, 'areas', 'lines', 'points', 'slices', 'mesh', 'legends']}
          />
        </ChartCard>

        <ChartCard title="Feltyper per månad (stacked)" height={300} info={CHART_INFO['Feltyper per månad (stacked)']}>
          <ResponsiveBar
            data={errorBarData}
            keys={errorKeysSv}
            indexBy="month"
            theme={theme}
            groupMode="stacked"
            borderRadius={2}
            padding={0.3}
            margin={{ top: 10, right: 90, bottom: 35, left: 55 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
            colors={errorColors}
            legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 90, itemWidth: 80, itemHeight: 14, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
          />
        </ChartCard>

        <ChartCard
          title={chartTitle}
          height={300}
          info={CHART_INFO['10 sämsta ventilerna (tillgänglighet)']}
          controls={!printMode && allWorst.length > DEFAULT_CHART_LIMIT && (
            <button
              onClick={() => setShowAllChart(s => !s)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors"
            >
              {showAllChart ? <><ChevronUp className="w-3 h-3" />Visa {DEFAULT_CHART_LIMIT}</> : <><ChevronDown className="w-3 h-3" />Visa alla ({allWorst.length})</>}
            </button>
          )}
        >
          {worstLines.length > 0 && (() => {
            // Generate colors for all lines using category10 scheme
            const category10 = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
            const lineColors = worstLines.map((_, i) => category10[i % category10.length])
            const visibleLines = worstLines.filter(line => !hiddenSeries.has(line.id))

            return (
              <ResponsiveLine
                data={visibleLines}
                theme={theme}
                margin={{ top: 10, right: 90, bottom: 35, left: 55 }}
                xScale={{ type: 'point' }}
                axisLeft={{ tickSize: 0, tickPadding: 5 }}
                axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45, format: x => monthLookup[x] || x }}
                pointSize={4}
                colors={visibleLines.map(line => {
                  const origIndex = worstLines.findIndex(l => l.id === line.id)
                  return lineColors[origIndex]
                })}
                yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                useMesh
                enableSlices="x"
                legends={[{
                  anchor: 'right',
                  direction: 'column',
                  translateX: 90,
                  itemWidth: 80,
                  itemHeight: 14,
                  symbolSize: 10,
                  onClick: (datum) => toggleSeries(datum.id),
                  effects: [{ on: 'hover', style: { itemOpacity: 1 } }],
                  data: worstLines.map((line, i) => ({
                    id: line.id,
                    label: line.id,
                    color: hiddenSeries.has(line.id) ? '#cbd5e1' : lineColors[i],
                  })),
                  itemOpacity: 0.85,
                  itemTextColor: dark ? '#94a3b8' : '#64748b',
                }]}
              />
            )
          })()}
        </ChartCard>

        <ChartCard title="Tillgänglighetsfördelning (histogram)" height={300} info={CHART_INFO['Tillgänglighetsfördelning (histogram)']}>
          <ResponsiveBar
            data={histData}
            keys={['count']}
            indexBy="bucket"
            theme={theme}
            colors={['#3b82f6']}
            borderRadius={3}
            padding={0.2}
            margin={{ top: 10, right: 10, bottom: 35, left: 50 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
          />
        </ChartCard>
      </div>

      {tableData.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">Sämsta ventilerna<InfoButton text={TABLE_INFO['Sämsta ventilerna']} size={14} /></h4>
            {!printMode && allWorst.length > DEFAULT_TABLE_LIMIT && (
              <button
                onClick={() => setShowAllTable(s => !s)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                {showAllTable ? <><ChevronUp className="w-3 h-3" />Visa färre</> : <><ChevronDown className="w-3 h-3" />Visa alla ({allWorst.length})</>}
              </button>
            )}
          </div>
          <DataTable
            columns={[
              { key: 'valveId', label: 'Ventil' },
              { key: 'avgAvailability', label: 'Tillgänglighet', render: v => (
                <span className="flex items-center gap-2">
                  {pct(v)}
                  <StatusBadge status={v < 95 ? 'critical' : v < 99 ? 'warning' : 'ok'} label={v < 95 ? 'Kritisk' : v < 99 ? 'Varning' : 'OK'} />
                </span>
              )},
              { key: 'totalErrors', label: 'Totala fel', render: v => fmt(v) },
            ]}
            data={tableData}
          />
        </div>
      )}
    </SectionWrapper>
  )
}
