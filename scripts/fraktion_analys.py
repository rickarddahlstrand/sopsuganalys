#!/usr/bin/env python3
"""Fraktionsdjupanalys for sopsugsanlaggningen.

Extraherar oanvanda Sheet5-kolumner ("Hours", "Emptying/minute") for
containerfyllnadsanalys, genomstromning och sasongsvariation per fraktion.

Datakallor:
  - Sheet5 (rad 3): Fraction, Hours, kWh, Emptyings, Emptying/minute

Output:
  - output/fraktion_analys.csv — Per fraktion per manad, alla kolumner
  - output/fraktion_analys.png — 3x2 subplots
  - Textsammanfattning till stdout
"""

import re

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import (
    OUTPUT_DIR,
    MANAD_NAMN,
    get_report_files,
    read_sheet,
    ensure_output_dir,
)


def collect_fraction_full(report_files):
    """Samlar alla Sheet5-kolumner per fraktion per manad.

    Inkluderar oanvanda kolumner: Hours (fyllnadstid) och Emptying/minute.
    """
    rows = []
    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet5", header_row=3)

        frac_col = [c for c in df.columns if "fraction" in c.lower()]
        hours_col = [c for c in df.columns if c.lower().strip() == "hours"]
        kwh_col = [c for c in df.columns if "kwh" in c.lower()]
        empty_col = [c for c in df.columns if "emptying" in c.lower() and "minute" not in c.lower()]
        epm_col = [c for c in df.columns if "minute" in c.lower()]

        if not frac_col:
            continue

        for _, row in df.iterrows():
            frac = str(row[frac_col[0]]).strip()
            if not frac or frac == "nan":
                continue

            # Filtrera bort historiska manad-rader (t.ex. "Month", "24-Feb", "25-Jan")
            if frac.lower() == "month":
                continue
            if re.match(r"^\d{2}-\w+$", frac):
                continue

            hours = pd.to_numeric(row[hours_col[0]], errors="coerce") if hours_col else np.nan
            kwh = pd.to_numeric(row[kwh_col[0]], errors="coerce") if kwh_col else np.nan
            emptyings = pd.to_numeric(row[empty_col[0]], errors="coerce") if empty_col else np.nan
            epm = pd.to_numeric(row[epm_col[0]], errors="coerce") if epm_col else np.nan

            kwh_per_tomning = kwh / emptyings if pd.notna(kwh) and pd.notna(emptyings) and emptyings > 0 else np.nan

            rows.append({
                "Manad_nr": month_num,
                "Manad": month_name,
                "Fraktion": frac,
                "Timmar_hog_fyllnad": round(hours, 2) if pd.notna(hours) else np.nan,
                "kWh": round(kwh, 1) if pd.notna(kwh) else np.nan,
                "Tomningar": int(emptyings) if pd.notna(emptyings) else 0,
                "Tomning_per_minut": round(epm, 4) if pd.notna(epm) else np.nan,
                "kWh_per_tomning": round(kwh_per_tomning, 3) if pd.notna(kwh_per_tomning) else np.nan,
            })

    return pd.DataFrame(rows)


def compute_seasonal_analysis(df):
    """H1 vs H2, sommar vs vinter per fraktion."""
    if df.empty:
        return {}

    results = {}
    for frac in df["Fraktion"].unique():
        frac_data = df[df["Fraktion"] == frac]

        h1 = frac_data[frac_data["Manad_nr"] <= 6]
        h2 = frac_data[frac_data["Manad_nr"] > 6]
        sommar = frac_data[frac_data["Manad_nr"].isin([6, 7, 8])]
        vinter = frac_data[frac_data["Manad_nr"].isin([12, 1, 2])]

        h1_tom = h1["Tomningar"].sum()
        h2_tom = h2["Tomningar"].sum()
        variation = abs(h1_tom - h2_tom) / max(h1_tom, h2_tom, 1) * 100

        sommar_medel = sommar["Tomningar"].mean() if not sommar.empty else 0
        vinter_medel = vinter["Tomningar"].mean() if not vinter.empty else 0

        results[frac] = {
            "H1_tomningar": h1_tom,
            "H2_tomningar": h2_tom,
            "Halvars_variation_%": round(variation, 1),
            "Sommar_medel": round(sommar_medel, 0),
            "Vinter_medel": round(vinter_medel, 0),
        }
    return results


def compute_fill_analysis(df):
    """Timmar vid hog fyllnad: medel, topp, troskelvarden."""
    if df.empty or "Timmar_hog_fyllnad" not in df.columns:
        return {}

    results = {}
    for frac in df["Fraktion"].unique():
        frac_data = df[df["Fraktion"] == frac]
        hours = frac_data["Timmar_hog_fyllnad"].dropna()
        if hours.empty:
            continue
        results[frac] = {
            "medel_timmar": round(hours.mean(), 2),
            "max_timmar": round(hours.max(), 2),
            "min_timmar": round(hours.min(), 2),
            "topp_manad": frac_data.loc[hours.idxmax(), "Manad"] if len(hours) > 0 else "?",
        }
    return results


def compute_throughput(df):
    """Tomning/minut-trend, korrelation med energi."""
    if df.empty:
        return {}

    results = {}
    for frac in df["Fraktion"].unique():
        frac_data = df[df["Fraktion"] == frac].sort_values("Manad_nr")
        epm = frac_data["Tomning_per_minut"].dropna()
        if epm.empty:
            continue
        results[frac] = {
            "medel": round(epm.mean(), 4),
            "min": round(epm.min(), 4),
            "max": round(epm.max(), 4),
        }
    return results


def create_plots(df):
    """Skapar 6 individuella grafer for fraktionsanalys."""
    if df.empty:
        print("Ingen data att visualisera.")
        return

    fraktioner = sorted(df["Fraktion"].unique())
    colors = plt.cm.Set2(np.linspace(0, 1, len(fraktioner)))

    # 1. Tomningar per fraktion (area)
    fig, ax = plt.subplots(figsize=(10, 3.5))
    pivot_tom = df.pivot_table(index="Manad_nr", columns="Fraktion", values="Tomningar",
                                aggfunc="sum", fill_value=0).sort_index()
    pivot_tom.index = [MANAD_NAMN.get(i, str(i)) for i in pivot_tom.index]
    pivot_tom.plot.area(ax=ax, alpha=0.7, colormap="Set2")
    ax.set_title("Tomningar per fraktion (sasongsmonster)")
    ax.set_ylabel("Antal tomningar")
    ax.legend(fontsize=7, loc="upper right")
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "fraktion_tomningar.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 2. Fyllnadstid (grouped bar)
    fig, ax = plt.subplots(figsize=(10, 3.5))
    hours_data = df.dropna(subset=["Timmar_hog_fyllnad"])
    if not hours_data.empty:
        pivot_hours = hours_data.pivot_table(index="Manad_nr", columns="Fraktion",
                                              values="Timmar_hog_fyllnad", aggfunc="mean").sort_index()
        pivot_hours.index = [MANAD_NAMN.get(i, str(i)) for i in pivot_hours.index]
        pivot_hours.plot(kind="bar", ax=ax, colormap="Set2")
        ax.legend(fontsize=7)
    ax.set_title("Timmar vid hog fyllnadsgrad")
    ax.set_ylabel("Timmar")
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "fraktion_fyllnad.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 3. Genomstromning (tomning/minut) per fraktion over tid
    fig, ax = plt.subplots(figsize=(10, 3.5))
    epm_data = df.dropna(subset=["Tomning_per_minut"])
    if not epm_data.empty:
        for i, frac in enumerate(fraktioner):
            frac_data = epm_data[epm_data["Fraktion"] == frac].sort_values("Manad_nr")
            if not frac_data.empty:
                ax.plot(frac_data["Manad"], frac_data["Tomning_per_minut"],
                        "-o", markersize=4, label=frac, color=colors[i])
        ax.legend(fontsize=7)
    ax.set_title("Genomstromning (tomning/minut)")
    ax.set_ylabel("Tomning/minut")
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "fraktion_genomstromning.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 4. kWh per tomning per fraktion
    fig, ax = plt.subplots(figsize=(10, 3.5))
    kwh_data = df.dropna(subset=["kWh_per_tomning"])
    if not kwh_data.empty:
        for i, frac in enumerate(fraktioner):
            frac_data = kwh_data[kwh_data["Fraktion"] == frac].sort_values("Manad_nr")
            if not frac_data.empty:
                ax.plot(frac_data["Manad"], frac_data["kWh_per_tomning"],
                        "-o", markersize=4, label=frac, color=colors[i])
        ax.legend(fontsize=7)
    ax.set_title("Energieffektivitet per fraktion")
    ax.set_ylabel("kWh / tomning")
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "fraktion_effektivitet.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 5. Heatmap: fraktion x manad (tomningar)
    fig, ax = plt.subplots(figsize=(10, 4.5))
    pivot_hm = df.pivot_table(index="Fraktion", columns="Manad_nr", values="Tomningar",
                               aggfunc="sum", fill_value=0).sort_index()
    pivot_hm.columns = [MANAD_NAMN.get(c, str(c)) for c in pivot_hm.columns]
    if not pivot_hm.empty:
        im = ax.imshow(pivot_hm.values, aspect="auto", cmap="YlOrRd")
        ax.set_xticks(range(len(pivot_hm.columns)))
        ax.set_xticklabels(pivot_hm.columns, fontsize=7, rotation=45)
        ax.set_yticks(range(len(pivot_hm.index)))
        ax.set_yticklabels(pivot_hm.index, fontsize=8)
        fig.colorbar(im, ax=ax, label="Tomningar", shrink=0.8)
    ax.set_title("Tomnings-heatmap")
    plt.tight_layout()
    path = OUTPUT_DIR / "fraktion_heatmap.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 6. Sommar vs vinter per fraktion
    fig, ax = plt.subplots(figsize=(10, 3.5))
    sommar = df[df["Manad_nr"].isin([6, 7, 8])].groupby("Fraktion")["Tomningar"].mean()
    vinter = df[df["Manad_nr"].isin([12, 1, 2])].groupby("Fraktion")["Tomningar"].mean()
    if not sommar.empty and not vinter.empty:
        x = np.arange(len(fraktioner))
        width = 0.35
        ax.bar(x - width / 2, [sommar.get(f, 0) for f in fraktioner], width,
               color="#FF9800", alpha=0.8, label="Sommar (jun-aug)")
        ax.bar(x + width / 2, [vinter.get(f, 0) for f in fraktioner], width,
               color="#2196F3", alpha=0.8, label="Vinter (dec-feb)")
        ax.set_xticks(x)
        ax.set_xticklabels(fraktioner, fontsize=8)
        ax.legend(fontsize=8)
    ax.set_title("Sommar vs vinter per fraktion")
    ax.set_ylabel("Medel tomningar/manad")
    plt.tight_layout()
    path = OUTPUT_DIR / "fraktion_sasong.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")


def print_summary(df, seasonal, fill, throughput):
    """Skriver textsammanfattning till stdout."""
    print("\n" + "=" * 60)
    print("FRAKTIONSANALYS — Sammanfattning 2025")
    print("=" * 60)

    if df.empty:
        print("Ingen fraktionsdata hittades.")
        return

    fraktioner = df["Fraktion"].unique()
    print(f"\nAntal fraktioner: {len(fraktioner)}")
    print(f"Fraktioner: {', '.join(sorted(fraktioner))}")

    # Totaler per fraktion
    print(f"\nTomningar per fraktion (aret):")
    totals = df.groupby("Fraktion")["Tomningar"].sum().sort_values(ascending=False)
    for frac, count in totals.items():
        print(f"  {frac}: {count:,}")

    # Fyllnadsanalys
    if fill:
        print(f"\nFyllnadstider (timmar vid hog fyllnadsgrad):")
        for frac, info in fill.items():
            print(f"  {frac}: medel {info['medel_timmar']:.1f}h, "
                  f"max {info['max_timmar']:.1f}h ({info['topp_manad']})")

    # Sasongsvariation
    if seasonal:
        print(f"\nSasongsvariation:")
        for frac, info in seasonal.items():
            print(f"  {frac}: H1={info['H1_tomningar']:,} H2={info['H2_tomningar']:,} "
                  f"(variation {info['Halvars_variation_%']:.0f}%) "
                  f"sommar={info['Sommar_medel']:.0f} vinter={info['Vinter_medel']:.0f}")

    # Genomstromning
    if throughput:
        print(f"\nGenomstromning (tomning/minut):")
        for frac, info in throughput.items():
            print(f"  {frac}: medel {info['medel']:.4f} "
                  f"(min {info['min']:.4f}, max {info['max']:.4f})")

    print("\n" + "=" * 60)


def main():
    ensure_output_dir()
    report_files = get_report_files()

    if not report_files:
        print("Inga rapportfiler hittades!")
        return

    print(f"Laser {len(report_files)} rapporter for fraktionsanalys...\n")

    # Datainsamling
    df = collect_fraction_full(report_files)
    print(f"Totalt {len(df)} rader, {df['Fraktion'].nunique()} fraktioner")

    # Analyser
    seasonal = compute_seasonal_analysis(df)
    fill = compute_fill_analysis(df)
    throughput = compute_throughput(df)

    # Spara CSV
    csv_path = OUTPUT_DIR / "fraktion_analys.csv"
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"CSV sparad: {csv_path}")

    # Graf
    create_plots(df)

    # Sammanfattning
    print_summary(df, seasonal, fill, throughput)


if __name__ == "__main__":
    main()
