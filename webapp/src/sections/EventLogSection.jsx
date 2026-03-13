import { Activity, CalendarDays, Zap, Clock, AlertTriangle, BatteryWarning } from 'lucide-react'
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

export default function EventLogSection() {
  const { state } = useData()
  const { dark } = useTheme()
  const theme = getNivoTheme(dark)
  const eventLog = state.eventLog

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

      {/* Top alarm messages */}
      {alarms.topMessages?.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Vanligaste larm</h4>
          <DataTable columns={topAlarmColumns} data={alarms.topMessages} maxRows={15} />
        </div>
      )}

      {/* Component health - Valves */}
      {valveData.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Komponenthälsa &ndash; Ventiler</h4>
          <DataTable columns={valveColumns} data={valveData} maxRows={20} />
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
