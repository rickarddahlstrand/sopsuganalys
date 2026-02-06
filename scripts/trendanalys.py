#!/usr/bin/env python3
"""Djup trendanalys av sopsugsanlaggningen.

Samlar granular per-ventil/per-manad data fran .xls-filerna
och beraknar statistik med scipy/numpy.

Datakallor:
  - Sheet3  (rad 3): Energy (kWh), Operation Time (h)
  - Sheet5  (rad 3): Fraction, Hours, kWh, Emptyings, Emptying/minute
  - Sheet7  (rad 4): Name, ID, Starts, Hours, kWh
  - Sheet9  (rad 3): ID, Info, MAN_OPEN_CMD, AUTO_OPEN_CMD, INLET_OPEN
  - Sheet11 (rad 3): Availability [%], felkolumner per ventil
  - Sheet13 (rad 7): Alarm category, Current period, Average

Output:
  - output/trend_anlaggning.csv
  - output/trend_ventiler.csv
  - output/trend_grenar.csv
  - output/trend_korrelationer.csv
  - output/trend_anomalier.csv
  - output/trend_energi_forbrukning.png
  - output/trend_energi_effektivitet.png
  - output/trend_energi_fraktioner.png
  - output/trend_energi_korrelation.png
  - output/trend_ventiler_tillganglighet.png
  - output/trend_ventiler_feltyper.png
  - output/trend_ventiler_samsta.png
  - output/trend_ventiler_felfordelning.png
  - output/trend_grenar_halsopoang.png
  - output/trend_grenar_heatmap.png
  - output/trend_larm_trend.png
  - output/trend_larm_jamforelse.png
"""

import re

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

ERROR_COLS = {
    "DOES_NOT_CLOSE", "DOES_NOT_OPEN", "LEVEL_ERROR",
    "LONG_TIME_SINCE_LAST_COLLECTION", "ERROR_FEEDBACK_FROM_USER",
}


# ---------------------------------------------------------------------------
# Datainsamling
# ---------------------------------------------------------------------------

def collect_valve_monthly(report_files):
    """Samlar per-ventil per-manad data fran Sheet11 + Sheet9."""
    rows = []
    for month_num, month_name, filepath in report_files:
        # Sheet11: tillganglighet + felkoder
        df11 = read_sheet(filepath, "Sheet11", header_row=3)
        avail_col = [c for c in df11.columns if "availability" in c.lower()]
        id_col = "ID" if "ID" in df11.columns else None
        if not avail_col or not id_col:
            continue

        found_error_cols = [c for c in df11.columns if c in ERROR_COLS]

        # Sheet9: kommandon
        df9 = read_sheet(filepath, "Sheet9", header_row=3)
        id_col9 = [c for c in df9.columns if c.lower() == "id"]
        cmd_cols9 = [c for c in df9.columns if "open" in c.lower() or "cmd" in c.lower()]
        cmd_lookup = {}
        if id_col9:
            for _, row9 in df9.iterrows():
                vid9 = str(row9[id_col9[0]]).strip()
                if vid9 and vid9 != "nan":
                    total_cmds = 0
                    for cc in cmd_cols9:
                        v = pd.to_numeric(row9[cc], errors="coerce")
                        if pd.notna(v):
                            total_cmds += int(v)
                    cmd_lookup[vid9] = total_cmds

        for _, row in df11.iterrows():
            vid = str(row[id_col]).strip()
            if not vid or vid == "nan":
                continue

            avail = pd.to_numeric(row[avail_col[0]], errors="coerce")
            if pd.isna(avail):
                continue

            total_errors = 0
            error_detail = {}
            for ec in found_error_cols:
                ev = pd.to_numeric(row[ec], errors="coerce")
                if pd.notna(ev) and ev > 0:
                    error_detail[ec] = int(ev)
                    total_errors += int(ev)

            try:
                gren, ventilnr = parse_valve_id(vid)
            except (ValueError, IndexError):
                gren, ventilnr = -1, -1

            rows.append({
                "Manad_nr": month_num,
                "Manad": month_name,
                "Ventil_ID": vid,
                "Gren": gren,
                "Ventilnr": ventilnr,
                "Tillganglighet": avail,
                "Totala_fel": total_errors,
                "Kommandon": cmd_lookup.get(vid, 0),
                **{f"Fel_{ec}": error_detail.get(ec, 0) for ec in ERROR_COLS},
            })

    return pd.DataFrame(rows)


def collect_energy_detail(report_files):
    """Samlar per-fraktion per-manad energi- och tomningsdata."""
    rows = []
    for month_num, month_name, filepath in report_files:
        # Sheet3: total energi + drifttid
        df3 = read_sheet(filepath, "Sheet3", header_row=3)
        energy_col = [c for c in df3.columns if "energy" in c.lower() or "kwh" in c.lower()]
        time_col = [c for c in df3.columns if "operation" in c.lower() or "time" in c.lower()]
        total_energy = pd.to_numeric(df3[energy_col[0]], errors="coerce").sum() if energy_col else 0
        total_time = pd.to_numeric(df3[time_col[0]], errors="coerce").sum() if time_col else 0

        # Sheet5: per fraktion
        df5 = read_sheet(filepath, "Sheet5", header_row=3)
        frac_col = [c for c in df5.columns if "fraction" in c.lower()]
        kwh_col = [c for c in df5.columns if "kwh" in c.lower()]
        empty_col = [c for c in df5.columns if "emptying" in c.lower() and "minute" not in c.lower()]
        epm_col = [c for c in df5.columns if "minute" in c.lower()]

        frac_rows = []
        if frac_col:
            for _, r in df5.iterrows():
                frac = str(r[frac_col[0]]).strip()
                if not frac or frac == "nan":
                    continue
                # Filtrera bort historiska manad-rader
                if frac.lower() == "month" or re.match(r"^\d{2}-\w+$", frac):
                    continue
                kwh = pd.to_numeric(r[kwh_col[0]], errors="coerce") if kwh_col else 0
                emptyings = pd.to_numeric(r[empty_col[0]], errors="coerce") if empty_col else 0
                epm = pd.to_numeric(r[epm_col[0]], errors="coerce") if epm_col else 0
                kwh_per_empty = kwh / emptyings if emptyings and emptyings > 0 else 0
                frac_rows.append({
                    "Fraktion": frac,
                    "kWh": kwh if pd.notna(kwh) else 0,
                    "Tomningar": int(emptyings) if pd.notna(emptyings) else 0,
                    "kWh_per_tomning": round(kwh_per_empty, 3) if pd.notna(kwh_per_empty) else 0,
                    "Tomning_per_min": round(epm, 4) if pd.notna(epm) else 0,
                })

        total_emptyings = sum(fr["Tomningar"] for fr in frac_rows)
        kwh_per_empty_total = total_energy / total_emptyings if total_emptyings > 0 else 0

        rows.append({
            "Manad_nr": month_num,
            "Manad": month_name,
            "Total_kWh": round(total_energy, 1),
            "Drifttid_h": round(total_time, 1),
            "Total_tomningar": total_emptyings,
            "kWh_per_tomning": round(kwh_per_empty_total, 3),
            "Fraktioner": frac_rows,
        })
    return rows


def collect_machine_monthly(report_files):
    """Samlar per-maskin per-manad data fran Sheet7."""
    rows = []
    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet7", header_row=4)
        name_col = [c for c in df.columns if "name" in c.lower()]
        starts_col = [c for c in df.columns if "start" in c.lower()]
        hours_col = [c for c in df.columns if "hour" in c.lower()]
        kwh_col = [c for c in df.columns if "kwh" in c.lower()]

        if not name_col:
            continue

        for _, row in df.iterrows():
            name = str(row[name_col[0]]).strip()
            if not name or name == "nan":
                continue
            if name.lower() == "total":
                continue
            s = pd.to_numeric(row[starts_col[0]], errors="coerce") if starts_col else 0
            h = pd.to_numeric(row[hours_col[0]], errors="coerce") if hours_col else 0
            k = pd.to_numeric(row[kwh_col[0]], errors="coerce") if kwh_col else 0
            rows.append({
                "Manad_nr": month_num,
                "Manad": month_name,
                "Maskin": name,
                "Starter": int(s) if pd.notna(s) else 0,
                "Timmar": round(h, 1) if pd.notna(h) else 0,
                "kWh": round(k, 1) if pd.notna(k) else 0,
                "kWh_per_start": round(k / s, 2) if pd.notna(s) and s > 0 and pd.notna(k) else 0,
            })
    return pd.DataFrame(rows)


def collect_alarm_detail(report_files):
    """Samlar larmdata per kategori per manad med forega arets snitt."""
    rows = []
    for month_num, month_name, filepath in report_files:
        df = read_sheet(filepath, "Sheet13", header_row=7)
        cat_col = [c for c in df.columns if "alarm" in c.lower() or "category" in c.lower()]
        current_col = [c for c in df.columns if "current" in c.lower() or "period" in c.lower()]
        avg_col = [c for c in df.columns if "average" in c.lower() or "previous" in c.lower()]

        if not cat_col or not current_col:
            continue

        for _, row in df.iterrows():
            cat = str(row[cat_col[0]]).strip()
            if not cat or cat == "nan":
                continue
            current = pd.to_numeric(row[current_col[0]], errors="coerce")
            avg = pd.to_numeric(row[avg_col[0]], errors="coerce") if avg_col else np.nan

            if pd.notna(current):
                rows.append({
                    "Manad_nr": month_num,
                    "Manad": month_name,
                    "Kategori": cat,
                    "Aktuell": int(current),
                    "Forega_snitt": round(avg, 1) if pd.notna(avg) else np.nan,
                })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Statistiska berakningar
# ---------------------------------------------------------------------------

def compute_linear_trends(series_dict):
    """Beraknar linjar regression for varje namngiven tidsserie.

    series_dict: {namn: [(x, y), ...]}
    Returnerar dict med {namn: {slope, intercept, r2, p_value, trend_class}}
    """
    results = {}
    for name, points in series_dict.items():
        if len(points) < 3:
            results[name] = {"slope": 0, "r2": 0, "p_value": 1, "trend_class": "otillracklig_data"}
            continue
        x = np.array([p[0] for p in points], dtype=float)
        y = np.array([p[1] for p in points], dtype=float)
        slope, intercept, r_value, p_value, _ = stats.linregress(x, y)
        r2 = r_value ** 2

        if p_value > 0.05:
            trend_class = "stabil"
        elif slope > 0:
            trend_class = "okande"
        else:
            trend_class = "minskande"

        results[name] = {
            "slope": round(slope, 4),
            "intercept": round(intercept, 4),
            "r2": round(r2, 4),
            "p_value": round(p_value, 6),
            "trend_class": trend_class,
        }
    return results


def compute_moving_averages(df, value_col, window=3):
    """Beraknar glidande medelvarde for en kolumn."""
    return df[value_col].rolling(window=window, min_periods=1).mean()


def detect_anomalies(values, labels=None, threshold=2.0):
    """Hittar avvikelser via z-score. Hanterar std=0."""
    arr = np.array(values, dtype=float)
    mean = np.nanmean(arr)
    std = np.nanstd(arr)

    anomalies = []
    if std == 0 or np.isnan(std):
        return anomalies

    z_scores = (arr - mean) / std
    for i, z in enumerate(z_scores):
        if abs(z) > threshold:
            anomalies.append({
                "index": i,
                "label": labels[i] if labels is not None else i,
                "varde": round(float(arr[i]), 2),
                "z_score": round(float(z), 2),
                "typ": "hog" if z > 0 else "lag",
            })
    return anomalies


def compute_correlations(data_pairs):
    """Beraknar Pearson och Spearman for par av serier.

    data_pairs: {namn: (x_array, y_array)}
    """
    results = {}
    for name, (x, y) in data_pairs.items():
        x = np.array(x, dtype=float)
        y = np.array(y, dtype=float)
        mask = ~(np.isnan(x) | np.isnan(y))
        x, y = x[mask], y[mask]
        if len(x) < 3:
            results[name] = {"pearson_r": np.nan, "spearman_r": np.nan, "tolkning": "otillracklig_data"}
            continue
        pr, pp = stats.pearsonr(x, y)
        sr, sp = stats.spearmanr(x, y)

        if abs(pr) > 0.7:
            tolkning = "stark"
        elif abs(pr) > 0.4:
            tolkning = "mattlig"
        else:
            tolkning = "svag"
        riktning = "positiv" if pr > 0 else "negativ"

        results[name] = {
            "pearson_r": round(pr, 4),
            "pearson_p": round(pp, 6),
            "spearman_r": round(sr, 4),
            "spearman_p": round(sp, 6),
            "tolkning": f"{tolkning} {riktning}",
        }
    return results


def detect_seasonal_patterns(values, max_lag=6):
    """Detekterar sasongsmonster via autokorrelation."""
    arr = np.array(values, dtype=float)
    arr = arr - np.nanmean(arr)
    n = len(arr)
    if n < 6:
        return {"har_sasongsmonster": False}

    norm = np.sum(arr ** 2)
    if norm == 0:
        return {"har_sasongsmonster": False}

    autocorr = []
    for lag in range(1, min(max_lag + 1, n)):
        c = np.sum(arr[:n-lag] * arr[lag:]) / norm
        autocorr.append({"lag": lag, "korrelation": round(float(c), 4)})

    peak_lag = max(autocorr, key=lambda x: x["korrelation"])
    return {
        "har_sasongsmonster": peak_lag["korrelation"] > 0.3,
        "starkast_lag": peak_lag["lag"],
        "korrelation": peak_lag["korrelation"],
        "alla_lag": autocorr,
    }


def compute_branch_analysis(valve_df):
    """Aggregerar per gren: medel/min tillg., fel/ventil, trend, halsopoang."""
    if valve_df.empty:
        return pd.DataFrame()

    grenar = valve_df.groupby("Gren").agg(
        antal_ventiler=("Ventil_ID", "nunique"),
        medel_tillg=("Tillganglighet", "mean"),
        min_tillg=("Tillganglighet", "min"),
        totala_fel=("Totala_fel", "sum"),
    ).reset_index()

    # Fel per ventil
    grenar["fel_per_ventil"] = (grenar["totala_fel"] / grenar["antal_ventiler"]).round(1)

    # Samsta ventil per gren
    worst_per_branch = valve_df.groupby("Gren").apply(
        lambda g: g.groupby("Ventil_ID")["Tillganglighet"].mean().idxmin(),
        include_groups=False,
    ).reset_index()
    worst_per_branch.columns = ["Gren", "samsta_ventil"]
    grenar = grenar.merge(worst_per_branch, on="Gren", how="left")

    # Trendberakning per gren
    trend_results = {}
    for gren in valve_df["Gren"].unique():
        gren_data = valve_df[valve_df["Gren"] == gren]
        monthly = gren_data.groupby("Manad_nr")["Tillganglighet"].mean()
        points = [(m, v) for m, v in monthly.items()]
        tr = compute_linear_trends({f"gren_{gren}": points})
        trend_results[gren] = tr[f"gren_{gren}"]

    grenar["trend_class"] = grenar["Gren"].map(lambda g: trend_results.get(g, {}).get("trend_class", "?"))
    grenar["trend_slope"] = grenar["Gren"].map(lambda g: trend_results.get(g, {}).get("slope", 0))

    # Halsopoang
    def health_score(row):
        tillg_score = row["medel_tillg"] * 0.5
        fel_score = (100 - min(row["fel_per_ventil"], 100)) * 0.3
        trend_factor = 50  # neutral
        if row["trend_class"] == "okande":
            trend_factor = 75
        elif row["trend_class"] == "minskande":
            trend_factor = 25
        trend_score = trend_factor * 0.2
        return round(tillg_score + fel_score + trend_score, 1)

    grenar["halsopoang"] = grenar.apply(health_score, axis=1)
    grenar = grenar.sort_values("halsopoang")

    return grenar


# ---------------------------------------------------------------------------
# Output: CSV-filer
# ---------------------------------------------------------------------------

def save_trend_anlaggning(energy_data, alarm_df, trends):
    """Sparar anlaggningstrend-CSV."""
    rows = []
    for ed in energy_data:
        month = ed["Manad_nr"]
        alarm_month = alarm_df[alarm_df["Manad_nr"] == month]["Aktuell"].sum() if not alarm_df.empty else 0
        rows.append({
            "Manad_nr": ed["Manad_nr"],
            "Manad": ed["Manad"],
            "Energi_kWh": ed["Total_kWh"],
            "Drifttid_h": ed["Drifttid_h"],
            "Tomningar": ed["Total_tomningar"],
            "kWh_per_tomning": ed["kWh_per_tomning"],
            "Larm_totalt": alarm_month,
        })

    df = pd.DataFrame(rows).sort_values("Manad_nr")

    # Lagg till trendlinjer
    for col, key in [("Energi_kWh", "energi"), ("Tomningar", "tomningar"),
                     ("kWh_per_tomning", "kwh_per_tomning"), ("Larm_totalt", "larm")]:
        if key in trends:
            t = trends[key]
            df[f"{col}_trend"] = t["intercept"] + t["slope"] * df["Manad_nr"]
            df[f"{col}_trend_class"] = t["trend_class"]
            df[f"{col}_p"] = t["p_value"]

    # Glidande medelvarden
    for col in ["Energi_kWh", "Tomningar", "kWh_per_tomning", "Larm_totalt"]:
        df[f"{col}_MA3"] = compute_moving_averages(df, col, 3).round(1)

    path = OUTPUT_DIR / "trend_anlaggning.csv"
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"  Sparad: {path}")
    return df


def save_trend_ventiler(valve_df, trends_per_valve):
    """Sparar per-ventil trenddata."""
    # Lagg till trendklassning
    valve_out = valve_df.copy()
    valve_out["trend_class"] = valve_out["Ventil_ID"].map(
        lambda vid: trends_per_valve.get(vid, {}).get("trend_class", "?")
    )

    # Anomaliflaggor per ventil
    anomaly_flags = {}
    for vid in valve_df["Ventil_ID"].unique():
        vdata = valve_df[valve_df["Ventil_ID"] == vid].sort_values("Manad_nr")
        anomalies = detect_anomalies(
            vdata["Tillganglighet"].values,
            labels=vdata["Manad"].values,
        )
        if anomalies:
            for a in anomalies:
                anomaly_flags[(vid, a["label"])] = True

    valve_out["anomali"] = valve_out.apply(
        lambda r: anomaly_flags.get((r["Ventil_ID"], r["Manad"]), False), axis=1
    )

    path = OUTPUT_DIR / "trend_ventiler.csv"
    valve_out.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"  Sparad: {path}")
    return valve_out


def save_trend_grenar(branch_df):
    """Sparar grenanalys."""
    path = OUTPUT_DIR / "trend_grenar.csv"
    branch_df.round(2).to_csv(path, index=False, encoding="utf-8-sig")
    print(f"  Sparad: {path}")


def save_correlations(corr_results):
    """Sparar korrelationsdata."""
    rows = []
    for name, vals in corr_results.items():
        rows.append({"Par": name, **vals})
    df = pd.DataFrame(rows)
    path = OUTPUT_DIR / "trend_korrelationer.csv"
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"  Sparad: {path}")


def save_anomalies(all_anomalies):
    """Sparar alla detekterade avvikelser."""
    path = OUTPUT_DIR / "trend_anomalier.csv"
    df = pd.DataFrame(all_anomalies)
    df.to_csv(path, index=False, encoding="utf-8-sig")
    print(f"  Sparad: {path} ({len(df)} anomalier)")


# ---------------------------------------------------------------------------
# Output: Grafer
# ---------------------------------------------------------------------------

def create_energy_plots(anlaggning_df, energy_data, corr_results):
    """4 individuella grafer: energitrend+MA, kWh/tomning, fraktionsarea, korrelationsscatter."""
    months = anlaggning_df["Manad"].values

    # 1. Energitrend + MA
    fig, ax = plt.subplots(figsize=(10, 3.5))
    ax.bar(months, anlaggning_df["Energi_kWh"], color="#2196F3", alpha=0.6, label="Faktisk")
    if "Energi_kWh_MA3" in anlaggning_df.columns:
        ax.plot(months, anlaggning_df["Energi_kWh_MA3"], "r-o", linewidth=2, markersize=4, label="MA(3)")
    if "Energi_kWh_trend" in anlaggning_df.columns:
        ax.plot(months, anlaggning_df["Energi_kWh_trend"], "k--", linewidth=1, label="Trendlinje")
    ax.set_ylabel("kWh")
    ax.set_title("Energiforbrukning + trend", fontsize=14, fontweight="bold")
    ax.legend(fontsize=7)
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_energi_forbrukning.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")

    # 2. kWh per tomning
    fig, ax = plt.subplots(figsize=(10, 3.5))
    ax.plot(months, anlaggning_df["kWh_per_tomning"], "g-o", linewidth=2)
    if "kWh_per_tomning_MA3" in anlaggning_df.columns:
        ax.plot(months, anlaggning_df["kWh_per_tomning_MA3"], "r--", linewidth=1.5, label="MA(3)")
    ax.set_ylabel("kWh / tomning")
    ax.set_title("Energieffektivitet", fontsize=14, fontweight="bold")
    ax.legend(fontsize=7)
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_energi_effektivitet.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")

    # 3. Fraktioner area chart
    fig, ax = plt.subplots(figsize=(10, 3.5))
    frac_data = {}
    for ed in energy_data:
        for fr in ed["Fraktioner"]:
            if fr["Fraktion"] not in frac_data:
                frac_data[fr["Fraktion"]] = []
            frac_data[fr["Fraktion"]].append((ed["Manad_nr"], fr["Tomningar"]))

    if frac_data:
        frac_df = pd.DataFrame(index=range(1, 13))
        for frac, points in frac_data.items():
            s = pd.Series({m: v for m, v in points})
            frac_df[frac] = s
        frac_df = frac_df.fillna(0)
        frac_df.index = [MANAD_NAMN.get(i, str(i)) for i in frac_df.index]
        frac_df.plot.area(ax=ax, alpha=0.7, colormap="Set2")
        ax.legend(fontsize=6, loc="upper right")
    ax.set_title("Tomningar per fraktion (area)", fontsize=14, fontweight="bold")
    ax.set_ylabel("Antal")
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_energi_fraktioner.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")

    # 4. Korrelationsscatter: energi vs tomningar
    fig, ax = plt.subplots(figsize=(10, 3.5))
    if not anlaggning_df.empty:
        x = anlaggning_df["Tomningar"].values
        y = anlaggning_df["Energi_kWh"].values
        ax.scatter(x, y, color="#FF5722", s=60, zorder=3)
        for i, m in enumerate(months):
            ax.annotate(m, (x[i], y[i]), fontsize=6, ha="left", va="bottom")
        # Trendlinje
        mask = ~(np.isnan(x) | np.isnan(y))
        if mask.sum() >= 2:
            z = np.polyfit(x[mask], y[mask], 1)
            p = np.poly1d(z)
            x_line = np.linspace(x[mask].min(), x[mask].max(), 50)
            ax.plot(x_line, p(x_line), "k--", linewidth=1)
        corr_key = "energi_vs_tomningar"
        if corr_key in corr_results:
            r = corr_results[corr_key]["pearson_r"]
            ax.set_title(f"Energi vs Tomningar (r={r:.2f})", fontsize=14, fontweight="bold")
        else:
            ax.set_title("Energi vs Tomningar", fontsize=14, fontweight="bold")
    ax.set_xlabel("Tomningar")
    ax.set_ylabel("kWh")
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_energi_korrelation.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")


def create_valve_plots(valve_df):
    """4 individuella grafer: tillganglighetstrend, feltyper area, topp-10 spaghetti, felfordelning histogram."""

    # 1. Medeltillganglighet per manad
    fig, ax = plt.subplots(figsize=(10, 3.5))
    monthly = valve_df.groupby(["Manad_nr", "Manad"])["Tillganglighet"].agg(["mean", "min", "max"]).reset_index()
    monthly = monthly.sort_values("Manad_nr")
    ax.plot(monthly["Manad"], monthly["mean"], "g-o", linewidth=2, label="Medel")
    ax.fill_between(monthly["Manad"], monthly["min"], monthly["max"], alpha=0.15, color="green")
    ax.set_ylabel("Tillganglighet (%)")
    ax.set_title("Tillganglighet per manad (medel + min/max)", fontsize=14, fontweight="bold")
    ax.legend(fontsize=7)
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_ventiler_tillganglighet.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")

    # 2. Feltyper area chart
    fig, ax = plt.subplots(figsize=(10, 3.5))
    fel_cols = [c for c in valve_df.columns if c.startswith("Fel_")]
    if fel_cols:
        monthly_err = valve_df.groupby("Manad_nr")[fel_cols].sum().sort_index()
        monthly_err.index = [MANAD_NAMN.get(i, str(i)) for i in monthly_err.index]
        monthly_err.columns = [c.replace("Fel_", "") for c in monthly_err.columns]
        monthly_err.plot.area(ax=ax, alpha=0.7, colormap="Set1")
        ax.legend(fontsize=5, loc="upper right")
    ax.set_title("Feltyper per manad", fontsize=14, fontweight="bold")
    ax.set_ylabel("Antal")
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_ventiler_feltyper.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")

    # 3. Topp-10 samsta ventiler (spaghetti)
    fig, ax = plt.subplots(figsize=(10, 3.5))
    avg_avail = valve_df.groupby("Ventil_ID")["Tillganglighet"].mean()
    worst10 = avg_avail.nsmallest(10).index
    for vid in worst10:
        vdata = valve_df[valve_df["Ventil_ID"] == vid].sort_values("Manad_nr")
        ax.plot(vdata["Manad"], vdata["Tillganglighet"], "-o", markersize=3, label=vid)
    ax.set_ylabel("Tillganglighet (%)")
    ax.set_title("Topp-10 samsta ventiler", fontsize=14, fontweight="bold")
    ax.legend(fontsize=5, loc="lower left", ncol=2)
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_ventiler_samsta.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")

    # 4. Felfordelning histogram
    fig, ax = plt.subplots(figsize=(10, 3.5))
    total_per_valve = valve_df.groupby("Ventil_ID")["Totala_fel"].sum()
    ax.hist(total_per_valve.values, bins=30, color="#FF9800", edgecolor="white")
    ax.set_xlabel("Totala fel (aret)")
    ax.set_ylabel("Antal ventiler")
    ax.set_title("Felfordelning bland ventiler", fontsize=14, fontweight="bold")
    mean_err = total_per_valve.mean()
    ax.axvline(mean_err, color="red", linestyle="--", label=f"Medel: {mean_err:.0f}")
    ax.legend(fontsize=8)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_ventiler_felfordelning.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")


def create_branch_plots(branch_df, valve_df):
    """2 individuella grafer: halsopoang-ranking, tillganglighets-heatmap."""

    # 1. Halsopoang ranking (horisontell bar)
    fig, ax = plt.subplots(figsize=(10, 3.5))
    sorted_df = branch_df.sort_values("halsopoang")
    colors = []
    for h in sorted_df["halsopoang"]:
        if h < 70:
            colors.append("#F44336")
        elif h < 85:
            colors.append("#FF9800")
        else:
            colors.append("#4CAF50")
    ax.barh(sorted_df["Gren"].astype(str), sorted_df["halsopoang"], color=colors)
    ax.set_xlabel("Halsopoang")
    ax.set_title("Halsopoang per gren", fontsize=14, fontweight="bold")
    ax.axvline(70, color="red", linestyle="--", linewidth=0.8, alpha=0.5)
    ax.axvline(85, color="orange", linestyle="--", linewidth=0.8, alpha=0.5)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_grenar_halsopoang.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")

    # 2. Tillganglighets-heatmap
    fig, ax = plt.subplots(figsize=(10, 4.5))
    if not valve_df.empty:
        pivot = valve_df.groupby(["Gren", "Manad_nr"])["Tillganglighet"].mean().reset_index()
        heatmap_data = pivot.pivot(index="Gren", columns="Manad_nr", values="Tillganglighet")
        heatmap_data = heatmap_data.sort_index()
        heatmap_data.columns = [MANAD_NAMN.get(c, str(c)) for c in heatmap_data.columns]

        im = ax.imshow(heatmap_data.values, aspect="auto", cmap="RdYlGn", vmin=90, vmax=100)
        ax.set_xticks(range(len(heatmap_data.columns)))
        ax.set_xticklabels(heatmap_data.columns, fontsize=7, rotation=45)
        ax.set_yticks(range(len(heatmap_data.index)))
        ax.set_yticklabels(heatmap_data.index.astype(str), fontsize=7)
        ax.set_title("Tillganglighet per gren & manad", fontsize=14, fontweight="bold")
        fig.colorbar(im, ax=ax, label="%", shrink=0.8)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_grenar_heatmap.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")


def create_alarm_plots(alarm_df, anomalies):
    """2 individuella grafer: larmtrend med trendlinjer + anomalimarkorer, nuv vs forega ar."""

    if alarm_df.empty:
        # Spara tomma grafer
        for fname in ["trend_larm_trend.png", "trend_larm_jamforelse.png"]:
            fig, ax = plt.subplots(figsize=(10, 3.5))
            ax.set_title(fname.replace(".png", "").replace("_", " ").title(), fontsize=14, fontweight="bold")
            plt.tight_layout()
            path = OUTPUT_DIR / fname
            fig.savefig(path, dpi=150, bbox_inches="tight")
            plt.close(fig)
            print(f"  Sparad: {path}")
        return

    monthly_total = alarm_df.groupby(["Manad_nr", "Manad"])["Aktuell"].sum().reset_index().sort_values("Manad_nr")

    # 1. Larmtrend
    fig, ax = plt.subplots(figsize=(10, 3.5))
    ax.bar(monthly_total["Manad"], monthly_total["Aktuell"], color="#F44336", alpha=0.6, label="Larm")

    # MA(3)
    ma3 = compute_moving_averages(monthly_total, "Aktuell", 3)
    ax.plot(monthly_total["Manad"].values, ma3.values, "b-o", linewidth=2, markersize=4, label="MA(3)")

    # Trendlinje
    points = [(r["Manad_nr"], r["Aktuell"]) for _, r in monthly_total.iterrows()]
    trend = compute_linear_trends({"larm": points})["larm"]
    x_vals = monthly_total["Manad_nr"].values
    trend_y = trend["intercept"] + trend["slope"] * x_vals
    ax.plot(monthly_total["Manad"].values, trend_y, "k--", linewidth=1, label=f"Trend ({trend['trend_class']})")

    # Anomalimarkorer
    alarm_anomalies = [a for a in anomalies if a.get("mal") == "larm_manad"]
    for aa in alarm_anomalies:
        idx = aa.get("index", 0)
        if idx < len(monthly_total):
            ax.annotate("!",
                        (monthly_total["Manad"].values[idx], monthly_total["Aktuell"].values[idx]),
                        fontsize=14, color="red", fontweight="bold", ha="center", va="bottom")

    ax.set_ylabel("Antal larm")
    ax.set_title("Larmtrend med anomalier", fontsize=14, fontweight="bold")
    ax.legend(fontsize=7)
    ax.tick_params(axis="x", rotation=45)
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_larm_trend.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")

    # 2. Nuvarande vs forega ar
    fig, ax = plt.subplots(figsize=(10, 3.5))
    avg_data = alarm_df.dropna(subset=["Forega_snitt"])
    if not avg_data.empty:
        current_monthly = alarm_df.groupby("Manad_nr")["Aktuell"].sum().sort_index()
        prev_monthly = avg_data.groupby("Manad_nr")["Forega_snitt"].sum().sort_index()
        months_list = sorted(set(current_monthly.index) | set(prev_monthly.index))
        month_labels = [MANAD_NAMN.get(m, str(m)) for m in months_list]

        x = np.arange(len(months_list))
        width = 0.35
        ax.bar(x - width/2, [current_monthly.get(m, 0) for m in months_list],
               width, color="#2196F3", label="2025")
        ax.bar(x + width/2, [prev_monthly.get(m, 0) for m in months_list],
               width, color="#9E9E9E", alpha=0.7, label="Forega snitt")
        ax.set_xticks(x)
        ax.set_xticklabels(month_labels, fontsize=7, rotation=45)
        ax.legend(fontsize=8)
    ax.set_ylabel("Antal larm")
    ax.set_title("2025 vs forega ar", fontsize=14, fontweight="bold")
    plt.tight_layout()
    path = OUTPUT_DIR / "trend_larm_jamforelse.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Sparad: {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ensure_output_dir()
    report_files = get_report_files()
    if not report_files:
        print("Inga rapportfiler hittades!")
        return

    print(f"Laser {len(report_files)} rapporter for djupanalys...\n")

    # --- Datainsamling ---
    print("1. Samlar ventildata (Sheet9+11)...")
    valve_df = collect_valve_monthly(report_files)
    print(f"   {len(valve_df)} rader, {valve_df['Ventil_ID'].nunique()} ventiler")

    print("2. Samlar energi- och fraktionsdata (Sheet3+5)...")
    energy_data = collect_energy_detail(report_files)
    print(f"   {len(energy_data)} manader")

    print("3. Samlar maskindata (Sheet7)...")
    machine_df = collect_machine_monthly(report_files)
    print(f"   {len(machine_df)} rader")

    print("4. Samlar larmdata (Sheet13)...")
    alarm_df = collect_alarm_detail(report_files)
    print(f"   {len(alarm_df)} rader")

    # --- Berakningar ---
    print("\n5. Beraknar trender...")
    # Anlaggningstrender
    anlaggning_series = {}
    for col_name, ed_key in [("energi", "Total_kWh"), ("tomningar", "Total_tomningar"),
                              ("kwh_per_tomning", "kWh_per_tomning")]:
        anlaggning_series[col_name] = [(ed["Manad_nr"], ed[ed_key]) for ed in energy_data]

    if not alarm_df.empty:
        monthly_alarms = alarm_df.groupby("Manad_nr")["Aktuell"].sum()
        anlaggning_series["larm"] = [(m, v) for m, v in monthly_alarms.items()]

    anlaggning_trends = compute_linear_trends(anlaggning_series)
    for name, t in anlaggning_trends.items():
        print(f"   {name}: {t['trend_class']} (R2={t['r2']:.3f}, p={t['p_value']:.4f})")

    # Per-ventil trender
    print("6. Beraknar ventiltrender...")
    trends_per_valve = {}
    for vid in valve_df["Ventil_ID"].unique():
        vdata = valve_df[valve_df["Ventil_ID"] == vid].sort_values("Manad_nr")
        points = [(r["Manad_nr"], r["Tillganglighet"]) for _, r in vdata.iterrows()]
        tr = compute_linear_trends({vid: points})
        trends_per_valve[vid] = tr[vid]

    # Grenanalys
    print("7. Beraknar grenanalys...")
    branch_df = compute_branch_analysis(valve_df)
    print(f"   {len(branch_df)} grenar")

    # Korrelationer
    print("8. Beraknar korrelationer...")
    corr_pairs = {}
    if not alarm_df.empty and energy_data:
        e_vals = [ed["Total_kWh"] for ed in energy_data]
        t_vals = [ed["Total_tomningar"] for ed in energy_data]
        monthly_alarms_list = []
        for ed in energy_data:
            m = ed["Manad_nr"]
            a = alarm_df[alarm_df["Manad_nr"] == m]["Aktuell"].sum()
            monthly_alarms_list.append(a)

        corr_pairs["energi_vs_tomningar"] = (e_vals, t_vals)
        corr_pairs["energi_vs_larm"] = (e_vals, monthly_alarms_list)
        corr_pairs["tomningar_vs_larm"] = (t_vals, monthly_alarms_list)

    if not valve_df.empty:
        monthly_avail = valve_df.groupby("Manad_nr")["Tillganglighet"].mean()
        monthly_errors = valve_df.groupby("Manad_nr")["Totala_fel"].sum()
        common_months = sorted(set(monthly_avail.index) & set(monthly_errors.index))
        if len(common_months) >= 3:
            corr_pairs["tillganglighet_vs_fel"] = (
                [monthly_avail[m] for m in common_months],
                [monthly_errors[m] for m in common_months],
            )

    corr_results = compute_correlations(corr_pairs)
    for name, c in corr_results.items():
        print(f"   {name}: {c['tolkning']} (r={c['pearson_r']:.3f})")

    # Anomalier
    print("9. Detekterar anomalier...")
    all_anomalies = []

    # Energi-anomalier
    energy_vals = [ed["Total_kWh"] for ed in energy_data]
    energy_labels = [ed["Manad"] for ed in energy_data]
    for a in detect_anomalies(energy_vals, energy_labels):
        a["mal"] = "energi_manad"
        all_anomalies.append(a)

    # Larm-anomalier
    if not alarm_df.empty:
        monthly_alarms_s = alarm_df.groupby(["Manad_nr", "Manad"])["Aktuell"].sum().reset_index().sort_values("Manad_nr")
        alarm_vals = monthly_alarms_s["Aktuell"].values
        alarm_labels = monthly_alarms_s["Manad"].values
        for a in detect_anomalies(alarm_vals, alarm_labels):
            a["mal"] = "larm_manad"
            all_anomalies.append(a)

    # Ventil-anomalier (arsmedelvardet)
    if not valve_df.empty:
        avg_avail = valve_df.groupby("Ventil_ID")["Tillganglighet"].mean()
        for a in detect_anomalies(avg_avail.values, avg_avail.index.values):
            a["mal"] = "ventil_tillganglighet"
            all_anomalies.append(a)

    print(f"   {len(all_anomalies)} anomalier detekterade")

    # Sasongsmonster
    print("10. Kontrollerar sasongsmonster...")
    season_energy = detect_seasonal_patterns(energy_vals)
    print(f"    Energi: {'Ja' if season_energy['har_sasongsmonster'] else 'Nej'} "
          f"(lag={season_energy.get('starkast_lag', '-')}, r={season_energy.get('korrelation', 0):.3f})")

    # --- Spara output ---
    print("\nSparar CSV:er...")
    anlaggning_df = save_trend_anlaggning(energy_data, alarm_df, anlaggning_trends)
    save_trend_ventiler(valve_df, trends_per_valve)
    save_trend_grenar(branch_df)
    save_correlations(corr_results)
    save_anomalies(all_anomalies)

    print("\nSkapar grafer...")
    create_energy_plots(anlaggning_df, energy_data, corr_results)
    create_valve_plots(valve_df)
    create_branch_plots(branch_df, valve_df)
    create_alarm_plots(alarm_df, all_anomalies)

    # Sammanfattning
    print("\n" + "=" * 60)
    print("TRENDANALYS KLAR")
    print("=" * 60)
    print(f"\nCSV:er: trend_anlaggning, trend_ventiler, trend_grenar, trend_korrelationer, trend_anomalier")
    print(f"Grafer: 12 individuella PNG-filer (energi x4, ventiler x4, grenar x2, larm x2)")
    print(f"\nNyckelresultat:")
    for name, t in anlaggning_trends.items():
        print(f"  {name}: {t['trend_class']} (p={t['p_value']:.4f})")
    if branch_df is not None and not branch_df.empty:
        worst = branch_df.head(3)
        print(f"\n  Samsta grenar (halsopoang):")
        for _, r in worst.iterrows():
            print(f"    Gren {int(r['Gren'])}: {r['halsopoang']:.1f} "
                  f"(tillg={r['medel_tillg']:.1f}%, fel/ventil={r['fel_per_ventil']:.0f})")
    print(f"\n  Anomalier: {len(all_anomalies)} detekterade")
    for a in all_anomalies[:5]:
        print(f"    {a['mal']}: {a['label']} = {a['varde']} (z={a['z_score']:.1f})")
    if len(all_anomalies) > 5:
        print(f"    ... och {len(all_anomalies) - 5} till")


if __name__ == "__main__":
    main()
