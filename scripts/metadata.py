#!/usr/bin/env python3
"""Extraherar metadata från sopsugsrapporter.

Samlar ENBART strukturell metadata (filnamn, storlekar, arknamn,
kolumnrubriker, rad/kolumnantal). Inga datavärden extraheras.

Resultat sparas till output/metadata.json.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import xlrd

RAPPORT_DIR = Path(__file__).resolve().parent.parent / "rapporter"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


def get_file_info(filepath: Path) -> dict:
    """Hämtar filmetadata utan att läsa datavärden."""
    stat = filepath.stat()
    return {
        "filnamn": filepath.name,
        "storlek_bytes": stat.st_size,
        "storlek_kb": round(stat.st_size / 1024, 1),
        "senast_andrad": datetime.fromtimestamp(stat.st_mtime).isoformat(),
    }


def find_header_row(sheet) -> tuple[int | None, list[str]]:
    """Hittar första raden med icke-tomma textvärden (rubrikraden).

    Söker igenom de första 10 raderna. Returnerar (radnummer, rubriker).
    """
    max_search = min(10, sheet.nrows)
    for row_idx in range(max_search):
        values = [
            str(sheet.cell_value(row_idx, col)).strip()
            for col in range(sheet.ncols)
        ]
        # Räkna icke-tomma textvärden
        non_empty = [v for v in values if v]
        if len(non_empty) >= 2:
            return row_idx, values
    return None, []


def get_sheet_metadata(filepath: Path) -> list[dict]:
    """Extraherar arkmetadata: namn, dimensioner, kolumnrubriker."""
    workbook = xlrd.open_workbook(str(filepath))
    sheets = []

    for sheet in workbook.sheets():
        header_row, headers = find_header_row(sheet)

        sheets.append({
            "arknamn": sheet.name,
            "antal_rader": sheet.nrows,
            "antal_kolumner": sheet.ncols,
            "rubrik_rad": header_row,
            "kolumnrubriker": headers,
        })

    return sheets


def extract_metadata() -> dict:
    """Extraherar metadata från alla rapportfiler."""
    if not RAPPORT_DIR.exists():
        print(f"Fel: Rapportkatalogen finns inte: {RAPPORT_DIR}")
        sys.exit(1)

    xls_files = sorted(RAPPORT_DIR.glob("*.xls"))

    if not xls_files:
        print(f"Inga .xls-filer hittades i {RAPPORT_DIR}")
        sys.exit(1)

    rapporter = []
    for filepath in xls_files:
        file_info = get_file_info(filepath)
        file_info["ark"] = get_sheet_metadata(filepath)
        rapporter.append(file_info)

    return {
        "genererat": datetime.now().isoformat(),
        "rapport_katalog": str(RAPPORT_DIR),
        "antal_filer": len(rapporter),
        "rapporter": rapporter,
    }


def print_summary(metadata: dict) -> None:
    """Skriver en läsbar sammanfattning till stdout."""
    print("=" * 60)
    print("METADATA — Sopsugsrapporter")
    print("=" * 60)
    print(f"Antal rapportfiler: {metadata['antal_filer']}")
    print(f"Katalog: {metadata['rapport_katalog']}")
    print()

    for rapport in metadata["rapporter"]:
        print(f"  {rapport['filnamn']}")
        print(f"    Storlek: {rapport['storlek_kb']} KB")
        for ark in rapport["ark"]:
            print(f"    Ark: {ark['arknamn']}")
            print(f"      Rader: {ark['antal_rader']}, Kolumner: {ark['antal_kolumner']}")
            if ark["rubrik_rad"] is not None:
                print(f"      Rubrikrad: {ark['rubrik_rad']}")
            non_empty = [h for h in ark["kolumnrubriker"] if h]
            if non_empty:
                preview = non_empty[:5]
                suffix = f" ... (+{len(non_empty) - 5} till)" if len(non_empty) > 5 else ""
                print(f"      Rubriker: {', '.join(preview)}{suffix}")
        print()

    print("=" * 60)


def main():
    metadata = extract_metadata()

    # Skapa output-katalog
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Spara JSON
    output_file = OUTPUT_DIR / "metadata.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print_summary(metadata)
    print(f"Metadata sparad till: {output_file}")


if __name__ == "__main__":
    main()
