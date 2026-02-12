import { TrendingUp, TrendingDown, Zap, AlertTriangle, Sun, Hand, Bot } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, fmt1, fmt2 } from '../utils/formatters'
import { SECTION_INFO, CHART_INFO, KPI_INFO, TABLE_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import InfoButton from '../components/common/InfoButton'
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveScatterPlot } from '@nivo/scatterplot'

export default function TrendSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const t = state.trendanalys
  const man = state.manuellAnalys

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

  // Manual percentage line
  const manualPctPoints = (man?.monthly || []).map(m => ({ x: m.month, y: m.manualPct }))
  const manualPctLine = [{ id: 'Manuell andel', data: manualPctPoints }]

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

  // KPI values
  const trendClass = ft.energi?.trendClass || '–'
  const rSquared = ft.energi?.rSquared != null ? ft.energi.rSquared.toFixed(3) : '–'
  const pearsonR = ft.energi?.pearsonR != null ? ft.energi.pearsonR.toFixed(3) : (corrRows[0]?.pearsonR || '–')
  const pValue = ft.energi?.pValue != null ? (ft.energi.pValue < 0.001 ? '<0.001' : ft.energi.pValue.toFixed(3)) : (corrRows[0]?.pValue || '–')
  const anomalyCount = t.anomalies?.length || 0
  const hasSeasonal = t.seasonalEnergy?.hasSeasonal

  return (
    <SectionWrapper id="trender" title="Trender" icon={TrendingUp} info={SECTION_INFO.trender}>
      {/* KPI cards - 4 on one row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Energitrend */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${trendClass === 'minskande' ? 'bg-emerald-100 dark:bg-emerald-900/50' : trendClass === 'ökande' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
              {trendClass === 'minskande' ? <TrendingDown className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> : trendClass === 'ökande' ? <TrendingUp className="w-6 h-6 text-red-600 dark:text-red-400" /> : <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Energitrend<InfoButton text={KPI_INFO['Energitrend']} size={13} /></p>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 capitalize">{trendClass}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">R² = {rSquared}</p>
        </div>

        {/* Korrelation */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/50">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Korrelation<InfoButton text={KPI_INFO['Korrelation (KPI)']} size={13} /></p>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">r = {pearsonR}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">p-värde: {pValue}</p>
        </div>

        {/* Anomalier */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${anomalyCount > 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-emerald-100 dark:bg-emerald-900/50'}`}>
              <AlertTriangle className={`w-6 h-6 ${anomalyCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Anomalier<InfoButton text={KPI_INFO['Anomalier (KPI)']} size={13} /></p>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{anomalyCount} st</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{anomalyCount === 0 ? 'Inga avvikelser' : 'Avvikande värden'}</p>
        </div>

        {/* Säsongsmönster */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${hasSeasonal ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-slate-100 dark:bg-slate-700/50'}`}>
              <Sun className={`w-6 h-6 ${hasSeasonal ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400'}`} />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">Säsong<InfoButton text={KPI_INFO['Säsong (KPI)']} size={13} /></p>
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{hasSeasonal ? 'Ja' : 'Nej'}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{hasSeasonal ? 'Säsongsmönster finns' : 'Jämn förbrukning'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 [&>:last-child:nth-child(odd)]:md:col-span-2">
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

        <ChartCard title="Manuell andel per månad (%)" height={300} info={CHART_INFO['Manuella vs automatiska körningar'] || 'Visar andelen manuella ventilkommandon i procent per månad. Hög andel manuella körningar kan indikera problem med automatiken.'}>
          {manualPctLine[0].data.length > 0 && (
            <ResponsiveLine
              data={manualPctLine}
              theme={theme}
              colors={['#a855f7']}
              margin={{ top: 10, right: 20, bottom: 35, left: 55 }}
              xScale={{ type: 'point' }}
              yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
              axisLeft={{ tickSize: 0, tickPadding: 5, format: v => `${v}%` }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={8}
              pointColor={{ theme: 'background' }}
              pointBorderWidth={2}
              pointBorderColor={{ from: 'serieColor' }}
              enableArea={false}
              useMesh
              enableSlices="x"
              sliceTooltip={({ slice }) => (
                <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded shadow-lg border border-slate-200 dark:border-slate-700">
                  <strong className="text-sm">{slice.points[0].data.x}</strong>
                  <div className="text-sm text-purple-600 dark:text-purple-400">
                    Manuell: {slice.points[0].data.y}%
                  </div>
                </div>
              )}
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
              tooltip={({ node }) => (
                <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 text-sm">
                  <strong>{node.data.label}</strong>
                  <div className="text-slate-600 dark:text-slate-300">Tömningar: {fmt(node.data.x)}</div>
                  <div className="text-slate-600 dark:text-slate-300">Energi: {fmt(node.data.y)} kWh</div>
                </div>
              )}
            />
          )}
        </ChartCard>
      </div>

      {corrRows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Korrelationsanalys<InfoButton text={TABLE_INFO['Korrelationsanalys']} size={14} /></h4>
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
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Identifierade anomalier<InfoButton text={TABLE_INFO['Identifierade anomalier']} size={14} /></h4>
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
