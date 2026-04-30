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
// Alarm response times (fjärr-responstid)
// ---------------------------------------------------------------------------

const ID_EXTRACTORS = [
  { label: 'DV', re: /\bDV (\d+:\d+(?::\d+)?)\b/ },
  { label: 'SE', re: /\bSE (\d+)\b/ },
  { label: 'Exhauster', re: /\b[Ee]xhauster (\d+)\b/ },
  { label: 'Container', re: /\bContainer (\d+)\b/i },
  { label: 'Sequence', re: /\bSequence (\d+)\b/ },
  { label: 'SCT', re: /\bSCT (\d+:\d+)\b/ },
  { label: 'PDVE', re: /\bPDVE (\d+)\b/ },
]

function extractIdentifier(text) {
  for (const { label, re } of ID_EXTRACTORS) {
    const m = text.match(re)
    if (m) return `${label} ${m[1]}`
  }
  return null
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0
  const idx = (sortedArr.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedArr[lo]
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo)
}

function median(sortedArr) {
  return percentile(sortedArr, 0.5)
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// Maximum window between an alarm and a follow-up event (login/manual/reset)
// to count as a response. 7 days = 604800 s.
const RESPONSE_WINDOW_SECONDS = 7 * 24 * 3600

// Follow-up text patterns. The CSV reports "remote login" as
// "Remote connection 1 (0=off, 1=on)" and "manual mode" as
// "Change to manual operation mode".
const RE_REMOTE_LOGIN = /remote\s+connection\s*1\b/i
const RE_MANUAL_MODE = /change\s+to\s+manual\s+operation\s+mode/i
const RE_ALARM_RESET = /^alarm reset/i

const FOLLOWUP_KINDS = ['engagement', 'login', 'manual', 'reset']

const FOLLOWUP_LABELS = {
  engagement: 'Engagemang',
  login: 'Login',
  manual: 'Manual',
  reset: 'Reset',
}

function isFollowupText(text) {
  return (
    RE_REMOTE_LOGIN.test(text) ||
    RE_MANUAL_MODE.test(text) ||
    RE_ALARM_RESET.test(text)
  )
}

function emptyKindStats() {
  return {
    count: 0,
    medianSeconds: 0,
    p50Seconds: 0,
    p75Seconds: 0,
    p90Seconds: 0,
    p95Seconds: 0,
    meanSeconds: null,
    stddevSeconds: null,
  }
}

function meanOf(arr) {
  if (!arr || arr.length === 0) return null
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

function stddevOf(arr, mean) {
  if (!arr || arr.length < 2) return null
  let s = 0
  for (const v of arr) {
    const d = v - mean
    s += d * d
  }
  return Math.sqrt(s / (arr.length - 1))
}

function statsFromArray(arr) {
  if (!arr || arr.length === 0) return emptyKindStats()
  const sorted = [...arr].sort((a, b) => a - b)
  const mean = meanOf(sorted)
  const stddev = stddevOf(sorted, mean)
  return {
    count: sorted.length,
    medianSeconds: median(sorted),
    p50Seconds: percentile(sorted, 0.5),
    p75Seconds: percentile(sorted, 0.75),
    p90Seconds: percentile(sorted, 0.9),
    p95Seconds: percentile(sorted, 0.95),
    meanSeconds: mean,
    stddevSeconds: stddev,
  }
}

function emptyResponseTimes() {
  const overall = Object.fromEntries(FOLLOWUP_KINDS.map((k) => [k, emptyKindStats()]))
  return {
    pairs: [],
    matchedCount: 0,
    unmatchedCount: 0,
    totalAlarms: 0,
    totalResets: 0,
    totalLogins: 0,
    totalManualSwitches: 0,
    matchCounts: { engagement: 0, login: 0, manual: 0, reset: 0 },
    overall,
    overallMedianSeconds: 0,
    perType: [],
    longest: [],
    alarmLog: [],
    flaggedCount: 0,
    timeline: [],
    timelineGranularity: 'day',
    unmatchedRatio: 0,
    warning: null,
    followupLabels: FOLLOWUP_LABELS,
    windowSeconds: RESPONSE_WINDOW_SECONDS,
  }
}

/**
 * Find first index in sorted array of Date objects whose value is >= t.
 * Returns null if none.
 */
function firstAfter(arr, t) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid].getTime() < t.getTime()) lo = mid + 1
    else hi = mid
  }
  return lo < arr.length ? arr[lo] : null
}

/**
 * Build remote-response-time analysis. For each alarm we look for the FIRST
 * follow-up event of each kind within RESPONSE_WINDOW_SECONDS after the alarm:
 *   * login — "Remote connection 1" (operator goes online)
 *   * manual — "Change to manual operation mode" (operator takes manual control)
 *   * reset — "Alarm reset" (alarm acknowledged / cleared)
 *   * engagement — earliest of login/manual/reset (whatever the operator did first)
 *
 * Every kind is reported separately (median/p75/p90/p95) plus a per-type
 * breakdown by alarm severity.
 */
export function buildAlarmResponseTimes(events) {
  if (!events || events.length === 0) return emptyResponseTimes()

  // Separate follow-up events from real alarms. The follow-up rows
  // ("Remote connection 1", "Change to manual operation mode", "Alarm reset")
  // are reported with typ = Information / Generellt and must be detected
  // regardless of typ. Real alarms are non-Information rows that don't match
  // any follow-up pattern.
  const alarms = []
  const logins = []
  const manuals = []
  const resets = []
  for (const ev of events) {
    if (RE_ALARM_RESET.test(ev.text)) {
      resets.push(ev)
      continue
    }
    if (RE_REMOTE_LOGIN.test(ev.text)) {
      logins.push(ev)
      continue
    }
    if (RE_MANUAL_MODE.test(ev.text)) {
      manuals.push(ev)
      continue
    }
    if (ev.typ === 'Information') continue
    alarms.push(ev)
  }

  if (alarms.length === 0) {
    return {
      ...emptyResponseTimes(),
      totalAlarms: 0,
      totalResets: resets.length,
      totalLogins: logins.length,
      totalManualSwitches: manuals.length,
    }
  }

  alarms.sort((a, b) => a.tid - b.tid)
  const loginTimes = logins.map((e) => e.tid).sort((a, b) => a - b)
  const manualTimes = manuals.map((e) => e.tid).sort((a, b) => a - b)
  const resetTimes = resets.map((e) => e.tid).sort((a, b) => a - b)

  const pairs = []
  for (const alarm of alarms) {
    const t = alarm.tid
    const cap = t.getTime() + RESPONSE_WINDOW_SECONDS * 1000

    const within = (cand) =>
      cand && cand.getTime() <= cap ? cand : null

    const loginAt = within(firstAfter(loginTimes, t))
    const manualAt = within(firstAfter(manualTimes, t))
    const resetAt = within(firstAfter(resetTimes, t))

    const candidates = [loginAt, manualAt, resetAt].filter(Boolean)
    const engagementAt =
      candidates.length > 0
        ? new Date(Math.min(...candidates.map((d) => d.getTime())))
        : null

    const secondsTo = (d) =>
      d ? (d.getTime() - t.getTime()) / 1000 : null

    pairs.push({
      alarmTid: alarm.tid,
      typ: alarm.typ,
      text: alarm.text,
      identifier: extractIdentifier(alarm.text),
      loginAt,
      manualAt,
      resetAt,
      engagementAt,
      loginSeconds: secondsTo(loginAt),
      manualSeconds: secondsTo(manualAt),
      resetSeconds: secondsTo(resetAt),
      engagementSeconds: secondsTo(engagementAt),
    })
  }

  // Aggregate per kind across all alarms.
  const collect = (key) => pairs.map((p) => p[key]).filter((v) => v != null)
  const engagementVals = collect('engagementSeconds')
  const loginVals = collect('loginSeconds')
  const manualVals = collect('manualSeconds')
  const resetVals = collect('resetSeconds')

  const overall = {
    engagement: statsFromArray(engagementVals),
    login: statsFromArray(loginVals),
    manual: statsFromArray(manualVals),
    reset: statsFromArray(resetVals),
  }

  const matchCounts = {
    engagement: engagementVals.length,
    login: loginVals.length,
    manual: manualVals.length,
    reset: resetVals.length,
  }

  // Per type stats.
  const perTypeMap = {}
  for (const p of pairs) {
    if (!perTypeMap[p.typ]) {
      perTypeMap[p.typ] = {
        engagement: [],
        login: [],
        manual: [],
        reset: [],
        count: 0,
      }
    }
    const slot = perTypeMap[p.typ]
    slot.count++
    if (p.engagementSeconds != null) slot.engagement.push(p.engagementSeconds)
    if (p.loginSeconds != null) slot.login.push(p.loginSeconds)
    if (p.manualSeconds != null) slot.manual.push(p.manualSeconds)
    if (p.resetSeconds != null) slot.reset.push(p.resetSeconds)
  }
  const perType = Object.entries(perTypeMap).map(([typ, slot]) => ({
    typ,
    count: slot.count,
    engagement: statsFromArray(slot.engagement),
    login: statsFromArray(slot.login),
    manual: statsFromArray(slot.manual),
    reset: statsFromArray(slot.reset),
    // Backwards-compatible flat fields (pre-existing UI consumers used these).
    medianSeconds: slot.engagement.length
      ? median([...slot.engagement].sort((a, b) => a - b))
      : 0,
    p50Seconds: slot.engagement.length
      ? percentile([...slot.engagement].sort((a, b) => a - b), 0.5)
      : 0,
    p75Seconds: slot.engagement.length
      ? percentile([...slot.engagement].sort((a, b) => a - b), 0.75)
      : 0,
    p90Seconds: slot.engagement.length
      ? percentile([...slot.engagement].sort((a, b) => a - b), 0.9)
      : 0,
    p95Seconds: slot.engagement.length
      ? percentile([...slot.engagement].sort((a, b) => a - b), 0.95)
      : 0,
  }))
  perType.sort((a, b) => {
    const ia = SEVERITY_ORDER.indexOf(a.typ)
    const ib = SEVERITY_ORDER.indexOf(b.typ)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  // Top-10 longest by engagement time (fallback to reset if engagement missing)
  const sortableSeconds = (p) =>
    p.engagementSeconds != null ? p.engagementSeconds : (p.resetSeconds ?? -1)
  const longest = [...pairs]
    .filter((p) => p.engagementSeconds != null || p.resetSeconds != null)
    .sort((a, b) => sortableSeconds(b) - sortableSeconds(a))
    .slice(0, 10)
    .map((p) => ({
      tid: p.alarmTid,
      typ: p.typ,
      text: p.text,
      identifier: p.identifier,
      engagementSeconds: p.engagementSeconds,
      loginSeconds: p.loginSeconds,
      manualSeconds: p.manualSeconds,
      resetSeconds: p.resetSeconds,
      // Backwards-compat — some older UI uses .seconds (engagement preferred).
      seconds: p.engagementSeconds ?? p.resetSeconds,
      minutes:
        (p.engagementSeconds ?? p.resetSeconds ?? 0) / 60,
      hours: (p.engagementSeconds ?? p.resetSeconds ?? 0) / 3600,
    }))

  // Time trend per kind: median seconds per day or week.
  const allDayKeys = new Set()
  const dailyByKind = { engagement: {}, login: {}, manual: {}, reset: {} }
  for (const p of pairs) {
    const dk = toDateKey(p.alarmTid)
    allDayKeys.add(dk)
    for (const kind of ['engagement', 'login', 'manual', 'reset']) {
      const v = p[`${kind}Seconds`]
      if (v == null) continue
      if (!dailyByKind[kind][dk]) dailyByKind[kind][dk] = []
      dailyByKind[kind][dk].push(v)
    }
  }
  const dailyKeys = Array.from(allDayKeys).sort()

  let timelineGranularity = 'day'
  let timeline

  function buildTimelineFromBucket(byKind) {
    const allKeys = new Set()
    for (const kind of FOLLOWUP_KINDS)
      for (const k of Object.keys(byKind[kind] || {})) allKeys.add(k)
    const keys = Array.from(allKeys).sort()
    return keys.map((period) => {
      const row = { period }
      for (const kind of FOLLOWUP_KINDS) {
        const arr = byKind[kind][period]
        if (arr && arr.length) {
          const sorted = [...arr].sort((a, b) => a - b)
          const med = median(sorted)
          row[`${kind}MedianSeconds`] = med
          row[`${kind}MedianMinutes`] = med / 60
          row[`${kind}Count`] = arr.length
        } else {
          row[`${kind}MedianSeconds`] = null
          row[`${kind}MedianMinutes`] = null
          row[`${kind}Count`] = 0
        }
      }
      // Backwards-compat for any old chart code using d.medianMinutes/medianSeconds.
      row.medianSeconds = row.engagementMedianSeconds ?? row.resetMedianSeconds ?? null
      row.medianMinutes = row.engagementMedianMinutes ?? row.resetMedianMinutes ?? null
      row.count = row.engagementCount || row.resetCount || 0
      return row
    })
  }

  if (dailyKeys.length > 60) {
    timelineGranularity = 'week'
    const weeklyByKind = { engagement: {}, login: {}, manual: {}, reset: {} }
    for (const p of pairs) {
      const wk = isoWeek(p.alarmTid)
      for (const kind of ['engagement', 'login', 'manual', 'reset']) {
        const v = p[`${kind}Seconds`]
        if (v == null) continue
        if (!weeklyByKind[kind][wk]) weeklyByKind[kind][wk] = []
        weeklyByKind[kind][wk].push(v)
      }
    }
    timeline = buildTimelineFromBucket(weeklyByKind)
  } else {
    timeline = buildTimelineFromBucket(dailyByKind)
  }

  // Per-alarm log with flagging for outliers.
  // Threshold per kind = max(p90, mean + 2*stddev). Flagging skipped if total alarms < 10.
  const flagThresholds = {}
  for (const kind of FOLLOWUP_KINDS) {
    const stats = overall[kind]
    const candidates = []
    if (stats?.p90Seconds != null && stats.count >= 1) candidates.push(stats.p90Seconds)
    if (stats?.meanSeconds != null && stats?.stddevSeconds != null) {
      candidates.push(stats.meanSeconds + 2 * stats.stddevSeconds)
    }
    flagThresholds[kind] = candidates.length > 0 ? Math.max(...candidates) : null
  }
  const flagsEnabled = alarms.length >= 10
  let flaggedCount = 0
  const alarmLog = pairs.map((p) => {
    const flags = { engagement: false, login: false, manual: false, reset: false }
    if (flagsEnabled) {
      for (const kind of FOLLOWUP_KINDS) {
        const v = p[`${kind}Seconds`]
        const t = flagThresholds[kind]
        if (v != null && t != null && v > t) flags[kind] = true
      }
    }
    const anyFlag = flags.engagement || flags.login || flags.manual || flags.reset
    if (anyFlag) flaggedCount++
    return {
      tid: p.alarmTid,
      typ: p.typ,
      text: p.text,
      identifier: p.identifier,
      engagementSeconds: p.engagementSeconds,
      loginSeconds: p.loginSeconds,
      manualSeconds: p.manualSeconds,
      resetSeconds: p.resetSeconds,
      flags,
      flagged: anyFlag,
    }
  })
  alarmLog.sort((a, b) => {
    const av = a.engagementSeconds ?? -1
    const bv = b.engagementSeconds ?? -1
    return bv - av
  })

  // "Unmatched" = alarms with no engagement (no login/manual/reset within window).
  const matchedCount = engagementVals.length
  const unmatched = alarms.length - matchedCount
  const unmatchedRatio = alarms.length > 0 ? unmatched / alarms.length : 0

  // Warning logic — engagement is the primary metric; if any kind has <30%
  // match we surface that.
  const lowMatchKinds = []
  for (const kind of FOLLOWUP_KINDS) {
    const ratio = matchCounts[kind] / Math.max(alarms.length, 1)
    if (ratio < 0.3) lowMatchKinds.push({ kind, ratio })
  }
  let warning = null
  if (matchedCount === 0) {
    warning =
      'Inga uppföljande operatörshändelser (login, manual mode, Alarm reset) hittades — responstid kan ej beräknas.'
  } else if (matchedCount < 10) {
    warning =
      'Få matchade larm (<10). Statistiken är osäker — tolka med försiktighet.'
  } else if (unmatchedRatio > 0.3) {
    warning = `${Math.round(unmatchedRatio * 100)} % av larmen saknar uppföljande engagemang. Matchningen är osäker.`
  } else if (lowMatchKinds.length > 0) {
    const labels = lowMatchKinds
      .map(({ kind, ratio }) => `${FOLLOWUP_LABELS[kind]} (${Math.round(ratio * 100)}%)`)
      .join(', ')
    warning = `Låg matchningsgrad (<30 %) för: ${labels}. Tolka dessa median-värden med försiktighet.`
  }

  return {
    pairs,
    matchedCount,
    unmatchedCount: unmatched,
    totalAlarms: alarms.length,
    totalResets: resets.length,
    totalLogins: logins.length,
    totalManualSwitches: manuals.length,
    matchCounts,
    overall,
    overallMedianSeconds: overall.engagement.medianSeconds,
    perType,
    longest,
    alarmLog,
    flaggedCount,
    timeline,
    timelineGranularity,
    unmatchedRatio,
    warning,
    followupLabels: FOLLOWUP_LABELS,
    windowSeconds: RESPONSE_WINDOW_SECONDS,
  }
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
      responseTimes: emptyResponseTimes(),
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
    responseTimes: buildAlarmResponseTimes(sorted),
  };
}
