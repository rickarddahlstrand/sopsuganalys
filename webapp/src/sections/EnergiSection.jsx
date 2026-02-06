import { Zap } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, fmt1 } from '../utils/formatters'
import { SECTION_INFO, CHART_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import EmptyState from '../components/common/EmptyState'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'

export default function EnergiSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const ed = state.energiDrift

  if (!ed) return <SectionWrapper id="energi" title="Energi & Drift" icon={Zap} info={SECTION_INFO.energi}><EmptyState loading={state.isLoading} /></SectionWrapper>

  const driftData = [{
    id: 'Drifttid',
    data: ed.energy.map(e => ({ x: e.month, y: e.operationTimeH })),
  }]

  return (
    <SectionWrapper id="energi" title="Energi & Drift" icon={Zap} info={SECTION_INFO.energi}>
      <KpiGrid>
        <KpiCard label="Total energi" value={`${fmt(ed.totalEnergy)} kWh`} icon={Zap} color="yellow" />
        <KpiCard label="Total drifttid" value={`${fmt(ed.totalTime)} h`} icon={Zap} color="orange" />
        <KpiCard label="Totala tömningar" value={fmt(ed.totalEmptyings)} icon={Zap} color="cyan" />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <ChartCard title="Energiförbrukning per månad (kWh)" info={CHART_INFO['Energiförbrukning per månad (kWh)']}>
          <ResponsiveBar
            data={ed.energy.map(e => ({ month: e.month, kWh: e.energyKwh }))}
            keys={['kWh']}
            indexBy="month"
            theme={theme}
            colors={['#eab308']}
            borderRadius={4}
            padding={0.3}
            margin={{ top: 10, right: 10, bottom: 30, left: 60 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
          />
        </ChartCard>

        <ChartCard title="Tömningar per fraktion (stacked)" info={CHART_INFO['Tömningar per fraktion (stacked)']}>
          <ResponsiveBar
            data={ed.monthlyFractions}
            keys={ed.fractionNames}
            indexBy="month"
            theme={theme}
            groupMode="stacked"
            borderRadius={2}
            padding={0.3}
            margin={{ top: 10, right: 80, bottom: 30, left: 60 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
            colors={{ scheme: 'set2' }}
            legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 80, itemWidth: 70, itemHeight: 16, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
          />
        </ChartCard>

        <ChartCard title="Drifttid per månad (h)" info={CHART_INFO['Drifttid per månad (h)']}>
          <ResponsiveLine
            data={driftData}
            theme={theme}
            colors={['#f97316']}
            margin={{ top: 10, right: 10, bottom: 30, left: 60 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            pointSize={8}
            pointColor={{ theme: 'background' }}
            pointBorderWidth={2}
            pointBorderColor={{ from: 'serieColor' }}
            enableArea
            areaOpacity={0.1}
            useMesh
            enableSlices="x"
          />
        </ChartCard>
      </div>

      {ed.machineAvg.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Maskinstatistik (årssnitt)</h4>
          <DataTable
            columns={[
              { key: 'name', label: 'Maskin' },
              { key: 'avgStarts', label: 'Starter/mån', render: v => fmt(v) },
              { key: 'avgHours', label: 'Timmar/mån', render: v => fmt1(v) },
              { key: 'avgKwh', label: 'kWh/mån', render: v => fmt(v) },
            ]}
            data={ed.machineAvg}
          />
        </div>
      )}
    </SectionWrapper>
  )
}
