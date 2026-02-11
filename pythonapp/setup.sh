#!/usr/bin/env bash
# setup.sh — Installerar beroenden och skapar projektstruktur
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Sopsuganalys — Installation ==="
echo ""

# Kontrollera Python 3
if ! command -v python3 &> /dev/null; then
    echo "FELR: python3 hittades inte. Installera Python 3.9+ först."
    echo "  macOS:  brew install python3"
    echo "  Linux:  sudo apt install python3 python3-venv"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Python-version: $PYTHON_VERSION"

# Skapa virtuell miljo
if [ ! -d ".venv" ]; then
    echo "Skapar virtuell miljo (.venv)..."
    python3 -m venv .venv
else
    echo "Virtuell miljo finns redan (.venv)"
fi

# Installera beroenden
echo "Installerar beroenden..."
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r requirements.txt -q

# Skapa output-katalog
mkdir -p output

echo ""
echo "=== Installation klar ==="
echo ""
echo "Lagg rapportfiler (.xls) i: $SCRIPT_DIR/rapporter/"
echo ""
echo "Kor analyserna med:"
echo "  ./run.sh"
echo ""
echo "Eller steg for steg:"
echo "  .venv/bin/python3 scripts/energi_drift.py"
echo "  .venv/bin/python3 scripts/ventiler.py"
echo "  .venv/bin/python3 scripts/larm.py"
echo "  .venv/bin/python3 scripts/dashboard.py"
echo "  .venv/bin/python3 scripts/manuell_analys.py"
echo "  .venv/bin/python3 scripts/trendanalys.py"
echo "  .venv/bin/python3 scripts/rekommendationer.py"
echo "  .venv/bin/python3 scripts/rapport_pdf.py"
