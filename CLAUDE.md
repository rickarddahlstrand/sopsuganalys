# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Regelverk för datahantering

Rapportfilerna under `pythonapp/rapporter/` (`.xls`) innehåller känslig driftdata. Följande regler gäller strikt:

### Förbjudet

- **Läsa, öppna eller inspektera** innehållet i `.xls`-filer
- **Analysera eller bearbeta** rapportdata direkt
- **Skicka rapportdata** till AI-tjänster, molntjänster eller externa system
- **Inkludera rådata** i konversationer eller output

### Tillåtet

- **Metadata** om rapportfilerna: filnamn, filstorlekar, antal rader/kolumner, kolumnrubriker, arknamn
- **Output från lokala script** (sammanfattningar, statistik, grafer) — förutsatt att det inte innehåller rådata
- **Skapa och redigera Python-script** för lokal dataanalys

### Arbetsflöde

1. AI skapar/redigerar analysscript baserat på metadata och krav
2. Användaren kör scripten lokalt
3. Användaren delar resultat (ej rådata) med AI vid behov

## Kommandon

### Setup och körning

```bash
cd pythonapp
./setup.sh                              # Skapa .venv och installera beroenden
./run.sh                                # Kör alla 12 analyssteg i ordning
.venv/bin/python3 scripts/<script>.py   # Kör enskilt script
```

### Tester

```bash
cd pythonapp
.venv/bin/python3 -m pytest tests/                  # Alla tester
.venv/bin/python3 -m pytest tests/test_ventiler.py   # Enskilt test
.venv/bin/python3 -m pytest tests/test_ventiler.py -k "test_func"  # En funktion
```

### Webapp (React)

```bash
cd webapp && npm install && npm run dev    # Dev-server
cd webapp && npm run build                 # Bygg till webapp/dist/
```

## Arkitektur

### Python-analyskedja (`pythonapp/scripts/`)

All analys sker via lokala Python-script. `common.py` tillhandahåller delade funktioner: `get_report_files()`, `read_sheet()`, `parse_valve_id()`, `ensure_output_dir()`. Konstanterna `RAPPORT_DIR` och `OUTPUT_DIR` pekar på `pythonapp/rapporter/` resp. `pythonapp/output/`.

**Pipeline med beroenden (körordning i `pythonapp/run.sh`):**

```
1-4:  Grundanalys (energi_drift, ventiler, larm, dashboard)
5-7:  Utökade analyser (sammanfattning, fraktion_analys, gren_djupanalys) — läser .xls direkt, inga inbördes beroenden
8:    manuell_analys — läser .xls direkt
9:    trendanalys (kräver steg 1-4)
10:   rekommendationer (kräver steg 9)
11:   drifterfarenheter (kräver steg 9 + 8)
12:   rapport_pdf (kräver alla ovanstående)
```

Script 1-4 producerar CSV:er till `pythonapp/output/` som konsumeras nedströms. Script 5-8 läser `.xls` direkt via xlrd och skriver till `pythonapp/output/` utan beroenden sinsemellan.

### Webapp (`webapp/`)

Fristående React-app (Vite + Tailwind) som analyserar `.xls`-filer helt i webbläsaren via `xlsx`-biblioteket. Deployas till Cloudflare Pages. Inget beroende till Python-scripten.

### Tester (`pythonapp/tests/`)

Varje analysscript har en motsvarande testfil. `conftest.py` genererar syntetisk testdata via numpy/pandas-fixtures som efterliknar `.xls`-strukturen — inga riktiga rapportfiler används.

## Rapportstruktur (ark och rubrikrader)

Varje `.xls`-fil har 13 ark (Sheet1–Sheet13). Rubrikrader ligger INTE på rad 0 (merged cells/titlar ovanför):

| Ark | header_row | Innehåll |
|-----|-----------|----------|
| Sheet1 | 9 | Anläggningssammanfattning: nyckel-värde-par (etiketter i kol 0-5, Value kol 6, Comment kol 8) |
| Sheet3 | 3 | Energy (kWh), Operation Time (h) |
| Sheet5 | 3 | Fraction, Hours, kWh, Emptyings, Emptying/minute |
| Sheet7 | 4 | Name, ID, Starts, Hours, kWh + /start, /minute, total |
| Sheet8 | 8 | Ventildata (AUTO_OPEN_CMD, INLET_OPEN m.fl.) |
| Sheet9 | 3 | ID, Info, MAN_OPEN_CMD, AUTO_OPEN_CMD, INLET_OPEN |
| Sheet11 | 3 | ID, Info, Availability [%], MAN_OPEN_CMD, AUTO_OPEN_CMD + felkoder |
| Sheet13 | 7 | Alarm category, Current period, Average based on previous year |

- Sheet2/4/6/12: Små ark (5 rader), inga tydliga rubriker
- Sheet10: Duplicerade "ID"-kolumner — använd Sheet11 istället

## Tekniska begränsningar

- **xlrd "file size"-varning**: Undertrycks med `logfile=open(os.devnull, "w")` i `open_workbook`
- **Sheet1**: Sammanslagna celler — `common.read_sheet()` fungerar inte. Kräver custom xlrd-läsare som skannar kolumn 0-5 för etiketter
- **Sheet7**: Extra kolumner ("/start", "/minute", "total") utöver grunddata
- **Sheet5**: Kolumnen "Hours" är fyllnadstid (inte drifttid). "Emptying/minute" = genomströmningseffektivitet
- **fpdf2**: `set_x(15)` krävs före `multi_cell()` i loopar — annars "not enough horizontal space"
