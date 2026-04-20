#!/usr/bin/env python3
"""Utforska unika larmkategorinamn från Sheet13 i testdata.

Skriver endast ut kategorinamn (metadata) — inga larmvärden.
Enligt CLAUDE.md: AI får använda metadata, inte rådata.
"""

import os
from pathlib import Path

import xlrd


TESTDATA_DIR = Path(__file__).resolve().parent.parent.parent / "testdata"


def collect_categories(only_with_current_period: bool = False):
    """Samlar kategorinamn från Sheet13.

    Args:
        only_with_current_period: Om True, ta bara kategorier med värde i
            kolumn "Current period" (samma filter som webbappen använder).
    """
    all_cats = set()
    cats_with_value = set()
    files_checked = 0

    for xls_file in sorted(TESTDATA_DIR.glob("*.xls")):
        files_checked += 1
        wb = xlrd.open_workbook(str(xls_file), logfile=open(os.devnull, "w"))
        try:
            sheet = wb.sheet_by_name("Sheet13")
        except xlrd.biffh.XLRDError:
            continue
        # Kategorinamn ligger i kolumn 1, "Current period" i kolumn 6.
        for row_idx in range(8, sheet.nrows):
            cat = str(sheet.cell_value(row_idx, 1)).strip()
            if not cat or cat.lower() == "nan":
                continue
            if cat.lower() in ("alarm category", "category", "id"):
                continue
            all_cats.add(cat)
            # Kontrollera numeriskt värde i kolumn 6
            cp = sheet.cell_value(row_idx, 6) if sheet.ncols > 6 else ""
            if isinstance(cp, (int, float)) and cp != "":
                cats_with_value.add(cat)

    return all_cats, cats_with_value, files_checked


def main():
    all_cats, with_value, n_files = collect_categories()
    print(f"Genomsökte {n_files} filer från {TESTDATA_DIR}")
    print()
    print(f"Alla unika strängar i kategori-kolumnen ({len(all_cats)} st):")
    for cat in sorted(all_cats):
        print(f"  - {cat!r}")
    print()
    print(f"Kategorier som verkligen har ett värde i 'Current period' ({len(with_value)} st):")
    print("(Dessa är de som webbappen faktiskt ser, eftersom parsern filtrerar på värde.)")
    for cat in sorted(with_value):
        print(f"  - {cat!r}")


if __name__ == "__main__":
    main()
