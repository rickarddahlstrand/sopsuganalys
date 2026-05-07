import { useMemo, useState } from 'react'
import { Hand, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, fmt1, fmt2, pct } from '../utils/formatters'
import { manualColor } from '../utils/colors'
import { SECTION_INFO, CHART_INFO, KPI_INFO, TABLE_INFO } from '../utils/descriptions'
import { fractionLabelSv } from '../utils/valveFraction'
import { analyzeManuellWindow } from '../analysis/manuellAnalys'
import { DEFAULT_RECENT_WINDOW } from '../utils/recentSlice'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import EmptyState from '../components/common/EmptyState'
import InfoButton from '../components/common/InfoButton'
import SortToggle from '../components/common/SortToggle'
import StatusBadge from '../components/common/StatusBadge'
import WindowPicker from '../components/common/WindowPicker'
import { createTrendLineLayer } from '../components/charts/TrendLine'
import { COMPARE_COLORS } from './CompareSection'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'

const manualTrendLine = createTrendLineLayer('Manuella', '#7c3aed')

// Färger för fraktioner (nivo set2 palette för konsekvens med FraktionSection)
const FRACTION_COLORS = ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494']

function applySortBar(data, valueKey, sortMode) {
  if (sortMode === 'default') {
    // För horisontell bar i nivo renderas index 0 längst ned. Vänd ordningen
    // så att högsta värdet visas högst upp (matchar "Topp"-rubriken).
    return [...data].reverse()
  }
  const sorted = [...data]
  sorted.sort((a, b) => sortMode === 'asc' ? a[valueKey] - b[valueKey] : b[valueKey] - a[valueKey])
  return sorted
}

export default function ManuellSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const man = state.manuellAnalys
  const { compareMode, compareData, compareName, compareFacilities } = state
  const cman = compareData?.manuellAnalys

  const [top15Sort, setTop15Sort] = useState('default')
  const [branchSort, setBranchSort] = useState('default')
  const printMode = state.printMode
  const [showAllValves, setShowAllValves] = useState(false)
  const [showAllBranches, setShowAllBranches] = useState(false)
  const [showAllTable, setShowAllTable] = useState(false)

  const totalMonths = state.parsedFiles?.length || 0
  const defaultWindow = totalMonths > DEFAULT_RECENT_WINDOW ? DEFAULT_RECENT_WINDOW : null
  const [windowMonths, setWindowMonths] = useState(defaultWindow)

  // Räkna ut "recent"-analys baserat på vald fönsterstorlek
  const manRecent = useMemo(() => {
    if (!state.parsedFiles?.length) return null
    if (windowMonths == null) return man  // hela perioden
    if (windowMonths === DEFAULT_RECENT_WINDOW && man?.recent) return man.recent
    return analyzeManuellWindow(state.parsedFiles, windowMonths)
  }, [state.parsedFiles, windowMonths, man])

  if (!man) return <SectionWrapper id="manuell" title="Manuella körningar" icon={Hand} info={SECTION_INFO.manuell}><EmptyState loading={state.isLoading} /></SectionWrapper>

  // Stacked bar: auto + manual per month
  const stackedData = man.monthly.map(m => ({
    month: m.month,
    Automatiska: m.autoTotal,
    Manuella: m.manTotal,
  }))

  // Manual% trend line
  const manPctLine = [{
    id: compareMode ? (state.facilityName || 'Manuell%') : 'Manuell%',
    data: man.monthly.map(m => ({ x: m.month, y: m.manualPct })),
  }]

  // Add compare manual% lines (multi-facility)
  if (compareMode && compareFacilities?.length > 0) {
    for (const cf of compareFacilities) {
      const cfman = cf.data?.manuellAnalys
      if (cfman?.monthly) {
        manPctLine.push({ id: cf.name || 'Jämförelse', data: cfman.monthly.map(m => ({ x: m.month, y: m.manualPct })) })
      }
    }
  }

  // Top manual valves horizontal bar
  const allManualValves = man.topManualValves || []
  const valveLimit = showAllValves ? allManualValves.length : 15
  const topValveDataRaw = allManualValves.slice(0, valveLimit).map(v => ({
    valve: v.valveId,
    manualPct: v.manualPct,
    color: manualColor(v.manualPct),
  }))
  const topValveData = applySortBar(topValveDataRaw, 'manualPct', top15Sort)

  // Per-branch horizontal bar
  const allBranches = man.branchSummary.filter(b => b.manualPct > 0)
  const branchLimit = showAllBranches ? allBranches.length : 15
  const branchDataRaw = allBranches
    .slice(0, branchLimit)
    .map(b => ({
      branch: `Gren ${b.branch}`,
      manualPct: b.manualPct,
    }))
  const branchData = applySortBar(branchDataRaw, 'manualPct', branchSort)

  // Table data
  const tableValveLimit = showAllTable ? allManualValves.length : 15
  const tableValves = allManualValves.slice(0, tableValveLimit)

  // Per-fraktion manuell andel per månad (linjediagram, en linje per fraktion)
  const pfm = man.perFractionMonthly
  const selfLabel = state.facilityName || ''
  const fractionLineData = pfm?.fractions?.length > 0 ? pfm.fractions.map(frac => {
    const fracLabel = frac === 'Okänd' ? 'Okänd' : (fractionLabelSv(frac) || frac)
    return {
      id: compareMode && selfLabel ? `${selfLabel} · ${fracLabel}` : fracLabel,
      fraction: frac,
      data: (pfm.series[frac] || [])
        .filter(r => r.totalCmd > 0)
        .map(r => ({ x: r.month, y: r.manualPct })),
    }
  }).filter(line => line.data.length > 0) : []

  // Lägg till jämförelsefastigheter (om i compare-läge)
  if (compareMode && compareFacilities?.length > 0) {
    for (const cf of compareFacilities) {
      const cfpfm = cf.data?.manuellAnalys?.perFractionMonthly
      if (!cfpfm?.fractions?.length) continue
      for (const frac of cfpfm.fractions) {
        const series = cfpfm.series?.[frac] || []
        if (series.length === 0) continue
        const fracLabel = frac === 'Okänd' ? 'Okänd' : (fractionLabelSv(frac) || frac)
        fractionLineData.push({
          id: `${cf.name || 'Jämförelse'} · ${fracLabel}`,
          fraction: frac,
          data: series
            .filter(r => r.totalCmd > 0)
            .map(r => ({ x: r.month, y: r.manualPct })),
        })
      }
    }
  }

  // Rising trend valves
  const risingValves = man.risingTrendValves || []

  // Spike months
  const spikes = man.spikeMonths || []

  // Seasonal comparison
  const season = man.seasonalComparison

  // Manual vs alarm categories correlations (from drifterfarenheter)
  const drift = state.drifterfarenheter
  const alarmCatCorr = drift?.manualVsAlarmCategories?.correlations || []

  // KPI-värden baserade på valt fönster (eller hela perioden om null)
  const showRecent = windowMonths != null && manRecent && manRecent !== man
  const kpiMan = showRecent ? manRecent : man
  const recentLabelText = windowMonths != null ? `Senaste ${windowMonths} mån` : 'Hela perioden'
  const pctTrend = showRecent ? Math.round((kpiMan.yearPct - man.yearPct) * 100) / 100 : null

  return (
    <SectionWrapper id="manuell" title="Manuella körningar" icon={Hand} info={SECTION_INFO.manuell}>
      {totalMonths > DEFAULT_RECENT_WINDOW && !printMode && (
        <div className="mb-4">
          <WindowPicker value={windowMonths} onChange={setWindowMonths} totalMonths={totalMonths} />
        </div>
      )}
      <KpiGrid>
        <KpiCard
          label="Manuella kommandon"
          value={fmt(kpiMan.totalMan)}
          icon={Hand}
          color="purple"
          info={KPI_INFO['Manuella kommandon']}
          compareValue={compareMode && cman ? fmt(cman.totalMan) : undefined}
          showRecentBadge={showRecent}
          recentLabel={recentLabelText}
          historicValue={showRecent ? fmt(man.totalMan) : undefined}
        />
        <KpiCard
          label="Totala kommandon"
          value={fmt(kpiMan.totalAll)}
          icon={Hand}
          color="blue"
          info={KPI_INFO['Totala kommandon']}
          compareValue={compareMode && cman ? fmt(cman.totalAll) : undefined}
          showRecentBadge={showRecent}
          recentLabel={recentLabelText}
          historicValue={showRecent ? fmt(man.totalAll) : undefined}
        />
        <KpiCard
          label="Manuell andel"
          value={`${kpiMan.yearPct}%`}
          icon={Hand}
          color="orange"
          info={KPI_INFO['Manuell andel']}
          compareValue={compareMode && cman ? `${cman.yearPct}%` : undefined}
          showRecentBadge={showRecent}
          recentLabel={recentLabelText}
          historicValue={showRecent ? `${man.yearPct}%` : undefined}
          trendDelta={showRecent && pctTrend != null ? { value: pctTrend, unit: ' pp', betterWhen: 'lower' } : null}
        />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 [&>:last-child:nth-child(odd)]:md:col-span-2">
        <ChartCard title="Automatiska vs manuella kommandon (stacked)" height={300} info={CHART_INFO['Automatiska vs manuella kommandon (stacked)']}>
          <ResponsiveBar
            data={stackedData}
            keys={['Automatiska', 'Manuella']}
            indexBy="month"
            theme={theme}
            groupMode="stacked"
            borderRadius={2}
            padding={0.3}
            margin={{ top: 10, right: 90, bottom: 35, left: 60 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            enableLabel={false}
            colors={['#3b82f6', '#a855f7']}
            legends={[{ dataFrom: 'keys', anchor: 'right', direction: 'column', translateX: 90, itemWidth: 80, itemHeight: 18, symbolSize: 12, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
          />
        </ChartCard>

        <ChartCard title="Manuell andel per månad (%)" height={300} info={CHART_INFO['Manuell andel per månad (%)']}>
          <ResponsiveLine
            data={manPctLine}
            theme={theme}
            colors={compareMode && manPctLine.length > 1 ? ['#a855f7', ...COMPARE_COLORS.slice(0, manPctLine.length - 1)] : ['#a855f7']}
            margin={{ top: 10, right: compareMode && manPctLine.length > 1 ? 80 : 10, bottom: 35, left: 55 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
            pointSize={6}
            pointColor={{ theme: 'background' }}
            pointBorderWidth={2}
            pointBorderColor={{ from: 'serieColor' }}
            enableArea
            areaOpacity={0.1}
            yScale={{ type: 'linear', min: 0, max: 'auto' }}
            useMesh
            enableSlices="x"
            legends={compareMode && manPctLine.length > 1 ? [{ anchor: 'right', direction: 'column', translateX: 80, itemWidth: 70, itemHeight: 16, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }] : []}
          />
        </ChartCard>

        {topValveData.length > 0 && (
          <ChartCard
            title={`Topp ventiler — manuell% (${topValveData.length} st)`}
            height={Math.max(300, topValveData.length * 25)}
            info={CHART_INFO['Topp-15 ventiler (manuell%)']}
            controls={<>
              <SortToggle sortMode={top15Sort} onChange={setTop15Sort} />
              {!printMode && allManualValves.length > 15 && (
                <button onClick={() => setShowAllValves(s => !s)} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors">
                  {showAllValves ? <><ChevronUp className="w-3 h-3" />Visa 15</> : <><ChevronDown className="w-3 h-3" />Alla ({allManualValves.length})</>}
                </button>
              )}
            </>}
          >
            <ResponsiveBar
              data={topValveData}
              keys={['manualPct']}
              indexBy="valve"
              layout="horizontal"
              theme={theme}
              borderRadius={3}
              padding={0.3}
              margin={{ top: 10, right: 30, bottom: 30, left: 70 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5 }}
              enableLabel={true}
              label={d => `${d.value}%`}
              labelTextColor="#fff"
              colors={({ data }) => data.color}
            />
          </ChartCard>
        )}

        {branchData.length > 0 && (
          <ChartCard
            title={`Manuell andel per gren (${branchData.length} st)`}
            height={Math.max(250, branchData.length * 25)}
            info={CHART_INFO['Manuell andel per gren']}
            controls={<>
              <SortToggle sortMode={branchSort} onChange={setBranchSort} />
              {!printMode && allBranches.length > 15 && (
                <button onClick={() => setShowAllBranches(s => !s)} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors">
                  {showAllBranches ? <><ChevronUp className="w-3 h-3" />Visa 15</> : <><ChevronDown className="w-3 h-3" />Alla ({allBranches.length})</>}
                </button>
              )}
            </>}
          >
            <ResponsiveBar
              data={branchData}
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
      </div>

      {tableValves.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">Manuella ventiler<InfoButton text={TABLE_INFO['Manuella ventiler']} size={14} /></h4>
            {!printMode && allManualValves.length > 15 && (
              <button
                onClick={() => setShowAllTable(s => !s)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                {showAllTable ? <><ChevronUp className="w-3 h-3" />Visa färre</> : <><ChevronDown className="w-3 h-3" />Visa alla ({allManualValves.length})</>}
              </button>
            )}
          </div>
          <DataTable
            columns={[
              { key: 'valveId', label: 'Ventil' },
              { key: 'branch', label: 'Gren' },
              { key: 'manTotal', label: 'Manuella', render: v => fmt(v) },
              { key: 'autoTotal', label: 'Automatiska', render: v => fmt(v) },
              { key: 'manualPct', label: 'Manuell%', render: v => `${v}%` },
              { key: 'avgAvailability', label: 'Tillgänglighet', render: v => v != null ? pct(v) : '–' },
            ]}
            data={tableValves}
          />
        </div>
      )}

      {/* Säsongsjämförelse sommar vs vinter */}
      {season && (season.summerAvg != null || season.winterAvg != null) && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">Säsongsjämförelse<InfoButton text={TABLE_INFO['Manuell säsongsanalys']} size={14} /></h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">Sommar (jun–aug)</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{season.summerAvg != null ? `${fmt2(season.summerAvg)}%` : '–'}</div>
              <div className="text-xs text-slate-400 mt-0.5">{season.summerCount} månader</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">Vinter (dec–feb)</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{season.winterAvg != null ? `${fmt2(season.winterAvg)}%` : '–'}</div>
              <div className="text-xs text-slate-400 mt-0.5">{season.winterCount} månader</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">Skillnad (sommar − vinter)</div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {season.delta != null ? `${season.delta > 0 ? '+' : ''}${fmt2(season.delta)} pp` : '–'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {season.deltaPct != null ? `${season.deltaPct > 0 ? '+' : ''}${fmt1(season.deltaPct)}% relativt` : ''}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 flex flex-col">
              <div className="text-xs text-slate-500 dark:text-slate-400">Signifikans</div>
              <div className="mt-2">
                {season.summerCount >= 2 && season.winterCount >= 2 ? (
                  <StatusBadge
                    status={season.significant ? 'warning' : 'ok'}
                    label={season.significant ? 'Signifikant skillnad' : 'Ingen tydlig skillnad'}
                  />
                ) : (
                  <StatusBadge status="info" label="Otillräckligt dataunderlag" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manuell andel per fraktion per månad */}
      {fractionLineData.length > 0 && (
        <div className="mt-6">
          <ChartCard
            title={`Manuell andel per fraktion per månad (%)`}
            height={Math.max(320, compareMode ? 380 : 320)}
            info={CHART_INFO['Manuell andel per fraktion per månad (%)']}
          >
            <ResponsiveLine
              data={fractionLineData}
              theme={theme}
              colors={FRACTION_COLORS}
              margin={{ top: 10, right: compareMode ? 180 : 110, bottom: 40, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5, legend: 'Manuell %', legendOffset: -45, legendPosition: 'middle' }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={5}
              pointColor={{ theme: 'background' }}
              pointBorderWidth={2}
              pointBorderColor={{ from: 'serieColor' }}
              yScale={{ type: 'linear', min: 0, max: 'auto' }}
              useMesh
              enableSlices="x"
              legends={[{ anchor: 'right', direction: 'column', translateX: compareMode ? 175 : 105, itemWidth: compareMode ? 160 : 90, itemHeight: 18, symbolSize: 10, itemTextColor: dark ? '#94a3b8' : '#64748b' }]}
            />
          </ChartCard>
        </div>
      )}

      {/* Topp-10 ventiler med stigande manuell-trend */}
      {risingValves.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            Ventiler med stigande manuell-trend (topp {risingValves.length})
            <InfoButton text={TABLE_INFO['Stigande manuell-trend']} size={14} />
          </h4>
          <DataTable
            columns={[
              { key: 'valveId', label: 'Ventil' },
              { key: 'branch', label: 'Gren' },
              { key: 'fraction', label: 'Fraktion', render: v => v ? (fractionLabelSv(v) || v) : '–' },
              { key: 'firstPct', label: 'Start %', render: v => `${fmt2(v)}%` },
              { key: 'lastPct', label: 'Senast %', render: v => `${fmt2(v)}%` },
              { key: 'change', label: 'Förändring', render: v => `${v > 0 ? '+' : ''}${fmt2(v)} pp` },
              { key: 'slope', label: 'Lutning/mån', render: v => fmt2(v) },
              { key: 'pValue', label: 'p', render: v => v != null ? (v < 0.001 ? '<0.001' : v.toFixed(3)) : '–' },
              { key: 'totalManual', label: 'Manuella', render: v => fmt(v) },
            ]}
            data={risingValves}
          />
        </div>
      )}

      {/* Månader med manuell-spikar */}
      {spikes.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            Månader med manuell-spikar
            <InfoButton text={TABLE_INFO['Manuell-spikar per månad']} size={14} />
          </h4>
          <DataTable
            columns={[
              { key: 'month', label: 'Månad' },
              { key: 'manualPct', label: 'Manuell%', render: v => `${v}%` },
              { key: 'deltaFromMean', label: 'Avvikelse från snitt', render: v => `${v > 0 ? '+' : ''}${fmt2(v)} pp` },
              { key: 'zScore', label: 'z-score', render: v => fmt2(v) },
              { key: 'manTotal', label: 'Manuella', render: v => fmt(v) },
              { key: 'totalCmd', label: 'Totalt', render: v => fmt(v) },
            ]}
            data={spikes}
          />
        </div>
      )}

      {/* Korrelation manuell vs larm per kategori */}
      {alarmCatCorr.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            Korrelation: manuell andel vs larm per kategori
            <InfoButton text={TABLE_INFO['Korrelation manuell vs larmkategorier']} size={14} />
          </h4>
          <DataTable
            columns={[
              { key: 'category', label: 'Larmkategori' },
              { key: 'pearsonR', label: 'Pearson r', render: v => v?.toFixed(3) || '–' },
              { key: 'pValue', label: 'p-värde', render: v => v != null ? (v < 0.001 ? '<0.001' : v.toFixed(3)) : '–' },
              { key: 'totalAlarms', label: 'Totalt antal larm', render: v => fmt(v) },
              { key: 'months', label: 'Månader' },
            ]}
            data={alarmCatCorr}
          />
        </div>
      )}
    </SectionWrapper>
  )
}
