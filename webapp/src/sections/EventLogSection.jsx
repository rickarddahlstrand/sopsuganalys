import { useState, useMemo, useCallback } from 'react'
import { Activity, CalendarDays, Zap, Clock, AlertTriangle, BatteryWarning, X, Timer, AlertCircle, LogIn, Hand, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, fmt1, pct } from '../utils/formatters'
import { CHART_INFO, TABLE_INFO, KPI_INFO } from '../utils/descriptions'
import SectionWrapper from '../components/common/SectionWrapper'
import KpiGrid from '../components/common/KpiGrid'
import KpiCard from '../components/common/KpiCard'
import ChartCard from '../components/common/ChartCard'
import DataTable from '../components/common/DataTable'
import EmptyState from '../components/common/EmptyState'
import StatusBadge from '../components/common/StatusBadge'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'

const severityColors = {
  'Kritiskt': '#ef4444',
  'Nödstopp': '#f97316',
  'Totalt stopp': '#eab308',
  'Generellt': '#60a5fa',
}

function severityStatusType(typ) {
  if (typ === 'Kritiskt') return 'critical'
  if (typ === 'Nödstopp') return 'warning'
  if (typ === 'Totalt stopp') return 'warning'
  return 'info'
}

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '–'
  const s = Math.max(0, seconds)
  if (s < 60) return `${fmt1(s)} s`
  if (s < 3600) return `${fmt1(s / 60)} min`
  if (s < 86400) return `${fmt1(s / 3600)} h`
  return `${fmt1(s / 86400)} dygn`
}

function ErrorTimelineChart({ label, events, dark }) {
  const theme = getNivoTheme(dark)
  const lineData = useMemo(() => {
    const daily = {}
    for (const ev of events) {
      const dk = toDateKey(ev.tid)
      daily[dk] = (daily[dk] || 0) + 1
    }
    const points = Object.keys(daily).sort().map(d => ({ x: d, y: daily[d] }))
    return [{ id: label, data: points }]
  }, [events, label])

  if (lineData[0].data.length < 2) {
    return (
      <div className="flex items-center gap-4 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        <span>Alla {events.length} händelser inträffade {lineData[0].data[0]?.x}</span>
      </div>
    )
  }

  return (
    <div style={{ height: 180 }}>
      <ResponsiveLine
        data={lineData}
        theme={theme}
        colors={['#ef4444']}
        margin={{ top: 10, right: 20, bottom: 35, left: 45 }}
        axisLeft={{ tickSize: 0, tickPadding: 5 }}
        axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
        pointSize={6}
        pointColor="#ef4444"
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        useMesh
        curve="monotoneX"
        enableArea
        areaOpacity={0.1}
      />
    </div>
  )
}

function ClickableAlarmTable({ columns, data, rawEvents, dark }) {
  const [selected, setSelected] = useState(null)

  const matchingEvents = useMemo(() => {
    if (!selected || !rawEvents) return []
    return rawEvents.filter(ev => ev.text === selected.text)
  }, [selected, rawEvents])

  const handleRowClick = useCallback((row) => {
    setSelected(prev => prev?.text === row.text ? null : row)
  }, [])

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              {columns.map(col => (
                <th key={col.key} className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const isSelected = selected?.text === row.text
              return (
                <tr
                  key={i}
                  onClick={() => handleRowClick(row)}
                  className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40'
                      : i % 2 === 0
                        ? 'hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                        : 'bg-slate-50/50 dark:bg-slate-800/25 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '–')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {selected && matchingEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-slate-700">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/50 dark:border-slate-700/50">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate pr-4">
                  {selected.text}
                  <span className="ml-2 text-slate-400 font-normal">({matchingEvents.length} händelser)</span>
                </p>
                <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ErrorTimelineChart label={selected.text} events={matchingEvents} dark={dark} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ClickableValveTable({ columns, data, rawEvents, dark }) {
  const [selected, setSelected] = useState(null)

  const matchingEvents = useMemo(() => {
    if (!selected || !rawEvents) return []
    const re = new RegExp(`DV ${selected.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    return rawEvents.filter(ev => ev.typ !== 'Information' && re.test(ev.text))
  }, [selected, rawEvents])

  const handleRowClick = useCallback((row) => {
    setSelected(prev => prev?.id === row.id ? null : row)
  }, [])

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              {columns.map(col => (
                <th key={col.key} className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const isSelected = selected?.id === row.id
              return (
                <tr
                  key={i}
                  onClick={() => handleRowClick(row)}
                  className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40'
                      : i % 2 === 0
                        ? 'hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                        : 'bg-slate-50/50 dark:bg-slate-800/25 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '–')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {selected && matchingEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-slate-700">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/50 dark:border-slate-700/50">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  DV {selected.id}
                  <span className="ml-2 text-slate-400 font-normal">({matchingEvents.length} fel)</span>
                </p>
                <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ErrorTimelineChart label={`DV ${selected.id}`} events={matchingEvents} dark={dark} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const FOLLOWUP_KIND_ORDER = ['engagement', 'login', 'manual', 'reset']
const FOLLOWUP_KIND_LABELS = {
  engagement: 'Engagemang',
  login: 'Login',
  manual: 'Manual',
  reset: 'Reset',
}
const FOLLOWUP_KIND_COLORS = {
  engagement: '#06b6d4',
  login: '#22c55e',
  manual: '#a855f7',
  reset: '#f97316',
}

function ResponseTimeBlock({ responseTimes, theme, dark }) {
  const {
    matchedCount,
    unmatchedCount,
    totalAlarms,
    totalResets,
    totalLogins,
    totalManualSwitches,
    matchCounts,
    overall,
    perType,
    longest,
    alarmLog,
    flaggedCount,
    timeline,
    timelineGranularity,
    unmatchedRatio,
    warning,
  } = responseTimes

  const [showDetailedPerType, setShowDetailedPerType] = useState(false)

  const ratio = (n) => (totalAlarms > 0 ? n / totalAlarms : 0)

  // Per-type compact median table (one column per follow-up kind).
  const perTypeColumns = [
    { key: 'typ', label: 'Larmtyp', render: (val) => <StatusBadge status={severityStatusType(val)} label={val} /> },
    { key: 'count', label: 'Larm' },
    {
      key: 'engagement',
      label: 'Engagemang',
      render: (v) => v?.count ? `${formatDuration(v.medianSeconds)} (${v.count})` : '–',
    },
    {
      key: 'login',
      label: 'Login',
      render: (v) => v?.count ? `${formatDuration(v.medianSeconds)} (${v.count})` : '–',
    },
    {
      key: 'manual',
      label: 'Manual',
      render: (v) => v?.count ? `${formatDuration(v.medianSeconds)} (${v.count})` : '–',
    },
    {
      key: 'reset',
      label: 'Reset',
      render: (v) => v?.count ? `${formatDuration(v.medianSeconds)} (${v.count})` : '–',
    },
  ]

  // Detaljerad per-typ-tabell — flatten kind+percentile.
  const detailedPerTypeRows = perType.flatMap((row) => {
    return FOLLOWUP_KIND_ORDER.map((kind) => ({
      key: `${row.typ}-${kind}`,
      typ: row.typ,
      kindLabel: FOLLOWUP_KIND_LABELS[kind],
      kind,
      count: row[kind]?.count ?? 0,
      median: row[kind]?.medianSeconds ?? null,
      p75: row[kind]?.p75Seconds ?? null,
      p90: row[kind]?.p90Seconds ?? null,
      p95: row[kind]?.p95Seconds ?? null,
      mean: row[kind]?.meanSeconds ?? null,
      stddev: row[kind]?.stddevSeconds ?? null,
    }))
  })

  const detailedColumns = [
    { key: 'typ', label: 'Larmtyp', render: (val) => <StatusBadge status={severityStatusType(val)} label={val} /> },
    { key: 'kindLabel', label: 'Mätpunkt' },
    { key: 'count', label: 'n' },
    { key: 'median', label: 'Median', render: (v) => v != null ? formatDuration(v) : '–' },
    { key: 'p75', label: 'p75', render: (v) => v != null ? formatDuration(v) : '–' },
    { key: 'p90', label: 'p90', render: (v) => v != null ? formatDuration(v) : '–' },
    { key: 'p95', label: 'p95', render: (v) => v != null ? formatDuration(v) : '–' },
    { key: 'mean', label: 'Medel', render: (v) => v != null ? formatDuration(v) : '–' },
    { key: 'stddev', label: 'σ', render: (v) => v != null ? formatDuration(v) : '–' },
  ]

  // Topp 10 längsta — visa både engagemang och reset.
  const longestColumns = [
    { key: 'tid', label: 'Larmtid', render: (v) => v instanceof Date ? v.toLocaleString('sv-SE') : String(v) },
    { key: 'typ', label: 'Typ', render: (val) => <StatusBadge status={severityStatusType(val)} label={val} /> },
    { key: 'identifier', label: 'Identifierare', render: (v) => v ?? '–' },
    { key: 'text', label: 'Larmtext' },
    { key: 'engagementSeconds', label: 'Engagemang', render: (v) => v != null ? formatDuration(v) : '–' },
    { key: 'resetSeconds', label: 'Reset', render: (v) => v != null ? formatDuration(v) : '–' },
  ]

  // Larmlogg-tabell — alla larm individuellt, med flaggning för avvikande tider.
  const truncate = (s, n = 80) => {
    if (!s) return '–'
    return s.length > n ? s.slice(0, n - 1) + '…' : s
  }
  const renderTime = (v, flagged) => {
    if (v == null) return <span className="text-slate-400">–</span>
    if (flagged) {
      return (
        <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300 font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          {formatDuration(v)}
        </span>
      )
    }
    return formatDuration(v)
  }
  const alarmLogColumns = [
    { key: 'tid', label: 'Tidpunkt', render: (v) => v instanceof Date ? v.toLocaleString('sv-SE') : String(v) },
    { key: 'typ', label: 'Typ', render: (val) => <StatusBadge status={severityStatusType(val)} label={val} /> },
    {
      key: 'text',
      label: 'Text',
      // Allow the text column to wrap so the row stays readable when the user
      // expands to all rows. The wrapper class overrides DataTable's default
      // `whitespace-nowrap` per-cell.
      cellClassName: 'whitespace-normal break-words min-w-[220px]',
      render: (v) => <span title={v}>{truncate(v, 80)}</span>,
    },
    { key: 'engagementSeconds', label: 'Engagemang', render: (v, row) => renderTime(v, row.flags?.engagement) },
    { key: 'loginSeconds', label: 'Login', render: (v, row) => renderTime(v, row.flags?.login) },
    { key: 'manualSeconds', label: 'Manual', render: (v, row) => renderTime(v, row.flags?.manual) },
    { key: 'resetSeconds', label: 'Reset', render: (v, row) => renderTime(v, row.flags?.reset) },
  ]

  // Linjediagram — en linje per kind.
  const lineData = FOLLOWUP_KIND_ORDER
    .map((kind) => {
      const data = timeline
        .map((d) => ({ x: d.period, y: d[`${kind}MedianMinutes`] }))
        .filter((p) => p.y != null)
        .map((p) => ({ x: p.x, y: Number(p.y.toFixed(2)) }))
      return { id: FOLLOWUP_KIND_LABELS[kind], data, kind }
    })
    .filter((s) => s.data.length > 0)

  const lineColors = lineData.map((s) => FOLLOWUP_KIND_COLORS[s.kind])

  const showChart = timeline.length >= 2 && matchedCount >= 10

  // Varningsbanner för låga matchningar per kind (<30%)
  const lowMatchKinds = FOLLOWUP_KIND_ORDER
    .filter((k) => totalAlarms > 0 && matchCounts[k] / totalAlarms < 0.3)
    .map((k) => ({ kind: k, ratio: ratio(matchCounts[k]) }))

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Fjärr-responstid</h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">
        Tid från larm till första uppföljande operatörshändelse, mätt i fyra steg:
        <strong> Login</strong> ("Remote connection 1" — operatören kopplar upp),
        <strong> Manual</strong> ("Change to manual operation mode" — operatören tar manuell kontroll),
        <strong> Reset</strong> ("Alarm reset" — kvittering/åtgärd klar). <strong>Engagemang</strong> är det första
        av dessa tre — alltså hur snabbt operatören över huvud taget reagerar. Endast fjärrhantering — inställelsetid på plats ingår inte.
      </p>

      {warning && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50">
          <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-orange-700 dark:text-orange-300">{warning}</p>
        </div>
      )}

      {!warning && lowMatchKinds.length > 0 && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50">
          <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Låg matchningsgrad (&lt;30 %) för: {lowMatchKinds.map((x, i) => (
              <span key={x.kind}>
                {i > 0 ? ', ' : ''}<strong>{FOLLOWUP_KIND_LABELS[x.kind]}</strong> ({pct(x.ratio * 100, 0)})
              </span>
            ))}. Tolka dessa median-värden med försiktighet.
          </p>
        </div>
      )}

      <KpiGrid>
        <KpiCard
          label="Median tid till engagemang"
          value={formatDuration(overall.engagement?.medianSeconds ?? 0)}
          icon={Timer}
          color="cyan"
          info={KPI_INFO['Median tid till engagemang']}
          compareValue={`${fmt(matchCounts.engagement)} av ${fmt(totalAlarms)} larm`}
        />
        <KpiCard
          label="Median tid till login"
          value={formatDuration(overall.login?.medianSeconds ?? 0)}
          icon={LogIn}
          color="emerald"
          info={KPI_INFO['Median tid till login']}
          compareValue={`${fmt(matchCounts.login)} av ${fmt(totalAlarms)} larm`}
        />
        <KpiCard
          label="Median tid till manual mode"
          value={formatDuration(overall.manual?.medianSeconds ?? 0)}
          icon={Hand}
          color="purple"
          info={KPI_INFO['Median tid till manual mode']}
          compareValue={`${fmt(matchCounts.manual)} av ${fmt(totalAlarms)} larm`}
        />
        <KpiCard
          label="Median tid till reset"
          value={formatDuration(overall.reset?.medianSeconds ?? 0)}
          icon={RotateCcw}
          color="orange"
          info={KPI_INFO['Median tid till reset']}
          compareValue={`${fmt(matchCounts.reset)} av ${fmt(totalAlarms)} larm`}
        />
      </KpiGrid>

      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {fmt(totalAlarms)} larm · {fmt(totalLogins)} login · {fmt(totalManualSwitches)} manual mode · {fmt(totalResets)} reset · {fmt(unmatchedCount)} larm utan engagemang ({pct(unmatchedRatio * 100, 0)})
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 [&>:last-child:nth-child(odd)]:md:col-span-2">
        {perType.length > 0 && (
          <ChartCard title="Median per larmtyp och mätpunkt" height={Math.max(150, 60 + perType.length * 56)} info={CHART_INFO['Responstid per larmtyp']}>
            <div className="overflow-x-auto -m-2">
              <DataTable columns={perTypeColumns} data={perType} maxRows={20} />
            </div>
          </ChartCard>
        )}

        {showChart && (
          <ChartCard
            title={timelineGranularity === 'week' ? 'Median responstid per vecka' : 'Median responstid per dag'}
            height={Math.max(280, 60 + perType.length * 56)}
            info={CHART_INFO['Median responstid över tid']}
          >
            <ResponsiveLine
              data={lineData}
              theme={theme}
              colors={lineColors}
              margin={{ top: 10, right: 110, bottom: 50, left: 60 }}
              axisLeft={{ tickSize: 0, tickPadding: 5, legend: 'min', legendPosition: 'middle', legendOffset: -45 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={4}
              useMesh
              curve="monotoneX"
              enableSlices="x"
              legends={[{
                anchor: 'right',
                direction: 'column',
                translateX: 100,
                itemWidth: 90,
                itemHeight: 18,
                symbolSize: 10,
                itemTextColor: dark ? '#94a3b8' : '#64748b',
              }]}
            />
          </ChartCard>
        )}
      </div>

      {perType.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDetailedPerType((v) => !v)}
            className="text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {showDetailedPerType ? 'Dölj detaljerad statistik (p75/p90/p95)' : 'Visa detaljerad statistik (p75/p90/p95)'}
          </button>
          <AnimatePresence>
            {showDetailedPerType && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-3">
                  <DataTable columns={detailedColumns} data={detailedPerTypeRows} maxRows={detailedPerTypeRows.length} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {longest.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
            Topp 10 längsta responstider
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-2">— enskilda larm med längst tid till engagemang/reset</span>
          </h4>
          <DataTable columns={longestColumns} data={longest} maxRows={10} />
        </div>
      )}

      {alarmLog && alarmLog.length > 0 && (
        <div className="mt-6">
          <ChartCard title="Larmlogg med svartider" info={TABLE_INFO['Larmlogg med svartider']}>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              {fmt(alarmLog.length)} larm, varav <strong>{fmt(flaggedCount)}</strong> avvikande
              {flaggedCount > 0 && (
                <span className="ml-2 text-slate-400">— rader med röd bakgrund överstiger p90 eller medel + 2σ för sin mätpunkt</span>
              )}
            </div>
            {/* Limit height so "Visa alla" doesn't blow up the page on
                CSV-loggar med tusentals larm — table scrolls internally. */}
            <div className="max-h-[600px] overflow-y-auto rounded-lg">
              <DataTable
                columns={alarmLogColumns}
                data={alarmLog}
                maxRows={25}
                defaultSort={{ key: 'engagementSeconds', dir: 'desc' }}
                rowClassName={(row) => row.flagged ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100/60 dark:hover:bg-red-900/40' : ''}
              />
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  )
}

export default function EventLogSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const eventLog = state.eventLog
  // eventLogFiles is now an array of { fileName, events, dateRange }.
  // Combine raw events from all files for the clickable timeline drilldowns.
  // Dedup logic already ran at upload time, so we can just concat here.
  const rawEvents = useMemo(() => {
    const elf = state.eventLogFiles
    if (!elf) return null
    if (Array.isArray(elf)) {
      // Concat all events, sorted (already sorted within each file but not
      // across files); cheap enough to re-sort.
      const all = elf.flatMap(f => f.events || [])
      all.sort((a, b) => a.tid - b.tid)
      return all
    }
    // Backwards-compat: object with .events
    return elf.events || null
  }, [state.eventLogFiles])

  if (!eventLog) return (
    <SectionWrapper id="eventlog" title="Händelselogg" icon={Activity}>
      <EmptyState loading={state.isLoading} />
    </SectionWrapper>
  )

  const { summary, sequences, alarms, componentHealth, timePatterns, powerEvents, operationMode, responseTimes } = eventLog

  // KPI values
  const criticalCount = (summary.byType?.['Kritiskt'] || 0) + (summary.byType?.['Nödstopp'] || 0) + (summary.byType?.['Totalt stopp'] || 0)

  // Alarm severity bar data (horizontal)
  const severityBarData = alarms.bySeverity.map(s => ({
    typ: s.typ,
    Antal: s.count,
  }))

  // Alarm timeline line data
  const alarmTimelineKeys = ['Kritiskt', 'Nödstopp', 'Totalt stopp', 'Generellt']
  const alarmLineData = alarmTimelineKeys
    .filter(key => alarms.timeline.some(d => d[key] > 0))
    .map(key => ({
      id: key,
      data: alarms.timeline.map(d => ({ x: d.date, y: d[key] || 0 })),
    }))

  const alarmLineColors = alarmLineData.map(s => severityColors[s.id] || '#94a3b8')

  // Sequence timeline line data
  const seqLineData = [
    {
      id: 'Genomförda',
      data: sequences.timeline.map(d => ({ x: d.date, y: d.count })),
    },
    {
      id: 'Ventiler tömda',
      data: sequences.timeline.map(d => ({ x: d.date, y: d.valves })),
    },
  ]

  // Activity by hour bar data
  const hourBarData = timePatterns.byHour.map((val, i) => ({
    hour: String(i).padStart(2, '0'),
    Händelser: val,
    ...(timePatterns.alarmsByHour ? { Larm: timePatterns.alarmsByHour[i] } : {}),
  }))
  const hourBarKeys = timePatterns.alarmsByHour ? ['Händelser', 'Larm'] : ['Händelser']
  const hourBarColors = timePatterns.alarmsByHour ? ['#3b82f6', '#ef4444'] : ['#3b82f6']

  // Top alarm messages table columns
  const topAlarmColumns = [
    { key: 'text', label: 'Text' },
    { key: 'typ', label: 'Typ', render: (val) => <StatusBadge status={severityStatusType(val)} label={val} /> },
    { key: 'count', label: 'Antal' },
  ]

  // Valve health table columns
  const valveColumns = [
    { key: 'id', label: 'Ventil-ID' },
    { key: 'errors', label: 'Totala fel' },
    { key: 'closeFault', label: 'Stängningsfel', render: (_, row) => row.errorTypes?.['failed to close'] ?? 0 },
    { key: 'openFault', label: 'Öppningsfel', render: (_, row) => row.errorTypes?.['failed to open'] ?? 0 },
    { key: 'levelFault', label: 'Nivåfel', render: (_, row) => row.errorTypes?.['Level error'] ?? 0 },
    { key: 'timeout', label: 'Timeout', render: (_, row) => row.errorTypes?.['Inlet open timeout'] ?? 0 },
    { key: 'comFault', label: 'COM-fel', render: (_, row) => row.errorTypes?.['COM error'] ?? 0 },
  ]

  const valveData = [...(componentHealth.valves || [])].sort((a, b) => b.errors - a.errors)

  // Separator table
  const separatorColumns = [
    { key: 'id', label: 'ID' },
    { key: 'blocks', label: 'Blockeringar' },
  ]

  // Exhauster table
  const exhausterColumns = [
    { key: 'id', label: 'ID' },
    { key: 'alarms', label: 'Larm' },
  ]

  // Container table
  const containerColumns = [
    { key: 'id', label: 'ID' },
    { key: 'connects', label: 'Anslutningar' },
    { key: 'disconnects', label: 'Frånkopplingar' },
    { key: 'almostFull', label: 'Nästan full' },
  ]

  return (
    <SectionWrapper id="eventlog" title="Händelselogg" icon={Activity}>
      <KpiGrid>
        <KpiCard label="Totalt antal händelser" value={fmt(summary.total)} icon={Activity} color="blue" />
        <KpiCard label="Händelser/dag" value={fmt1(summary.eventsPerDay)} icon={CalendarDays} color="cyan" />
        <KpiCard label="Sekvenser genomförda" value={fmt(sequences.totalCompletions)} icon={Zap} color="emerald" />
        <KpiCard label="Snitt tömningstid" value={`${fmt1(sequences.avgMinutesPerCompletion)} min`} icon={Clock} color="purple" />
        <KpiCard label="Kritiska händelser" value={fmt(criticalCount)} icon={AlertTriangle} color="red" />
        <KpiCard label="Effektbegränsningar" value={fmt(powerEvents.count)} icon={BatteryWarning} color="orange" />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 [&>:last-child:nth-child(odd)]:md:col-span-2">
        {/* Alarm severity breakdown */}
        {severityBarData.length > 0 && (
          <ChartCard title="Larmfördelning per allvarlighetsgrad" height={250}>
            <ResponsiveBar
              data={severityBarData}
              keys={['Antal']}
              indexBy="typ"
              layout="horizontal"
              theme={theme}
              colors={({ data }) => severityColors[data.typ] || '#94a3b8'}
              borderRadius={3}
              padding={0.3}
              margin={{ top: 10, right: 30, bottom: 30, left: 100 }}
              axisLeft={{ tickSize: 0, tickPadding: 10 }}
              axisBottom={{ tickSize: 0, tickPadding: 5 }}
              enableLabel
              labelTextColor="#fff"
            />
          </ChartCard>
        )}

        {/* Alarm timeline */}
        {alarmLineData.length > 0 && (
          <ChartCard title="Händelser per dag" height={250}>
            <ResponsiveLine
              data={alarmLineData}
              theme={theme}
              colors={alarmLineColors}
              margin={{ top: 10, right: 110, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={3}
              useMesh
              enableSlices="x"
              legends={[{
                anchor: 'right',
                direction: 'column',
                translateX: 110,
                itemWidth: 100,
                itemHeight: 18,
                symbolSize: 10,
                itemTextColor: dark ? '#94a3b8' : '#64748b',
              }]}
            />
          </ChartCard>
        )}

        {/* Sequence timeline */}
        {sequences.timeline.length > 0 && (
          <ChartCard title="Sekvensanalys per dag" height={250}>
            <ResponsiveLine
              data={seqLineData}
              theme={theme}
              colors={['#22c55e', '#3b82f6']}
              margin={{ top: 10, right: 110, bottom: 35, left: 55 }}
              axisLeft={{ tickSize: 0, tickPadding: 5 }}
              axisBottom={{ tickSize: 0, tickPadding: 5, tickRotation: -45 }}
              pointSize={3}
              useMesh
              enableSlices="x"
              legends={[{
                anchor: 'right',
                direction: 'column',
                translateX: 110,
                itemWidth: 100,
                itemHeight: 18,
                symbolSize: 10,
                itemTextColor: dark ? '#94a3b8' : '#64748b',
              }]}
            />
          </ChartCard>
        )}

        {/* Activity by hour */}
        <ChartCard title="Aktivitet per timme" height={250}>
          <ResponsiveBar
            data={hourBarData}
            keys={hourBarKeys}
            indexBy="hour"
            theme={theme}
            colors={hourBarColors}
            borderRadius={2}
            padding={0.2}
            groupMode="grouped"
            margin={{ top: 10, right: 80, bottom: 30, left: 50 }}
            axisLeft={{ tickSize: 0, tickPadding: 5 }}
            axisBottom={{ tickSize: 0, tickPadding: 5 }}
            enableLabel={false}
            legends={[{
              dataFrom: 'keys',
              anchor: 'right',
              direction: 'column',
              translateX: 80,
              itemWidth: 70,
              itemHeight: 18,
              symbolSize: 10,
              itemTextColor: dark ? '#94a3b8' : '#64748b',
            }]}
          />
        </ChartCard>
      </div>

      {/* Fjärr-responstid */}
      {responseTimes && (responseTimes.totalResets > 0 || responseTimes.totalAlarms > 0) && (
        <ResponseTimeBlock responseTimes={responseTimes} theme={theme} dark={dark} />
      )}

      {/* Top alarm messages — clickable */}
      {alarms.topMessages?.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Vanligaste larm <span className="text-xs font-normal text-slate-400 dark:text-slate-500">— klicka för tidslinje</span></h4>
          <ClickableAlarmTable columns={topAlarmColumns} data={alarms.topMessages} rawEvents={rawEvents} dark={dark} />
        </div>
      )}

      {/* Component health - Valves — clickable */}
      {valveData.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Komponenthälsa &ndash; Ventiler <span className="text-xs font-normal text-slate-400 dark:text-slate-500">— klicka för tidslinje</span></h4>
          <ClickableValveTable columns={valveColumns} data={valveData} rawEvents={rawEvents} dark={dark} />
        </div>
      )}

      {/* Component health - Other */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {componentHealth.separators?.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Separatorer</h4>
            <DataTable columns={separatorColumns} data={componentHealth.separators} maxRows={10} />
          </div>
        )}

        {componentHealth.exhausters?.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Exhausters</h4>
            <DataTable columns={exhausterColumns} data={componentHealth.exhausters} maxRows={10} />
          </div>
        )}

        {componentHealth.containers?.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Containers</h4>
            <DataTable columns={containerColumns} data={componentHealth.containers} maxRows={10} />
          </div>
        )}
      </div>

      {/* Power events */}
      {powerEvents.count > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Effektbegränsningar ({powerEvents.count} st)</h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Tidpunkt</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Beskrivning</th>
                </tr>
              </thead>
              <tbody>
                {powerEvents.events.slice(0, 20).map((evt, i) => (
                  <tr key={i} className={`border-t border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/25'}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{evt.tid instanceof Date ? evt.tid.toLocaleString('sv-SE') : String(evt.tid)}</td>
                    <td className="px-3 py-2">{evt.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {powerEvents.events.length > 20 && (
              <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400">Visar 20 av {powerEvents.events.length} händelser</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Operation mode */}
      {operationMode && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Driftläge</h4>
          <div className="flex gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Manuella perioder</p>
              <p className="text-lg font-bold">{fmt(operationMode.manualPeriods)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Automatiska perioder</p>
              <p className="text-lg font-bold">{fmt(operationMode.automaticPeriods)}</p>
            </div>
          </div>
        </div>
      )}
    </SectionWrapper>
  )
}
