#!/usr/bin/env python3
"""Utforska vilken info som finns for att harleda ventil -> fraktion-koppling.

Aggregerar och printar:
  - Unika varden fran Sheet5 "Fraction"-kolumnen
  - Unika varden fran Sheet9/Sheet11 "Info"-kolumnen
  - Unika mapnningar ventil-ID-prefix -> Info (aggregerat, grennr istallet for fullt ID)
  - Alla raw-rubriker fran Sheet9, Sheet10, Sheet11 for att hitta REPEATING_EMPTYING m.fl.

Skriver enbart aggregerad metadata — inga rader som kopplar enskilda ventiler
till fastighet-specifika positioner.

Anvands fran testdata/ (inte rapporter/) for att folja CLAUDE.md-regelverket.
"""

import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

import xlrd

TESTDATA_DIR = Path(__file__).resolve().parent.parent.parent / "testdata"


def iter_xls_files():
    return sorted(TESTDATA_DIR.glob("*.xls"))


def open_wb(path: Path):
    return xlrd.open_workbook(str(path), logfile=open(os.devnull, "w"), on_demand=True)


def read_headers_only(sheet, header_row: int):
    return [
        str(sheet.cell_value(header_row, col)).strip()
        for col in range(sheet.ncols)
    ]


def read_column_values(sheet, header_row: int, col_name_matchers: list[str]) -> list[tuple[str, str]]:
    """Return list of (col_name, value_as_string) for columns matching any matcher (lowercase substring)."""
    headers = read_headers_only(sheet, header_row)
    matched = []
    for idx, h in enumerate(headers):
        hl = h.lower().strip()
        if any(m in hl for m in col_name_matchers):
            matched.append((idx, h))

    out = []
    for row_idx in range(header_row + 1, sheet.nrows):
        for idx, h in matched:
            v = sheet.cell_value(row_idx, idx)
            if v is None or v == "":
                continue
            s = str(v).strip()
            if s and s.lower() != "nan":
                out.append((h, s))
    return out


def main():
    files = iter_xls_files()
    if not files:
        print(f"Inga .xls-filer i {TESTDATA_DIR}", file=sys.stderr)
        return 1

    print(f"Utforskar {len(files)} filer fran {TESTDATA_DIR.name}/\n")

    fraction_values = Counter()
    info_values = Counter()
    branch_to_infos = defaultdict(Counter)  # grennr (prefix) -> Counter(info_text)
    sheet9_headers_all = Counter()
    sheet10_headers_all = Counter()
    sheet11_headers_all = Counter()

    # For Sheet10 vi scannar flera mojliga header_row-positioner
    sheet10_headers_by_row = defaultdict(Counter)  # header_row -> Counter(header)

    for fp in files:
        wb = open_wb(fp)
        try:
            for sn in wb.sheet_names():
                try:
                    sh = wb.sheet_by_name(sn)
                except xlrd.XLRDError:
                    continue

                if sn == "Sheet5":
                    for _h, v in read_column_values(sh, 3, ["fraction"]):
                        # Filtera bort radrubriker ("Month", "02-Feb" etc.)
                        low = v.lower()
                        if low == "month":
                            continue
                        if low in ("nan",):
                            continue
                        fraction_values[v] += 1

                elif sn in ("Sheet9", "Sheet11"):
                    headers = read_headers_only(sh, 3)
                    # id-kol och info-kol
                    id_idx = next((i for i, h in enumerate(headers) if h.lower().strip() == "id"), None)
                    info_idx = next((i for i, h in enumerate(headers) if "info" in h.lower()), None)
                    if sn == "Sheet9":
                        sheet9_headers_all.update(headers)
                    else:
                        sheet11_headers_all.update(headers)

                    if id_idx is None or info_idx is None:
                        continue

                    for row_idx in range(4, sh.nrows):
                        vid = str(sh.cell_value(row_idx, id_idx)).strip()
                        info = str(sh.cell_value(row_idx, info_idx)).strip()
                        if not vid or vid.lower() == "nan":
                            continue
                        if not info or info.lower() == "nan":
                            continue
                        info_values[info] += 1
                        # Parsa grennr fran ID "XX:Y"
                        prefix = vid.split(":")[0] if ":" in vid else vid
                        branch_to_infos[prefix][info] += 1

                elif sn == "Sheet10":
                    # Prova flera header_row
                    for hr in (3, 4, 5, 6, 7, 8):
                        if hr >= sh.nrows:
                            continue
                        try:
                            h = read_headers_only(sh, hr)
                            if any(x for x in h):
                                sheet10_headers_by_row[hr].update(h)
                        except Exception:
                            pass
                    # Aven samla alla header som Sheet10_all
                    for hr in (3, 4, 5, 6, 7, 8):
                        if hr >= sh.nrows:
                            continue
                        for v in read_headers_only(sh, hr):
                            if v:
                                sheet10_headers_all[v] += 1
        finally:
            wb.release_resources()

    # Presentera resultat
    print("=" * 70)
    print("SHEET5 — unika Fraction-varden (antal forekomster over alla filer)")
    print("=" * 70)
    for v, c in sorted(fraction_values.items(), key=lambda x: -x[1]):
        print(f"  {c:>4}x  {v!r}")

    print()
    print("=" * 70)
    print("SHEET9/11 — unika Info-varden (agregerat over alla ventiler)")
    print("=" * 70)
    print(f"Totalt {len(info_values)} unika Info-strangar over {sum(info_values.values())} rader")
    print()
    print("Topp 30 vanligaste Info-strangar:")
    for v, c in info_values.most_common(30):
        short = v if len(v) <= 80 else v[:77] + "..."
        print(f"  {c:>4}x  {short!r}")

    print()
    print("=" * 70)
    print("GREN-PREFIX -> INFO (aggregerat, endast grennr + unika info-texter)")
    print("=" * 70)
    for prefix in sorted(branch_to_infos.keys(), key=lambda p: (int(p) if p.isdigit() else 999, p)):
        infos = branch_to_infos[prefix]
        # Visa bara unika info-strangar per gren — ingen koppling ventil<->fastighet
        uniq = list(infos.keys())
        print(f"  Gren {prefix}: {len(uniq)} unika info-texter")
        for u in uniq[:5]:
            short = u if len(u) <= 80 else u[:77] + "..."
            print(f"      {short!r}")
        if len(uniq) > 5:
            print(f"      (+{len(uniq) - 5} fler)")

    print()
    print("=" * 70)
    print("SHEET9 rubriker (alla filer aggregerat)")
    print("=" * 70)
    for v, c in sorted(sheet9_headers_all.items(), key=lambda x: -x[1]):
        if v:
            print(f"  {c:>3}x  {v!r}")

    print()
    print("=" * 70)
    print("SHEET10 rubriker per header_row (alla filer aggregerat)")
    print("=" * 70)
    for hr in sorted(sheet10_headers_by_row.keys()):
        print(f"-- header_row={hr} --")
        for v, c in sorted(sheet10_headers_by_row[hr].items(), key=lambda x: -x[1]):
            if v:
                print(f"  {c:>3}x  {v!r}")

    print()
    print("=" * 70)
    print("SHEET11 rubriker (alla filer aggregerat)")
    print("=" * 70)
    for v, c in sorted(sheet11_headers_all.items(), key=lambda x: -x[1]):
        if v:
            print(f"  {c:>3}x  {v!r}")

    # Soek efter REPEATING_EMPTYING-liknande kolumnnamn
    print()
    print("=" * 70)
    print("POTENTIELLA REPEATING_EMPTYING/EMPTY-kolumner")
    print("=" * 70)
    keywords = ["repeat", "empty_cycle", "emptying", "reempty", "redo"]
    for name, src in (
        ("Sheet9", sheet9_headers_all),
        ("Sheet10", sheet10_headers_all),
        ("Sheet11", sheet11_headers_all),
    ):
        hits = [h for h in src if any(k in h.lower() for k in keywords)]
        print(f"{name}: {hits}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
