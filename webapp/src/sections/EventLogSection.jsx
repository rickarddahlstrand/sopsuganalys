import { useState, useMemo, useCallback } from 'react'
import { Activity, CalendarDays, Zap, Clock, AlertTriangle, BatteryWarning, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '../context/DataContext'
import { useTheme } from '../context/ThemeContext'
import { getNivoTheme } from '../utils/nivoTheme'
import { fmt, fmt1 } from '../utils/formatters'
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

export default function EventLogSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const eventLog = state.eventLog
  const rawEvents = state.eventLogFiles?.events

  if (!eventLog) return (
    <SectionWrapper id="eventlog" title="Händelselogg" icon={Activity}>
      <EmptyState loading={state.isLoading} />
    </SectionWrapper>
  )

  const { summary, sequences, alarms, componentHealth, timePatterns, powerEvents, operationMode } = eventLog

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
