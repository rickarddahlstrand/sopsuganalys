# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Regelverk för datahantering

Rapportfilerna under `pythonapp/rapporter/` (`.xls`) och CSV-eventloggar innehåller känslig driftdata. Följande regler gäller strikt:

### Förbjudet

- **Läsa, öppna eller inspektera** innehållet i `.xls`-filer eller CSV-eventloggar
- **Analysera eller bearbeta** rapportdata direkt
- **Skicka rapportdata** till AI-tjänster, molntjänster eller externa system
- **Inkludera rådata** i konversationer eller output

### Tillåtet

- **Metadata**: filnamn, filstorlekar, antal rader/kolumner, kolumnrubriker, arknamn, unika värden i kategorikolumner
- **Output från lokala script** (sammanfattningar, statistik, grafer) — förutsatt att det inte innehåller rådata
- **Skapa och redigera Python-script** för lokal dataanalys
- **End-to-end-verifiering via `agent-browser`**: programmatisk uppladdning av filer i webbläsaren och skärmdumpar av UI är tillåtet — filerna bearbetas lokalt av webappen, inget skickas externt

### Arbetsflöde

1. AI skapar/redigerar analysscript baserat på metadata och krav
2. Användaren kör scripten lokalt eller verifierar via agent-browser
3. Användaren delar resultat (ej rådata) med AI vid behov

## Kommandon

### Setup och körning

```bash
cd pythonapp
./setup.sh                              # Skapa .venv och installera beroenden
./run.sh                                # Kör alla 12 analyssteg i ordning
.venv/bin/python3 scripts/<script>.py   # Kör enskilt script
```

Rapportfiler placeras i `pythonapp/rapporter/` med namnmönstret `*_<månadsnummer>_2025.xls` (t.ex. `facility_1_2025.xls` för januari).

### Tester

```bash
cd pythonapp
.venv/bin/python3 -m pytest tests/                  # Alla tester
.venv/bin/python3 -m pytest tests/test_ventiler.py   # Enskilt test
.venv/bin/python3 -m pytest tests/test_ventiler.py -k "test_func"  # En funktion
```

### Webapp (React)

```bash
cd webapp && npm install && npm run dev    # Dev-server (default :5173)
cd webapp && npm run build                 # Bygg till webapp/dist/
```

### PocketBase backend (för delning/jämförelse)

```bash
/tmp/pocketbase serve --http=0.0.0.0:8001 \
  --dir=./webapp/pb_data \
  --migrationsDir=./webapp/pb_migrations \
  --publicDir=./webapp/pb_public      # symlink → dist; servar både API och frontend
```

PocketBase serverar på `:8001` och hanterar två collections:

- `facility_uploads` — originalfiler (`.xls`/`.csv`) + sammanfattning. **list/view/create publika; update/delete kräver superuser.**
- `shared_analyses` — legacy JSON-blob, oanvänt av aktuell kod men kvar för historisk data.

Migrationer ligger i `webapp/pb_migrations/`. Vid schemaändringar — använd `app.db().newQuery(...)` för raw SQL om `app.save(collection)` kraschar med "name must not match an existing collection id" (PB 0.25.x-bugg när id == name).

### End-to-end-verifiering med agent-browser

```bash
npm install -g agent-browser
agent-browser install --with-deps     # Hämtar Chrome 147+ + systempaket
agent-browser skills get core --full  # Skill-guide med kommandoreferens
```

Använd `agent-browser` för att verifiera UI efter större ändringar — ladda upp testdata via `input[type=file]`, klicka i flikar, ta skärmdumpar, kontrollera console.

## Arkitektur

### Python-analyskedja (`pythonapp/scripts/`)

`common.py` tillhandahåller delade funktioner: `get_report_files()`, `read_sheet()`, `parse_valve_id()`, `ensure_output_dir()`. Konstanterna `RAPPORT_DIR` och `OUTPUT_DIR` pekar på `pythonapp/rapporter/` resp. `pythonapp/output/`.

**Pipeline med beroenden (körordning i `pythonapp/run.sh`):**

```
1-4:  Grundanalys (energi_drift, ventiler, larm, dashboard)
5-7:  Utökade analyser (sammanfattning, fraktion_analys, gren_djupanalys) — läser .xls direkt
8:    manuell_analys — läser .xls direkt
9:    trendanalys (kräver steg 1-4)
10:   rekommendationer (kräver steg 9)
11:   drifterfarenheter (kräver steg 9 + 8)
12:   rapport_pdf (kräver alla ovanstående)
```

`energi_drift.py` hanterar att månadsrapporter innehåller **kumulativa** värden (YTD) och konverterar till månadsdelta i `collect_*`-funktionerna.

### Webapp (`webapp/`)

React-app (Vite + Tailwind) som analyserar `.xls` + `.csv` helt i webbläsaren via `xlsx`-biblioteket. Deployas till Cloudflare Pages eller serveras av PocketBase via `pb_public/` (symlink till `dist/`).

Nyckelkataloger:
- `src/parsers/` — XLS-parsning (`xlsParser.js`, `sheetReaders.js`, `fileSort.js`)
- `src/analysis/` — Analyslogik (en fil per sektion: `energiDrift`, `ventiler`, `larm`, `nivagivare`, `manuellAnalys`, `fraktionAnalys`, `grenDjupanalys`, `trendanalys`, `rekommendationer`, `drifterfarenheter`, `sammanfattning`, `eventLog`)
- `src/sections/` — UI-sektioner (en per analys + `DashboardSection`, `CompareSection`, `UploadSection`)
- `src/components/common/` — `KpiCard`, `ChartCard`, `DataTable`, `KpiGrid`, `EmptyState`, `StatusBadge`, `InfoButton`
- `src/utils/` — formatters, descriptions (CHART_INFO/KPI_INFO/TABLE_INFO), `valveFraction.js` (mappar ventil → avfallsfraktion via Info-fält), `halfPeriod.js`, `pocketbase.js`, `loadFacility.js`
- `src/stats/` — `linregress`, `correlation`, `anomaly`
- `src/context/` — DataContext (state), ThemeContext

#### Viktig parser-logik (`fileSort.js`)

Varje månads-XLS innehåller **kumulativa** YTD-värden, inte månadsvärden. `deltafyCumulativeSheets()` konverterar Sheet3/5/7-räknare till månadsdelta efter sortering på `sortKey = year*100 + monthNum`. Årsbrytning resettar; negativa deltas skyddas mot. Rate/state-fält (availability, fyllnadstid, emptyingPerMinute) lämnas orörda — de är period-snapshots, inte räknare.

#### Multi-year H1/H2 (`utils/halfPeriod.js`)

H1/H2-jämförelser splittar på `sortKey` (kronologiskt), inte calendar-`monthNum`. "H1" = första halvan av uppladdad period, "H2" = andra halvan. Korrigerar för data som spänner över årsskifte (t.ex. aug 2025 – juli 2026).

#### Ventil → fraktion (`utils/valveFraction.js`)

Info-kolumnen i Sheet9/Sheet11 inleds med fraktionsnamn följt av komma (`"Rest,"`, `"Plastic,"`, `"Organic,"`). `buildValveFractionMap(parsedFiles)` matchar prefix mot Sheet5:s fraktionslista som kanonisk uppsättning. Returnerar `null` när matchning saknas (kallaren visar "Okänd").

### Tester (`pythonapp/tests/`)

Varje analysscript har en motsvarande testfil. `conftest.py` genererar syntetisk testdata via numpy/pandas-fixtures. **JS-sidan saknar tester** — endast Python-koden testas idag.

## Rapportstruktur (ark och rubrikrader)

Varje `.xls`-fil har 13 ark (Sheet1–Sheet13). Rubrikrader ligger INTE på rad 0 (merged cells/titlar ovanför):

| Ark | header_row | Innehåll |
|-----|-----------|----------|
| Sheet1 | 9 | Anläggningssammanfattning: nyckel-värde-par (etiketter i kol 0-5, Value kol 6, Comment kol 8) |
| Sheet3 | 3 | Energy (kWh), Operation Time (h) |
| Sheet5 | 3 | Fraction, Hours (fyllnadstid), kWh, Emptyings, Emptying/minute |
| Sheet7 | 4 | Name, ID, Starts, Hours, kWh + /start, /minute, total |
| Sheet8 | 8 | Ventildata (AUTO_OPEN_CMD, INLET_OPEN m.fl.) |
| Sheet9 | 3 | ID, Info, MAN_OPEN_CMD, AUTO_OPEN_CMD, INLET_OPEN, INLET_ACCESS_OK, LOW_LEVEL, HIGH_LEVEL, REPEATING_EMPTYING |
| Sheet11 | 3 | ID, Info, Availability [%], MAN_OPEN_CMD, AUTO_OPEN_CMD + felkoder (DOES_NOT_OPEN, DOES_NOT_CLOSE, LEVEL_ERROR, LONG_TIME_SINCE_LAST_COLLECTION, ERROR_FEEDBACK_FROM_USER) |
| Sheet13 | 7 | Alarm category, Current period, Average based on previous year |

- Sheet2/4/6/12: Små ark (5 rader), inga tydliga rubriker
- Sheet10: Duplicerade "ID"-kolumner — använd Sheet11 istället

## CSV-eventlogg

CSV-format: `Tid, Typ, Text` (citattecken, sekund-precision).

- `Typ`: `Information` / `Generellt` / `Kritiskt` / `Nödstopp` / `Totalt stopp`
- Larm = rad där `Typ != Information` och text inte börjar med `"Alarm reset"`
- Operatörshändelser för responstid:
  - **Remote login**: `"Remote connection 1 (0=off, 1=on)"` (typ=Information)
  - **Manual mode**: `"Change to manual operation mode"` (typ=Information)
  - **Reset**: `"Alarm reset"` (typ=Generellt) — saknar identifierare
- "Sequence N start/queued" och "Sequence N emptied X valves in Y minutes" används för sekvensanalys

`buildAlarmResponseTimes()` matchar varje larm mot **första** följande operatörshändelse (engagement = min(login, manual, reset)) inom 7 dygn. Ingen identifier-baserad parning är möjlig för reset; kronologisk närmast-följande används.

## Tekniska begränsningar och fallgropar

- **xlrd "file size"-varning**: Undertrycks med `logfile=open(os.devnull, "w")` i `open_workbook`
- **Sheet1**: Sammanslagna celler — `common.read_sheet()` fungerar inte. Kräver custom xlrd-läsare som skannar kolumn 0-5 för etiketter
- **Sheet7**: Extra kolumner ("/start", "/minute", "total") utöver grunddata. Filtrera bort `name.toLowerCase() === 'total'`
- **Sheet5**: Kolumnen "Hours" är fyllnadstid (inte drifttid). "Emptying/minute" = genomströmningseffektivitet. Historiska månadsrader ("24-Feb", "25-Jan") måste filtreras
- **Sheet11**: Kan sakna enskilda felkolumner (t.ex. DOES_NOT_CLOSE) i en del filer — parsern hanterar det med tomma värden
- **Kumulativa värden**: Sheet3/5/7-räknare är YTD per fil. Använd `deltafyCumulativeSheets()` (webapp) eller delta-logiken i `energi_drift.py` (Python)
- **PocketBase v0.25 schema:-syntax**: Den gamla `schema: [...]`-formen ignoreras silent och skapar tabellen utan kolumner. Använd `fields: [...]` för nya migrationer
- **PocketBase save()**: Kraschar med "name must not match an existing collection id" om collection.id == collection.name. Använd `app.db().newQuery("UPDATE _collections SET ...").execute()` istället
- **fpdf2**: `set_x(15)` krävs före `multi_cell()` i loopar — annars "not enough horizontal space"
- **Kommentarer i kod**: Default no comments. Skriv bara WHY-kommentarer för icke-uppenbar logik
