#!/usr/bin/env bash
# run.sh — Kör alla analyser i rätt ordning och generera PDF-rapport
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Kontrollera att venv finns
if [ ! -d ".venv" ]; then
    echo "Virtuell miljö saknas. Kör ./setup.sh först."
    exit 1
fi

# Kontrollera att rapporter finns
if [ ! -d "rapporter" ] || [ -z "$(ls rapporter/*.xls 2>/dev/null)" ]; then
    echo "Inga rapportfiler hittades i rapporter/"
    echo "Lägg .xls-filerna där och kör detta skript igen."
    exit 1
fi

PYTHON=".venv/bin/python3"

echo "=== Sopsuganalys — Kör alla analyser ==="
echo ""

echo "[1/12] Energi & drift..."
$PYTHON scripts/energi_drift.py
echo ""

echo "[2/12] Ventiler..."
$PYTHON scripts/ventiler.py
echo ""

echo "[3/12] Larm..."
$PYTHON scripts/larm.py
echo ""

echo "[4/12] Dashboard..."
$PYTHON scripts/dashboard.py
echo ""

echo "[5/12] Sammanfattning (Sheet1 discovery)..."
$PYTHON scripts/sammanfattning.py
echo ""

echo "[6/12] Fraktionsanalys..."
$PYTHON scripts/fraktion_analys.py
echo ""

echo "[7/12] Grendjupanalys..."
$PYTHON scripts/gren_djupanalys.py
echo ""

echo "[8/12] Manuella körningar..."
$PYTHON scripts/manuell_analys.py
echo ""

echo "[9/12] Trendanalys..."
$PYTHON scripts/trendanalys.py
echo ""

echo "[10/12] Rekommendationer..."
$PYTHON scripts/rekommendationer.py
echo ""

echo "[11/12] Drifterfarenheter..."
$PYTHON scripts/drifterfarenheter.py
echo ""

echo "[12/12] PDF-rapport..."
$PYTHON scripts/rapport_pdf.py
echo ""

echo "=== Klart! ==="
echo "Resultat i: $SCRIPT_DIR/output/"
echo "PDF-rapport: $SCRIPT_DIR/output/rapport_2025.pdf"
