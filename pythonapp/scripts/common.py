"""Gemensamma hjälpfunktioner för sopsugsanalys.

Tillhandahåller sökvägar, fillistor och DataFrame-inläsning
med korrekt rubrikrad för rapporterna.
"""

import os
import re
from pathlib import Path

import pandas as pd
import xlrd

RAPPORT_DIR = Path(__file__).resolve().parent.parent / "rapporter"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"

MANAD_NAMN = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr",
    5: "Maj", 6: "Jun", 7: "Jul", 8: "Aug",
    9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec",
}


def get_report_files() -> list[tuple[int, str, Path]]:
    """Returnerar sorterad lista av (manadsnummer, manadsnamn, sokvag).

    Stoder filnamn med olika ar (t.ex. *_1_2025.xls, *_2_2026.xls).
    Returnerar sortering pa (ar * 100 + manad).
    """
    files = sorted(RAPPORT_DIR.glob("*.xls"))
    result = []
    for f in files:
        m = re.search(r"_(\d{1,2})_(\d{4})\.xls$", f.name)
        if m:
            month = int(m.group(1))
            year = int(m.group(2))
            result.append((month, MANAD_NAMN[month], f, year))
    result.sort(key=lambda x: x[3] * 100 + x[0])
    # Behall bakat-kompat-tupelformat (month, name, path) — slang bort year
    return [(m, n, p) for (m, n, p, _) in result]


def read_sheet(filepath: Path, sheet_name: str, header_row: int) -> pd.DataFrame:
    """Läser ett ark med angiven rubrikrad och returnerar DataFrame.

    Undertrycker xlrd-varningen om filstorlek.
    """
    # xlrd skriver "file size not multiple of sector size" via print(file=logfile)
    # till stdout — undertryck genom att skicka logfile till devnull
    wb = xlrd.open_workbook(str(filepath), logfile=open(os.devnull, "w"), on_demand=True)

    sheet = wb.sheet_by_name(sheet_name)

    # Läs rubriker från angiven rad
    headers = [
        str(sheet.cell_value(header_row, col)).strip()
        for col in range(sheet.ncols)
    ]

    # Läs data från raden efter rubrikraden
    data = []
    for row_idx in range(header_row + 1, sheet.nrows):
        row = [sheet.cell_value(row_idx, col) for col in range(sheet.ncols)]
        data.append(row)

    df = pd.DataFrame(data, columns=headers)

    # Ta bort helt tomma rader
    df = df.dropna(how="all").reset_index(drop=True)

    # Ta bort kolumner utan namn
    df = df.loc[:, df.columns != ""]

    return df


def parse_valve_id(valve_id: str) -> tuple[int, int]:
    """Parsar 'XX:Y' → (grennummer, ventilnummer)."""
    parts = str(valve_id).split(":")
    return int(parts[0]), int(parts[1])


def ensure_output_dir():
    """Skapar output-katalogen om den inte finns."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
