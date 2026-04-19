#!/usr/bin/env python3
"""Energi- och driftanalys av sopsugsanläggningen.

Datakällor:
  - Sheet3 (rad 3): Energy (kWh), Operation Time (h)
  - Sheet5 (rad 3): Fraction, Hours, kWh, Emptyings, Emptying/minute
  - Sheet7 (rad 4): Name, ID, Starts, Hours, kWh

Output:
  - output/energi_drift.csv
  - output/energi_drift.png
  - Textsammanfattning till stdout
"""

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import (
    OUTPUT_DIR,
    get_report_files,
    read_sheet,
    ensure_output_dir,
)


def collect_energy_data(report_files):
    """Samlar månatlig energi och drifttid från Sheet3.

    OBS: Varje rapport innehåller ackumulerade värden från årets start
    (eller anläggningens start) fram till rapportdatumet. Vi räknar ut
    månadsdelta genom att subtrahera föregående månads värde.
    """
    raw = []
    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet3", header_row=3)
        # Summera numeriska kolumner
        energy_col = [c for c in df.columns if "energy" in c.lower() or "kwh" in c.lower()]
        time_col = [c for c in df.columns if "operation" in c.lower() or "time" in c.lower()]

        energy = pd.to_numeric(df[energy_col[0]], errors="coerce").sum() if energy_col else 0
        op_time = pd.to_numeric(df[time_col[0]], errors="coerce").sum() if time_col else 0

        raw.append({
            "Månad_nr": month_num,
            "Månad": month_name,
            "Energi_kWh_ack": float(energy) if pd.notna(energy) else 0.0,
            "Drifttid_h_ack": float(op_time) if pd.notna(op_time) else 0.0,
        })

    # Sortera kronologiskt och beräkna delta mot föregående månad.
    raw.sort(key=lambda r: r["Månad_nr"])
    rows = []
    for i, r in enumerate(raw):
        if i == 0:
            energy = r["Energi_kWh_ack"]
            op_time = r["Drifttid_h_ack"]
        else:
            prev = raw[i - 1]
            energy = r["Energi_kWh_ack"] - prev["Energi_kWh_ack"]
            op_time = r["Drifttid_h_ack"] - prev["Drifttid_h_ack"]
            # Skydd mot räknare-reset eller felaktig ordning
            if energy < 0:
                energy = r["Energi_kWh_ack"]
            if op_time < 0:
                op_time = r["Drifttid_h_ack"]

        rows.append({
            "Månad_nr": r["Månad_nr"],
            "Månad": r["Månad"],
            "Energi_kWh": round(energy, 1),
            "Drifttid_h": round(op_time, 1),
        })
    return pd.DataFrame(rows)


def collect_fraction_data(report_files):
    """Samlar tömningar per fraktion från Sheet5.

    Värdena är ackumulerade från rapportperiodens start — vi räknar ut
    månadsdelta per fraktion genom att subtrahera föregående månads värde.
    """
    import re
    raw_by_month = {}
    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet5", header_row=3)
        frac_col = [c for c in df.columns if "fraction" in c.lower()]
        empty_col = [c for c in df.columns if "emptying" in c.lower() and "minute" not in c.lower()]

        if not frac_col or not empty_col:
            continue

        per_frac = {}
        for _, row in df.iterrows():
            frac = str(row[frac_col[0]]).strip()
            if not frac or frac == "nan":
                continue
            # Filtrera bort historiska månad-rader (t.ex. "Month", "24-Feb")
            if frac.lower() == "month" or re.match(r"^\d{2}-\w+$", frac):
                continue
            emptyings = pd.to_numeric(row[empty_col[0]], errors="coerce")
            if pd.notna(emptyings):
                per_frac[frac] = float(emptyings)
        raw_by_month[month_num] = (month_name, per_frac)

    # Beräkna delta mot föregående månad per fraktion
    sorted_months = sorted(raw_by_month.keys())
    rows = []
    prev_frac = {}
    for i, m in enumerate(sorted_months):
        name, cur_frac = raw_by_month[m]
        for frac, cum in cur_frac.items():
            if i == 0 or frac not in prev_frac:
                delta = cum
            else:
                delta = cum - prev_frac[frac]
                if delta < 0:
                    delta = cum
            if delta > 0:
                rows.append({
                    "Månad_nr": m,
                    "Månad": name,
                    "Fraktion": frac,
                    "Tömningar": int(delta),
                })
        prev_frac = cur_frac
    return pd.DataFrame(rows)


def collect_machine_data(report_files):
    """Samlar maskinstatistik från Sheet7.

    Värdena (Starter, Drifttimmar, kWh) är ackumulerade — vi räknar ut
    månadsdelta per maskin genom att subtrahera föregående månads värde.
    """
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

    sorted_months = sorted(raw_by_month.keys())
    rows = []
    prev_machine = {}
    for i, m in enumerate(sorted_months):
        name_m, cur_mach = raw_by_month[m]
        for mname, vals in cur_mach.items():
            if i == 0 or mname not in prev_machine:
                delta_starts = vals["starter"]
                delta_hours = vals["timmar"]
                delta_kwh = vals["kwh"]
            else:
                p = prev_machine[mname]
                delta_starts = vals["starter"] - p["starter"] if pd.notna(vals["starter"]) and pd.notna(p["starter"]) else vals["starter"]
                delta_hours = vals["timmar"] - p["timmar"] if pd.notna(vals["timmar"]) and pd.notna(p["timmar"]) else vals["timmar"]
                delta_kwh = vals["kwh"] - p["kwh"] if pd.notna(vals["kwh"]) and pd.notna(p["kwh"]) else vals["kwh"]
                # Skydd mot räknare-reset
                if pd.notna(delta_starts) and delta_starts < 0:
                    delta_starts = vals["starter"]
                if pd.notna(delta_hours) and delta_hours < 0:
                    delta_hours = vals["timmar"]
                if pd.notna(delta_kwh) and delta_kwh < 0:
                    delta_kwh = vals["kwh"]
            rows.append({
                "Månad_nr": m,
                "Månad": name_m,
                "Maskin": mname,
                "Starter": delta_starts,
                "Drifttimmar": delta_hours,
                "kWh": delta_kwh,
            })
        prev_machine = cur_mach
    return pd.DataFrame(rows)


def create_summary_csv(energy_df, fraction_df):
    """Sparar månatlig sammanfattning till CSV."""
    # Pivotera fraktioner till kolumner
    if not fraction_df.empty:
        pivot = fraction_df.pivot_table(
            index=["Månad_nr", "Månad"],
            columns="Fraktion",
            values="Tömningar",
            aggfunc="sum",
            fill_value=0,
        ).reset_index()
        pivot.columns.name = None

        summary = energy_df.merge(pivot, on=["Månad_nr", "Månad"], how="left")
    else:
        summary = energy_df.copy()

    summary = summary.sort_values("Månad_nr")
    output_path = OUTPUT_DIR / "energi_drift.csv"
    summary.to_csv(output_path, index=False, encoding="utf-8-sig")
    return summary


def create_plots(energy_df, fraction_df):
    """Skapar graf med 3 subplots."""
    fig, axes = plt.subplots(3, 1, figsize=(12, 12))
    fig.suptitle("Energi & Drift — Sopsuganläggningen 2025", fontsize=14, fontweight="bold")

    energy_sorted = energy_df.sort_values("Månad_nr")
    months = energy_sorted["Månad"]

    # 1. Energi per månad (stapeldiagram)
    ax1 = axes[0]
    bars = ax1.bar(months, energy_sorted["Energi_kWh"], color="#2196F3")
    ax1.set_ylabel("kWh")
    ax1.set_title("Energiförbrukning per månad")
    ax1.bar_label(bars, fmt="%.0f", fontsize=7)

    # 2. Tömningar per fraktion (stacked bar)
    ax2 = axes[1]
    if not fraction_df.empty:
        pivot = fraction_df.pivot_table(
            index="Månad_nr",
            columns="Fraktion",
            values="Tömningar",
            aggfunc="sum",
            fill_value=0,
        ).sort_index()
        pivot.index = [energy_sorted.set_index("Månad_nr").loc[i, "Månad"] for i in pivot.index]
        pivot.plot(kind="bar", stacked=True, ax=ax2, colormap="Set2")
        ax2.legend(fontsize=7, loc="upper left")
    ax2.set_ylabel("Antal tömningar")
    ax2.set_title("Tömningar per fraktion per månad")
    ax2.tick_params(axis="x", rotation=0)

    # 3. Drifttid per månad (linjediagram)
    ax3 = axes[2]
    ax3.plot(months, energy_sorted["Drifttid_h"], marker="o", color="#FF9800", linewidth=2)
    ax3.set_ylabel("Timmar")
    ax3.set_title("Drifttid per månad")
    ax3.fill_between(months, energy_sorted["Drifttid_h"], alpha=0.15, color="#FF9800")

    plt.tight_layout()
    output_path = OUTPUT_DIR / "energi_drift.png"
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return output_path


def print_summary(energy_df, fraction_df, machine_df):
    """Skriver textsammanfattning till stdout."""
    print("=" * 60)
    print("ENERGI & DRIFT — Sammanfattning 2025")
    print("=" * 60)

    if not energy_df.empty:
        total_energy = energy_df["Energi_kWh"].sum()
        total_hours = energy_df["Drifttid_h"].sum()
        avg_energy = energy_df["Energi_kWh"].mean()
        print(f"\nTotal energiförbrukning: {total_energy:,.0f} kWh")
        print(f"Medelenergi per månad:   {avg_energy:,.0f} kWh")
        print(f"Total drifttid:          {total_hours:,.0f} h")

        max_month = energy_df.loc[energy_df["Energi_kWh"].idxmax()]
        min_month = energy_df.loc[energy_df["Energi_kWh"].idxmin()]
        print(f"Högst förbrukning:       {max_month['Månad']} ({max_month['Energi_kWh']:,.0f} kWh)")
        print(f"Lägst förbrukning:       {min_month['Månad']} ({min_month['Energi_kWh']:,.0f} kWh)")

    if not fraction_df.empty:
        print(f"\nTömningar per fraktion (totalt):")
        totals = fraction_df.groupby("Fraktion")["Tömningar"].sum().sort_values(ascending=False)
        for frac, count in totals.items():
            print(f"  {frac}: {count:,}")
        print(f"  Totalt: {totals.sum():,}")

    if not machine_df.empty:
        print(f"\nMaskinstatistik (årssnitt per maskin):")
        avg = machine_df.groupby("Maskin").agg({
            "Starter": "mean",
            "Drifttimmar": "mean",
            "kWh": "mean",
        }).round(1)
        for name, row in avg.iterrows():
            print(f"  {name}: {row['Starter']:.0f} starter, "
                  f"{row['Drifttimmar']:.1f} h, {row['kWh']:.0f} kWh/mån")

    print("\n" + "=" * 60)


def main():
    ensure_output_dir()
    report_files = get_report_files()

    if not report_files:
        print("Inga rapportfiler hittades!")
        return

    print(f"Läser {len(report_files)} rapporter...")

    energy_df = collect_energy_data(report_files)
    fraction_df = collect_fraction_data(report_files)
    machine_df = collect_machine_data(report_files)

    summary = create_summary_csv(energy_df, fraction_df)
    print(f"CSV sparad: {OUTPUT_DIR / 'energi_drift.csv'}")

    plot_path = create_plots(energy_df, fraction_df)
    print(f"Graf sparad: {plot_path}")

    print_summary(energy_df, fraction_df, machine_df)


if __name__ == "__main__":
    main()
