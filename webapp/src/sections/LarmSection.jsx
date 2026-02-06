import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt } from '../utils/formatters'
import { SECTION_INFO, CHART_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import EmptyState from '../components/common/EmptyState'
import StatusBadge from '../components/common/StatusBadge'
import SortToggle from '../components/common/SortToggle'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'

function applySortBar(data, valueKey, sortMode) {
  if (sortMode === 'default') return data
  const sorted = [...data]
  sorted.sort((a, b) => sortMode === 'asc' ? a[valueKey] - b[valueKey] : b[valueKey] - a[valueKey])
  return sorted
}

export default function LarmSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const l = state.larm
  const trend = state.trendanalys

  const [catSort, setCatSort] = useState('default')

  if (!l) return <SectionWrapper id="larm" title="Larm" icon={AlertTriangle} info={SECTION_INFO.larm}><EmptyState loading={state.isLoading} /></SectionWrapper>

  // Alarm bar data
  const alarmBarData = l.monthlyTotals.map(m => ({
    month: m.month,
    Larm: m.total,
  }))

  // MA(3) overlay line + anomaly markers
  const alarmMA = trend?.alarmMA || []
  const alarmLine = [{
    id: 'MA(3)',
    data: l.monthlyTotals.map((m, i) => ({
      x: m.month,
      y: alarmMA[i] != null ? Math.round(alarmMA[i]) : null,
    })).filter(d => d.y != null),
  }]

  // Trend line
  const trendLine = trend?.facilityTrends?.larm
  const trendLineData = trendLine ? [{
    id: 'Trend',
    data: l.monthlyTotals.map((m, i) => ({
      x: m.month,
      y: Math.round(trendLine.intercept + trendLine.slope * (i + 1)),
    })),
  }] : []

  // Anomalies
  const alarmAnomalies = trend?.anomalies?.filter(a => a.target === 'larm_månad') || []

  // Year comparison: current vs previous — dynamic year label
  const years = [...new Set(l.monthlyTotals.map(m => Math.floor(m.sortKey / 100)))]
  const currentLabel = years.length === 1 ? String(years[0]) : 'Aktuell period'
  const compData = l.monthlyTotals.map(m => ({
    month: m.month,
    [currentLabel]: m.total,
    'Föregående år': l.prevMonthly[m.sortKey] != null ? Math.round(l.prevMonthly[m.sortKey]) : 0,
  }))

  // Category totals bar
  const catDataRaw = Object.entries(l.categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, total]) => ({ category: cat, Antal: total }))
  const catData = applySortBar(catDataRaw, 'Antal', catSort)

  return (
    <SectionWrapper id="larm" title="Larm" icon={AlertTriangle} info={SECTION_INFO.larm}>
      <KpiGrid>
        <KpiCard label="Totala larm" value={fmt(l.totalAlarms)} icon={AlertTriangle} color="red" />
        <KpiCard label="H1 medel/mån" value={fmt(l.h1Avg)} icon={AlertTriangle} color="orange" />
        <KpiCard label="H2 medel/mån" value={fmt(l.h2Avg)} icon={AlertTriangle} color="yellow" />
        <KpiCard label="Trend" value={<StatusBadge status={l.trend === 'ökande' ? 'critical' : l.trend === 'minskande' ? 'ok' : 'info'} label={l.trend} />} icon={AlertTriangle} color="blue" />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <ChartCard title="Larm per månad" height={300}>
          <ResponsiveBar
            data={alarmBarData}
            keys={['Larm']}
            indexBy="month"
            theme={theme}
            colors={['#ef4444']}
            borderRadius={3}
            padding={0.3}
            margin={{ top: 10, right: 10, bottom: 35, left: 55 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
          />
        </ChartCard>

        <ChartCard title="MA(3) + trendlinje" height={300} info={CHART_INFO['MA(3) + trendlinje']}>
          {(alarmLine[0].data.length > 0 || trendLineData.length > 0) && (
            <ResponsiveLine
              data={[...alarmLine, ...trendLineData]}
              theme={theme}
              colors={['#f97316', '#94a3b8']}
              margin={{ top: 10, right: 90, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={5}
              enablePointLabel={false}
              useMesh
              enableSlices="x"
              legends={[{ anchor: 'right', direction: 'column', translateX: 90, itemWidth: 80, itemHeight: 18, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
            />
          )}
        </ChartCard>

        <ChartCard title={`${currentLabel} vs föregående år`} height={300} info={CHART_INFO['Aktuell period vs föregående år']}>
          <ResponsiveBar
            data={compData}
            keys={[currentLabel, 'Föregående år']}
            indexBy="month"
            theme={theme}
            groupMode="grouped"
            borderRadius={3}
            padding={0.3}
            margin={{ top: 10, right: 100, bottom: 35, left: 55 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
            colors={['#ef4444', '#94a3b8']}
            legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 100, itemWidth: 90, itemHeight: 18, symbolSize: 12, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
          />
        </ChartCard>

        {catData.length > 0 && (
          <ChartCard
            title="Larm per kategori (årstotal)"
            height={Math.max(250, catData.length * 30)}
            controls={<SortToggle sortMode={catSort} onChange={setCatSort} />}
          >
            <ResponsiveBar
              data={catData}
              keys={['Antal']}
              indexBy="category"
              layout="horizontal"
              theme={theme}
              colors={['#ef4444']}
              borderRadius={3}
              padding={0.3}
              margin={{ top: 10, right: 30, bottom: 30, left: 200 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5 }}
              enableLabel={true}
              labelTextColor="#fff"
            />
          </ChartCard>
        )}
      </div>

      {alarmAnomalies.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Larmanomalier</h4>
          <div className="space-y-2">
            {alarmAnomalies.map((a, i) => (
              <div key={i} className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">
                <StatusBadge status="critical" label={`z=${a.zScore.toFixed(1)}`} />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {a.label}: {Math.round(a.value)} larm ({a.type})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionWrapper>
  )
}
