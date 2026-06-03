#!/usr/bin/env python3
"""Energi- och driftanalys av sopsugsanlaggningen.

Datakallor (uppdaterat efter strukturanalys 2025):
  - Sheet3: header pa rad 4 ("Month, Auto, Manual, Idle, Total, ..., Auto, Manual, Idle").
    Innehaller per-manad historik. Filtrera "SUM"-rad.
  - Sheet5: blandad struktur, per-manad historik finns efter rad med "Month"-header.
    Vi laser per-fraktion data fran de subgrupperade kolumnerna.
  - Sheet7 (header rad 4): per-fil snapshot av programstatistik (Name, ID, Starts,
    Hours, kWh).

Eftersom historiken oftast ar identisk mellan filer som rapporterar samma
manad dedupar vi pa "YY-Mon"-etiketten och plockar forsta icke-tomma vardet.

Output:
  - output/energi_drift.csv
  - output/energi_drift.png
  - Textsammanfattning till stdout
"""

import os
import re

import pandas as pd
import xlrd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import (
    MANAD_NAMN,
    OUTPUT_DIR,
    get_report_files,
    read_sheet,
    ensure_output_dir,
)


MONTH_LABEL_RE = re.compile(r"^\d{2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$", re.IGNORECASE)
MONTH_ABBR = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _open_wb(path):
    return xlrd.open_workbook(str(path), logfile=open(os.devnull, "w"))


def _is_month_label(s):
    return bool(MONTH_LABEL_RE.match(str(s).strip()))


def _label_to_sortkey(label):
    m = re.match(r"^(\d{2})-([A-Za-z]{3})$", str(label).strip())
    if not m:
        return None
    return (2000 + int(m.group(1))) * 100 + MONTH_ABBR[m.group(2).lower()]


def read_sheet3_history(filepath):
    """Las Sheet3-historik som lista av dict per manad."""
    wb = _open_wb(filepath)
    sh = wb.sheet_by_name("Sheet3")

    # Hitta supergrupper Energy / Operation Time
    energy_start, time_start = -1, -1
    for r in range(min(sh.nrows, 6)):
        for c in range(sh.ncols):
            v = str(sh.cell_value(r, c)).strip().lower()
            if "energy" in v and "kwh" in v and energy_start < 0:
                energy_start = c
            if "operation" in v and "time" in v and time_start < 0:
                time_start = c

    # Hitta header-rad och kolumner
    header_row = -1
    cols = {"month": -1, "eAuto": -1, "eManual": -1, "eIdle": -1, "eTotal": -1,
            "tAuto": -1, "tManual": -1, "tIdle": -1}
    for r in range(min(sh.nrows, 8)):
        for c in range(sh.ncols):
            v = str(sh.cell_value(r, c)).strip()
            if v == "Month":
                cols["month"] = c
                header_row = r
        if header_row >= 0:
            break
    if header_row < 0:
        return []

    for c in range(sh.ncols):
        v = str(sh.cell_value(header_row, c)).strip()
        if v not in ("Auto", "Manual", "Idle", "Total"):
            continue
        is_energy = c < time_start if (energy_start >= 0 and time_start >= 0) else True
        key = {"Auto": "eAuto" if is_energy else "tAuto",
               "Manual": "eManual" if is_energy else "tManual",
               "Idle": "eIdle" if is_energy else "tIdle",
               "Total": "eTotal" if is_energy else None}[v]
        if key:
            cols[key] = c

    rows = []
    for r in range(header_row + 1, sh.nrows):
        label = str(sh.cell_value(r, cols["month"])).strip() if cols["month"] >= 0 else ""
        if not label or label.upper() == "SUM" or not _is_month_label(label):
            continue
        def get(k):
            c = cols.get(k, -1)
            if c < 0:
                return 0.0
            v = sh.cell_value(r, c)
            try:
                return float(v) if v != "" else 0.0
            except (ValueError, TypeError):
                return 0.0
        rows.append({
            "monthLabel": label,
            "sortKey": _label_to_sortkey(label),
            "energyAuto": get("eAuto"),
            "energyManual": get("eManual"),
            "energyIdle": get("eIdle"),
            "energyTotal": get("eTotal"),
            "timeAuto": get("tAuto"),
            "timeManual": get("tManual"),
            "timeIdle": get("tIdle"),
        })
    return rows


def read_sheet5_history(filepath):
    """Las Sheet5-historik som lista per manad med perFraction-dict."""
    wb = _open_wb(filepath)
    sh = wb.sheet_by_name("Sheet5")

    # Hitta historik-headern (rad med "Month" i en kolumn)
    hist_row = -1
    month_col = -1
    for r in range(sh.nrows):
        for c in range(sh.ncols):
            if str(sh.cell_value(r, c)).strip() == "Month":
                hist_row = r
                month_col = c
                break
        if hist_row >= 0:
            break
    if hist_row < 0:
        return []

    # Supergrupp-rad ovanfor: fyll fraction per kolumn
    super_row = hist_row - 1
    frac_for_col = {}
    current_frac = None
    for c in range(sh.ncols):
        if super_row >= 0:
            v = str(sh.cell_value(super_row, c)).strip()
            if v:
                current_frac = v
        if current_frac:
            frac_for_col[c] = current_frac

    # Header-rad: bygg colSpec
    col_spec = {}
    for c in range(sh.ncols):
        v = str(sh.cell_value(hist_row, c)).strip()
        if v in ("Hours", "Energy", "Emptyings") and c in frac_for_col:
            col_spec[c] = (frac_for_col[c], v.lower())

    rows = []
    for r in range(hist_row + 1, sh.nrows):
        label = str(sh.cell_value(r, month_col)).strip()
        if not label or label.upper() == "SUM" or not _is_month_label(label):
            continue
        per_frac = {}
        for c, (frac, field) in col_spec.items():
            v = sh.cell_value(r, c)
            try:
                num = float(v) if v != "" else 0.0
            except (ValueError, TypeError):
                num = 0.0
            if frac not in per_frac:
                per_frac[frac] = {"hours": 0.0, "energy": 0.0, "emptyings": 0.0}
            per_frac[frac][field] = num
        rows.append({
            "monthLabel": label,
            "sortKey": _label_to_sortkey(label),
            "perFraction": per_frac,
        })
    return rows


def collect_combined_monthly_history(report_files):
    """Bygg en deduperad manadshistorik fran alla filers Sheet3+Sheet5.

    For varje manads-label valjs det varde som har storst dataunderlag
    (energi > 0 prioriteras over tom cell).
    """
    s3_per_label = {}
    s5_per_label = {}
    for _, _, filepath in report_files:
        for m in read_sheet3_history(filepath):
            s3_per_label.setdefault(m["monthLabel"], []).append(m)
        for m in read_sheet5_history(filepath):
            s5_per_label.setdefault(m["monthLabel"], []).append(m)

    labels = sorted(set(s3_per_label.keys()) | set(s5_per_label.keys()),
                    key=lambda lbl: _label_to_sortkey(lbl) or 0)
    result = []
    for lbl in labels:
        s3c = s3_per_label.get(lbl, [])
        s5c = s5_per_label.get(lbl, [])
        m3 = next((c for c in s3c if c["energyTotal"] > 0), s3c[0] if s3c else None)
        m5 = next((c for c in s5c
                   if sum(d.get("emptyings", 0) for d in c["perFraction"].values()) > 0),
                  s5c[0] if s5c else None)

        sort_key = (m3 or m5)["sortKey"]
        month_num = sort_key % 100
        result.append({
            "Manad_label": lbl,
            "Manad_nr": month_num,
            "Manad": MANAD_NAMN.get(month_num, "?"),
            "sortKey": sort_key,
            "Energi_kWh": round(m3["energyTotal"] if m3 else 0.0, 1),
            "Drifttid_h": round(((m3 or {}).get("timeAuto", 0.0) + (m3 or {}).get("timeManual", 0.0)
                                 + (m3 or {}).get("timeIdle", 0.0)), 1),
            "perFraction": (m5 or {}).get("perFraction", {}),
        })
    return result


def collect_energy_data(report_files):
    """Manatlig energi och drifttid fran kombinerad historik."""
    history = collect_combined_monthly_history(report_files)
    return pd.DataFrame([{
        "Manad_nr": m["Manad_nr"],
        "Manad": m["Manad"],
        "sortKey": m["sortKey"],
        "Manad_label": m["Manad_label"],
        "Energi_kWh": m["Energi_kWh"],
        "Drifttid_h": m["Drifttid_h"],
    } for m in history])


def collect_fraction_data(report_files):
    """Tomningar per fraktion per manad fran kombinerad historik."""
    history = collect_combined_monthly_history(report_files)
    rows = []
    for m in history:
        for frac, data in m["perFraction"].items():
            emp = int(data.get("emptyings", 0))
            if emp > 0:
                rows.append({
                    "Manad_nr": m["Manad_nr"],
                    "Manad": m["Manad"],
                    "sortKey": m["sortKey"],
                    "Manad_label": m["Manad_label"],
                    "Fraktion": frac,
                    "Tomningar": emp,
                })
    return pd.DataFrame(rows)


def collect_machine_data(report_files):
    """Sheet7 ar per-fil snapshot — vi tar medel over filerna."""
    raw_by_month = {}
    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet7", header_row=4)
        name_col = [c for c in df.columns if "name" in c.lower()]
        starts_col = [c for c in df.columns if "start" in c.lower()]
        hours_col = [c for c in df.columns if "hour" in c.lower()]
        kwh_col = [c for c in df.columns if "kwh" in c.lower()]

        if not name_col:
            continue

        per_machine = {}
        for _, row in df.iterrows():
            name = str(row[name_col[0]]).strip()
            if not name or name == "nan":
                continue
            if name.lower() == "total":
                continue
            per_machine[name] = {
                "starter": pd.to_numeric(row[starts_col[0]], errors="coerce") if starts_col else 0,
                "timmar": pd.to_numeric(row[hours_col[0]], errors="coerce") if hours_col else 0,
                "kwh": pd.to_numeric(row[kwh_col[0]], errors="coerce") if kwh_col else 0,
            }
        raw_by_month[month_num] = (month_name, per_machine)

    rows = []
    for m, (name_m, cur_mach) in raw_by_month.items():
        for mname, vals in cur_mach.items():
            rows.append({
                "Manad_nr": m,
                "Manad": name_m,
                "Maskin": mname,
                "Starter": vals["starter"],
                "Drifttimmar": vals["timmar"],
                "kWh": vals["kwh"],
            })
    return pd.DataFrame(rows)


def create_summary_csv(energy_df, fraction_df):
    """Sparar manatlig sammanfattning till CSV.

    Stoder bade nya (ASCII) och gamla (ar med a-umlaut) kolumnnamn for
    bakatkompatibilitet med befintliga tester.
    """
    # Normalisera kolumnnamn — acceptera bade "Manad_nr" och "Månad_nr"
    def _norm(df):
        rename = {}
        for c in df.columns:
            if c == "Månad_nr": rename[c] = "Manad_nr"
            elif c == "Månad": rename[c] = "Manad"
            elif c == "Tömningar": rename[c] = "Tomningar"
        return df.rename(columns=rename) if rename else df

    energy_df = _norm(energy_df)
    fraction_df = _norm(fraction_df) if not fraction_df.empty else fraction_df

    if not fraction_df.empty:
        index_cols = [c for c in ("sortKey", "Manad_nr", "Manad") if c in fraction_df.columns]
        pivot = fraction_df.pivot_table(
            index=index_cols,
            columns="Fraktion",
            values="Tomningar",
            aggfunc="sum",
            fill_value=0,
        ).reset_index()
        pivot.columns.name = None

        merge_on = [c for c in index_cols if c in energy_df.columns]
        summary = energy_df.merge(pivot, on=merge_on, how="left") if merge_on else energy_df.copy()
    else:
        summary = energy_df.copy()

    sort_col = "sortKey" if "sortKey" in summary.columns else "Manad_nr"
    summary = summary.sort_values(sort_col)
    output_path = OUTPUT_DIR / "energi_drift.csv"
    summary.to_csv(output_path, index=False, encoding="utf-8-sig")
    return summary


def create_plots(energy_df, fraction_df):
    """Skapar graf med 3 subplots."""
    fig, axes = plt.subplots(3, 1, figsize=(12, 12))
    fig.suptitle("Energi & Drift — Sopsuganlaggningen", fontsize=14, fontweight="bold")

    energy_sorted = energy_df.sort_values("sortKey") if "sortKey" in energy_df.columns else energy_df.sort_values("Manad_nr")
    months = energy_sorted["Manad"]

    ax1 = axes[0]
    bars = ax1.bar(months, energy_sorted["Energi_kWh"], color="#2196F3")
    ax1.set_ylabel("kWh")
    ax1.set_title("Energiforbrukning per manad")
    ax1.bar_label(bars, fmt="%.0f", fontsize=7)
    ax1.tick_params(axis="x", rotation=45)

    ax2 = axes[1]
    if not fraction_df.empty:
        pivot = fraction_df.pivot_table(
            index="sortKey",
            columns="Fraktion",
            values="Tomningar",
            aggfunc="sum",
            fill_value=0,
        ).sort_index()
        pivot.index = [energy_sorted.set_index("sortKey").loc[i, "Manad"] for i in pivot.index]
        pivot.plot(kind="bar", stacked=True, ax=ax2, colormap="Set2")
        ax2.legend(fontsize=7, loc="upper left")
    ax2.set_ylabel("Antal tomningar")
    ax2.set_title("Tomningar per fraktion per manad")
    ax2.tick_params(axis="x", rotation=45)

    ax3 = axes[2]
    ax3.plot(months, energy_sorted["Drifttid_h"], marker="o", color="#FF9800", linewidth=2)
    ax3.set_ylabel("Timmar")
    ax3.set_title("Drifttid per manad")
    ax3.fill_between(months, energy_sorted["Drifttid_h"], alpha=0.15, color="#FF9800")
    ax3.tick_params(axis="x", rotation=45)

    plt.tight_layout()
    output_path = OUTPUT_DIR / "energi_drift.png"
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return output_path


def print_summary(energy_df, fraction_df, machine_df):
    """Skriver textsammanfattning till stdout."""
    print("=" * 60)
    print("ENERGI & DRIFT — Sammanfattning")
    print("=" * 60)

    if not energy_df.empty:
        total_energy = energy_df["Energi_kWh"].sum()
        total_hours = energy_df["Drifttid_h"].sum()
        avg_energy = energy_df["Energi_kWh"].mean()
        print(f"\nTotal energiforbrukning: {total_energy:,.0f} kWh")
        print(f"Medelenergi per manad:   {avg_energy:,.0f} kWh")
        print(f"Total drifttid:          {total_hours:,.0f} h")

        max_month = energy_df.loc[energy_df["Energi_kWh"].idxmax()]
        min_month = energy_df.loc[energy_df["Energi_kWh"].idxmin()]
        print(f"Hogst forbrukning:       {max_month['Manad']} ({max_month['Energi_kWh']:,.0f} kWh)")
        print(f"Lagst forbrukning:       {min_month['Manad']} ({min_month['Energi_kWh']:,.0f} kWh)")

    if not fraction_df.empty:
        print(f"\nTomningar per fraktion (totalt):")
        totals = fraction_df.groupby("Fraktion")["Tomningar"].sum().sort_values(ascending=False)
        for frac, count in totals.items():
            print(f"  {frac}: {count:,}")
        print(f"  Totalt: {totals.sum():,}")

    if not machine_df.empty:
        print(f"\nMaskinstatistik (snitt per maskin):")
        avg = machine_df.groupby("Maskin").agg({
            "Starter": "mean",
            "Drifttimmar": "mean",
            "kWh": "mean",
        }).round(1)
        for name, row in avg.iterrows():
            print(f"  {name}: {row['Starter']:.0f} starter, "
                  f"{row['Drifttimmar']:.1f} h, {row['kWh']:.0f} kWh/man")

    print("\n" + "=" * 60)


def main():
    ensure_output_dir()
    report_files = get_report_files()

    if not report_files:
        print("Inga rapportfiler hittades!")
        return

    print(f"Laser {len(report_files)} rapporter...")

    energy_df = collect_energy_data(report_files)
    fraction_df = collect_fraction_data(report_files)
    machine_df = collect_machine_data(report_files)

    create_summary_csv(energy_df, fraction_df)
    print(f"CSV sparad: {OUTPUT_DIR / 'energi_drift.csv'}")

    plot_path = create_plots(energy_df, fraction_df)
    print(f"Graf sparad: {plot_path}")

    print_summary(energy_df, fraction_df, machine_df)


if __name__ == "__main__":
    main()
