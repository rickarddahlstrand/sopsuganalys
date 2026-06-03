#!/usr/bin/env python3
"""Utforska struktur i Sheet3, Sheet5, Sheet7, Sheet9, Sheet11, Sheet13.

Syfte: avgora om varje ark innehaller per-fil snapshot eller historik
av flera manader.
"""

import os
import re
import sys
from pathlib import Path

import xlrd

TESTDATA = Path("/root/projects/sopsuganalys/testdata/zipped")
MONTH_RE = re.compile(r"^\d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$", re.IGNORECASE)


def open_wb(path):
    return xlrd.open_workbook(str(path), logfile=open(os.devnull, "w"), on_demand=True)


def is_month_label(val):
    s = str(val).strip()
    return bool(MONTH_RE.match(s))


def explore_sheet(wb, sheet_name, header_row, label_col=0):
    """Returns dict: { 'rows': N, 'data_rows': N, 'month_rows': N, 'sample_labels': [...] }"""
    try:
        sheet = wb.sheet_by_name(sheet_name)
    except Exception:
        return None
    total = sheet.nrows
    data_rows = 0
    month_rows = 0
    sample = []
    for r in range(header_row + 1, total):
        first = sheet.cell_value(r, label_col)
        s = str(first).strip()
        if not s or s.lower() == "nan":
            continue
        data_rows += 1
        if is_month_label(s):
            month_rows += 1
        if len(sample) < 8:
            sample.append(s)
    return {
        "rows": total,
        "data_rows": data_rows,
        "month_rows": month_rows,
        "sample_labels": sample,
    }


def snapshot_signature(wb, sheet_name, header_row, label_col=0):
    """Build a (label -> [vals across cols]) dict so we can compare files."""
    try:
        sheet = wb.sheet_by_name(sheet_name)
    except Exception:
        return None
    headers = [str(sheet.cell_value(header_row, c)).strip() for c in range(sheet.ncols)]
    data = {}
    for r in range(header_row + 1, sheet.nrows):
        key = str(sheet.cell_value(r, label_col)).strip()
        if not key or key.lower() == "nan":
            continue
        vals = []
        for c in range(sheet.ncols):
            v = sheet.cell_value(r, c)
            vals.append(str(v))
        data[key] = vals
    return {"headers": headers, "rows": data}


def main():
    files = sorted(TESTDATA.glob("Service_-_monthly_report_HammarbyGard_*.xls"))
    if not files:
        print("Inga filer hittades")
        return

    print(f"Hittade {len(files)} filer\n")

    # Struktur per ark for ett urval
    sample_files = [files[0], files[len(files) // 2], files[-1]]
    sheet_configs = [
        ("Sheet3", 4, 1),
        ("Sheet5", 4, 1),
        ("Sheet7", 4, 1),
        ("Sheet9", 3, 1),
        ("Sheet11", 3, 1),
        ("Sheet13", 7, 1),
    ]

    print("=" * 80)
    print("STRUKTUR (header_row enligt vad jag forsoker, label_col 0)")
    print("=" * 80)
    for f in sample_files:
        print(f"\n--- {f.name} ---")
        wb = open_wb(f)
        for sn, hr, lc in sheet_configs:
            info = explore_sheet(wb, sn, hr, lc)
            if info is None:
                print(f"  {sn}: saknas")
                continue
            print(f"  {sn} (header_row={hr}): rader={info['rows']}, "
                  f"data_rows={info['data_rows']}, month_rows={info['month_rows']}")
            print(f"    sample labels: {info['sample_labels']}")

    # Jamfor Sheet9/11/13 mellan tva filer for att verifiera per-fil snapshot
    print("\n" + "=" * 80)
    print("JAMFOR Sheet9 / Sheet11 / Sheet13 mellan 5_2025 och 9_2025")
    print("=" * 80)
    f5 = next((f for f in files if "_5_2025" in f.name), None)
    f9 = next((f for f in files if "_9_2025" in f.name), None)
    if not (f5 and f9):
        print("Kunde inte hitta 5_2025 eller 9_2025")
    else:
        wb5 = open_wb(f5)
        wb9 = open_wb(f9)
        for sn, hr, lc in [("Sheet9", 3, 1), ("Sheet11", 3, 1), ("Sheet13", 7, 1)]:
            sig5 = snapshot_signature(wb5, sn, hr, lc)
            sig9 = snapshot_signature(wb9, sn, hr, lc)
            if not sig5 or not sig9:
                print(f"\n{sn}: saknas i en eller fler filer")
                continue
            print(f"\n--- {sn} ---")
            print(f"  Headers: {sig5['headers'][:8]}")
            keys5 = set(sig5["rows"].keys())
            keys9 = set(sig9["rows"].keys())
            shared = keys5 & keys9
            print(f"  Keys i 5_2025: {len(keys5)}, 9_2025: {len(keys9)}, delade: {len(shared)}")
            identical = 0
            different = 0
            diff_examples = []
            for k in sorted(shared):
                v5 = sig5["rows"][k]
                v9 = sig9["rows"][k]
                if v5 == v9:
                    identical += 1
                else:
                    different += 1
                    if len(diff_examples) < 3:
                        diff_examples.append((k, v5[:5], v9[:5]))
            print(f"  Identiska rader: {identical}, olika: {different}")
            if diff_examples:
                print(f"  Exempel pa skillnad:")
                for k, v5, v9 in diff_examples:
                    print(f"    {k}: 5_2025={v5} vs 9_2025={v9}")

    # Verifiera att Sheet3 har historik som ar IDENTISK over filer for delade manader
    print("\n" + "=" * 80)
    print("VERIFIERA Sheet3-historik konsekvens over alla filer")
    print("=" * 80)
    month_data_per_file = {}
    for f in files:
        wb = open_wb(f)
        try:
            sh = wb.sheet_by_name("Sheet3")
        except Exception:
            continue
        # Skanna efter manad-label kolumn och Total-kolumn dynamiskt
        # Forst hitta header-rad och kolumner
        month_col = None
        total_col = None
        header_row = None
        for r in range(min(sh.nrows, 10)):
            for c in range(min(sh.ncols, 20)):
                v = str(sh.cell_value(r, c)).strip()
                if v == "Month":
                    month_col = c
                    header_row = r
                if v == "Total":
                    total_col = c
        if month_col is None or total_col is None:
            continue
        month_to_total = {}
        for r in range(header_row + 1, sh.nrows):
            label = str(sh.cell_value(r, month_col)).strip()
            if not is_month_label(label):
                continue
            total_e = sh.cell_value(r, total_col)
            month_to_total[label] = total_e
        month_data_per_file[f.name] = month_to_total

    # Aggregera per manad: { manad: { fil: total } }
    all_months = set()
    for d in month_data_per_file.values():
        all_months.update(d.keys())
    print(f"\nAlla unika manader i historiken: {sorted(all_months)}")
    print(f"\nMan vs fil (Total energy):")
    for m in sorted(all_months):
        vals_per_file = {fn: d.get(m) for fn, d in month_data_per_file.items() if m in d}
        if not vals_per_file:
            continue
        unique_vals = set(str(v) for v in vals_per_file.values())
        consistency = "OK" if len(unique_vals) == 1 else "MISMATCH"
        first_val = next(iter(vals_per_file.values()))
        print(f"  {m}: i {len(vals_per_file)} filer, {consistency}, "
              f"forsta varde={first_val}")
        if consistency == "MISMATCH":
            for fn, v in vals_per_file.items():
                print(f"    {fn}: {v}")

    # Berakna sant varde for senaste 14 manader (Feb 2025 - Mar 2026)
    print("\n" + "=" * 80)
    print("SANT VARDE Sheet3 Total energy summan over senaste 14 manaderna")
    print("(Tar fran den fil som har senast historik)")
    print("=" * 80)
    target_months = ["25-Feb", "25-Mar", "25-Apr", "25-May", "25-Jun", "25-Jul",
                     "25-Aug", "25-Sep", "25-Oct", "25-Nov", "25-Dec",
                     "26-Jan", "26-Feb", "26-Mar"]
    for fn, d in month_data_per_file.items():
        if all(m in d for m in target_months):
            print(f"\nFil med full historik: {fn}")
            total = 0
            for m in target_months:
                v = d[m]
                try:
                    n = float(v)
                except (ValueError, TypeError):
                    n = 0
                total += n
                print(f"  {m}: {n:.0f} kWh")
            print(f"  SUM 14 manader: {total:.0f} kWh")
            break
    else:
        print("Ingen fil har all 14 manaders historik. Aggregera istallet:")
        agg = {}
        for fn, d in month_data_per_file.items():
            for m, v in d.items():
                if m not in target_months:
                    continue
                try:
                    n = float(v)
                except (ValueError, TypeError):
                    n = 0
                # Anvand vilket varde som helst (alla ska vara identiska)
                if m not in agg:
                    agg[m] = n
        total = 0
        for m in target_months:
            if m in agg:
                print(f"  {m}: {agg[m]:.0f} kWh")
                total += agg[m]
            else:
                print(f"  {m}: SAKNAS")
        print(f"  SUM (manader som finns): {total:.0f} kWh")

    # Sheet5 month-row structure
    print("\n" + "=" * 80)
    print("Sheet5 month-row structure (i en fil)")
    print("=" * 80)
    f = files[-1]
    wb = open_wb(f)
    try:
        sh = wb.sheet_by_name("Sheet5")
    except Exception:
        return
    print(f"Fran fil: {f.name}, totalt rader: {sh.nrows}, kolumner: {sh.ncols}")
    for r in range(min(sh.nrows, 30)):
        cells = [str(sh.cell_value(r, c))[:20] for c in range(min(sh.ncols, 10))]
        print(f"  R{r}: {cells}")


if __name__ == "__main__":
    main()
