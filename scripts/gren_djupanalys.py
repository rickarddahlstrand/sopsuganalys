#!/usr/bin/env python3
"""Grendjupanalys for sopsugsanlaggningen.

Bygger ut befintlig grenanalys (trendanalys.py halsopoang) med
ventilmetadata fran "Info"-kolumnen, sasongsmonster per gren,
och identifiering av grentyper (skola/bostader).

Datakallor:
  - Sheet9  (rad 3): ID, Info, MAN_OPEN_CMD, AUTO_OPEN_CMD, INLET_OPEN
  - Sheet11 (rad 3): ID, Info, Availability [%], felkolumner

Output:
  - output/gren_djupanalys.csv — Per gren per manad
  - output/gren_profiler.csv   — En rad per gren med arsprofil + Info-text
  - output/gren_tillganglighet_heatmap.png — Tillganglighet heatmap
  - output/gren_feltrend.png — Feltrend topp-5 grenar
  - output/gren_manuell.png — Manuell andel per gren
  - output/gren_sasong.png — Sommar vs vinter kommandon
  - output/gren_typer.png — Grentyp-fordelning
  - output/gren_ranking.png — Tillganglighet ranking
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
    read_sheet,
    parse_valve_id,
    ensure_output_dir,
)

ERROR_COLS = {
    "DOES_NOT_CLOSE", "DOES_NOT_OPEN", "LEVEL_ERROR",
    "LONG_TIME_SINCE_LAST_COLLECTION", "ERROR_FEEDBACK_FROM_USER",
}


def collect_valve_info(report_files):
    """Extrahera "Info"-kolumn fran Sheet9/11 → ventil-ID, gren, beskrivningstext.

    Tar info fran forsta filen som innehaller data (info andras normalt inte
    mellan manader).
    """
    info_rows = []
    seen_ids = set()

    for month_num, month_name, filepath in report_files:
        # Prova Sheet9 forst
        for sheet_name in ["Sheet9", "Sheet11"]:
            df = read_sheet(filepath, sheet_name, header_row=3)
            id_col = [c for c in df.columns if c.lower().strip() == "id"]
            info_col = [c for c in df.columns if c.lower().strip() == "info"]

            if not id_col or not info_col:
                continue

            for _, row in df.iterrows():
                vid = str(row[id_col[0]]).strip()
                if not vid or vid == "nan" or vid in seen_ids:
                    continue

                info = str(row[info_col[0]]).strip()
                if info == "nan":
                    info = ""

                if info:
                    try:
                        gren, ventilnr = parse_valve_id(vid)
                    except (ValueError, IndexError):
                        gren, ventilnr = -1, -1

                    info_rows.append({
                        "Ventil_ID": vid,
                        "Gren": gren,
                        "Ventilnr": ventilnr,
                        "Info": info,
                    })
                    seen_ids.add(vid)

        # Vi vill helst data fran bara en manad, men tar fran alla for att
        # fanga ev. ventiler som bara finns i vissa rapporter
        # break utkommenterad for fullstandighet

    return pd.DataFrame(info_rows) if info_rows else pd.DataFrame(
        columns=["Ventil_ID", "Gren", "Ventilnr", "Info"]
    )


def collect_branch_data(report_files):
    """Aggregera per gren per manad: tillganglighet, fel, kommandon, manuell andel."""
    rows = []
    for month_num, month_name, filepath in report_files:
        # Sheet11: tillganglighet + felkoder
        df11 = read_sheet(filepath, "Sheet11", header_row=3)
        avail_col = [c for c in df11.columns if "availability" in c.lower()]
        id_col11 = "ID" if "ID" in df11.columns else None
        found_error_cols = [c for c in df11.columns if c in ERROR_COLS]

        if not avail_col or not id_col11:
            continue

        # Sheet9: kommandon
        df9 = read_sheet(filepath, "Sheet9", header_row=3)
        id_col9 = [c for c in df9.columns if c.lower().strip() == "id"]
        cmd_map = {}
        if id_col9:
            for c in df9.columns:
                cl = c.strip().upper()
                if cl == "MAN_OPEN_CMD":
                    cmd_map["man"] = c
                elif cl == "AUTO_OPEN_CMD":
                    cmd_map["auto"] = c

            man_lookup = {}
            auto_lookup = {}
            for _, r9 in df9.iterrows():
                vid9 = str(r9[id_col9[0]]).strip()
                if vid9 and vid9 != "nan":
                    m = pd.to_numeric(r9.get(cmd_map.get("man", ""), 0), errors="coerce")
                    a = pd.to_numeric(r9.get(cmd_map.get("auto", ""), 0), errors="coerce")
                    man_lookup[vid9] = int(m) if pd.notna(m) else 0
                    auto_lookup[vid9] = int(a) if pd.notna(a) else 0

        # Per ventil -> aggregera per gren
        gren_data = {}
        for _, row in df11.iterrows():
            vid = str(row[id_col11]).strip()
            if not vid or vid == "nan":
                continue

            try:
                gren, _ = parse_valve_id(vid)
            except (ValueError, IndexError):
                continue

            avail = pd.to_numeric(row[avail_col[0]], errors="coerce")
            if pd.isna(avail):
                continue

            total_errors = 0
            for ec in found_error_cols:
                ev = pd.to_numeric(row[ec], errors="coerce")
                if pd.notna(ev) and ev > 0:
                    total_errors += int(ev)

            man_cmd = man_lookup.get(vid, 0) if cmd_map else 0
            auto_cmd = auto_lookup.get(vid, 0) if cmd_map else 0

            if gren not in gren_data:
                gren_data[gren] = {
                    "avail_sum": 0, "avail_count": 0,
                    "errors": 0, "man": 0, "auto": 0, "ventiler": set()
                }
            gren_data[gren]["avail_sum"] += avail
            gren_data[gren]["avail_count"] += 1
            gren_data[gren]["errors"] += total_errors
            gren_data[gren]["man"] += man_cmd
            gren_data[gren]["auto"] += auto_cmd
            gren_data[gren]["ventiler"].add(vid)

        for gren, gd in gren_data.items():
            total_cmd = gd["man"] + gd["auto"]
            rows.append({
                "Manad_nr": month_num,
                "Manad": month_name,
                "Gren": gren,
                "Medel_tillganglighet": round(gd["avail_sum"] / gd["avail_count"], 2),
                "Totala_fel": gd["errors"],
                "MAN_CMD": gd["man"],
                "AUTO_CMD": gd["auto"],
                "Total_CMD": total_cmd,
                "Manuell_andel_%": round(gd["man"] / total_cmd * 100, 1) if total_cmd > 0 else 0,
                "Antal_ventiler": len(gd["ventiler"]),
            })

    return pd.DataFrame(rows)


def identify_branch_characteristics(info_df, branch_df):
    """Tagga grenar med info-text, detektera sasongstyp."""
    if info_df.empty or branch_df.empty:
        return pd.DataFrame()

    # Samla info per gren
    gren_info = {}
    for gren in info_df["Gren"].unique():
        if gren < 0:
            continue
        texts = info_df[info_df["Gren"] == gren]["Info"].unique()
        combined = "; ".join(t for t in texts if t)
        gren_info[gren] = combined

    # Detektera grentyp baserat pa info-text
    gren_types = {}
    for gren, text in gren_info.items():
        text_lower = text.lower()
        if any(t in text_lower for t in ["skola", "school", "forskola", "forskolebarn"]):
            gren_types[gren] = "Skola/forskola"
        elif any(t in text_lower for t in ["kontor", "office", "butik", "handels"]):
            gren_types[gren] = "Kontor/handel"
        elif any(t in text_lower for t in ["bostader", "lagenhet", "brf", "hush"]):
            gren_types[gren] = "Bostader"
        else:
            gren_types[gren] = "Ovrigt"

    # Sasongsanalys per gren
    season_results = {}
    for gren in branch_df["Gren"].unique():
        g_data = branch_df[branch_df["Gren"] == gren].sort_values("Manad_nr")
        if len(g_data) < 4:
            continue

        sommar = g_data[g_data["Manad_nr"].isin([6, 7, 8])]["Total_CMD"].mean()
        vinter = g_data[g_data["Manad_nr"].isin([12, 1, 2])]["Total_CMD"].mean()
        medel = g_data["Total_CMD"].mean()

        # Variationskoefficient
        cv = g_data["Total_CMD"].std() / medel * 100 if medel > 0 else 0

        sommar_andel = sommar / medel if medel > 0 else 0

        season_results[gren] = {
            "Sommar_CMD": round(sommar, 0),
            "Vinter_CMD": round(vinter, 0),
            "CV_%": round(cv, 1),
            "Sasongstyp": "Sommarsvacka" if sommar_andel < 0.7 else
                          "Sommartopp" if sommar_andel > 1.3 else "Jamn",
        }

    # Bygg profil-dataframe
    profiler = []
    all_grenar = sorted(set(branch_df["Gren"].unique()))
    for gren in all_grenar:
        g_data = branch_df[branch_df["Gren"] == gren]
        profiler.append({
            "Gren": gren,
            "Antal_ventiler": g_data["Antal_ventiler"].max() if not g_data.empty else 0,
            "Medel_tillganglighet": round(g_data["Medel_tillganglighet"].mean(), 2) if not g_data.empty else np.nan,
            "Totala_fel_aret": g_data["Totala_fel"].sum() if not g_data.empty else 0,
            "Manuell_andel_%": round(g_data["Manuell_andel_%"].mean(), 1) if not g_data.empty else 0,
            "Info": gren_info.get(gren, ""),
            "Grentyp": gren_types.get(gren, "Okand"),
            "Sasongstyp": season_results.get(gren, {}).get("Sasongstyp", "?"),
            "CV_%": season_results.get(gren, {}).get("CV_%", np.nan),
            "Sommar_CMD": season_results.get(gren, {}).get("Sommar_CMD", np.nan),
            "Vinter_CMD": season_results.get(gren, {}).get("Vinter_CMD", np.nan),
        })

    return pd.DataFrame(profiler)


def create_plots(branch_df, profiler_df):
    """Spara 6 individuella grafer istallet for 3x2 subplot-kluster."""
    if branch_df.empty:
        print("Ingen data att visualisera.")
        return

    # 1. Tillganglighets-heatmap per gren & manad
    fig, ax = plt.subplots(figsize=(10, 4.5))
    pivot_avail = branch_df.pivot_table(index="Gren", columns="Manad_nr",
                                         values="Medel_tillganglighet", aggfunc="mean")
    pivot_avail = pivot_avail.sort_index()
    pivot_avail.columns = [MANAD_NAMN.get(c, str(c)) for c in pivot_avail.columns]
    if not pivot_avail.empty:
        im = ax.imshow(pivot_avail.values, aspect="auto", cmap="RdYlGn", vmin=90, vmax=100)
        ax.set_xticks(range(len(pivot_avail.columns)))
        ax.set_xticklabels(pivot_avail.columns, fontsize=7, rotation=45)
        ax.set_yticks(range(len(pivot_avail.index)))
        ax.set_yticklabels([str(g) for g in pivot_avail.index], fontsize=7)
        fig.colorbar(im, ax=ax, label="%", shrink=0.8)
    ax.set_title("Tillganglighet per gren & manad")
    plt.tight_layout()
    path = OUTPUT_DIR / "gren_tillganglighet_heatmap.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 2. Feltrend per gren (topp-5 samsta)
    fig, ax = plt.subplots(figsize=(10, 3.5))
    gren_total_fel = branch_df.groupby("Gren")["Totala_fel"].sum().nlargest(5)
    for gren in gren_total_fel.index:
        g_data = branch_df[branch_df["Gren"] == gren].sort_values("Manad_nr")
        ax.plot(g_data["Manad"], g_data["Totala_fel"], "-o", markersize=4,
                label=f"Gren {gren}")
    ax.set_title("Feltrend (topp-5 samsta grenar)")
    ax.set_ylabel("Antal fel")
    ax.legend(fontsize=7)
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "gren_feltrend.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 3. Manuell andel per gren (bar)
    fig, ax = plt.subplots(figsize=(10, 5))
    gren_man = branch_df.groupby("Gren")["Manuell_andel_%"].mean().sort_values(ascending=True)
    if not gren_man.empty:
        colors = ["#F44336" if v > 20 else "#FF9800" if v > 10 else "#4CAF50" for v in gren_man.values]
        ax.barh([str(g) for g in gren_man.index], gren_man.values, color=colors)
        ax.axvline(10, color="orange", linestyle="--", linewidth=0.8, alpha=0.5)
        ax.axvline(20, color="red", linestyle="--", linewidth=0.8, alpha=0.5)
    ax.set_title("Manuell andel per gren (arsmedel)")
    ax.set_xlabel("Manuell andel (%)")
    plt.tight_layout()
    path = OUTPUT_DIR / "gren_manuell.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 4. Sasongsmonster: sommar vs vinter CMD
    fig, ax = plt.subplots(figsize=(10, 3.5))
    if not profiler_df.empty:
        prof = profiler_df.dropna(subset=["Sommar_CMD", "Vinter_CMD"]).sort_values("Gren")
        if not prof.empty:
            x = np.arange(len(prof))
            width = 0.35
            ax.bar(x - width / 2, prof["Sommar_CMD"], width, color="#FF9800", alpha=0.8, label="Sommar")
            ax.bar(x + width / 2, prof["Vinter_CMD"], width, color="#2196F3", alpha=0.8, label="Vinter")
            ax.set_xticks(x)
            ax.set_xticklabels([str(g) for g in prof["Gren"]], fontsize=6, rotation=45)
            ax.legend(fontsize=8)
    ax.set_title("Sommar vs vinter per gren (kommandon)")
    ax.set_ylabel("Medel CMD/manad")
    plt.tight_layout()
    path = OUTPUT_DIR / "gren_sasong.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 5. Grentyp-fordelning (pie) om profiler finns
    fig, ax = plt.subplots(figsize=(8, 4.5))
    if not profiler_df.empty and "Grentyp" in profiler_df.columns:
        typ_counts = profiler_df["Grentyp"].value_counts()
        ax.pie(typ_counts.values, labels=typ_counts.index, autopct="%1.0f%%",
               colors=plt.cm.Set2(np.linspace(0, 1, len(typ_counts))),
               textprops={"fontsize": 9})
    ax.set_title("Grentyper (baserat pa Info-falt)")
    plt.tight_layout()
    path = OUTPUT_DIR / "gren_typer.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")

    # 6. Tillganglighet ranking (horisontell bar)
    fig, ax = plt.subplots(figsize=(10, 5))
    if not profiler_df.empty:
        prof_sorted = profiler_df.sort_values("Medel_tillganglighet")
        colors = []
        for v in prof_sorted["Medel_tillganglighet"]:
            if pd.isna(v) or v < 95:
                colors.append("#F44336")
            elif v < 99:
                colors.append("#FF9800")
            else:
                colors.append("#4CAF50")
        ax.barh([str(g) for g in prof_sorted["Gren"]], prof_sorted["Medel_tillganglighet"],
                color=colors)
        ax.axvline(95, color="red", linestyle="--", linewidth=0.8, alpha=0.5)
        ax.axvline(99, color="orange", linestyle="--", linewidth=0.8, alpha=0.5)
    ax.set_title("Tillganglighet per gren (arsmedel)")
    ax.set_xlabel("Medel tillganglighet (%)")
    plt.tight_layout()
    path = OUTPUT_DIR / "gren_ranking.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Graf sparad: {path}")


def print_summary(branch_df, profiler_df, info_df):
    """Skriver textsammanfattning till stdout."""
    print("\n" + "=" * 60)
    print("GRENDJUPANALYS — Sammanfattning 2025")
    print("=" * 60)

    if branch_df.empty:
        print("Ingen grendata hittades.")
        return

    grenar = sorted(branch_df["Gren"].unique())
    print(f"\nAntal grenar: {len(grenar)}")

    # Info-falt sammanfattning
    if not info_df.empty:
        unique_info = info_df["Info"].nunique()
        print(f"Ventiler med Info-text: {len(info_df)} ({unique_info} unika texter)")

        # Visa nagra exempel
        samples = info_df.drop_duplicates(subset=["Info"]).head(10)
        print(f"\nExempel pa Info-texter:")
        for _, r in samples.iterrows():
            print(f"  Ventil {r['Ventil_ID']}: {r['Info'][:60]}")

    # Grentyper
    if not profiler_df.empty and "Grentyp" in profiler_df.columns:
        print(f"\nGrentyper (baserat pa Info-falt):")
        for typ in profiler_df["Grentyp"].unique():
            count = len(profiler_df[profiler_df["Grentyp"] == typ])
            print(f"  {typ}: {count} grenar")

    # Sasongstyper
    if not profiler_df.empty and "Sasongstyp" in profiler_df.columns:
        print(f"\nSasongstyper:")
        for typ in profiler_df["Sasongstyp"].unique():
            grenar_i = profiler_df[profiler_df["Sasongstyp"] == typ]["Gren"].tolist()
            print(f"  {typ}: grenar {grenar_i}")

    # Samsta/basta grenar
    if not profiler_df.empty:
        print(f"\nTopp-5 samsta grenar (tillganglighet):")
        worst = profiler_df.sort_values("Medel_tillganglighet").head(5)
        for _, r in worst.iterrows():
            print(f"  Gren {int(r['Gren'])}: {r['Medel_tillganglighet']:.1f}%, "
                  f"fel: {r['Totala_fel_aret']}, MAN: {r['Manuell_andel_%']:.1f}%, "
                  f"typ: {r['Grentyp']}, sasong: {r['Sasongstyp']}")

        print(f"\nTopp-5 grenar hogst manuell andel:")
        worst_man = profiler_df.sort_values("Manuell_andel_%", ascending=False).head(5)
        for _, r in worst_man.iterrows():
            print(f"  Gren {int(r['Gren'])}: MAN {r['Manuell_andel_%']:.1f}%, "
                  f"tillg: {r['Medel_tillganglighet']:.1f}%, typ: {r['Grentyp']}")

    print("\n" + "=" * 60)


def main():
    ensure_output_dir()
    report_files = get_report_files()

    if not report_files:
        print("Inga rapportfiler hittades!")
        return

    print(f"Laser {len(report_files)} rapporter for grendjupanalys...\n")

    # Datainsamling
    print("1. Samlar ventil-Info (Sheet9/11)...")
    info_df = collect_valve_info(report_files)
    print(f"   {len(info_df)} ventiler med Info-text")

    print("2. Samlar grendata (Sheet9+11)...")
    branch_df = collect_branch_data(report_files)
    print(f"   {len(branch_df)} rader, {branch_df['Gren'].nunique()} grenar")

    # Analys
    print("3. Identifierar grenkaraktaristik...")
    profiler_df = identify_branch_characteristics(info_df, branch_df)
    print(f"   {len(profiler_df)} grenprofiler skapade")

    # Spara CSV:er
    csv_path = OUTPUT_DIR / "gren_djupanalys.csv"
    branch_df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"CSV sparad: {csv_path}")

    if not profiler_df.empty:
        prof_path = OUTPUT_DIR / "gren_profiler.csv"
        profiler_df.to_csv(prof_path, index=False, encoding="utf-8-sig")
        print(f"CSV sparad: {prof_path}")

    # Graf
    create_plots(branch_df, profiler_df)

    # Sammanfattning
    print_summary(branch_df, profiler_df, info_df)


if __name__ == "__main__":
    main()
