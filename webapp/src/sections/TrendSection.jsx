import { TrendingUp } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, fmt1, fmt2 } from '../utils/formatters'
import { SECTION_INFO, CHART_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveScatterPlot } from '@nivo/scatterplot'

export default function TrendSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const t = state.trendanalys

  if (!t) return <SectionWrapper id="trender" title="Trender" icon={TrendingUp} info={SECTION_INFO.trender}><EmptyState loading={state.isLoading} /></SectionWrapper>

  const fd = t.facilityData || []
  const ft = t.facilityTrends || {}

  // Energy + MA(3) + regression line
  const energyLine = [
    { id: 'Energi (kWh)', data: fd.map(d => ({ x: d.month, y: Math.round(d.energyKwh) })) },
    { id: 'MA(3)', data: fd.filter((d, i) => t.energyMA[i] != null).map((d, i) => ({ x: d.month, y: Math.round(t.energyMA[i]) })) },
    { id: 'Trend', data: fd.map(d => ({ x: d.month, y: Math.round(d.energyTrend) })) },
  ]

  // kWh per emptying + MA(3)
  const effLine = [
    { id: 'kWh/tömning', data: fd.map(d => ({ x: d.month, y: d.kwhPerEmptying })) },
    { id: 'MA(3)', data: fd.filter((d, i) => t.kwhPerEmptyMA[i] != null).map((d, i) => ({ x: d.month, y: t.kwhPerEmptyMA[i] })) },
  ]

  // Scatter: energy vs emptyings
  const scatterData = [{
    id: 'Månad',
    data: fd.map(d => ({ x: d.emptyings, y: d.energyKwh, label: d.month })),
  }]

  // Regression line for scatter
  const energyVsEmptyTrend = ft.energi
  const scatterRegLine = ({ xScale, yScale }) => {
    if (!ft.energi_vs_tömningar) return null
    // Simple line from min-x to max-x
    const xVals = fd.map(d => d.emptyings)
    const yVals = fd.map(d => d.energyKwh)
    const minX = Math.min(...xVals)
    const maxX = Math.max(...xVals)

    // Compute regression of energy on emptyings
    const n = xVals.length
    const sumX = xVals.reduce((s, v) => s + v, 0)
    const sumY = yVals.reduce((s, v) => s + v, 0)
    const sumXY = xVals.reduce((s, v, i) => s + v * yVals[i], 0)
    const sumX2 = xVals.reduce((s, v) => s + v * v, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const x1 = xScale(minX)
    const x2 = xScale(maxX)
    const y1 = yScale(intercept + slope * minX)
    const y2 = yScale(intercept + slope * maxX)

    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={2} strokeDasharray="6,4" />
  }

  // Correlation table
  const corrRows = t.correlations ? Object.entries(t.correlations).map(([pair, data]) => ({
    pair: pair.replace(/_/g, ' → '),
    pearsonR: data.r != null ? data.r.toFixed(3) : '–',
    pValue: data.p != null ? data.p < 0.001 ? '<0.001' : data.p.toFixed(3) : '–',
    interpretation: data.interpretation || '–',
  })) : []

  // Anomaly table
  const anomalyRows = (t.anomalies || []).map(a => ({
    target: a.target,
    label: a.label,
    value: typeof a.value === 'number' ? fmt1(a.value) : a.value,
    zScore: a.zScore.toFixed(1),
    type: a.type,
  }))

  return (
    <SectionWrapper id="trender" title="Trender" icon={TrendingUp} info={SECTION_INFO.trender}>
      <KpiGrid>
        <KpiCard label="Energitrend" value={<StatusBadge status={ft.energi?.trendClass === 'minskande' ? 'ok' : ft.energi?.trendClass === 'ökande' ? 'critical' : 'info'} label={ft.energi?.trendClass || '–'} />} icon={TrendingUp} color="yellow" />
        <KpiCard label="R²" value={ft.energi?.rSquared != null ? ft.energi.rSquared.toFixed(3) : '–'} icon={TrendingUp} color="blue" />
        <KpiCard label="Anomalier" value={fmt(t.anomalies?.length)} icon={TrendingUp} color="red" />
        <KpiCard label="Säsongsmönster" value={t.seasonalEnergy?.hasSeasonal ? 'Ja' : 'Nej'} icon={TrendingUp} color="emerald" />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <ChartCard title="Energi + MA(3) + trendlinje (kWh)" height={300} info={CHART_INFO['Energi + MA(3) + trendlinje (kWh)']}>
          {energyLine[0].data.length > 0 && (
            <ResponsiveLine
              data={energyLine}
              theme={theme}
              colors={['#eab308', '#f97316', '#94a3b8']}
              margin={{ top: 10, right: 100, bottom: 35, left: 60 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={5}
              enableArea={false}
              useMesh
              enableSlices="x"
              legends={[{ anchor: 'right', direction: 'column', translateX: 100, itemWidth: 90, itemHeight: 18, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
            />
          )}
        </ChartCard>

        <ChartCard title="kWh per tömning + MA(3)" height={300} info={CHART_INFO['kWh per tömning + MA(3)']}>
          {effLine[0].data.length > 0 && (
            <ResponsiveLine
              data={effLine}
              theme={theme}
              colors={['#10b981', '#f97316']}
              margin={{ top: 10, right: 90, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={5}
              useMesh
              enableSlices="x"
              legends={[{ anchor: 'right', direction: 'column', translateX: 90, itemWidth: 80, itemHeight: 18, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
            />
          )}
        </ChartCard>

        <ChartCard title="Energi vs tömningar (scatter)" height={300} info={CHART_INFO['Energi vs tömningar (scatter)']}>
          {scatterData[0].data.length > 0 && (
            <ResponsiveScatterPlot
              data={scatterData}
              theme={theme}
              colors={['#3b82f6']}
              margin={{ top: 10, right: 10, bottom: 40, left: 60 }}
              xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
              yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
              axisLeft={{ legend: 'Energi (kWh)', legendPosition: 'middle', legendOffset: -50, tickSize: 0, tickPadding: 5 }}
              axisBottom={{ legend: 'Tömningar', legendPosition: 'middle', legendOffset: 32, tickSize: 0, tickPadding: 5 }}
              nodeSize={10}
              layers={['grid', 'axes', scatterRegLine, 'nodes', 'markers', 'mesh', 'legends']}
            />
          )}
        </ChartCard>
      </div>

      {corrRows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Korrelationsanalys</h4>
          <DataTable
            columns={[
              { key: 'pair', label: 'Par' },
              { key: 'pearsonR', label: 'Pearson r' },
              { key: 'pValue', label: 'p-värde' },
              { key: 'interpretation', label: 'Tolkning' },
            ]}
            data={corrRows}
          />
        </div>
      )}

      {anomalyRows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Identifierade anomalier</h4>
          <DataTable
            columns={[
              { key: 'target', label: 'Datakälla' },
              { key: 'label', label: 'Etikett' },
              { key: 'value', label: 'Värde' },
              { key: 'zScore', label: 'z-score' },
              { key: 'type', label: 'Typ', render: v => <StatusBadge status={v === 'hög' ? 'critical' : 'warning'} label={v} /> },
            ]}
            data={anomalyRows}
          />
        </div>
      )}
    </SectionWrapper>
  )
}
