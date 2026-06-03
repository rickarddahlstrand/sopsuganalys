#!/usr/bin/env python3
"""Fraktionsdjupanalys for sopsugsanlaggningen.

Anvander den kombinerade per-manad-historiken (deduperad over alla filer)
istallet for per-fil snapshot. Det gor att en enstaka uppladdad fil ger
upp till 13 manaders historik och flera filer dedupar pa "YY-Mon".

Output:
  - output/fraktion_analys.csv — Per fraktion per manad
  - output/fraktion_analys.png — 6 individuella grafer
  - Textsammanfattning till stdout
"""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import (
    OUTPUT_DIR,
    MANAD_NAMN,
    get_report_files,
    ensure_output_dir,
)
from energi_drift import collect_combined_monthly_history, read_sheet5_history


def collect_fraction_full(report_files):
    """Kombinerar Sheet5-historiken (energi+tomningar per fraktion per manad)
    med per-fil fraktionssummering (for "Emptying/minute" som inte finns i historiken).
    """
    history = collect_combined_monthly_history(report_files)

    # Bygg lookup for emptying/minute per fil — kopplas till filens rapportmanad
    epm_lookup = {}  # (sortKey, fraction) -> epm
    import xlrd
    import os
    for month_num, month_name, filepath in report_files:
        # Hitta Sheet5 fraktions-summan ("Fraction" header med Hours/kWh/Emptyings/Emptying/minute)
        wb = xlrd.open_workbook(str(filepath), logfile=open(os.devnull, "w"))
        sh = wb.sheet_by_name("Sheet5")
        # Hitta header-rad med "Fraction"
        frac_row = -1
        frac_col, hours_col, kwh_col, empty_col, epm_col = -1, -1, -1, -1, -1
        for r in range(min(sh.nrows, 8)):
            for c in range(sh.ncols):
                v = str(sh.cell_value(r, c)).strip()
                if v == "Fraction":
                    frac_col = c
                    frac_row = r
                elif v == "Hours" and hours_col < 0:
                    hours_col = c
                elif v == "kWh" and kwh_col < 0:
                    kwh_col = c
                elif v == "Emptyings" and empty_col < 0:
                    empty_col = c
                elif "emptying" in v.lower() and "minute" in v.lower() and epm_col < 0:
                    epm_col = c
            if frac_row >= 0:
                break
        if frac_row < 0:
            continue
        # Las fraktioner — ar filens rapportmanad
        # Anta filens rapport-manad har samma sortKey som filens monad_num
        file_sortkey = 2025 * 100 + month_num  # OBS: get_report_files returnerar bara 2025
        for r in range(frac_row + 1, sh.nrows):
            frac = str(sh.cell_value(r, frac_col)).strip()
            if not frac:
                break
            if frac.lower() in ("month", "sum", "total"):
                continue
            v = sh.cell_value(r, epm_col) if epm_col >= 0 else None
            try:
                epm = float(v) if v not in (None, "") else None
            except (ValueError, TypeError):
                epm = None
            if epm is not None:
                epm_lookup[(file_sortkey, frac)] = epm

    rows = []
    for m in history:
        for frac, data in m["perFraction"].items():
            hours = data.get("hours")
            kwh = data.get("energy")
            emptyings = data.get("emptyings", 0)
            kwh_per_tomning = (kwh / emptyings) if (kwh and emptyings) else None
            epm = epm_lookup.get((m["sortKey"], frac))

            rows.append({
                "Manad_nr": m["Manad_nr"],
                "Manad": m["Manad"],
                "sortKey": m["sortKey"],
                "Manad_label": m["Manad_label"],
                "Fraktion": frac,
                "Timmar_hog_fyllnad": round(hours, 2) if hours else np.nan,
                "kWh": round(kwh, 1) if kwh else 0.0,
                "Tomningar": int(emptyings) if emptyings else 0,
                "Tomning_per_minut": round(epm, 4) if epm else np.nan,
                "kWh_per_tomning": round(kwh_per_tomning, 3) if kwh_per_tomning else np.nan,
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
    """Tomning/minut: medel, min, max per fraktion."""
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
    """Skapar 6 grafer for fraktionsanalys."""
    if df.empty:
        print("Ingen data att visualisera.")
        return

    fraktioner = sorted(df["Fraktion"].unique())
    colors = plt.cm.Set2(np.linspace(0, 1, len(fraktioner)))

    fig, ax = plt.subplots(figsize=(10, 3.5))
    pivot_tom = df.pivot_table(index="sortKey", columns="Fraktion", values="Tomningar",
                                aggfunc="sum", fill_value=0).sort_index()
    label_map = df.set_index("sortKey")["Manad"].to_dict()
    pivot_tom.index = [label_map.get(i, str(i)) for i in pivot_tom.index]
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

    fig, ax = plt.subplots(figsize=(10, 3.5))
    hours_data = df.dropna(subset=["Timmar_hog_fyllnad"])
    if not hours_data.empty:
        pivot_hours = hours_data.pivot_table(index="sortKey", columns="Fraktion",
                                              values="Timmar_hog_fyllnad", aggfunc="mean").sort_index()
        pivot_hours.index = [label_map.get(i, str(i)) for i in pivot_hours.index]
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

    fig, ax = plt.subplots(figsize=(10, 3.5))
    epm_data = df.dropna(subset=["Tomning_per_minut"])
    if not epm_data.empty:
        for i, frac in enumerate(fraktioner):
            frac_data = epm_data[epm_data["Fraktion"] == frac].sort_values("sortKey")
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

    fig, ax = plt.subplots(figsize=(10, 3.5))
    kwh_data = df.dropna(subset=["kWh_per_tomning"])
    if not kwh_data.empty:
        for i, frac in enumerate(fraktioner):
            frac_data = kwh_data[kwh_data["Fraktion"] == frac].sort_values("sortKey")
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

    fig, ax = plt.subplots(figsize=(10, 4.5))
    pivot_hm = df.pivot_table(index="Fraktion", columns="sortKey", values="Tomningar",
                               aggfunc="sum", fill_value=0).sort_index()
    pivot_hm.columns = [label_map.get(c, str(c)) for c in pivot_hm.columns]
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
    print("FRAKTIONSANALYS — Sammanfattning")
    print("=" * 60)

    if df.empty:
        print("Ingen fraktionsdata hittades.")
        return

    fraktioner = df["Fraktion"].unique()
    print(f"\nAntal fraktioner: {len(fraktioner)}")
    print(f"Fraktioner: {', '.join(sorted(fraktioner))}")

    print(f"\nTomningar per fraktion (totalt):")
    totals = df.groupby("Fraktion")["Tomningar"].sum().sort_values(ascending=False)
    for frac, count in totals.items():
        print(f"  {frac}: {count:,}")

    if fill:
        print(f"\nFyllnadstider (timmar vid hog fyllnadsgrad):")
        for frac, info in fill.items():
            print(f"  {frac}: medel {info['medel_timmar']:.1f}h, "
                  f"max {info['max_timmar']:.1f}h ({info['topp_manad']})")

    if seasonal:
        print(f"\nSasongsvariation:")
        for frac, info in seasonal.items():
            print(f"  {frac}: H1={info['H1_tomningar']:,} H2={info['H2_tomningar']:,} "
                  f"(variation {info['Halvars_variation_%']:.0f}%) "
                  f"sommar={info['Sommar_medel']:.0f} vinter={info['Vinter_medel']:.0f}")

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

    df = collect_fraction_full(report_files)
    print(f"Totalt {len(df)} rader, {df['Fraktion'].nunique()} fraktioner")

    seasonal = compute_seasonal_analysis(df)
    fill = compute_fill_analysis(df)
    throughput = compute_throughput(df)

    csv_path = OUTPUT_DIR / "fraktion_analys.csv"
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"CSV sparad: {csv_path}")

    create_plots(df)

    print_summary(df, seasonal, fill, throughput)


if __name__ == "__main__":
    main()
