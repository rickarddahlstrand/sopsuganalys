import { AlertTriangle, Bell, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt } from '../utils/formatters'
import { SECTION_INFO, CHART_INFO, KPI_INFO, TABLE_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import EmptyState from '../components/common/EmptyState'
import InfoButton from '../components/common/InfoButton'
import StatusBadge from '../components/common/StatusBadge'
import { createTrendLineLayer } from '../components/charts/TrendLine'
import { COMPARE_COLORS } from './CompareSection'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'

const alarmTrendLine = createTrendLineLayer('Larm', '#b91c1c')

export default function LarmSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const l = state.larm
  const trend = state.trendanalys
  const { compareMode, compareData, compareName, compareFacilities } = state
  const cl = compareData?.larm

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

  // Category per month stacked bar
  const monthlyCatData = l.monthlyTotals.map(m => ({
    month: m.month,
    ...m.categories,
  }))

  // Stoppkategorier per månad (summa av alla stop-kategorier)
  const stopMonthly = l.stopCategoriesMonthly || []
  const hasCompareStop = compareMode && compareFacilities?.some(cf => cf.data?.larm?.stopCategoriesMonthly)
  const localFacilityName = state.facilityName || 'Lokal'
  const stopBarData = hasCompareStop
    ? stopMonthly.map(m => {
        const row = { month: m.month, [localFacilityName]: m.stopTotal }
        for (const cf of compareFacilities) {
          const cfm = cf.data?.larm?.stopCategoriesMonthly
          if (cfm) {
            const match = cfm.find(x => x.month === m.month)
            if (match) row[cf.name || 'Jämförelse'] = match.stopTotal
          }
        }
        return row
      })
    : stopMonthly.map(m => ({ month: m.month, Stoppar: m.stopTotal }))
  const stopBarKeys = hasCompareStop
    ? [localFacilityName, ...compareFacilities.filter(cf => cf.data?.larm?.stopCategoriesMonthly).map(cf => cf.name || 'Jämförelse')]
    : ['Stoppar']

  // Per-kategori grid — data och jämförelse
  const categoryList = l.categories || []
  const buildCategoryData = (cat) => {
    if (!hasCompareStop) {
      return l.monthlyTotals.map(m => ({ month: m.month, Antal: m.categories[cat] || 0 }))
    }
    return l.monthlyTotals.map(m => {
      const row = { month: m.month, [localFacilityName]: m.categories[cat] || 0 }
      for (const cf of compareFacilities) {
        const cfLarm = cf.data?.larm
        if (cfLarm?.monthlyTotals) {
          const match = cfLarm.monthlyTotals.find(x => x.month === m.month)
          if (match) row[cf.name || 'Jämförelse'] = match.categories?.[cat] || 0
        }
      }
      return row
    })
  }
  const categoryBarKeys = hasCompareStop
    ? [localFacilityName, ...compareFacilities.filter(cf => cf.data?.larm?.monthlyTotals).map(cf => cf.name || 'Jämförelse')]
    : ['Antal']

  return (
    <SectionWrapper id="larm" title="Larm" icon={AlertTriangle} info={SECTION_INFO.larm}>
      <KpiGrid>
        <KpiCard label="Totala larm" value={fmt(l.totalAlarms)} icon={Bell} color="red" info={KPI_INFO['Totala larm']} compareValue={compareMode && cl ? fmt(cl.totalAlarms) : undefined} />
        <KpiCard label="H1 medel/mån" value={fmt(l.h1Avg)} icon={Calendar} color="orange" info={KPI_INFO['H1 medel/mån']} compareValue={compareMode && cl ? fmt(cl.h1Avg) : undefined} />
        <KpiCard label="H2 medel/mån" value={fmt(l.h2Avg)} icon={Calendar} color="yellow" info={KPI_INFO['H2 medel/mån']} compareValue={compareMode && cl ? fmt(cl.h2Avg) : undefined} />
        <KpiCard label="Trend" value={<StatusBadge status={l.trend === 'ökande' ? 'critical' : l.trend === 'minskande' ? 'ok' : 'info'} label={l.trend} />} icon={l.trend === 'ökande' ? TrendingUp : l.trend === 'minskande' ? TrendingDown : Minus} color="blue" info={KPI_INFO['Larmtrend']} />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 [&>:last-child:nth-child(odd)]:md:col-span-2">
        <ChartCard title="Larm per månad" height={300} info={CHART_INFO['Larm per månad']}>
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
            layers={['grid', 'axes', 'bars', alarmTrendLine, 'markers', 'legends', 'annotations']}
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
            margin={{ top: 10, right: 170, bottom: 35, left: 55 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
            colors={['#ef4444', '#94a3b8']}
            legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 165, itemWidth: 160, itemHeight: 18, symbolSize: 12, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
          />
        </ChartCard>

        {l.categories.length > 0 && (
          <ChartCard
            title="Larm per kategori (per månad)"
            height={300}
            info={CHART_INFO['Larm per kategori (per månad)']}
          >
            <ResponsiveBar
              data={monthlyCatData}
              keys={l.categories}
              indexBy="month"
              groupMode="stacked"
              theme={theme}
              borderRadius={2}
              padding={0.3}
              margin={{ top: 10, right: 120, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              enableLabel={false}
              colors={{ scheme: 'set2' }}
              legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 120, itemWidth: 110, itemHeight: 16, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
            />
          </ChartCard>
        )}

        {stopMonthly.length > 0 && (
          <ChartCard
            title="Stoppkategorier per månad"
            height={300}
            info={CHART_INFO['Stoppkategorier per månad']}
          >
            <ResponsiveBar
              data={stopBarData}
              keys={stopBarKeys}
              indexBy="month"
              theme={theme}
              colors={hasCompareStop ? ['#b91c1c', ...COMPARE_COLORS.slice(0, stopBarKeys.length - 1)] : ['#b91c1c']}
              groupMode={hasCompareStop ? 'grouped' : 'stacked'}
              borderRadius={3}
              padding={0.3}
              margin={{ top: 10, right: hasCompareStop ? 120 : 10, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              enableLabel={false}
              legends={hasCompareStop ? [{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 120, itemWidth: 110, itemHeight: 16, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }] : []}
            />
          </ChartCard>
        )}
      </div>

      {categoryList.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            Larm per enskild kategori
            <InfoButton text={CHART_INFO['Larm per enskild kategori']} size={14} />
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryList.map((cat, idx) => {
              const catData = buildCategoryData(cat)
              const baseColor = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#14b8a6', '#ec4899'][idx % 6]
              return (
                <ChartCard
                  key={cat}
                  title={cat}
                  height={220}
                  info={CHART_INFO['Larm per enskild kategori']}
                >
                  <ResponsiveBar
                    data={catData}
                    keys={categoryBarKeys}
                    indexBy="month"
                    theme={theme}
                    colors={hasCompareStop ? [baseColor, ...COMPARE_COLORS.slice(0, categoryBarKeys.length - 1)] : [baseColor]}
                    groupMode={hasCompareStop ? 'grouped' : 'stacked'}
                    borderRadius={2}
                    padding={0.25}
                    margin={{ top: 8, right: 8, bottom: 30, left: 40 }}
                    axisLeft={{ tickSize: 0, tickPadding: 4, tickValues: 4 }}
                    axisBottom={{ tickSize: 0, tickPadding: 4, tickRotation: -45 }}
                    enableLabel={false}
                    enableGridY={true}
                  />
                </ChartCard>
              )
            })}
          </div>
        </div>
      )}

      {alarmAnomalies.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Larmanomalier<InfoButton text={TABLE_INFO['Larmanomalier']} size={14} /></h4>
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
