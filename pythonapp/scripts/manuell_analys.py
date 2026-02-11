#!/usr/bin/env python3
"""Analys av manuella korningar som driftsindikator.

Manuella ventilkorningar (MAN_OPEN_CMD) jamfort med automatiska
(AUTO_OPEN_CMD) ger ett matt pa hur val anlaggningen gar.
Hog manuell andel = problem med automatiken.

Datakallor:
  - Sheet9  (rad 3): Per ventil — MAN_OPEN_CMD, AUTO_OPEN_CMD, INLET_OPEN
  - Sheet11 (rad 3): Per ventil — samma kolumner + Availability
  - Sheet3  (rad 3): Drifttid per manad (for att normalisera mot tid)

Output:
  - output/manuell_analys.csv   — per-manad KPI:er
  - output/manuell_ventiler.csv — per-ventil arssammanfattning
  - output/manuell_kommandon.png    — Manuella vs automatiska kommandon per manad
  - output/manuell_trend.png        — Manuell andel trend med trendlinje
  - output/manuell_topp_ventiler.png — Topp-15 ventiler hogst manuell andel
  - output/manuell_grenar.png       — Manuell andel per gren
  - Textsammanfattning till stdout
"""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import stats

from common import (
    OUTPUT_DIR,
    MANAD_NAMN,
    get_report_files,
    read_sheet,
    parse_valve_id,
    ensure_output_dir,
)


def discover_columns(report_files):
    """Loggar alla kolumner i Sheet9 och Sheet11 fran forsta filen."""
    _, _, filepath = report_files[0]
    for sheet, hdr in [("Sheet9", 3), ("Sheet11", 3)]:
        df = read_sheet(filepath, sheet, header_row=hdr)
        print(f"  {sheet} kolumner: {list(df.columns)}")


def collect_manual_data(report_files):
    """Samlar MAN_OPEN_CMD, AUTO_OPEN_CMD och INLET_OPEN per ventil per manad.

    Anvander Sheet9 (kommandon) och Sheet11 (tillganglighet).
    """
    rows = []
    for month_num, month_name, filepath in report_files:
        # Sheet9: kommandodetaljer
        df9 = read_sheet(filepath, "Sheet9", header_row=3)
        id_col9 = [c for c in df9.columns if c.lower() == "id"]
        if not id_col9:
            continue

        # Hitta relevanta kolumner (case-insensitive)
        col_map9 = {}
        for c in df9.columns:
            cl = c.strip().upper()
            if cl == "MAN_OPEN_CMD":
                col_map9["man_cmd"] = c
            elif cl == "AUTO_OPEN_CMD":
                col_map9["auto_cmd"] = c
            elif cl == "INLET_OPEN":
                col_map9["inlet_open"] = c

        # Sheet11: tillganglighet + ev. extra data
        df11 = read_sheet(filepath, "Sheet11", header_row=3)
        avail_col = [c for c in df11.columns if "availability" in c.lower()]
        id_col11 = "ID" if "ID" in df11.columns else None

        # Bygg tillganglighets-lookup
        avail_lookup = {}
        if avail_col and id_col11:
            for _, r11 in df11.iterrows():
                vid = str(r11[id_col11]).strip()
                if vid and vid != "nan":
                    v = pd.to_numeric(r11[avail_col[0]], errors="coerce")
                    if pd.notna(v):
                        avail_lookup[vid] = v

        for _, row in df9.iterrows():
            vid = str(row[id_col9[0]]).strip()
            if not vid or vid == "nan":
                continue

            man_cmd = pd.to_numeric(row.get(col_map9.get("man_cmd", ""), 0), errors="coerce")
            auto_cmd = pd.to_numeric(row.get(col_map9.get("auto_cmd", ""), 0), errors="coerce")
            inlet = pd.to_numeric(row.get(col_map9.get("inlet_open", ""), 0), errors="coerce")

            man_cmd = int(man_cmd) if pd.notna(man_cmd) else 0
            auto_cmd = int(auto_cmd) if pd.notna(auto_cmd) else 0
            inlet = int(inlet) if pd.notna(inlet) else 0

            total_cmd = man_cmd + auto_cmd
            man_andel = (man_cmd / total_cmd * 100) if total_cmd > 0 else 0

            try:
                gren, ventilnr = parse_valve_id(vid)
            except (ValueError, IndexError):
                gren, ventilnr = -1, -1

            rows.append({
                "Manad_nr": month_num,
                "Manad": month_name,
                "Ventil_ID": vid,
                "Gren": gren,
                "MAN_OPEN_CMD": man_cmd,
                "AUTO_OPEN_CMD": auto_cmd,
                "INLET_OPEN": inlet,
                "Total_CMD": total_cmd,
                "Manuell_andel_%": round(man_andel, 2),
                "Tillganglighet": avail_lookup.get(vid, np.nan),
            })

    return pd.DataFrame(rows)


def collect_operation_time(report_files):
    """Samlar total drifttid per manad fran Sheet3."""
    rows = []
    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet3", header_row=3)
        time_col = [c for c in df.columns if "operation" in c.lower() or "time" in c.lower()]
        op_time = pd.to_numeric(df[time_col[0]], errors="coerce").sum() if time_col else 0
        rows.append({"Manad_nr": month_num, "Manad": month_name, "Drifttid_h": round(op_time, 1)})
    return pd.DataFrame(rows)


def compute_monthly_kpis(manual_df, time_df):
    """Beraknar manatliga KPI:er."""
    monthly = manual_df.groupby(["Manad_nr", "Manad"]).agg(
        MAN_totalt=("MAN_OPEN_CMD", "sum"),
        AUTO_totalt=("AUTO_OPEN_CMD", "sum"),
        INLET_totalt=("INLET_OPEN", "sum"),
        Antal_ventiler=("Ventil_ID", "nunique"),
        Medel_tillg=("Tillganglighet", "mean"),
    ).reset_index()

    monthly["Total_CMD"] = monthly["MAN_totalt"] + monthly["AUTO_totalt"]
    monthly["Manuell_andel_%"] = (
        monthly["MAN_totalt"] / monthly["Total_CMD"] * 100
    ).where(monthly["Total_CMD"] > 0, 0).round(2)

    # Antal ventiler med minst 1 manuell korning
    man_ventiler = manual_df[manual_df["MAN_OPEN_CMD"] > 0].groupby("Manad_nr")["Ventil_ID"].nunique()
    monthly["Ventiler_med_MAN"] = monthly["Manad_nr"].map(man_ventiler).fillna(0).astype(int)
    monthly["Andel_ventiler_MAN_%"] = (
        monthly["Ventiler_med_MAN"] / monthly["Antal_ventiler"] * 100
    ).round(1)

    # Lagg till drifttid
    monthly = monthly.merge(time_df, on=["Manad_nr", "Manad"], how="left")

    # MAN per drifttimme
    monthly["MAN_per_drifttimme"] = (
        monthly["MAN_totalt"] / monthly["Drifttid_h"]
    ).where(monthly["Drifttid_h"] > 0, 0).round(3)

    monthly = monthly.sort_values("Manad_nr")
    return monthly


def compute_valve_summary(manual_df):
    """Per-ventil arssammanfattning."""
    summary = manual_df.groupby(["Ventil_ID", "Gren"]).agg(
        MAN_totalt=("MAN_OPEN_CMD", "sum"),
        AUTO_totalt=("AUTO_OPEN_CMD", "sum"),
        INLET_totalt=("INLET_OPEN", "sum"),
        Medel_tillg=("Tillganglighet", "mean"),
        Manader_aktiv=("Manad_nr", "nunique"),
    ).reset_index()

    summary["Total_CMD"] = summary["MAN_totalt"] + summary["AUTO_totalt"]
    summary["Manuell_andel_%"] = (
        summary["MAN_totalt"] / summary["Total_CMD"] * 100
    ).where(summary["Total_CMD"] > 0, 0).round(2)

    # MAN per manad (normaliserat)
    summary["MAN_per_manad"] = (
        summary["MAN_totalt"] / summary["Manader_aktiv"]
    ).round(1)

    summary = summary.sort_values("Manuell_andel_%", ascending=False)
    return summary


def compute_branch_manual(manual_df):
    """Per-gren manuell analys."""
    branch = manual_df.groupby("Gren").agg(
        MAN_totalt=("MAN_OPEN_CMD", "sum"),
        AUTO_totalt=("AUTO_OPEN_CMD", "sum"),
        Antal_ventiler=("Ventil_ID", "nunique"),
    ).reset_index()

    branch["Total_CMD"] = branch["MAN_totalt"] + branch["AUTO_totalt"]
    branch["Manuell_andel_%"] = (
        branch["MAN_totalt"] / branch["Total_CMD"] * 100
    ).where(branch["Total_CMD"] > 0, 0).round(2)
    branch["MAN_per_ventil"] = (branch["MAN_totalt"] / branch["Antal_ventiler"]).round(1)

    return branch.sort_values("Manuell_andel_%", ascending=False)


def create_plots(monthly_df, valve_summary, branch_df, manual_df):
    """Skapar 4 individuella grafer for manuell analys."""
    months = monthly_df["Manad"].values

    # 1. Manuella vs automatiska per manad (stacked bar + linje for MAN/drifttimme)
    fig, ax = plt.subplots(figsize=(10, 3.5))
    x = np.arange(len(months))
    width = 0.6
    ax.bar(x, monthly_df["AUTO_totalt"], width, color="#4CAF50", alpha=0.7, label="Automatiska")
    ax.bar(x, monthly_df["MAN_totalt"], width, bottom=monthly_df["AUTO_totalt"],
           color="#F44336", alpha=0.8, label="Manuella")
    ax.set_xticks(x)
    ax.set_xticklabels(months, fontsize=7, rotation=45)
    ax.set_ylabel("Antal kommandon")
    ax.set_title("Manuella vs automatiska kommandon")
    ax.legend(fontsize=7, loc="upper right")

    # Sekundar y-axel: MAN per drifttimme
    ax2 = ax.twinx()
    ax2.plot(x, monthly_df["MAN_per_drifttimme"], "ko--", markersize=4, linewidth=1.5,
             label="MAN/drifttimme")
    ax2.set_ylabel("MAN/drifttimme", fontsize=8)
    ax2.legend(fontsize=7, loc="upper left")

    plt.tight_layout()
    path1 = OUTPUT_DIR / "manuell_kommandon.png"
    fig.savefig(path1, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path1}")

    # 2. Manuell andel trend + trendlinje
    fig, ax = plt.subplots(figsize=(10, 3.5))
    ax.plot(months, monthly_df["Manuell_andel_%"], "r-o", linewidth=2, markersize=5, label="Manuell andel")

    # Lagg till trendlinje
    m_nums = monthly_df["Manad_nr"].values.astype(float)
    m_andel = monthly_df["Manuell_andel_%"].values.astype(float)
    if len(m_nums) >= 3:
        slope, intercept, r_val, p_val, _ = stats.linregress(m_nums, m_andel)
        trend_y = intercept + slope * m_nums
        trend_label = "minskande" if slope < 0 and p_val < 0.05 else \
                      "okande" if slope > 0 and p_val < 0.05 else "stabil"
        ax.plot(months, trend_y, "k--", linewidth=1,
                label=f"Trend: {trend_label} (R2={r_val**2:.2f})")

    # Andel ventiler med MAN som sekundar axel
    ax3 = ax.twinx()
    ax3.bar(months, monthly_df["Andel_ventiler_MAN_%"], alpha=0.15, color="blue",
            label="% ventiler med MAN")
    ax3.set_ylabel("% ventiler med MAN", fontsize=8, color="blue")
    ax3.tick_params(axis="y", labelcolor="blue")

    ax.set_ylabel("Manuell andel (%)")
    ax.set_title("Manuell andel over tid")
    ax.legend(fontsize=7, loc="upper left")
    ax.tick_params(axis="x", rotation=45)

    plt.tight_layout()
    path2 = OUTPUT_DIR / "manuell_trend.png"
    fig.savefig(path2, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path2}")

    # 3. Topp-15 ventiler med hogst manuell andel (bar)
    fig, ax = plt.subplots(figsize=(10, 5))
    top15 = valve_summary[valve_summary["Total_CMD"] > 10].head(15)
    if not top15.empty:
        labels = top15["Ventil_ID"].values
        y_pos = np.arange(len(labels))
        colors = ["#F44336" if v > 50 else "#FF9800" if v > 20 else "#4CAF50"
                  for v in top15["Manuell_andel_%"]]
        ax.barh(y_pos, top15["Manuell_andel_%"], color=colors)
        ax.set_yticks(y_pos)
        ax.set_yticklabels(labels, fontsize=7)
        ax.set_xlabel("Manuell andel (%)")
        ax.set_title("Topp-15 ventiler (hogst manuell andel)")
        ax.axvline(20, color="orange", linestyle="--", linewidth=0.8, alpha=0.5)
        ax.axvline(50, color="red", linestyle="--", linewidth=0.8, alpha=0.5)
    else:
        ax.set_title("Topp-15 ventiler (otillracklig data)")

    plt.tight_layout()
    path3 = OUTPUT_DIR / "manuell_topp_ventiler.png"
    fig.savefig(path3, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path3}")

    # 4. Manuell andel per gren
    fig, ax = plt.subplots(figsize=(10, 5))
    if not branch_df.empty:
        sorted_br = branch_df.sort_values("Manuell_andel_%", ascending=True)
        labels = sorted_br["Gren"].astype(str).values
        y_pos = np.arange(len(labels))
        colors = ["#F44336" if v > 50 else "#FF9800" if v > 20 else "#4CAF50"
                  for v in sorted_br["Manuell_andel_%"]]
        ax.barh(y_pos, sorted_br["Manuell_andel_%"], color=colors)
        ax.set_yticks(y_pos)
        ax.set_yticklabels(labels, fontsize=7)
        ax.set_xlabel("Manuell andel (%)")
        ax.set_title("Manuell andel per gren")
        ax.axvline(20, color="orange", linestyle="--", linewidth=0.8, alpha=0.5)

    plt.tight_layout()
    path4 = OUTPUT_DIR / "manuell_grenar.png"
    fig.savefig(path4, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path4}")


def print_summary(monthly_df, valve_summary, branch_df):
    """Textsammanfattning."""
    print("\n" + "=" * 60)
    print("MANUELL ANALYS -- Sammanfattning 2025")
    print("=" * 60)

    # Arsoverblick
    total_man = monthly_df["MAN_totalt"].sum()
    total_auto = monthly_df["AUTO_totalt"].sum()
    total_all = total_man + total_auto
    ars_andel = total_man / total_all * 100 if total_all > 0 else 0

    print(f"\nArsoverblick:")
    print(f"  Totala kommandon:     {total_all:,}")
    print(f"  Automatiska:          {total_auto:,} ({100 - ars_andel:.1f}%)")
    print(f"  Manuella:             {total_man:,} ({ars_andel:.1f}%)")

    # Drifttid
    total_h = monthly_df["Drifttid_h"].sum()
    man_per_h = total_man / total_h if total_h > 0 else 0
    print(f"  Total drifttid:       {total_h:,.0f} h")
    print(f"  MAN per drifttimme:   {man_per_h:.2f}")

    # Trend
    m_nums = monthly_df["Manad_nr"].values.astype(float)
    m_andel = monthly_df["Manuell_andel_%"].values.astype(float)
    if len(m_nums) >= 3:
        slope, _, r_val, p_val, _ = stats.linregress(m_nums, m_andel)
        trend = "minskande" if slope < 0 and p_val < 0.05 else \
                "okande" if slope > 0 and p_val < 0.05 else "stabil"
        print(f"\nTrend manuell andel: {trend}")
        print(f"  Lutning: {slope:.3f} procentenheter/manad")
        print(f"  R2: {r_val**2:.3f}, p: {p_val:.4f}")

    # Manad med hogst/lagst manuell andel
    best = monthly_df.loc[monthly_df["Manuell_andel_%"].idxmin()]
    worst = monthly_df.loc[monthly_df["Manuell_andel_%"].idxmax()]
    print(f"\n  Lagst manuell andel:  {best['Manad']} ({best['Manuell_andel_%']:.1f}%)")
    print(f"  Hogst manuell andel:  {worst['Manad']} ({worst['Manuell_andel_%']:.1f}%)")

    # MAN per drifttimme trend
    man_per_h_vals = monthly_df["MAN_per_drifttimme"].values.astype(float)
    if len(m_nums) >= 3:
        slope2, _, r_val2, p_val2, _ = stats.linregress(m_nums, man_per_h_vals)
        trend2 = "minskande" if slope2 < 0 and p_val2 < 0.05 else \
                 "okande" if slope2 > 0 and p_val2 < 0.05 else "stabil"
        print(f"\nTrend MAN/drifttimme: {trend2}")
        print(f"  Lutning: {slope2:.4f}/manad, R2: {r_val2**2:.3f}, p: {p_val2:.4f}")

    # Ventiler med hogst manuell andel
    top_man = valve_summary[valve_summary["Total_CMD"] > 10].head(10)
    if not top_man.empty:
        print(f"\nTopp-10 ventiler (hogst manuell andel, >10 totala cmd):")
        for _, r in top_man.iterrows():
            print(f"  {r['Ventil_ID']} (gren {int(r['Gren'])}): "
                  f"{r['Manuell_andel_%']:.1f}% "
                  f"({r['MAN_totalt']} MAN / {r['Total_CMD']} tot, "
                  f"tillg={r['Medel_tillg']:.1f}%)")

    # Ventiler med hogst absolut MAN-antal
    top_abs = valve_summary.sort_values("MAN_totalt", ascending=False).head(10)
    if not top_abs.empty:
        print(f"\nTopp-10 ventiler (flest manuella korningar absolut):")
        for _, r in top_abs.iterrows():
            print(f"  {r['Ventil_ID']} (gren {int(r['Gren'])}): "
                  f"{r['MAN_totalt']} MAN ({r['Manuell_andel_%']:.1f}%, "
                  f"tillg={r['Medel_tillg']:.1f}%)")

    # Grensammanfattning
    top_br = branch_df.head(5)
    if not top_br.empty:
        print(f"\nTopp-5 grenar (hogst manuell andel):")
        for _, r in top_br.iterrows():
            print(f"  Gren {int(r['Gren'])}: {r['Manuell_andel_%']:.1f}% "
                  f"({r['MAN_totalt']} MAN, {r['MAN_per_ventil']:.0f}/ventil)")

    # Korrelation: manuell andel vs tillganglighet
    if not valve_summary.empty:
        valid = valve_summary.dropna(subset=["Medel_tillg"])
        valid = valid[valid["Total_CMD"] > 10]
        if len(valid) >= 5:
            r, p = stats.pearsonr(valid["Manuell_andel_%"], valid["Medel_tillg"])
            print(f"\nKorrelation manuell andel vs tillganglighet:")
            print(f"  Pearson r: {r:.3f}, p: {p:.4f}")
            if abs(r) > 0.3 and p < 0.05:
                riktning = "negativ" if r < 0 else "positiv"
                print(f"  -> {riktning} korrelation: ventiler med hog manuell andel har "
                      f"{'lagre' if r < 0 else 'hogre'} tillganglighet")

    print("\n" + "=" * 60)


def main():
    ensure_output_dir()
    report_files = get_report_files()
    if not report_files:
        print("Inga rapportfiler hittades!")
        return

    print(f"Laser {len(report_files)} rapporter for manuell analys...\n")

    # Kolumninfo
    print("Kolumner i data:")
    discover_columns(report_files)

    # Datainsamling
    print("\nSamlar manuell/automatisk data (Sheet9+11)...")
    manual_df = collect_manual_data(report_files)
    print(f"  {len(manual_df)} rader, {manual_df['Ventil_ID'].nunique()} ventiler")

    print("Samlar drifttid (Sheet3)...")
    time_df = collect_operation_time(report_files)

    # Berakningar
    print("\nBeraknar KPI:er...")
    monthly_df = compute_monthly_kpis(manual_df, time_df)

    print("Beraknar ventilsammanfattning...")
    valve_summary = compute_valve_summary(manual_df)

    print("Beraknar grenanalys...")
    branch_df = compute_branch_manual(manual_df)

    # Spara
    csv_path = OUTPUT_DIR / "manuell_analys.csv"
    monthly_df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"\nCSV sparad: {csv_path}")

    valve_csv = OUTPUT_DIR / "manuell_ventiler.csv"
    valve_summary.to_csv(valve_csv, index=False, encoding="utf-8-sig")
    print(f"CSV sparad: {valve_csv}")

    # Graf
    create_plots(monthly_df, valve_summary, branch_df, manual_df)

    # Sammanfattning
    print_summary(monthly_df, valve_summary, branch_df)


if __name__ == "__main__":
    main()
