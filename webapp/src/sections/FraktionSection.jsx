import { Layers } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { SECTION_INFO, CHART_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import ChartCard from '../components/common/ChartCard'
import EmptyState from '../components/common/EmptyState'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveHeatMap } from '@nivo/heatmap'

export default function FraktionSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const fa = state.fraktionAnalys

  if (!fa) return <SectionWrapper id="fraktioner" title="Fraktioner" icon={Layers} info={SECTION_INFO.fraktioner}><EmptyState loading={state.isLoading} /></SectionWrapper>

  // Area-like data: stacked bar per fraction per month — use sortKey for multi-year
  const sortedMonths = [...new Map(fa.rows.map(r => [r.sortKey, r.month])).entries()].sort((a, b) => a[0] - b[0])
  const stackedData = sortedMonths.map(([sk, label]) => {
    const obj = { month: label }
    for (const frac of fa.fractions) {
      const row = fa.rows.find(r => r.sortKey === sk && r.fraction === frac)
      obj[frac] = row?.emptyings || 0
    }
    return obj
  })

  // Throughput line data
  const throughputLines = fa.fractions
    .filter(f => fa.throughput[f])
    .map(frac => ({
      id: frac,
      data: fa.rows.filter(r => r.fraction === frac && r.emptyingPerMinute != null)
        .sort((a, b) => a.sortKey - b.sortKey)
        .map(r => ({ x: r.month, y: r.emptyingPerMinute })),
    }))
    .filter(line => line.data.length > 0)

  // kWh per emptying line data
  const effLines = fa.fractions.map(frac => ({
    id: frac,
    data: fa.rows.filter(r => r.fraction === frac && r.kWhPerEmptying != null)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(r => ({ x: r.month, y: r.kWhPerEmptying })),
  })).filter(line => line.data.length > 0)

  // Heatmap: fraction x month — use sortKey for unique months
  const heatmapData = fa.fractions.map(frac => ({
    id: frac,
    data: sortedMonths.map(([sk, label]) => {
      const row = fa.rows.find(r => r.sortKey === sk && r.fraction === frac)
      return { x: label, y: row?.emptyings || 0 }
    }),
  }))

  // Season grouped bar
  const seasonData = fa.fractions.map(f => ({
    fraction: f,
    Sommar: fa.seasonal[f]?.summerAvg || 0,
    Vinter: fa.seasonal[f]?.winterAvg || 0,
  }))

  return (
    <SectionWrapper id="fraktioner" title="Fraktioner" icon={Layers} info={SECTION_INFO.fraktioner}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Tömningar per fraktion (stacked)" height={300} info={CHART_INFO['Tömningar per fraktion (stacked)']}>
          <ResponsiveBar
            data={stackedData}
            keys={fa.fractions}
            indexBy="month"
            theme={theme}
            groupMode="stacked"
            borderRadius={2}
            padding={0.3}
            margin={{ top: 10, right: 90, bottom: 35, left: 55 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
            colors={{ scheme: 'set2' }}
            legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 90, itemWidth: 80, itemHeight: 16, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
          />
        </ChartCard>

        <ChartCard title="Genomströmning (tömning/minut)" height={300} info={CHART_INFO['Genomströmning (tömning/minut)']}>
          {throughputLines.length > 0 && (
            <ResponsiveLine
              data={throughputLines}
              theme={theme}
              margin={{ top: 10, right: 90, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={5}
              colors={{ scheme: 'set2' }}
              useMesh
              enableSlices="x"
              legends={[{ anchor: 'right', direction: 'column', translateX: 90, itemWidth: 80, itemHeight: 16, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
            />
          )}
        </ChartCard>

        <ChartCard title="Energieffektivitet per fraktion (kWh/tömning)" height={300} info={CHART_INFO['Energieffektivitet per fraktion (kWh/tömning)']}>
          {effLines.length > 0 && (
            <ResponsiveLine
              data={effLines}
              theme={theme}
              margin={{ top: 10, right: 90, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={5}
              colors={{ scheme: 'set2' }}
              useMesh
              enableSlices="x"
              legends={[{ anchor: 'right', direction: 'column', translateX: 90, itemWidth: 80, itemHeight: 16, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
            />
          )}
        </ChartCard>

        <ChartCard title="Tömnings-heatmap (fraktion × månad)" height={300} info={CHART_INFO['Tömnings-heatmap (fraktion × månad)']}>
          {heatmapData.length > 0 && (
            <ResponsiveHeatMap
              data={heatmapData}
              theme={theme}
              margin={{ top: 10, right: 60, bottom: 30, left: 80 }}
              axisTop={null}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              colors={{ type: 'sequential', scheme: 'yellow_orange_red' }}
              emptyColor="#f1f5f9"
              borderWidth={1}
              borderColor={dark ? '#334155' : '#e2e8f0'}
              labelTextColor={dark ? '#e2e8f0' : '#1e293b'}
            />
          )}
        </ChartCard>

        <ChartCard title="Sommar vs vinter per fraktion" height={300} info={CHART_INFO['Sommar vs vinter per fraktion']}>
          <ResponsiveBar
            data={seasonData}
            keys={['Sommar', 'Vinter']}
            indexBy="fraction"
            theme={theme}
            groupMode="grouped"
            borderRadius={3}
            padding={0.3}
            margin={{ top: 10, right: 80, bottom: 35, left: 55 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
            colors={['#f97316', '#3b82f6']}
            legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 80, itemWidth: 70, itemHeight: 18, symbolSize: 12, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
          />
        </ChartCard>
      </div>
    </SectionWrapper>
  )
}
