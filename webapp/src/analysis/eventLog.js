/**
 * Event log analysis for waste vacuum system (sopsug).
 *
 * Input:  [{ tid: Date, typ: string, text: string }]
 * Output: structured analysis object (see analyzeEventLog return value).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER = ["Totalt stopp", "Kritiskt", "Nödstopp", "Generellt"];
const ALL_TYPES = ["Information", "Generellt", "Nödstopp", "Kritiskt", "Totalt stopp"];

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a, b) {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.max(1, Math.round(ms / 86400000));
}

function sortedDateKeys(obj) {
  return Object.keys(obj).sort();
}

function inc(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

// ---------------------------------------------------------------------------
// Sequence parsing
// ---------------------------------------------------------------------------

function buildSequences(events) {
  const reStart = /Sequence (\d+) (start|queued)/;
  const reComplete = /Sequence (\d+) emptied (\d+) valves? in (\d+) minutes?/;

  const byId = {};
  const dailyCounts = {};

  let totalCompletions = 0;
  let totalMinutesAll = 0;
  let totalValvesAll = 0;

  for (const ev of events) {
    let m = ev.text.match(reStart);
    if (m) {
      const id = m[1];
      if (!byId[id]) {
        byId[id] = {
          id,
          starts: 0,
          completions: 0,
          totalValves: 0,
          totalMinutes: 0,
          avgMinutes: 0,
          avgValves: 0,
          events: [],
        };
      }
      byId[id].starts += 1;
      byId[id].events.push(ev);
      continue;
    }

    m = ev.text.match(reComplete);
    if (m) {
      const id = m[1];
      const valves = parseInt(m[2], 10);
      const minutes = parseInt(m[3], 10);

      if (!byId[id]) {
        byId[id] = {
          id,
          starts: 0,
          completions: 0,
          totalValves: 0,
          totalMinutes: 0,
          avgMinutes: 0,
          avgValves: 0,
          events: [],
        };
      }
      const seq = byId[id];
      seq.completions += 1;
      seq.totalValves += valves;
      seq.totalMinutes += minutes;
      seq.events.push(ev);

      totalCompletions += 1;
      totalMinutesAll += minutes;
      totalValvesAll += valves;

      const dk = toDateKey(ev.tid);
      if (!dailyCounts[dk]) dailyCounts[dk] = { count: 0, valves: 0, minutes: 0 };
      dailyCounts[dk].count += 1;
      dailyCounts[dk].valves += valves;
      dailyCounts[dk].minutes += minutes;
    }
  }

  // Compute averages per sequence id
  for (const seq of Object.values(byId)) {
    if (seq.completions > 0) {
      seq.avgMinutes = seq.totalMinutes / seq.completions;
      seq.avgValves = seq.totalValves / seq.completions;
    }
  }

  const timeline = sortedDateKeys(dailyCounts).map((date) => ({
    date,
    count: dailyCounts[date].count,
    valves: dailyCounts[date].valves,
    minutes: dailyCounts[date].minutes,
  }));

  return {
    byId,
    timeline,
    totalCompletions,
    avgMinutesPerCompletion:
      totalCompletions > 0 ? totalMinutesAll / totalCompletions : 0,
    avgValvesPerCompletion:
      totalCompletions > 0 ? totalValvesAll / totalCompletions : 0,
  };
}

// ---------------------------------------------------------------------------
// Alarm analysis
// ---------------------------------------------------------------------------

function buildAlarms(events) {
  const isAlarm = (ev) => ev.typ !== "Information";
  const isRelevant = (ev) =>
    isAlarm(ev) && !/Alarm reset/i.test(ev.text);

  const byType = {
    Kritiskt: [],
    Nödstopp: [],
    "Totalt stopp": [],
    Generellt: [],
  };

  const dailyCounts = {};
  const msgCounts = {};

  for (const ev of events) {
    if (!isAlarm(ev)) continue;

    // byType — for Generellt also filter out alarm resets
    if (ev.typ === "Generellt") {
      if (!/Alarm reset/i.test(ev.text)) {
        byType.Generellt.push(ev);
      }
    } else if (byType[ev.typ]) {
      byType[ev.typ].push(ev);
    }

    if (!isRelevant(ev)) continue;

    // timeline
    const dk = toDateKey(ev.tid);
    if (!dailyCounts[dk]) {
      dailyCounts[dk] = { Kritiskt: 0, Nödstopp: 0, "Totalt stopp": 0, Generellt: 0 };
    }
    inc(dailyCounts[dk], ev.typ);

    // message frequency
    const key = `${ev.typ}|||${ev.text}`;
    inc(msgCounts, key);
  }

  // bySeverity
  const totalAlarms = Object.values(byType).reduce((s, a) => s + a.length, 0);
  const bySeverity = SEVERITY_ORDER.map((typ) => ({
    typ,
    count: byType[typ].length,
    percentage: totalAlarms > 0 ? (byType[typ].length / totalAlarms) * 100 : 0,
  }));

  // timeline
  const timeline = sortedDateKeys(dailyCounts).map((date) => ({
    date,
    ...dailyCounts[date],
  }));

  // topMessages
  const topMessages = Object.entries(msgCounts)
    .map(([key, count]) => {
      const [typ, text] = key.split("|||");
      return { text, count, typ };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return { byType, bySeverity, timeline, topMessages };
}

// ---------------------------------------------------------------------------
// Component health
// ---------------------------------------------------------------------------

function buildComponentHealth(events) {
  const valveMap = {};
  const separatorMap = {};
  const exhausterMap = {};
  const containerMap = {};

  const reValve = /DV (\d+:\d+(?::\d+)?)/;
  const reSeparator = /SE (\d+)/;
  const reExhauster = /[Ee]xhauster (\d+)/;
  const reContainer = /Container (\d+)/i;

  const reFailedClose = /failed to close/i;
  const reFailedOpen = /failed to open/i;
  const reLevelError = /Level error/i;
  const reInletTimeout = /Inlet open timeout/i;
  const reComError = /COM error/i;
  const reBlocked = /blocked by open valve/i;

  function ensureValve(id) {
    if (!valveMap[id]) {
      valveMap[id] = {
        id,
        errors: 0,
        errorTypes: {
          "failed to close": 0,
          "failed to open": 0,
          "Level error": 0,
          "Inlet open timeout": 0,
          "COM error": 0,
        },
      };
    }
    return valveMap[id];
  }

  function ensureSeparator(id) {
    if (!separatorMap[id]) {
      separatorMap[id] = { id, blocks: 0 };
    }
    return separatorMap[id];
  }

  function ensureExhauster(id) {
    if (!exhausterMap[id]) {
      exhausterMap[id] = { id, alarms: 0, errorCodes: [] };
    }
    return exhausterMap[id];
  }

  function ensureContainer(id) {
    if (!containerMap[id]) {
      containerMap[id] = { id, connects: 0, disconnects: 0, almostFull: 0 };
    }
    return containerMap[id];
  }

  for (const ev of events) {
    if (ev.typ === "Information") continue;
    const txt = ev.text;

    // Valve errors
    const vm = txt.match(reValve);
    if (vm) {
      const v = ensureValve(vm[1]);
      let matched = false;
      if (reFailedClose.test(txt)) { v.errorTypes["failed to close"]++; matched = true; }
      if (reFailedOpen.test(txt)) { v.errorTypes["failed to open"]++; matched = true; }
      if (reLevelError.test(txt)) { v.errorTypes["Level error"]++; matched = true; }
      if (reInletTimeout.test(txt)) { v.errorTypes["Inlet open timeout"]++; matched = true; }
      if (reComError.test(txt)) { v.errorTypes["COM error"]++; matched = true; }
      if (matched) v.errors++;
    }

    // Separator
    const sm = txt.match(reSeparator);
    if (sm) {
      const sep = ensureSeparator(sm[1]);
      if (reBlocked.test(txt) || reComError.test(txt)) {
        sep.blocks++;
      }
    }

    // Exhauster
    const em = txt.match(reExhauster);
    if (em) {
      const exh = ensureExhauster(em[1]);
      exh.alarms++;
      if (!exh.errorCodes.includes(txt)) {
        exh.errorCodes.push(txt);
      }
    }

    // Container
    const cm = txt.match(reContainer);
    if (cm) {
      const c = ensureContainer(cm[1]);
      if (/connect/i.test(txt) && !/disconnect/i.test(txt)) c.connects++;
      if (/disconnect/i.test(txt)) c.disconnects++;
      if (/almost full/i.test(txt) || /nearly full/i.test(txt)) c.almostFull++;
    }
  }

  return {
    valves: Object.values(valveMap).sort((a, b) => b.errors - a.errors),
    separators: Object.values(separatorMap).sort((a, b) => b.blocks - a.blocks),
    exhausters: Object.values(exhausterMap).sort((a, b) => b.alarms - a.alarms),
    containers: Object.values(containerMap).sort((a, b) => b.connects - a.connects),
  };
}

// ---------------------------------------------------------------------------
// Time patterns
// ---------------------------------------------------------------------------

function buildTimePatterns(events) {
  const byHour = new Array(24).fill(0);
  const byDayOfWeek = new Array(7).fill(0);
  const alarmsByHour = new Array(24).fill(0);
  const heatmapRaw = {};

  for (const ev of events) {
    const h = ev.tid.getHours();
    const d = ev.tid.getDay(); // 0 = Sunday

    byHour[h]++;
    byDayOfWeek[d]++;

    const key = `${h}-${d}`;
    inc(heatmapRaw, key);

    if (ev.typ !== "Information") {
      alarmsByHour[h]++;
    }
  }

  const heatmap = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let day = 0; day < 7; day++) {
      heatmap.push({
        hour,
        day,
        value: heatmapRaw[`${hour}-${day}`] || 0,
      });
    }
  }

  return { byHour, byDayOfWeek, heatmap, alarmsByHour };
}

// ---------------------------------------------------------------------------
// Power events
// ---------------------------------------------------------------------------

function buildPowerEvents(events) {
  const rePower = /(?:>|higher than)\s*(\d+)\s*kW/i;
  const matched = [];
  const dailyCounts = {};

  for (const ev of events) {
    if (rePower.test(ev.text)) {
      matched.push({ tid: ev.tid, text: ev.text });
      const dk = toDateKey(ev.tid);
      inc(dailyCounts, dk);
    }
  }

  const byDate = sortedDateKeys(dailyCounts).map((date) => ({
    date,
    count: dailyCounts[date],
  }));

  return { count: matched.length, events: matched, byDate };
}

// ---------------------------------------------------------------------------
// Operation mode
// ---------------------------------------------------------------------------

function buildOperationMode(events) {
  const reMode = /Change to (manual|automatic) operation mode/i;
  const changes = [];

  for (const ev of events) {
    const m = ev.text.match(reMode);
    if (m) {
      changes.push({
        tid: ev.tid,
        mode: m[1].toLowerCase(),
      });
    }
  }

  const manualPeriods = changes.filter((c) => c.mode === "manual").length;
  const automaticPeriods = changes.filter((c) => c.mode === "automatic").length;

  return { changes, manualPeriods, automaticPeriods };
}

// ---------------------------------------------------------------------------
// Remote connection
// ---------------------------------------------------------------------------

function buildRemoteConnection(events) {
  const reRemote = /Remote connection (0|1)/;
  const changes = [];

  for (const ev of events) {
    const m = ev.text.match(reRemote);
    if (m) {
      changes.push({
        tid: ev.tid,
        connected: m[1] === "1",
      });
    }
  }

  return { changes };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function buildSummary(events) {
  const byType = {};
  for (const t of ALL_TYPES) byType[t] = 0;

  let minDate = null;
  let maxDate = null;

  for (const ev of events) {
    inc(byType, ev.typ);
    if (!minDate || ev.tid < minDate) minDate = ev.tid;
    if (!maxDate || ev.tid > maxDate) maxDate = ev.tid;
  }

  const daysSpan = minDate && maxDate ? daysBetween(minDate, maxDate) : 0;

  return {
    total: events.length,
    byType,
    dateRange: { from: minDate, to: maxDate },
    daysSpan,
    eventsPerDay: daysSpan > 0 ? events.length / daysSpan : 0,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function analyzeEventLog(events) {
  if (!events || events.length === 0) {
    return {
      summary: {
        total: 0,
        byType: Object.fromEntries(ALL_TYPES.map((t) => [t, 0])),
        dateRange: { from: null, to: null },
        daysSpan: 0,
        eventsPerDay: 0,
      },
      sequences: {
        byId: {},
        timeline: [],
        totalCompletions: 0,
        avgMinutesPerCompletion: 0,
        avgValvesPerCompletion: 0,
      },
      alarms: {
        byType: { Kritiskt: [], Nödstopp: [], "Totalt stopp": [], Generellt: [] },
        bySeverity: SEVERITY_ORDER.map((typ) => ({ typ, count: 0, percentage: 0 })),
        timeline: [],
        topMessages: [],
      },
      componentHealth: {
        valves: [],
        separators: [],
        exhausters: [],
        containers: [],
      },
      timePatterns: {
        byHour: new Array(24).fill(0),
        byDayOfWeek: new Array(7).fill(0),
        heatmap: [],
        alarmsByHour: new Array(24).fill(0),
      },
      powerEvents: { count: 0, events: [], byDate: [] },
      operationMode: { changes: [], manualPeriods: 0, automaticPeriods: 0 },
      remoteConnection: { changes: [] },
    };
  }

  // Sort by time ascending for consistent processing
  const sorted = [...events].sort((a, b) => a.tid - b.tid);

  return {
    summary: buildSummary(sorted),
    sequences: buildSequences(sorted),
    alarms: buildAlarms(sorted),
    componentHealth: buildComponentHealth(sorted),
    timePatterns: buildTimePatterns(sorted),
    powerEvents: buildPowerEvents(sorted),
    operationMode: buildOperationMode(sorted),
    remoteConnection: buildRemoteConnection(sorted),
  };
}
