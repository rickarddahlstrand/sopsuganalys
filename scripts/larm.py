#!/usr/bin/env python3
"""Larmöversikt för sopsugsanläggningen.

Datakällor:
  - Sheet13 (rad 7): Alarm category, Current period, Average based on previous year

Output:
  - output/larm.csv
  - output/larm.png
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


def collect_alarm_data(report_files):
    """Samlar larmdata per kategori och månad från Sheet13."""
    rows = []
    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet13", header_row=7)

        cat_col = [c for c in df.columns if "alarm" in c.lower() or "category" in c.lower()]
        current_col = [c for c in df.columns if "current" in c.lower() or "period" in c.lower()]
        avg_col = [c for c in df.columns if "average" in c.lower() or "previous" in c.lower()]

        if not cat_col or not current_col:
            continue

        for _, row in df.iterrows():
            category = str(row[cat_col[0]]).strip()
            if not category or category == "nan":
                continue

            current = pd.to_numeric(row[current_col[0]], errors="coerce")
            avg = pd.to_numeric(row[avg_col[0]], errors="coerce") if avg_col else None

            if pd.notna(current):
                entry = {
                    "Månad_nr": month_num,
                    "Månad": month_name,
                    "Kategori": category,
                    "Aktuell_period": int(current),
                }
                if avg_col and pd.notna(avg):
                    entry["Föregående_snitt"] = round(avg, 1)
                else:
                    entry["Föregående_snitt"] = None
                rows.append(entry)

    return pd.DataFrame(rows)


def create_summary_csv(alarm_df):
    """Sparar larmkategorier per månad till CSV."""
    if alarm_df.empty:
        return pd.DataFrame()

    pivot = alarm_df.pivot_table(
        index=["Månad_nr", "Månad"],
        columns="Kategori",
        values="Aktuell_period",
        aggfunc="sum",
        fill_value=0,
    ).reset_index().sort_values("Månad_nr")
    pivot.columns.name = None

    output_path = OUTPUT_DIR / "larm.csv"
    pivot.to_csv(output_path, index=False, encoding="utf-8-sig")
    return pivot


def create_plots(alarm_df):
    """Skapar larmgraf: kategorier per månad vs föregående snitt."""
    fig, ax = plt.subplots(figsize=(12, 6))
    fig.suptitle("Larmöversikt — Sopsuganläggningen 2025", fontsize=14, fontweight="bold")

    # Stapeldiagram per kategori per månad
    pivot = alarm_df.pivot_table(
        index="Månad_nr",
        columns="Kategori",
        values="Aktuell_period",
        aggfunc="sum",
        fill_value=0,
    ).sort_index()

    # Mappa månadsnr till namn
    from common import MANAD_NAMN
    pivot.index = [MANAD_NAMN.get(i, str(i)) for i in pivot.index]

    pivot.plot(kind="bar", stacked=True, ax=ax, colormap="tab10")

    # Lägg till föregående snitt som linje (totalt per månad)
    avg_data = alarm_df.dropna(subset=["Föregående_snitt"])
    if not avg_data.empty:
        avg_monthly = avg_data.groupby("Månad_nr")["Föregående_snitt"].sum().sort_index()
        avg_monthly.index = [MANAD_NAMN.get(i, str(i)) for i in avg_monthly.index]
        # Rita linje ovanpå staplar
        x_positions = range(len(pivot.index))
        avg_values = [avg_monthly.get(m, None) for m in pivot.index]
        ax.plot(x_positions, avg_values, "k--", linewidth=2, marker="s",
                label="Föregående års snitt", markersize=5)

    ax.set_ylabel("Antal larm")
    ax.set_xlabel("")
    ax.legend(fontsize=7, loc="upper left", ncol=2)
    ax.tick_params(axis="x", rotation=0)

    plt.tight_layout()
    output_path = OUTPUT_DIR / "larm.png"
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return output_path


def print_summary(alarm_df):
    """Skriver textsammanfattning till stdout."""
    print("=" * 60)
    print("LARMÖVERSIKT — Sammanfattning 2025")
    print("=" * 60)

    if alarm_df.empty:
        print("Ingen larmdata hittades.")
        return

    # Totaler per kategori
    totals = alarm_df.groupby("Kategori")["Aktuell_period"].sum().sort_values(ascending=False)
    print(f"\nLarm per kategori (hela året):")
    for cat, count in totals.items():
        print(f"  {cat}: {count:,}")
    print(f"  Totalt: {totals.sum():,} larm")

    # Trend per månad
    monthly = alarm_df.groupby("Månad_nr")["Aktuell_period"].sum().sort_index()
    if len(monthly) >= 2:
        first_half = monthly[monthly.index <= 6].mean()
        second_half = monthly[monthly.index > 6].mean()
        trend = "ökande" if second_half > first_half * 1.1 else \
                "minskande" if second_half < first_half * 0.9 else "stabil"
        print(f"\nTrend: {trend}")
        print(f"  H1 medel: {first_half:.0f} larm/mån")
        print(f"  H2 medel: {second_half:.0f} larm/mån")

    # Jämförelse med föregående år
    avg_data = alarm_df.dropna(subset=["Föregående_snitt"])
    if not avg_data.empty:
        current_total = alarm_df.groupby("Månad_nr")["Aktuell_period"].sum().mean()
        prev_total = avg_data.groupby("Månad_nr")["Föregående_snitt"].sum().mean()
        if prev_total > 0:
            pct = ((current_total - prev_total) / prev_total) * 100
            print(f"\nJämförelse med föregående år:")
            print(f"  2025 medel:      {current_total:.0f} larm/mån")
            print(f"  Föregående snitt: {prev_total:.0f} larm/mån")
            print(f"  Förändring:       {pct:+.1f} %")

    print("\n" + "=" * 60)


def main():
    ensure_output_dir()
    report_files = get_report_files()

    if not report_files:
        print("Inga rapportfiler hittades!")
        return

    print(f"Läser {len(report_files)} rapporter...")

    alarm_df = collect_alarm_data(report_files)

    create_summary_csv(alarm_df)
    print(f"CSV sparad: {OUTPUT_DIR / 'larm.csv'}")

    if not alarm_df.empty:
        plot_path = create_plots(alarm_df)
        print(f"Graf sparad: {plot_path}")
    else:
        print("Ingen larmdata — hoppar över graf.")

    print_summary(alarm_df)


if __name__ == "__main__":
    main()
