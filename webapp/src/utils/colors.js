// Semantic colors per analysis category
export const CATEGORY_COLORS = {
  energi: '#eab308',      // yellow-500
  ventiler: '#3b82f6',    // blue-500
  larm: '#ef4444',        // red-500
  fraktioner: '#06b6d4',  // cyan-500
  grenar: '#f97316',      // orange-500
  manuell: '#a855f7',     // purple-500
  trend: '#10b981',       // emerald-500
}

export const FRACTION_COLORS = [
  '#06b6d4', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f97316',
  '#ef4444', '#ec4899', '#a855f7', '#6366f1',
]

export const ERROR_COLORS = {
  DOES_NOT_CLOSE: '#ef4444',
  DOES_NOT_OPEN: '#f97316',
  LEVEL_ERROR: '#eab308',
  LONG_TIME_SINCE_LAST_COLLECTION: '#3b82f6',
  ERROR_FEEDBACK_FROM_USER: '#a855f7',
}

// Swedish translations for error type names
export const ERROR_NAMES_SV = {
  DOES_NOT_CLOSE: 'Stänger ej',
  DOES_NOT_OPEN: 'Öppnar ej',
  LEVEL_ERROR: 'Nivåfel',
  LONG_TIME_SINCE_LAST_COLLECTION: 'Ej tömd länge',
  ERROR_FEEDBACK_FROM_USER: 'Användarfel',
}

// Swedish translations for Sheet1 KPI labels
export const KPI_NAMES_SV = {
  // Fullständiga etiketter från rapporter (prioriteras)
  'Inlets (no of DV\'s)': 'Antal inkast',
  'Branches (no of AV\'s)': 'Antal grenar',
  'Sections (no of SE\'s)': 'Antal sektioner',
  'In Operation Since': 'I drift sedan',
  'Longest suction distance': 'Längsta sugsträcka',
  'Pipe diameter': 'Rördiameter',
  'No of exhausters': 'Antal fläktar',
  'No of separators': 'Antal separatorer',
  'EAP version': 'EAP-version',
  'No of apartments': 'Antal lägenheter',
  'Number of apartments': 'Antal lägenheter',

  // Varianter med/utan apostrof
  "Inlets (no of DV's)": 'Antal inkast',
  "Branches (no of AV's)": 'Antal grenar',
  "Sections (no of SE's)": 'Antal sektioner',
  'Inlets (no of DVs)': 'Antal inkast',
  'Branches (no of AVs)': 'Antal grenar',
  'Sections (no of SEs)': 'Antal sektioner',

  // Antal/Number
  'No of inlets': 'Antal inkast',
  'Number of inlets': 'Antal inkast',
  'No of valves': 'Antal ventiler',
  'Number of valves': 'Antal ventiler',
  'No of branches': 'Antal grenar',
  'Number of branches': 'Antal grenar',
  'No of fractions': 'Antal fraktioner',
  'Number of fractions': 'Antal fraktioner',
  'No of transports': 'Antal transporter',
  'Number of transports': 'Antal transporter',
  'No of collections': 'Antal tömningar',
  'Number of collections': 'Antal tömningar',
  'No of cyclones': 'Antal cykloner',
  'No of containers': 'Antal behållare',
  'No of fans': 'Antal fläktar',
  'No of pumps': 'Antal pumpar',
  'No of compressors': 'Antal kompressorer',
  'No of sections': 'Antal sektioner',

  // Energi
  'Total energy': 'Total energi',
  'Energy consumption': 'Energiförbrukning',
  'Energy': 'Energi',
  'Energy [kWh]': 'Energi [kWh]',
  'Total Energy [kWh]': 'Total energi [kWh]',
  'Energy per collection': 'Energi per tömning',
  'kWh per collection': 'kWh per tömning',
  'kWh/collection': 'kWh/tömning',

  // Vikt
  'Total weight': 'Total vikt',
  'Weight': 'Vikt',
  'Total Weight [ton]': 'Total vikt [ton]',
  'Weight [ton]': 'Vikt [ton]',
  'Weight per collection': 'Vikt per tömning',
  'Kg per collection': 'Kg per tömning',

  // Tid
  'Operation time': 'Drifttid',
  'Operating time': 'Drifttid',
  'Operation Time [h]': 'Drifttid [h]',
  'Total operation time': 'Total drifttid',
  'Run time': 'Körtid',
  'Running time': 'Körtid',
  'Idle time': 'Vilotid',
  'Downtime': 'Stilleståndstid',

  // Vakuum
  'Vacuum level': 'Vakuumnivå',
  'Average vacuum': 'Genomsnittligt vakuum',
  'Max vacuum': 'Max vakuum',
  'Min vacuum': 'Min vakuum',
  'Vacuum [kPa]': 'Vakuum [kPa]',
  'Set vacuum': 'Inställt vakuum',
  'Vacuum pressure': 'Vakuumtryck',

  // Tömningar
  'Collection cycles': 'Tömningscykler',
  'Emptyings': 'Tömningar',
  'Total emptyings': 'Totala tömningar',
  'Collections': 'Tömningar',
  'Total collections': 'Totala tömningar',
  'Emptying': 'Tömning',
  'Collection': 'Tömning',
  'Emptyings per day': 'Tömningar per dag',
  'Collections per day': 'Tömningar per dag',

  // Tillgänglighet
  'Availability': 'Tillgänglighet',
  'System availability': 'Systemtillgänglighet',
  'Availability [%]': 'Tillgänglighet [%]',
  'Average availability': 'Genomsnittlig tillgänglighet',
  'Uptime': 'Drifttid',

  // Larm
  'Alarms': 'Larm',
  'Total alarms': 'Totala larm',
  'Alarm count': 'Antal larm',
  'Active alarms': 'Aktiva larm',
  'Alarm': 'Larm',

  // Fraktioner
  'Fraction': 'Fraktion',
  'Fractions': 'Fraktioner',
  'Residual waste': 'Restavfall',
  'Food waste': 'Matavfall',
  'Paper': 'Papper',
  'Cardboard': 'Kartong',
  'Plastic': 'Plast',
  'Glass': 'Glas',
  'Metal': 'Metall',
  'Mixed waste': 'Blandat avfall',
  'Organic waste': 'Organiskt avfall',

  // Utrustning
  'Fan': 'Fläkt',
  'Fans': 'Fläktar',
  'Pump': 'Pump',
  'Pumps': 'Pumpar',
  'Cyclone': 'Cyklon',
  'Cyclones': 'Cykloner',
  'Container': 'Behållare',
  'Containers': 'Behållare',
  'Compressor': 'Kompressor',
  'Compressors': 'Kompressorer',
  'Terminal': 'Terminal',
  'Terminals': 'Terminaler',
  'Valve': 'Ventil',
  'Valves': 'Ventiler',
  'Inlet': 'Inkast',
  'Inlets': 'Inkast',

  // Status
  'Status': 'Status',
  'System status': 'Systemstatus',
  'Current status': 'Aktuell status',
  'Active': 'Aktiv',
  'Inactive': 'Inaktiv',
  'Running': 'Igång',
  'Stopped': 'Stoppad',
  'Error': 'Fel',
  'Warning': 'Varning',
  'OK': 'OK',
  'Normal': 'Normal',

  // Tid/Datum
  'Period': 'Period',
  'Month': 'Månad',
  'Year': 'År',
  'Date': 'Datum',
  'Time': 'Tid',
  'Start date': 'Startdatum',
  'End date': 'Slutdatum',
  'Start time': 'Starttid',
  'End time': 'Sluttid',
  'Duration': 'Varaktighet',
  'Hours': 'Timmar',
  'Minutes': 'Minuter',
  'Seconds': 'Sekunder',
  'Days': 'Dagar',

  // Övrigt
  'Name': 'Namn',
  'Description': 'Beskrivning',
  'Type': 'Typ',
  'ID': 'ID',
  'Info': 'Info',
  'Comment': 'Kommentar',
  'Comments': 'Kommentarer',
  'Note': 'Notering',
  'Notes': 'Noteringar',
  'Total': 'Totalt',
  'Average': 'Genomsnitt',
  'Mean': 'Medelvärde',
  'Min': 'Min',
  'Max': 'Max',
  'Sum': 'Summa',
  'Count': 'Antal',
  'Value': 'Värde',
  'Unit': 'Enhet',
  'Location': 'Plats',
  'Address': 'Adress',
  'Building': 'Byggnad',
  'Floor': 'Våning',
  'Room': 'Rum',
  'Area': 'Område',
  'Zone': 'Zon',
  'Branch': 'Gren',
  'System': 'System',
  'Facility': 'Anläggning',
  'Site': 'Anläggning',
  'Customer': 'Kund',
  'Client': 'Kund',
  'Service': 'Service',
  'Maintenance': 'Underhåll',
  'Report': 'Rapport',
  'Monthly report': 'Månadsrapport',
  'Service report': 'Servicerapport',
}

// Helper to translate KPI label
export function translateKpiLabel(label) {
  if (!label) return label

  const trimmed = label.trim()

  // Try exact match first
  if (KPI_NAMES_SV[trimmed]) return KPI_NAMES_SV[trimmed]

  // Try case-insensitive exact match
  const lowerLabel = trimmed.toLowerCase()
  for (const [en, sv] of Object.entries(KPI_NAMES_SV)) {
    if (en.toLowerCase() === lowerLabel) return sv
  }

  // Try matching with normalized whitespace
  const normalized = trimmed.replace(/\s+/g, ' ')
  if (KPI_NAMES_SV[normalized]) return KPI_NAMES_SV[normalized]

  for (const [en, sv] of Object.entries(KPI_NAMES_SV)) {
    if (en.toLowerCase().replace(/\s+/g, ' ') === normalized.toLowerCase()) return sv
  }

  // Return original if no translation found
  return label
}

export const STATUS_COLORS = {
  critical: '#ef4444',
  warning: '#f97316',
  ok: '#22c55e',
}

export function healthColor(score) {
  if (score < 70) return STATUS_COLORS.critical
  if (score < 85) return STATUS_COLORS.warning
  return STATUS_COLORS.ok
}

export function availabilityColor(pct) {
  if (pct < 95) return STATUS_COLORS.critical
  if (pct < 99) return STATUS_COLORS.warning
  return STATUS_COLORS.ok
}

export function manualColor(pct) {
  if (pct > 50) return STATUS_COLORS.critical
  if (pct > 20) return STATUS_COLORS.warning
  return STATUS_COLORS.ok
}
