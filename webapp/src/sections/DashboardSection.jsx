import { LayoutDashboard, Zap, Gauge, AlertTriangle, GitBranch, Activity, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { useAnalysis } from '../hooks/useAnalysis'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, pct } from '../utils/formatters'
import { SECTION_INFO, CHART_INFO, KPI_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiCard from '../components/common/KpiCard'
import KpiGrid from '../components/common/KpiGrid'
import ChartCard from '../components/common/ChartCard'
import EmptyState from '../components/common/EmptyState'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'

export default function DashboardSection() {
  useAnalysis()
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)

  const { energiDrift, ventiler, larm, trendanalys } = state

  if (!energiDrift) return <SectionWrapper id="dashboard" title="Överblick" icon={LayoutDashboard} info={SECTION_INFO.dashboard}><EmptyState loading={state.isLoading} /></SectionWrapper>

  const totalKwh = energiDrift.totalEnergy
  const totalEmptyings = energiDrift.totalEmptyings
  const avgAvail = ventiler?.overallAvail
  const totalAlarms = larm?.totalAlarms
  const valveCount = ventiler?.uniqueValves
  const branchCount = trendanalys?.branchAnalysis?.length

  // Mini chart data
  const energyData = energiDrift.energy.map(e => ({ month: e.month, kWh: e.energyKwh }))
  const availPoints = ventiler?.monthlyAvailSummary?.map(m => ({ x: m.month, y: m.mean })) || []
  const availData = availPoints.length > 0 ? [{ id: 'Tillgänglighet', data: availPoints }] : []
  const alarmData = larm?.monthlyTotals?.map(m => ({ month: m.month, Larm: m.total })) || []

  return (
    <SectionWrapper id="dashboard" title="Överblick" icon={LayoutDashboard} info={SECTION_INFO.dashboard}>
      <KpiGrid>
        <KpiCard label="Total energi" value={`${fmt(totalKwh)} kWh`} icon={Zap} color="yellow" info={KPI_INFO['Total energi']} />
        <KpiCard label="Totala tömningar" value={fmt(totalEmptyings)} icon={Trash2} color="cyan" info={KPI_INFO['Totala tömningar']} />
        <KpiCard label="Medeltillgänglighet" value={pct(avgAvail)} icon={Gauge} color="blue" info={KPI_INFO['Medeltillgänglighet']} />
        <KpiCard label="Totala larm" value={fmt(totalAlarms)} icon={AlertTriangle} color="red" info={KPI_INFO['Totala larm']} />
        <KpiCard label="Ventiler" value={fmt(valveCount)} icon={Activity} color="emerald" info={KPI_INFO['Ventiler']} />
        <KpiCard label="Grenar" value={fmt(branchCount)} icon={GitBranch} color="orange" info={KPI_INFO['Grenar']} />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 [&>:last-child:nth-child(odd)]:md:col-span-2">
        <ChartCard title="Energi per månad" height={200} info={CHART_INFO['Energi per månad']}>
          <ResponsiveBar
            data={energyData}
            keys={['kWh']}
            indexBy="month"
            theme={theme}
            colors={['#eab308']}
            borderRadius={3}
            padding={0.3}
            margin={{ top: 10, right: 10, bottom: 30, left: 50 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
            enableGridY={true}
          />
        </ChartCard>

        <ChartCard title="Tillgänglighet per månad" height={200} info={CHART_INFO['Tillgänglighet per månad']}>
          {availData.length > 0 && (
            <ResponsiveLine
              data={availData}
              theme={theme}
              colors={['#22c55e']}
              margin={{ top: 10, right: 10, bottom: 30, left: 50 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={6}
              pointColor={{ theme: 'background' }}
              pointBorderWidth={2}
              pointBorderColor={{ from: 'serieColor' }}
              yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
              useMesh
              enableSlices="x"
            />
          )}
        </ChartCard>

        <ChartCard title="Larm per månad" height={200} info={CHART_INFO['Larm per månad']}>
          <ResponsiveBar
            data={alarmData}
            keys={['Larm']}
            indexBy="month"
            theme={theme}
            colors={['#ef4444']}
            borderRadius={3}
            padding={0.3}
            margin={{ top: 10, right: 10, bottom: 30, left: 50 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
          />
        </ChartCard>

        <ChartCard title="Tömningar per fraktion" height={200} info={CHART_INFO['Tömningar per fraktion']}>
          {energiDrift.fractionNames.length > 0 && (
            <ResponsiveBar
              data={energiDrift.monthlyFractions}
              keys={energiDrift.fractionNames}
              indexBy="month"
              theme={theme}
              groupMode="stacked"
              borderRadius={2}
              padding={0.3}
              margin={{ top: 10, right: 10, bottom: 30, left: 50 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              enableLabel={false}
              colors={{ scheme: 'set2' }}
            />
          )}
        </ChartCard>
      </div>
    </SectionWrapper>
  )
}
