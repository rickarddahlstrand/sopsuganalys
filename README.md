# Sopsuganalys

Analysverktyg för driftrapporter från sopsuganläggningar. Läser servicerapporter (.xls) och genererar statistik, trender, rekommendationer och rapporter.

Verktyget behandlar endast filer lokalt och ingen information laddas upp i molnet.

## Två appar — samma analysuppdrag

Projektet innehåller två fristående appar som löser samma grunduppgift på olika sätt:

| | **Python-pipeline** (`pythonapp/`) | **Webapp** (`webapp/`) |
|---|---|---|
| **Syfte** | Genererar en komplett PDF-rapport med trendanalys, rekommendationer och drifterfarenheter | Interaktiv analys direkt i webbläsaren — ingen installation krävs |
| **Körs** | Lokalt via terminalen (Python + venv) | I webbläsaren (React, deployas till Cloudflare Pages) |
| **Input** | .xls-filer i `pythonapp/rapporter/` | .xls-filer laddas upp via drag-and-drop |
| **Output** | CSV, PNG, JSON och PDF i `pythonapp/output/` | Diagram och tabeller direkt på skärmen |
| **Beroende** | Python 3.9+, xlrd, pandas, matplotlib, scipy, fpdf2 | Node.js (för build), xlsx-biblioteket i webbläsaren |

Apparna är helt oberoende av varandra och delar ingen kod.

## Datahantering

Rapportdata är känslig och hanteras enbart lokalt. Se [CLAUDE.md](CLAUDE.md) för fullständiga regler vid AI-assisterad utveckling.

## Upphovsrätt & Licens

Detta verktyg är skapat av Rickard Dahlstrand och licensierat under [Creative Commons Erkännande 4.0 Internationell (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

---

## Python-pipeline (`pythonapp/`)

12-stegs analyskedja som producerar en professionell PDF-rapport.

### Funktioner

- **Energi & drift** — Energiförbrukning, drifttid, tömningar per fraktion, maskinstatistik
- **Ventilanalys** — Tillgänglighet, felkoder, kommandostatistik per ventil och gren
- **Larmanalys** — Larmkategorier per månad, jämförelse med föregående år
- **Manuella körningar** — Andel manuell vs automatisk drift som mått på anläggningshälsa
- **Anläggningssammanfattning** — Extraherar KPI:er (tonnage, vakuumtryck, transportantal m.m.)
- **Fraktionsanalys** — Fyllnadstider, genomströmning, säsongsvariation per fraktion
- **Grendjupanalys** — Grentyper (skola/bostad), säsongsmönster, Info-metadata per ventil
- **Trendanalys** — Linjär regression, anomalidetektion (z-score), korrelationer, grenhälsopoäng
- **Rekommendationer** — Regelbaserade åtgärdsförslag med prioritering och KPI-mål
- **Drifterfarenheter** — Detaljanalys av felmönster, riskventiler och energieffektivitet
- **PDF-rapport** — Professionell A4-rapport med alla analyser samlade

### Snabbstart

```bash
cd pythonapp
./setup.sh                    # Skapar .venv och installerar beroenden
```

Placera servicerapporter (.xls) i `pythonapp/rapporter/` (filnamn: `*_<månadsnummer>_2025.xls`) och kör:

```bash
cd pythonapp
./run.sh                      # Kör alla 12 analyssteg
```

Resultat sparas i `pythonapp/output/`. PDF-rapporten hamnar i `pythonapp/output/rapport_2025.pdf`.

### Manuell körning

```bash
cd pythonapp

# Grundanalys
.venv/bin/python3 scripts/energi_drift.py
.venv/bin/python3 scripts/ventiler.py
.venv/bin/python3 scripts/larm.py
.venv/bin/python3 scripts/dashboard.py

# Utökade analyser (läser .xls direkt, ingen ordningsberoende)
.venv/bin/python3 scripts/sammanfattning.py
.venv/bin/python3 scripts/fraktion_analys.py
.venv/bin/python3 scripts/gren_djupanalys.py

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

### Tester

```bash
cd pythonapp
.venv/bin/python3 -m pytest tests/
```

### Krav

- Python 3.9+
- macOS eller Linux (Windows med WSL fungerar också)

Beroenden installeras automatiskt via `pythonapp/setup.sh`:
xlrd, pandas, matplotlib, scipy, fpdf2

---

## Webapp (`webapp/`)

Fristående React-app (Vite + Tailwind) som analyserar .xls-filer helt i webbläsaren. Ingen data lämnar användarens dator.

### Lokal utveckling

```bash
cd webapp
npm install
npm run dev                   # Startar dev-server
npm run build                 # Bygger till webapp/dist/
```

### Deploy till Cloudflare Pages

#### Alternativ 1: Koppla GitHub-repo (rekommenderat)

1. Logga in på [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Gå till **Workers & Pages** > **Create** > **Pages** > **Connect to Git**
3. Välj ditt GitHub-repo `sopsuganalys`
4. Konfigurera bygginställningar:

   | Inställning | Värde |
   |---|---|
   | Framework preset | None |
   | Build command | `cd webapp && npm install && npm run build` |
   | Build output directory | `webapp/dist` |
   | Root directory | `/` |
   | Node.js version | `18` (eller högre) |

5. Klicka **Save and Deploy**
6. Cloudflare bygger och publicerar automatiskt vid varje push till `main`

Om Node-version behöver sättas explicit, lägg till miljövariabeln `NODE_VERSION` = `20` under **Settings** > **Environment variables**.

#### Alternativ 2: Direkt uppladdning

1. Bygg lokalt: `cd webapp && npm install && npm run build`
2. Gå till **Workers & Pages** > **Create** > **Pages** > **Upload assets**
3. Dra in hela `webapp/dist/`-mappen
4. Ge projektet ett namn och klicka **Deploy**

#### Efter deploy

- Sidan nås via `https://<projektnamn>.pages.dev`
- Eget domännamn kan konfigureras under **Custom domains**
- All analys sker i besökarens webbläsare — Cloudflare servar bara de statiska filerna

---

## Projektstruktur

```
pythonapp/                Python-analyskedja
  scripts/                Analysscript (12 steg + common.py)
  tests/                  Enhetstester
  rapporter/              Månadsrapporter (.xls) — git-ignorerade
  output/                 Genererade resultat — git-ignorerade
  setup.sh                Installationsskript
  run.sh                  Kör alla analyssteg i rätt ordning
  requirements.txt        Python-beroenden
webapp/                   React-app (Vite + Tailwind, Cloudflare Pages)
CLAUDE.md                 Regelverk för AI-assisterad datahantering
LICENSE                   CC BY 4.0
```
