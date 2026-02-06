/**
 * Port of scripts/rekommendationer.py
 * Rule-based recommendation engine with thresholds
 */

const TILLG_KRITISK = 95.0
const TILLG_VARNING = 98.0
const FEL_HOG = 50
const GREN_HALSA_KRITISK = 70

function makeRec(prio, kategori, mal, rekommendation, dataunderlag, forvantadEffekt, atgarder) {
  return { prioritet: prio, kategori, mal, rekommendation, dataunderlag, forvantadEffekt, atgarder }
}

export function generateRekommendationer(trendanalys, ventiler, larm) {
  const recs = []

  // ---- Maintenance recommendations ----
  generateMaintenanceRecs(recs, trendanalys, ventiler)

  // ---- Energy recommendations ----
  generateEnergyRecs(recs, trendanalys)

  // ---- Alarm recommendations ----
  generateAlarmRecs(recs, trendanalys, larm)

  // ---- Branch recommendations ----
  generateBranchRecs(recs, trendanalys)

  recs.sort((a, b) => a.prioritet - b.prioritet)

  // ---- Strategic goals ----
  const goals = generateStrategicGoals(trendanalys, ventiler)

  // ---- Operator agenda ----
  const agenda = generateOperatorAgenda(recs, goals, trendanalys, ventiler)

  return { recommendations: recs, goals, agenda }
}

function generateMaintenanceRecs(recs, trendanalys, ventiler) {
  if (!ventiler?.valveSummary?.length) return

  // Compute per-valve average + trend
  const valveData = ventiler.valveSummary.map(v => ({
    ...v,
    trend: trendanalys.trendsPerValve[v.valveId]?.trendClass || '?',
  }))

  // Prio 1: Critical availability or declining trend
  const critical = valveData.filter(v =>
    v.avgAvailability < TILLG_KRITISK ||
    (v.trend === 'minskande' && v.avgAvailability < TILLG_VARNING)
  )
  if (critical.length > 0) {
    const top = critical.sort((a, b) => a.avgAvailability - b.avgAvailability).slice(0, 10)
    const details = top.map(v => `${v.valveId} (${v.avgAvailability.toFixed(1)}%)`).join(', ')
    recs.push(makeRec(
      1, 'Underhåll', 'Ventiler med kritisk tillgänglighet',
      `Akut underhåll krävs för ${critical.length} ventiler med tillgänglighet under ${TILLG_KRITISK}% eller nedåttrend under ${TILLG_VARNING}%.`,
      `Sämsta: ${details}`,
      'Höjd tillgänglighet till >98% för berörda ventiler inom 1 månad',
      ['Inspektera mekanisk funktion för varje listad ventil', 'Kontrollera ventildon och givare', 'Planera byte av slitdelar vid behov', 'Installera ökat övervakningsintervall under åtgärdsperioden'],
    ))
  }

  // Prio 2: Warning range
  const criticalIds = new Set(critical.map(v => v.valveId))
  const warning = valveData.filter(v =>
    !criticalIds.has(v.valveId) &&
    ((v.avgAvailability >= TILLG_KRITISK && v.avgAvailability < TILLG_VARNING) || v.totalErrors > FEL_HOG)
  )
  if (warning.length > 0) {
    recs.push(makeRec(
      2, 'Underhåll', 'Ventiler under bevakning',
      `${warning.length} ventiler med tillgänglighet ${TILLG_KRITISK}–${TILLG_VARNING}% eller mer än ${FEL_HOG} årsfel kräver förstärkta kontroller.`,
      `Antal: ${warning.length} ventiler`,
      'Förhindra att dessa ventiler går över till kritisk status',
      ['Lägg till i förstärkt underhållsschema (månatlig kontroll)', 'Analysera felkodsmönster för att identifiera rotorsak', 'Övervakning: om tillgänglighet sjunker 2 procentenheter → eskalera'],
    ))
  }

  // Prio 3: Fragile perfect valves
  const fragile = valveData.filter(v => v.avgAvailability >= 99.9 && v.totalErrors > 20)
  if (fragile.length > 0) {
    recs.push(makeRec(
      3, 'Underhåll', 'Bräckliga ventiler (hög tillgänglighet men många fel)',
      `${fragile.length} ventiler har 100% tillgänglighet men över 20 årsfel. Dessa kan snabbt gå från perfekt till kritisk.`,
      `Antal: ${fragile.length} ventiler med dold riskprofil`,
      'Proaktiv identifiering av potentiella framtida problem',
      ['Granska felloggar för att förstå felmönster', 'Övervakning: om fel ökar >50% nästa månad → eskalera', 'Planera förebyggande underhåll under låginblandningstider'],
    ))
  }
}

function generateEnergyRecs(recs, trendanalys) {
  const fd = trendanalys.facilityData
  if (!fd?.length) return

  const kwhPerEmpty = fd.map(d => d.kwhPerEmptying)
  if (trendanalys.facilityTrends.kwh_per_tömning?.trendClass === 'ökande') {
    recs.push(makeRec(
      2, 'Energi', 'Ökande kWh per tömning',
      'Energieffektiviteten försämras — kWh per tömning ökar över året.',
      `kWh/tömning: ${fd[0].kwhPerEmptying.toFixed(2)} (jan) → ${fd[fd.length - 1].kwhPerEmptying.toFixed(2)} (dec)`,
      'Stabilisera eller minska kWh per tömning',
      ['Utred orsak till ökad energiförbrukning per tömning', 'Kontrollera vakuumsystemets täthet', 'Övervakning: installera månatlig kWh/tömning-KPI'],
    ))
  }

  const best = Math.min(...kwhPerEmpty)
  const worst = Math.max(...kwhPerEmpty)
  if (best > 0 && worst > best * 1.2) {
    const savingPct = ((worst - best) / worst * 100).toFixed(0)
    recs.push(makeRec(
      3, 'Energi', 'Energibesparingspotential',
      `Spridning på ${savingPct}% mellan bästa och sämsta månads kWh/tömning indikerar optimeringspotential.`,
      `Bästa: ${best.toFixed(2)}, sämsta: ${worst.toFixed(2)} kWh/tömning`,
      `Minska energiförbrukningen med upp till ${savingPct}% genom konsekvent optimering`,
      ['Identifiera vad som skiljer effektiva månader från ineffektiva', 'Undersökning: drifttid, temperatur, fyllnadsgrad som påverkande faktorer', 'Mål: alla månader inom 10% av bästa månads effektivitet'],
    ))
  }

  if (trendanalys.facilityTrends.energi?.trendClass === 'minskande') {
    recs.push(makeRec(
      4, 'Energi', 'Positiv energitrend',
      'Energiförbrukningen visar en minskande trend under året — positivt.',
      `Jan: ${Math.round(fd[0].energyKwh).toLocaleString()} kWh → Dec: ${Math.round(fd[fd.length - 1].energyKwh).toLocaleString()} kWh`,
      'Bibehåll eller förstärk den positiva trenden',
      ['Dokumentera åtgärder som bidragit till minskningen', 'Använd som benchmark för nästa år'],
    ))
  }
}

function generateAlarmRecs(recs, trendanalys, larm) {
  // Alarm anomalies
  const alarmAnomalies = trendanalys.anomalies.filter(a => a.target === 'larm_månad' && a.type === 'hög')
  for (const a of alarmAnomalies) {
    recs.push(makeRec(
      1, 'Larm', `Larmanomali: ${a.label}`,
      `Månaden ${a.label} hade anomalt höga larm (${Math.round(a.value)}, z-score ${a.zScore.toFixed(1)}).`,
      `Värde: ${Math.round(a.value)}, z-score: ${a.zScore.toFixed(1)}`,
      'Identifiera och eliminera orsaken till larmspiken',
      ['Utred specifika larmkategorier för den aktuella månaden', 'Kontrollera om systemfel, uppgradering eller extern händelse förklarar spiken', 'Installera larmtrösklar för tidig varning vid liknande spikar'],
    ))
  }

  if (trendanalys.facilityTrends.larm?.trendClass === 'ökande') {
    recs.push(makeRec(
      2, 'Larm', 'Ökande larmtrend',
      'Larmen visar en ökande trend. Utred orsak för att undvika eskalering.',
      `Trend: ökande`,
      'Minska larmfrekvensen till föregående års nivå',
      ['Identifiera mest frekventa larmkategorier', 'Åtgärdsprogram per kategori', 'Mål: återvänd till föregående års snittnivå inom 6 månader'],
    ))
  }
}

function generateBranchRecs(recs, trendanalys) {
  const ba = trendanalys.branchAnalysis
  if (!ba?.length) return

  const critical = ba.filter(b => b.healthScore < GREN_HALSA_KRITISK)
  if (critical.length > 0) {
    const details = critical.map(b => `Gren ${b.branch} (${Math.round(b.healthScore)}p)`).join(', ')
    recs.push(makeRec(
      1, 'Infrastruktur', 'Grenar med kritisk hälsopoäng',
      `${critical.length} grenar har hälsopoäng under ${GREN_HALSA_KRITISK}.`,
      details,
      'Höja hälsopoäng för alla grenar över 70 inom 6 månader',
      ['Genomför grenspecifik inspektion (rör, ventiler, anslutningar)', 'Prioritera ventilbyte/underhåll inom dessa grenar', 'Utvärdera om redesign behövs för grenar med systematiskt låga poäng'],
    ))
  }

  const best3 = [...ba].sort((a, b) => b.healthScore - a.healthScore).slice(0, 3)
  if (best3.length > 0) {
    const benchmarkAvail = avg(best3.map(b => b.avgAvailability))
    recs.push(makeRec(
      4, 'Infrastruktur', 'Modellgrenar som benchmark',
      `De 3 bästa grenarna har medeltillgänglighet ${benchmarkAvail.toFixed(1)}%. Använd som målstandard för övriga.`,
      `Topp-3: ${best3.map(b => `Gren ${b.branch}`).join(', ')}`,
      'Sprid framgångsrika metoder till svagare grenar',
      ['Dokumentera underhållsrutiner för modellgrenar', 'Jämför konfiguration, ålder och underhållshistorik'],
    ))
  }
}

function generateStrategicGoals(trendanalys, ventiler) {
  const goals = []
  const vs = ventiler?.valveSummary
  const ba = trendanalys?.branchAnalysis
  const fd = trendanalys?.facilityData

  if (vs?.length) {
    const currentAvg = avg(vs.map(v => v.avgAvailability))
    goals.push({
      kpi: 'Medeltillgänglighet',
      current: `${currentAvg.toFixed(1)}%`,
      target3m: `${Math.min(currentAvg + 0.3, 100).toFixed(1)}%`,
      target6m: `${Math.min(currentAvg + 0.5, 100).toFixed(1)}%`,
      target12m: `${Math.min(currentAvg + 1.0, 100).toFixed(1)}%`,
      strategy: 'Fokusera på sämsta ventilerna först — större marginaleffekt',
    })

    const over98pct = vs.filter(v => v.avgAvailability >= 98).length / vs.length * 100
    goals.push({
      kpi: 'Andel ventiler över 98%',
      current: `${Math.round(over98pct)}%`,
      target3m: `${Math.min(Math.round(over98pct) + 2, 100)}%`,
      target6m: `${Math.min(Math.round(over98pct) + 5, 100)}%`,
      target12m: `${Math.min(Math.round(over98pct) + 10, 100)}%`,
      strategy: 'Lyft ventiler från 95–98% till över 98%',
    })

    const totalErrors = vs.reduce((s, v) => s + v.totalErrors, 0)
    goals.push({
      kpi: 'Totala ventilfel/år',
      current: totalErrors.toLocaleString(),
      target3m: '-10%',
      target6m: '-25%',
      target12m: '-40%',
      strategy: 'LONG_TIME_SINCE_LAST_COLLECTION är dominerande — optimera tömningsintervall',
    })
  }

  if (fd?.length) {
    const kwhPerE = fd.map(d => d.kwhPerEmptying)
    const current = avg(kwhPerE)
    const best = Math.min(...kwhPerE)
    goals.push({
      kpi: 'kWh per tömning (årsmedel)',
      current: current.toFixed(2),
      target3m: (current * 0.95).toFixed(2),
      target6m: (current * 0.90).toFixed(2),
      target12m: `${best.toFixed(2)} (bästa månadens nivå)`,
      strategy: 'Identifiera och replikera förhållanden från bästa månaden',
    })
  }

  if (ba?.length) {
    const perfect = ba.filter(b => b.avgAvailability >= 99.5).length
    const total = ba.length
    goals.push({
      kpi: 'Grenar med >99.5% tillgänglighet',
      current: `${perfect}/${total}`,
      target3m: `${Math.min(perfect + 2, total)}/${total}`,
      target6m: `${Math.min(perfect + 5, total)}/${total}`,
      target12m: `${Math.min(perfect + 8, total)}/${total}`,
      strategy: 'Rikta insatser mot grenar som är nära 99.5%-gränsen',
    })
  }

  return goals
}

function generateOperatorAgenda(recs, goals, trendanalys, ventiler) {
  const fd = trendanalys?.facilityData
  const prio1 = recs.filter(r => r.prioritet === 1)
  const prio23 = recs.filter(r => r.prioritet === 2 || r.prioritet === 3)

  return {
    facilityStatus: fd ? {
      totalKwh: Math.round(fd.reduce((s, d) => s + d.energyKwh, 0)),
      totalEmptyings: fd.reduce((s, d) => s + d.emptyings, 0),
      avgKwhPerEmptying: avg(fd.map(d => d.kwhPerEmptying)).toFixed(2),
      avgAvailability: ventiler?.overallAvail?.toFixed(1) || '?',
      totalErrors: ventiler?.totalErrors || 0,
    } : null,
    urgentActions: prio1,
    plannedImprovements: prio23,
    goals,
  }
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
