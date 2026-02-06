# Regelverk för datahantering — Sopsuganalys

## Rapportdata är skyddad

Rapportfilerna under `rapporter/` (`.xls`-filer) innehåller känslig driftdata från sopsuganläggningen. Följande regler gäller:

### Förbjudet

- **Läsa, öppna eller inspektera** innehållet i rapportfilerna (`.xls`)
- **Analysera eller bearbeta** rapportdata direkt
- **Skicka rapportdata** till AI-tjänster, molntjänster eller externa system
- **Inkludera rådata** från rapporterna i konversationer eller output

### Tillåtet

- **Metadata** om rapportfilerna får delas: filnamn, filstorlekar, antal rader/kolumner, kolumnrubriker, arknamn
- **Output från lokala script** (sammanfattningar, statistik, grafer) får delas med AI — förutsatt att det inte innehåller rådata
- **Skapa och redigera Python-script** för lokal dataanalys

## Lokal analys

- All dataanalys sker via lokala Python-script under `scripts/`
- Script körs i virtuell miljö (`.venv/`)
- Resultat sparas till `output/`
- Användaren kör scripten själv och delar relevant output med AI vid behov

## Arbetsflöde

1. AI skapar/redigerar analysscript baserat på metadata och krav
2. Användaren kör scripten lokalt
3. Användaren delar resultat (ej rådata) med AI för vidare analys eller förbättringar

## Rapportstruktur (ark och rubrikrader)

Varje .xls-fil innehåller 13 ark (Sheet1–Sheet13). Rubrikrader ligger INTE på rad 0 (merged cells/titlar ovanför). Korrekt `header_row` per ark:

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

## Tekniska begränsningar att känna till

- **xlrd "file size"-varning**: Undertrycks med `logfile=open(os.devnull, "w")` i `open_workbook`
- **Sheet1**: Har sammanslagna celler (merged cells) — `common.read_sheet()` fungerar inte. Kräver custom xlrd-läsare som skannar kolumn 0-5 för etiketter
- **Sheet7**: Har extra kolumner ("/start", "/minute", "total") utöver grunddata
- **Sheet5**: Kolumnen "Hours" är fyllnadstid (inte drifttid). "Emptying/minute" = genomströmningseffektivitet
- **fpdf2**: `set_x(15)` krävs före `multi_cell()` i loopar — annars "not enough horizontal space"

## Script-pipeline (körordning)

```
1-4:  Grundanalys (energi_drift, ventiler, larm, dashboard)
5-7:  Utökade analyser (sammanfattning, fraktion_analys, gren_djupanalys)
8:    manuell_analys
9:    trendanalys (kräver grundanalys)
10:   rekommendationer (kräver trendanalys)
11:   drifterfarenheter (kräver trendanalys + manuell_analys)
12:   rapport_pdf (kräver alla ovanstående)
```

Script 5-8 läser .xls direkt och har inga inbördes beroenden.
