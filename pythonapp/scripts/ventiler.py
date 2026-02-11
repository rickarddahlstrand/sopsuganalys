#!/usr/bin/env python3
"""Ventilhälsa och felanalys för sopsugsanläggningen.

Datakällor:
  - Sheet9  (rad 3): ID, Info, MAN_OPEN_CMD, AUTO_OPEN_CMD, INLET_OPEN
  - Sheet10 (rad 8): ID, DOES_NOT_OPEN, LEVEL_ERROR m.fl.
  - Sheet11 (rad 3): ID, Info, Availability [%]

Output:
  - output/ventiler.csv
  - output/ventiler.png
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


def collect_availability_and_errors(report_files):
    """Samlar ventiltillgänglighet och felkoder per månad från Sheet11.

    Sheet11 innehåller både Availability [%] och felkolumner
    (DOES_NOT_OPEN, LEVEL_ERROR, etc.) per ventil-ID.
    """
    ERROR_COLS = {"DOES_NOT_CLOSE", "DOES_NOT_OPEN", "LEVEL_ERROR",
                  "LONG_TIME_SINCE_LAST_COLLECTION", "ERROR_FEEDBACK_FROM_USER"}

    avail_rows = []
    error_rows = []

    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet11", header_row=3)

        avail_col = [c for c in df.columns if "availability" in c.lower()]
        id_col = "ID" if "ID" in df.columns else None
        if not avail_col or not id_col:
            continue

        # Hitta felkolumner som finns i detta ark
        found_error_cols = [c for c in df.columns if c in ERROR_COLS]

        for _, row in df.iterrows():
            vid = str(row[id_col]).strip()
            if not vid or vid == "nan":
                continue

            val = pd.to_numeric(row[avail_col[0]], errors="coerce")
            if pd.notna(val):
                avail_rows.append({
                    "Månad_nr": month_num,
                    "Månad": month_name,
                    "Ventil_ID": vid,
                    "Tillgänglighet": val,
                })

            for ec in found_error_cols:
                err_val = pd.to_numeric(row[ec], errors="coerce")
                if pd.notna(err_val) and err_val > 0:
                    error_rows.append({
                        "Månad_nr": month_num,
                        "Månad": month_name,
                        "Ventil_ID": vid,
                        "Feltyp": ec,
                        "Antal": int(err_val),
                    })

    return pd.DataFrame(avail_rows), pd.DataFrame(error_rows)


def collect_commands(report_files):
    """Samlar kommandostatistik per ventil från Sheet9."""
    rows = []
    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet9", header_row=3)
        id_col = [c for c in df.columns if c.lower() == "id"]
        cmd_cols = [c for c in df.columns if "open" in c.lower() or "cmd" in c.lower()]

        if not id_col:
            continue

        for _, row in df.iterrows():
            vid = str(row[id_col[0]]).strip()
            if not vid or vid == "nan":
                continue
            for cc in cmd_cols:
                val = pd.to_numeric(row[cc], errors="coerce")
                if pd.notna(val):
                    rows.append({
                        "Månad_nr": month_num,
                        "Månad": month_name,
                        "Ventil_ID": vid,
                        "Kommando": cc.strip(),
                        "Antal": int(val),
                    })
    return pd.DataFrame(rows)


def create_summary_csv(avail_df, error_df):
    """Sparar ventilöversikt med tillgänglighet och felantal."""
    if avail_df.empty:
        return pd.DataFrame()

    # Medeltillgänglighet per ventil
    avg_avail = avail_df.groupby("Ventil_ID")["Tillgänglighet"].mean().round(2).reset_index()
    avg_avail.columns = ["Ventil_ID", "Medel_Tillgänglighet_%"]

    # Totala fel per ventil
    if not error_df.empty:
        total_errors = error_df.groupby("Ventil_ID")["Antal"].sum().reset_index()
        total_errors.columns = ["Ventil_ID", "Totala_fel"]
        summary = avg_avail.merge(total_errors, on="Ventil_ID", how="left")
        summary["Totala_fel"] = summary["Totala_fel"].fillna(0).astype(int)
    else:
        summary = avg_avail.copy()
        summary["Totala_fel"] = 0

    summary = summary.sort_values("Medel_Tillgänglighet_%")
    output_path = OUTPUT_DIR / "ventiler.csv"
    summary.to_csv(output_path, index=False, encoding="utf-8-sig")
    return summary


def create_monthly_summary(avail_df, error_df):
    """Skapar månatlig sammanfattning för grafer."""
    monthly_avail = avail_df.groupby(["Månad_nr", "Månad"]).agg(
        Medel=("Tillgänglighet", "mean"),
        Min=("Tillgänglighet", "min"),
        Max=("Tillgänglighet", "max"),
    ).round(2).reset_index().sort_values("Månad_nr")

    monthly_errors = pd.DataFrame()
    if not error_df.empty:
        monthly_errors = error_df.pivot_table(
            index="Månad_nr",
            columns="Feltyp",
            values="Antal",
            aggfunc="sum",
            fill_value=0,
        ).sort_index()

    return monthly_avail, monthly_errors


def create_plots(avail_df, error_df):
    """Skapar graf med 2 subplots."""
    monthly_avail, monthly_errors = create_monthly_summary(avail_df, error_df)

    fig, axes = plt.subplots(2, 1, figsize=(12, 9))
    fig.suptitle("Ventilhälsa — Sopsuganläggningen 2025", fontsize=14, fontweight="bold")

    months = monthly_avail["Månad"]

    # 1. Medel-tillgänglighet med min/max-band
    ax1 = axes[0]
    ax1.plot(months, monthly_avail["Medel"], marker="o", color="#4CAF50", linewidth=2, label="Medel")
    ax1.fill_between(months, monthly_avail["Min"], monthly_avail["Max"],
                     alpha=0.2, color="#4CAF50", label="Min–Max")
    ax1.set_ylabel("Tillgänglighet (%)")
    ax1.set_title("Ventiltillgänglighet per månad")
    ax1.legend(fontsize=8)
    ax1.set_ylim(bottom=0)

    # 2. Felkoder per månad (stacked bar)
    ax2 = axes[1]
    if not monthly_errors.empty:
        # Mappa månadsnummer till namn
        month_map = monthly_avail.set_index("Månad_nr")["Månad"]
        monthly_errors.index = [month_map.get(i, str(i)) for i in monthly_errors.index]
        monthly_errors.plot(kind="bar", stacked=True, ax=ax2, colormap="Set1")
        ax2.legend(fontsize=7, loc="upper left", ncol=2)
    ax2.set_ylabel("Antal fel")
    ax2.set_title("Felkoder per månad")
    ax2.tick_params(axis="x", rotation=0)

    plt.tight_layout()
    output_path = OUTPUT_DIR / "ventiler.png"
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return output_path


def print_summary(avail_df, error_df, summary_df):
    """Skriver textsammanfattning till stdout."""
    print("=" * 60)
    print("VENTILHÄLSA — Sammanfattning 2025")
    print("=" * 60)

    if not avail_df.empty:
        overall = avail_df["Tillgänglighet"].mean()
        print(f"\nMedeltillgänglighet (alla ventiler): {overall:.1f} %")

        monthly = avail_df.groupby("Månad")["Tillgänglighet"].mean()
        best = monthly.idxmax()
        worst = monthly.idxmin()
        print(f"Bästa månad:  {best} ({monthly[best]:.1f} %)")
        print(f"Sämsta månad: {worst} ({monthly[worst]:.1f} %)")

    if not summary_df.empty:
        print(f"\nTop 10 ventiler med lägst tillgänglighet:")
        top10 = summary_df.head(10)
        for _, row in top10.iterrows():
            print(f"  {row['Ventil_ID']}: {row['Medel_Tillgänglighet_%']:.1f} % "
                  f"({row['Totala_fel']} fel)")

    if not error_df.empty:
        print(f"\nFeltyper (totalt under året):")
        totals = error_df.groupby("Feltyp")["Antal"].sum().sort_values(ascending=False)
        for feltyp, antal in totals.items():
            print(f"  {feltyp}: {antal:,}")
        print(f"  Totalt: {totals.sum():,} fel")

    print("\n" + "=" * 60)


def main():
    ensure_output_dir()
    report_files = get_report_files()

    if not report_files:
        print("Inga rapportfiler hittades!")
        return

    print(f"Läser {len(report_files)} rapporter...")

    avail_df, error_df = collect_availability_and_errors(report_files)
    commands_df = collect_commands(report_files)

    summary_df = create_summary_csv(avail_df, error_df)
    print(f"CSV sparad: {OUTPUT_DIR / 'ventiler.csv'}")

    if not avail_df.empty:
        plot_path = create_plots(avail_df, error_df)
        print(f"Graf sparad: {plot_path}")
    else:
        print("Ingen tillgänglighetsdata — hoppar över graf.")

    print_summary(avail_df, error_df, summary_df)


if __name__ == "__main__":
    main()
