#!/usr/bin/env python3
"""Sheet1-utvinning (discovery) for sopsugsanlaggningen.

Sheet1 ar den enda ej utlasta arket. Innehaller ~37 rader nyckel-varde-par
per manad med anlaggningssammanfattning. Etiketter finns i sammanslagna
celler (kolumn 0-5), varden i kolumn 6 ("Value"), kommentarer i kolumn 8.

Datakallor:
  - Sheet1 (rad 9): Value, Comment — generell sammanfattning

Output:
  - output/sammanfattning.csv       — Pivoterad: KPI-namn x Jan-Dec
  - output/sammanfattning_kpi_lista.csv — Upptackta KPI:er med typ, min/max/medel
  - output/sammanfattning.png       — Visualisering av nyckelfynd
  - stdout: Lista alla upptackta nycklar
"""

import os
import re

import numpy as np
import pandas as pd
import xlrd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import (
    OUTPUT_DIR,
    MANAD_NAMN,
    RAPPORT_DIR,
    get_report_files,
    ensure_output_dir,
)


def read_sheet1(filepath):
    """Custom xlrd-lasare for Sheet1.

    Sheet1 har ovanlig struktur: etiketter i sammanslagna celler (kol 0-5),
    varden i kolumn 6 ("Value"), kommentarer i kolumn 8 ("Comment").
    common.read_sheet() strippar tomma kolumner sa vi anvander xlrd direkt.
    """
    wb = xlrd.open_workbook(str(filepath), logfile=open(os.devnull, "w"), on_demand=True)
    sheet = wb.sheet_by_name("Sheet1")

    rows = []
    for row_idx in range(10, sheet.nrows):  # Data borjar efter rubrikrad 9
        # Skanna kolumn 0-5 for etikett (sammanslagna celler)
        label_parts = []
        for col in range(6):
            val = sheet.cell_value(row_idx, col)
            if val and str(val).strip():
                label_parts.append(str(val).strip())
        label = " ".join(label_parts).strip()

        if not label:
            continue

        # Varde i kolumn 6
        value = None
        if sheet.ncols > 6:
            raw = sheet.cell_value(row_idx, 6)
            if raw != "" and raw is not None:
                value = raw

        # Kommentar i kolumn 8
        comment = ""
        if sheet.ncols > 8:
            raw = sheet.cell_value(row_idx, 8)
            if raw and str(raw).strip():
                comment = str(raw).strip()

        if value is not None or comment:
            rows.append({
                "Nyckel": label,
                "Varde": value,
                "Kommentar": comment,
            })

    return rows


def collect_all_months(report_files):
    """Samlar Sheet1-data fran alla manader."""
    all_rows = []
    for month_num, month_name, filepath in report_files:
        month_data = read_sheet1(filepath)
        for row in month_data:
            all_rows.append({
                "Manad_nr": month_num,
                "Manad": month_name,
                **row,
            })
    return pd.DataFrame(all_rows)


def identify_kpis(df):
    """Gruppera nycklar, klassificera typ (numerisk/text), hitta enheter."""
    if df.empty:
        return pd.DataFrame()

    kpi_info = []
    for key in df["Nyckel"].unique():
        key_data = df[df["Nyckel"] == key]
        values = key_data["Varde"].dropna()

        # Forsoker konvertera till numerisk
        numeric_vals = pd.to_numeric(values, errors="coerce")
        n_numeric = numeric_vals.notna().sum()
        n_total = len(values)

        if n_numeric > 0 and n_numeric >= n_total * 0.5:
            typ = "numerisk"
            vals = numeric_vals.dropna()
            kpi_info.append({
                "KPI": key,
                "Typ": typ,
                "Antal_manader": n_total,
                "Min": round(vals.min(), 2),
                "Max": round(vals.max(), 2),
                "Medel": round(vals.mean(), 2),
                "Enhet": _guess_unit(key),
            })
        else:
            typ = "text"
            kpi_info.append({
                "KPI": key,
                "Typ": typ,
                "Antal_manader": n_total,
                "Min": None,
                "Max": None,
                "Medel": None,
                "Enhet": "",
            })

    return pd.DataFrame(kpi_info)


def _guess_unit(key):
    """Forsok gissa enhet fran nyckelnamn."""
    key_lower = key.lower()
    if "kwh" in key_lower or "energy" in key_lower:
        return "kWh"
    elif "kpa" in key_lower or "vacuum" in key_lower or "tryck" in key_lower:
        return "kPa"
    elif "ton" in key_lower or "weight" in key_lower or "vikt" in key_lower:
        return "ton"
    elif "hour" in key_lower or "timm" in key_lower or "time" in key_lower:
        return "h"
    elif "%" in key_lower or "percent" in key_lower or "andel" in key_lower:
        return "%"
    elif "transport" in key_lower:
        return "st"
    return ""


def create_pivoted_csv(df):
    """Pivotera: KPI-rader x manad-kolumner. Sparar numeriska KPI:er."""
    if df.empty:
        return pd.DataFrame()

    # Konvertera varden till numerisk dar mojligt
    df_copy = df.copy()
    df_copy["Varde_num"] = pd.to_numeric(df_copy["Varde"], errors="coerce")

    # Filtera till rader med numeriska varden
    numeric_df = df_copy.dropna(subset=["Varde_num"])

    if numeric_df.empty:
        # Om inga numeriska, pivotera textvarden
        pivot = df.pivot_table(
            index="Nyckel",
            columns="Manad",
            values="Varde",
            aggfunc="first",
        )
    else:
        pivot = numeric_df.pivot_table(
            index="Nyckel",
            columns="Manad_nr",
            values="Varde_num",
            aggfunc="first",
        )
        # Byt ut manadsnummer mot namn
        pivot.columns = [MANAD_NAMN.get(c, str(c)) for c in pivot.columns]

    path = OUTPUT_DIR / "sammanfattning.csv"
    pivot.to_csv(path, encoding="utf-8-sig")
    print(f"CSV sparad: {path}")
    return pivot


def create_plots(df, kpi_df):
    """Skapar individuella visualiseringar for topp-6 mest varierande KPI:er.

    Sparar varje KPI som en separat fil: sammanfattning_1.png ... sammanfattning_6.png.
    Returnerar antalet sparade filer (int).
    """
    if df.empty:
        print("Ingen data att visualisera.")
        return 0

    # Hitta numeriska KPI:er
    numeric_kpis = kpi_df[kpi_df["Typ"] == "numerisk"]
    if numeric_kpis.empty:
        print("Inga numeriska KPI:er att plotta.")
        return 0

    # Valj topp-6 mest varierande KPI:er for plottar
    kpis_to_plot = numeric_kpis.sort_values("Max", ascending=False).head(6)

    if kpis_to_plot.empty:
        return 0

    saved_count = 0

    for i, (_, kpi_row) in enumerate(kpis_to_plot.iterrows()):
        kpi_name = kpi_row["KPI"]
        unit = kpi_row["Enhet"]

        # Hamta data for denna KPI
        kpi_data = df[df["Nyckel"] == kpi_name].copy()
        kpi_data["Varde_num"] = pd.to_numeric(kpi_data["Varde"], errors="coerce")
        kpi_data = kpi_data.dropna(subset=["Varde_num"]).sort_values("Manad_nr")

        if kpi_data.empty:
            continue

        months = kpi_data["Manad"].values
        values = kpi_data["Varde_num"].values

        fig, ax = plt.subplots(figsize=(10, 3.5))
        ax.bar(months, values, color="#2196F3", alpha=0.7)
        ax.plot(months, values, "ro-", markersize=4, linewidth=1.5)
        ax.set_title(kpi_name, fontsize=12)
        ylabel = f"Varde ({unit})" if unit else "Varde"
        ax.set_ylabel(ylabel, fontsize=10)
        ax.tick_params(axis="x", rotation=45, labelsize=8)

        plt.tight_layout()
        filename = f"sammanfattning_{saved_count + 1}.png"
        path = OUTPUT_DIR / filename
        fig.savefig(path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        saved_count += 1
        print(f"Graf sparad: {path}")

    return saved_count


def print_discovery(df, kpi_df):
    """Skriver ut alla upptackta nycklar for verifiering."""
    print("\n" + "=" * 60)
    print("SHEET1 DISCOVERY — Alla nycklar")
    print("=" * 60)

    if df.empty:
        print("Inga nycklar hittades i Sheet1.")
        return

    unique_keys = df["Nyckel"].unique()
    print(f"\nAntal unika nycklar: {len(unique_keys)}")
    print(f"Antal manader: {df['Manad_nr'].nunique()}")

    print(f"\nNumeriska KPI:er:")
    numeric = kpi_df[kpi_df["Typ"] == "numerisk"]
    for _, row in numeric.iterrows():
        print(f"  {row['KPI']}: {row['Min']} - {row['Max']} "
              f"(medel {row['Medel']}) [{row['Enhet']}] "
              f"({row['Antal_manader']} man)")

    text_kpis = kpi_df[kpi_df["Typ"] == "text"]
    if not text_kpis.empty:
        print(f"\nText-KPI:er:")
        for _, row in text_kpis.iterrows():
            print(f"  {row['KPI']} ({row['Antal_manader']} man)")

    # Sammanfattning av vad som hittades
    print(f"\n--- Sokning efter nyckeldata ---")
    key_lower = {k.lower(): k for k in unique_keys}

    for term, desc in [
        ("ton", "Tonnage/vikt"),
        ("weight", "Vikt"),
        ("vacuum", "Vakuumtryck"),
        ("kpa", "kPa-tryck"),
        ("transport", "Transportantal"),
        ("stillest", "Stillestand"),
        ("avbrott", "Driftavbrott"),
    ]:
        matches = [k for k_low, k in key_lower.items() if term in k_low]
        if matches:
            print(f"  {desc}: HITTAD -> {matches}")
        else:
            print(f"  {desc}: ej hittad")

    print("\n" + "=" * 60)


def main():
    ensure_output_dir()
    report_files = get_report_files()

    if not report_files:
        print("Inga rapportfiler hittades!")
        return

    print(f"Laser {len(report_files)} rapporter for Sheet1-discovery...\n")

    # Samla all data
    df = collect_all_months(report_files)
    print(f"Totalt {len(df)} rader fran {df['Manad_nr'].nunique()} manader")

    # Identifiera KPI:er
    kpi_df = identify_kpis(df)

    # Spara KPI-lista
    if not kpi_df.empty:
        kpi_path = OUTPUT_DIR / "sammanfattning_kpi_lista.csv"
        kpi_df.to_csv(kpi_path, index=False, encoding="utf-8-sig")
        print(f"KPI-lista sparad: {kpi_path}")

    # Pivoterad CSV
    create_pivoted_csv(df)

    # Graf
    create_plots(df, kpi_df)

    # Discovery-utskrift
    print_discovery(df, kpi_df)


if __name__ == "__main__":
    main()
