# Sopsuganalys

Detta analysverktyg kan användas för att analysera driftrapporter från sopsuganläggningar. Det läser Envacs månadsrapporter (.xls) och genererar statistik, trender, rekommendationer och en sammanfattande PDF-rapport.

Verktyget behandlar endast filer lokalt och ingen information laddas upp i molnet.

## Datahantering

Rapportdata är känslig och hanteras enbart lokalt. Se [CLAUDE.md](CLAUDE.md) för fullständiga regler vid AI-assisterad utveckling.

## Upphovsrätt & Licens

Detta verktyg är skapat av Rickard Dahlstrand och licensierat under [Creative Commons Erkännande 4.0 Internationell (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).


## Funktioner

- **Energi & drift** — Energiförbrukning, drifttid, tömningar per fraktion, maskinstatistik
- **Ventilanalys** — Tillgänglighet, felkoder, kommandostatistik per ventil och gren
- **Larmanalys** — Larmkategorier per månad, jämförelse med föregående år
- **Manuella körningar** — Andel manuell vs automatisk drift som mått på anläggningshälsa
- **Anläggningssammanfattning** — Sheet1 discovery: extraherar KPI:er (tonnage, vakuumtryck, transportantal m.m.)
- **Fraktionsanalys** — Fyllnadstider, genomströmning (tömning/minut), säsongsvariation per fraktion
- **Grendjupanalys** — Grentyper (skola/bostad), säsongsmönster, Info-metadata per ventil
- **Trendanalys** — Linjär regression, anomalidetektion (z-score), korrelationer, grenhälsopoäng
- **Rekommendationer** — Regelbaserade åtgärdsförslag med prioritering och KPI-mål
- **Drifterfarenheter** — Detaljanalys av felmönster, riskventiler och energieffektivitet
- **PDF-rapport** — Professionell A4-rapport med alla analyser samlade

## Snabbstart (macOS / Linux)

### 1. Klona och installera

```bash
git clone https://github.com/rickarddahlstrand/sopsuganalys.git
cd sopsuganalys
./setup.sh
```

`setup.sh` skapar en virtuell Python-miljö (`.venv/`) och installerar alla beroenden.

### 2. Lägg till rapporter

Placera Envacs månadsrapporter (.xls) i katalogen `rapporter/`:

```
rapporter/
  report_1_2025.xls
  report_2_2025.xls
  ...
  report_12_2025.xls
```

Filnamnen ska följa mönstret `*_<månadsnummer>_2025.xls`.

### 3. Kör analyserna

```bash
./run.sh
```

Alla analyser körs i rätt ordning och resultat sparas i `output/`. PDF-rapporten hamnar i `output/rapport_2025.pdf`.

### Manuell körning

Om du vill köra enskilda steg:

```bash
# Grundanalys
.venv/bin/python3 scripts/energi_drift.py
.venv/bin/python3 scripts/ventiler.py
.venv/bin/python3 scripts/larm.py
.venv/bin/python3 scripts/dashboard.py

# Utökade analyser (läser .xls direkt, ingen ordningsberoende)
.venv/bin/python3 scripts/sammanfattning.py       # Sheet1 discovery
.venv/bin/python3 scripts/fraktion_analys.py       # Fraktionsdjup
.venv/bin/python3 scripts/gren_djupanalys.py       # Grendjup + Info-metadata

# Manuell analys
.venv/bin/python3 scripts/manuell_analys.py

# Djupanalys
.venv/bin/python3 scripts/trendanalys.py

# Rekommendationer (kräver trendanalys.py)
.venv/bin/python3 scripts/rekommendationer.py

# Drifterfarenheter (kräver trendanalys.py och manuell_analys.py)
.venv/bin/python3 scripts/drifterfarenheter.py

# PDF-rapport (kräver alla ovanstående)
.venv/bin/python3 scripts/rapport_pdf.py
```

## Projektstruktur

```
rapporter/          Månadsrapporter (.xls) — git-ignorerade
scripts/            Python-analysscript
  common.py         Delade hjälpare: filsökning, arkläsning, månadsnamn
  metadata.py       Extraherar filstruktur till output/metadata.json
  energi_drift.py     Sheet3+5+7 → energi_drift.csv + .png
  ventiler.py         Sheet9+11 → ventiler.csv + .png
  larm.py             Sheet13 → larm.csv + .png
  dashboard.py        Samlar CSV:er → dashboard.png
  sammanfattning.py   Sheet1 → sammanfattning.csv + kpi_lista.csv + .png
  fraktion_analys.py  Sheet5 (alla kolumner) → fraktion_analys.csv + .png
  gren_djupanalys.py  Sheet9+11 (Info) → gren_djupanalys.csv + gren_profiler.csv + .png
  manuell_analys.py   Sheet9+11+3 → manuell_analys.csv + .png
  trendanalys.py      Djupanalys → 5 CSV + 4 PNG
  rekommendationer.py Rekommendationer → JSON + CSV + TXT
  drifterfarenheter.py Felmönster & driftkvalitet → JSON + CSV
  rapport_pdf.py      Kompilerar allt → rapport_2025.pdf
output/             Genererade resultat — git-ignorerade
setup.sh            Installationsskript
run.sh              Kör alla analyser
CLAUDE.md           Regelverk för AI-assisterad datahantering
```

## Krav

- Python 3.9+
- macOS eller Linux (Windows med WSL fungerar också)

Beroenden installeras automatiskt via `setup.sh`:
- xlrd, pandas, matplotlib, scipy, fpdf2

