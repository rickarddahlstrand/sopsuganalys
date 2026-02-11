#!/usr/bin/env python3
"""Drifterfarenheter — detaljanalys av felmönster och driftkvalitet.

Korsrefererar manuella körningar med felkoder, analyserar
energieffektivitet och identifierar ventiler med dold risk.

Krav: Kör trendanalys.py och manuell_analys.py först.

Output:
  - output/drifterfarenheter.json
  - output/drifterfarenheter.csv
"""

import json

import pandas as pd
import numpy as np
from scipy.stats import pearsonr

from common import OUTPUT_DIR, ensure_output_dir


# ---------------------------------------------------------------------------
# Datainläsning
# ---------------------------------------------------------------------------

def load_data():
    """Laddar alla CSV:er som behövs för korsanalys."""
    data = {}
    for name in ["trend_anlaggning", "trend_ventiler", "trend_grenar", "trend_anomalier"]:
        path = OUTPUT_DIR / f"{name}.csv"
        if path.exists():
            data[name.replace("trend_", "")] = pd.read_csv(path)
        else:
            data[name.replace("trend_", "")] = pd.DataFrame()

    for name in ["manuell_analys", "manuell_ventiler"]:
        path = OUTPUT_DIR / f"{name}.csv"
        if path.exists():
            data[name] = pd.read_csv(path)
        else:
            data[name] = pd.DataFrame()

    return data


# ---------------------------------------------------------------------------
# Analys 1: Feltyper som driver manuella ingrepp
# ---------------------------------------------------------------------------

def analyze_manual_vs_errors(data):
    """Korsrefererar manuella körningar med felkoder per ventil."""
    tv = data.get("ventiler", pd.DataFrame())
    mv = data.get("manuell_ventiler", pd.DataFrame())
    if tv.empty or mv.empty:
        return {}

    fel_cols = [c for c in tv.columns if c.startswith("Fel_")]

    # Aggregera feltyper per ventil
    agg = {c: (c, "sum") for c in fel_cols}
    agg["tot_fel"] = ("Totala_fel", "sum")
    fel_per_ventil = tv.groupby("Ventil_ID").agg(**agg).reset_index()

    merged = mv.merge(fel_per_ventil, on="Ventil_ID", how="left")

    # Korrelation: manuella kommandon vs varje feltyp
    korrelationer = {}
    for c in fel_cols:
        if merged[c].sum() > 0 and merged["MAN_totalt"].sum() > 0:
            r, p = pearsonr(merged["MAN_totalt"], merged[c])
            korrelationer[c.replace("Fel_", "")] = {
                "pearson_r": round(r, 3),
                "p_varde": round(p, 4),
                "totalt_antal": int(merged[c].sum()),
            }

    # Rangordna: vilka feltyper driver manuella ingrepp?
    sorted_corr = sorted(korrelationer.items(), key=lambda x: abs(x[1]["pearson_r"]), reverse=True)

    # Riskventiler: hög manuell andel + 100% tillgänglighet (dold risk)
    active = merged[merged["Total_CMD"] > 10]
    risk = active[
        (active["Manuell_andel_%"] > 5) & (active["Medel_tillg"] >= 99.9)
    ].sort_values("Manuell_andel_%", ascending=False)

    risk_ventiler = []
    for _, r in risk.head(10).iterrows():
        dominant_error = ""
        max_err = 0
        for c in fel_cols:
            if r[c] > max_err:
                max_err = r[c]
                dominant_error = c.replace("Fel_", "")

        risk_ventiler.append({
            "ventil": r["Ventil_ID"],
            "gren": int(r["Gren"]),
            "manuell_andel": round(r["Manuell_andel_%"], 1),
            "tillganglighet": round(r["Medel_tillg"], 1),
            "totala_fel": int(r["tot_fel"]),
            "dominerande_fel": dominant_error,
            "dominerande_fel_antal": int(max_err),
        })

    return {
        "korrelationer": dict(sorted_corr),
        "risk_ventiler": risk_ventiler,
        "drivande_feltyp": sorted_corr[0][0] if sorted_corr else None,
        "drivande_korrelation": sorted_corr[0][1]["pearson_r"] if sorted_corr else 0,
    }


# ---------------------------------------------------------------------------
# Analys 2: Energieffektivitet och anomalier
# ---------------------------------------------------------------------------

def analyze_energy_efficiency(data):
    """Analyserar kWh/tömning-mönster och identifierar avvikelser."""
    anl = data.get("anlaggning", pd.DataFrame())
    if anl.empty or "kWh_per_tomning" not in anl.columns:
        return {}

    kwh_t = anl["kWh_per_tomning"]
    energi = anl["Energi_kWh"]
    drifttid = anl["Drifttid_h"]

    best_month = anl.loc[kwh_t.idxmin()]
    worst_month = anl.loc[kwh_t.idxmax()]
    spread = ((kwh_t.max() - kwh_t.min()) / kwh_t.mean()) * 100

    # Korrelation energi vs drifttid
    r_drift, p_drift = pearsonr(energi, drifttid) if len(energi) > 2 else (0, 1)

    # Halvårsanalys
    h1 = kwh_t.iloc[:6].mean()
    h2 = kwh_t.iloc[6:].mean()
    h_change = ((h2 - h1) / h1) * 100 if h1 > 0 else 0

    return {
        "kwh_per_tomning_medel": round(kwh_t.mean(), 2),
        "kwh_per_tomning_min": round(kwh_t.min(), 2),
        "kwh_per_tomning_max": round(kwh_t.max(), 2),
        "basta_manad": best_month["Manad"],
        "samsta_manad": worst_month["Manad"],
        "spridning_pct": round(spread, 1),
        "halvars_forandring_pct": round(h_change, 1),
        "korrelation_energi_drifttid": {
            "r": round(r_drift, 3),
            "p": round(p_drift, 4),
        },
        "total_kwh": round(energi.sum(), 0),
        "total_tomningar": int(anl["Tomningar"].sum()),
    }


# ---------------------------------------------------------------------------
# Analys 3: Manuell andel — trend och mönster
# ---------------------------------------------------------------------------

def analyze_manual_trend(data):
    """Analyserar manuell andel över tid och per gren."""
    man = data.get("manuell_analys", pd.DataFrame())
    mv = data.get("manuell_ventiler", pd.DataFrame())
    if man.empty:
        return {}

    total_man = int(man["MAN_totalt"].sum())
    total_cmd = int(man["Total_CMD"].sum())
    andel = total_man / total_cmd * 100 if total_cmd > 0 else 0

    # Trend: jämför H1 vs H2
    h1 = man.iloc[:6]["Manuell_andel_%"].mean()
    h2 = man.iloc[6:]["Manuell_andel_%"].mean()

    # Toppmanad
    worst = man.loc[man["Manuell_andel_%"].idxmax()]

    result = {
        "total_manuella": total_man,
        "total_kommandon": total_cmd,
        "arsandel_pct": round(andel, 2),
        "h1_andel_pct": round(h1, 2),
        "h2_andel_pct": round(h2, 2),
        "samsta_manad": worst["Manad"],
        "samsta_manad_andel": round(worst["Manuell_andel_%"], 1),
    }

    # Per-gren: vilka grenar har mest manuella körningar?
    if not mv.empty:
        gren_agg = mv.groupby("Gren").agg(
            man_totalt=("MAN_totalt", "sum"),
            cmd_totalt=("Total_CMD", "sum"),
            antal_ventiler=("Ventil_ID", "count"),
        ).reset_index()
        gren_agg["man_andel"] = gren_agg["man_totalt"] / gren_agg["cmd_totalt"] * 100
        gren_agg = gren_agg.sort_values("man_andel", ascending=False)

        top_grenar = []
        for _, r in gren_agg.head(5).iterrows():
            top_grenar.append({
                "gren": int(r["Gren"]),
                "manuell_andel": round(r["man_andel"], 1),
                "manuella": int(r["man_totalt"]),
                "ventiler": int(r["antal_ventiler"]),
            })
        result["grenar_med_hogst_manuell"] = top_grenar

    return result


# ---------------------------------------------------------------------------
# Analys 4: Larm och felmönster
# ---------------------------------------------------------------------------

def analyze_alarm_patterns(data):
    """Analyserar larmmönster och identifierar systematiska problem."""
    anl = data.get("anlaggning", pd.DataFrame())
    tv = data.get("ventiler", pd.DataFrame())
    anomalier = data.get("anomalier", pd.DataFrame())
    if anl.empty:
        return {}

    larm = anl["Larm_totalt"] if "Larm_totalt" in anl.columns else pd.Series()
    if larm.empty:
        return {}

    total = int(larm.sum())
    medel = larm.mean()
    median = larm.median()

    # Jan-spik-analys
    jan_larm = larm.iloc[0]
    resten_medel = larm.iloc[1:].mean()
    jan_faktor = jan_larm / resten_medel if resten_medel > 0 else 0

    # Stabil period (exkl jan)
    stabil = larm.iloc[1:]
    stabil_cv = (stabil.std() / stabil.mean() * 100) if stabil.mean() > 0 else 0

    result = {
        "totala_larm": total,
        "medel_per_manad": round(medel, 0),
        "median_per_manad": round(median, 0),
        "januari_larm": int(jan_larm),
        "januari_faktor_vs_resten": round(jan_faktor, 1),
        "feb_dec_medel": round(resten_medel, 0),
        "feb_dec_variationskoefficient": round(stabil_cv, 1),
    }

    # Anomalier
    if not anomalier.empty:
        larm_anom = anomalier[anomalier["mal"] == "larm_manad"]
        result["antal_anomalier"] = len(larm_anom)

    # Feltypsfördelning
    if not tv.empty:
        fel_cols = [c for c in tv.columns if c.startswith("Fel_")]
        fel_totals = {}
        total_fel = 0
        for c in fel_cols:
            s = int(tv[c].sum())
            fel_totals[c.replace("Fel_", "")] = s
            total_fel += s

        # Andel per feltyp
        fel_med_andel = {}
        for k, v in sorted(fel_totals.items(), key=lambda x: -x[1]):
            fel_med_andel[k] = {
                "antal": v,
                "andel_pct": round(v / total_fel * 100, 1) if total_fel > 0 else 0,
            }
        result["felfordelning"] = fel_med_andel
        result["totala_ventilfel"] = total_fel

        # Ventiler med mekaniska fel (DOES_NOT_OPEN + DOES_NOT_CLOSE)
        mek_cols = [c for c in fel_cols if "OPEN" in c or "CLOSE" in c]
        if mek_cols:
            mek_per_v = tv.groupby("Ventil_ID")[mek_cols].sum().sum(axis=1)
            mek_ventiler = (mek_per_v > 0).sum()
            result["ventiler_med_mekaniska_fel"] = int(mek_ventiler)

    return result


# ---------------------------------------------------------------------------
# Samlad bedömning
# ---------------------------------------------------------------------------

def create_summary(manual_errors, energy, manual_trend, alarms):
    """Sammanfattar huvudfynd."""
    findings = []

    # Manuell vs fel-insikt
    if manual_errors.get("drivande_feltyp"):
        ft = manual_errors["drivande_feltyp"]
        r = manual_errors["drivande_korrelation"]
        findings.append({
            "omrade": "Manuella körningar",
            "fynd": (f"Manuella ingrepp drivs främst av {ft}-fel (r={r:.2f}). "
                     f"Åtgärda dessa feltyper för att minska behovet av manuella körningar."),
            "prioritet": 1 if r > 0.5 else 2,
        })

    if manual_errors.get("risk_ventiler"):
        n = len(manual_errors["risk_ventiler"])
        findings.append({
            "omrade": "Dold risk",
            "fynd": (f"{n} ventiler har hög manuell andel trots 100% tillgänglighet. "
                     "Operatörer kompenserar för automatikproblem — dessa ventiler "
                     "riskerar plötsligt bortfall om operatören missar ingripandet."),
            "prioritet": 1,
        })

    # Energi-insikt
    if energy.get("spridning_pct", 0) > 30:
        findings.append({
            "omrade": "Energieffektivitet",
            "fynd": (f"kWh/tömning varierar {energy['spridning_pct']:.0f}% mellan "
                     f"bästa ({energy['basta_manad']}: {energy['kwh_per_tomning_min']:.1f}) "
                     f"och sämsta ({energy['samsta_manad']}: {energy['kwh_per_tomning_max']:.1f}) månad. "
                     f"H2 var {abs(energy['halvars_forandring_pct']):.0f}% "
                     f"{'bättre' if energy['halvars_forandring_pct'] < 0 else 'sämre'} än H1."),
            "prioritet": 2,
        })

    # Larm-insikt
    if alarms.get("januari_faktor_vs_resten", 0) > 5:
        findings.append({
            "omrade": "Larmanalys",
            "fynd": (f"Januari hade {alarms['januari_faktor_vs_resten']:.0f}x fler larm "
                     f"({alarms['januari_larm']:,}) jämfört med övriga månaders snitt "
                     f"({alarms['feb_dec_medel']:.0f}). Exklusive januari är larmfrekvensen "
                     f"stabil (CV {alarms['feb_dec_variationskoefficient']:.0f}%)."),
            "prioritet": 1,
        })

    if alarms.get("felfordelning"):
        dominant = list(alarms["felfordelning"].items())[0]
        name, info = dominant
        findings.append({
            "omrade": "Felfördelning",
            "fynd": (f"{name} dominerar med {info['andel_pct']:.0f}% av alla ventilfel "
                     f"({info['antal']:,} st). Dessa indikerar att tömningsintervallen "
                     "kan optimeras."),
            "prioritet": 2,
        })

    findings.sort(key=lambda x: x["prioritet"])
    return findings


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ensure_output_dir()

    print("Laddar data för drifterfarenhetsanalys...")
    data = load_data()

    print("Analyserar felmönster vs manuella ingrepp...")
    manual_errors = analyze_manual_vs_errors(data)
    if manual_errors.get("korrelationer"):
        for name, info in manual_errors["korrelationer"].items():
            print(f"  {name}: r={info['pearson_r']:.3f}, totalt {info['totalt_antal']}")

    print("Analyserar energieffektivitet...")
    energy = analyze_energy_efficiency(data)
    if energy:
        print(f"  kWh/tömning: {energy['kwh_per_tomning_min']:.1f}–{energy['kwh_per_tomning_max']:.1f} "
              f"(spridning {energy['spridning_pct']:.0f}%)")

    print("Analyserar manuell driftandel...")
    manual_trend = analyze_manual_trend(data)
    if manual_trend:
        print(f"  Årsandel: {manual_trend['arsandel_pct']:.1f}%, "
              f"H1: {manual_trend['h1_andel_pct']:.1f}%, H2: {manual_trend['h2_andel_pct']:.1f}%")

    print("Analyserar larmmönster...")
    alarms = analyze_alarm_patterns(data)
    if alarms:
        print(f"  Totalt: {alarms['totala_larm']:,} larm, "
              f"jan-faktor: {alarms.get('januari_faktor_vs_resten', 0):.0f}x")

    print("Sammanställer fynd...")
    findings = create_summary(manual_errors, energy, manual_trend, alarms)
    print(f"  {len(findings)} huvudfynd identifierade")

    output = {
        "manual_vs_felkoder": manual_errors,
        "energieffektivitet": energy,
        "manuell_trend": manual_trend,
        "larmmonster": alarms,
        "huvudfynd": findings,
    }

    json_path = OUTPUT_DIR / "drifterfarenheter.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n  Sparad: {json_path}")

    # CSV med riskventiler
    if manual_errors.get("risk_ventiler"):
        risk_df = pd.DataFrame(manual_errors["risk_ventiler"])
        csv_path = OUTPUT_DIR / "drifterfarenheter.csv"
        risk_df.to_csv(csv_path, index=False, encoding="utf-8-sig")
        print(f"  Sparad: {csv_path}")

    print("\n" + "=" * 60)
    print("DRIFTERFARENHETSANALYS KLAR")
    print("=" * 60)


if __name__ == "__main__":
    main()
