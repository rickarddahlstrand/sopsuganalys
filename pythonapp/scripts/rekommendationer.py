#!/usr/bin/env python3
"""Rekommendationsmotor för sopsuganläggningen.

Läser trend-CSV:erna från trendanalys.py och genererar datadriven
rådgivning med regelbaserade tröskelvärden.

Krav: Kör scripts/trendanalys.py först.

Output:
  - output/rekommendationer.json
  - output/rekommendationer.csv
  - output/kpi_mal.csv
  - output/operatorsagenda.txt
"""

import json
from datetime import datetime

import pandas as pd
import numpy as np

from common import OUTPUT_DIR, ensure_output_dir

# ---------------------------------------------------------------------------
# Tröskelvärden (konfigurerbara)
# ---------------------------------------------------------------------------

TILLG_KRITISK = 95.0       # Under detta → akut underhåll
TILLG_VARNING = 98.0       # Under detta → bevakning
FEL_HOG = 50               # Fler årsfel → utredning
GREN_HALSA_KRITISK = 70    # Hälsopoäng under detta → grenåtgärd


# ---------------------------------------------------------------------------
# Laddning
# ---------------------------------------------------------------------------

def load_csv(name):
    path = OUTPUT_DIR / name
    if not path.exists():
        print(f"  Varning: {path} saknas")
        return pd.DataFrame()
    return pd.read_csv(path)


def load_all():
    """Laddar alla trend-CSV:er."""
    return {
        "anlaggning": load_csv("trend_anlaggning.csv"),
        "ventiler": load_csv("trend_ventiler.csv"),
        "grenar": load_csv("trend_grenar.csv"),
        "korrelationer": load_csv("trend_korrelationer.csv"),
        "anomalier": load_csv("trend_anomalier.csv"),
    }


# ---------------------------------------------------------------------------
# Rekommendationsgenerering
# ---------------------------------------------------------------------------

def make_rec(prio, kategori, mal, rekommendation, dataunderlag, forvantad_effekt, atgarder):
    return {
        "prioritet": prio,
        "kategori": kategori,
        "mal": mal,
        "rekommendation": rekommendation,
        "dataunderlag": dataunderlag,
        "forvantad_effekt": forvantad_effekt,
        "atgarder": atgarder,
    }


def generate_maintenance_recs(data):
    """Underhållsrekommendationer baserat på ventildata."""
    recs = []
    ventiler_df = data["ventiler"]
    if ventiler_df.empty:
        return recs

    avg_per_valve = ventiler_df.groupby("Ventil_ID").agg(
        medel_tillg=("Tillganglighet", "mean"),
        totala_fel=("Totala_fel", "sum"),
        trend=("trend_class", "first"),
    ).reset_index()

    # Prio 1: Kritisk tillgänglighet ELLER nedåttrend
    kritiska = avg_per_valve[
        (avg_per_valve["medel_tillg"] < TILLG_KRITISK) |
        ((avg_per_valve["trend"] == "minskande") & (avg_per_valve["medel_tillg"] < TILLG_VARNING))
    ]
    if not kritiska.empty:
        ventil_list = kritiska.sort_values("medel_tillg").head(10)
        details = ", ".join(
            f"{r['Ventil_ID']} ({r['medel_tillg']:.1f}%)"
            for _, r in ventil_list.iterrows()
        )
        recs.append(make_rec(
            1, "Underhåll", "Ventiler med kritisk tillgänglighet",
            f"Akut underhåll krävs för {len(kritiska)} ventiler med tillgänglighet under {TILLG_KRITISK}% "
            f"eller nedåttrend under {TILLG_VARNING}%.",
            f"Sämsta: {details}",
            "Höjd tillgänglighet till >98% för berörda ventiler inom 1 månad",
            [
                "Inspektera mekanisk funktion för varje listad ventil",
                "Kontrollera ventildon och givare",
                "Planera byte av slitdelar vid behov",
                "Installera ökat övervakningsintervall under åtgärdsperioden",
            ],
        ))

    # Prio 2: Varning (95–98%) eller höga felantal
    varning = avg_per_valve[
        ((avg_per_valve["medel_tillg"] >= TILLG_KRITISK) & (avg_per_valve["medel_tillg"] < TILLG_VARNING)) |
        (avg_per_valve["totala_fel"] > FEL_HOG)
    ]
    varning = varning[~varning["Ventil_ID"].isin(kritiska["Ventil_ID"])] if not kritiska.empty else varning
    if not varning.empty:
        recs.append(make_rec(
            2, "Underhåll", "Ventiler under bevakning",
            f"{len(varning)} ventiler med tillgänglighet {TILLG_KRITISK}–{TILLG_VARNING}% "
            f"eller mer än {FEL_HOG} årsfel kräver förstärkta kontroller.",
            f"Antal: {len(varning)} ventiler",
            "Förhindra att dessa ventiler går över till kritisk status",
            [
                "Lägg till i förstärkt underhållsschema (månatlig kontroll)",
                "Analysera felkodsmönster för att identifiera rotorsak",
                "Övervakning: om tillgänglighet sjunker 2 procentenheter → eskalera",
            ],
        ))

    # Prio 3: Bräckliga perfekta (100% tillg men högt felantal)
    brackliga = avg_per_valve[
        (avg_per_valve["medel_tillg"] >= 99.9) & (avg_per_valve["totala_fel"] > 20)
    ]
    if not brackliga.empty:
        recs.append(make_rec(
            3, "Underhåll", "Bräckliga ventiler (hög tillgänglighet men många fel)",
            f"{len(brackliga)} ventiler har 100% tillgänglighet men över 20 årsfel. "
            f"Dessa kan snabbt gå från perfekt till kritisk.",
            f"Antal: {len(brackliga)} ventiler med dold riskprofil",
            "Proaktiv identifiering av potentiella framtida problem",
            [
                "Granska felloggar för att förstå felmönster",
                "Övervakning: om fel ökar >50% nästa månad → eskalera",
                "Planera förebyggande underhåll under låginblandningstider",
            ],
        ))

    return recs


def generate_energy_recs(data):
    """Energirekommendationer baserat på energitrender."""
    recs = []
    anl_df = data["anlaggning"]
    if anl_df.empty:
        return recs

    kwh_cols = [c for c in anl_df.columns if "kWh_per_tomning_trend_class" in c]
    if kwh_cols and anl_df[kwh_cols[0]].iloc[0] == "okande":
        recs.append(make_rec(
            2, "Energi", "Ökande kWh per tömning",
            "Energieffektiviteten försämras — kWh per tömning ökar över året.",
            f"kWh/tömning: {anl_df['kWh_per_tomning'].iloc[0]:.2f} (jan) → "
            f"{anl_df['kWh_per_tomning'].iloc[-1]:.2f} (dec)",
            "Stabilisera eller minska kWh per tömning",
            [
                "Utred orsak till ökad energiförbrukning per tömning",
                "Kontrollera vakuumsystemets täthet",
                "Övervakning: installera månatlig kWh/tömning-KPI",
            ],
        ))

    if len(anl_df) >= 3:
        best_kwh = anl_df["kWh_per_tomning"].min()
        worst_kwh = anl_df["kWh_per_tomning"].max()
        if best_kwh > 0 and worst_kwh > best_kwh * 1.2:
            saving_pct = ((worst_kwh - best_kwh) / worst_kwh) * 100
            recs.append(make_rec(
                3, "Energi", "Energibesparingspotential",
                f"Spridning på {saving_pct:.0f}% mellan bästa och sämsta månads kWh/tömning "
                f"indikerar optimeringspotential.",
                f"Bästa: {best_kwh:.2f}, sämsta: {worst_kwh:.2f} kWh/tömning",
                f"Minska energiförbrukningen med upp till {saving_pct:.0f}% genom konsekvent optimering",
                [
                    "Identifiera vad som skiljer effektiva månader från ineffektiva",
                    "Undersökning: drifttid, temperatur, fyllnadsgrad som påverkande faktorer",
                    "Mål: alla månader inom 10% av bästa månads effektivitet",
                ],
            ))

    energy_trend_cols = [c for c in anl_df.columns if c == "Energi_kWh_trend_class"]
    if energy_trend_cols and anl_df[energy_trend_cols[0]].iloc[0] == "minskande":
        recs.append(make_rec(
            4, "Energi", "Positiv energitrend",
            "Energiförbrukningen visar en minskande trend under året — positivt.",
            f"Jan: {anl_df['Energi_kWh'].iloc[0]:,.0f} kWh → Dec: {anl_df['Energi_kWh'].iloc[-1]:,.0f} kWh",
            "Bibehåll eller förstärk den positiva trenden",
            [
                "Dokumentera åtgärder som bidragit till minskningen",
                "Använd som benchmark för nästa år",
            ],
        ))

    return recs


def generate_alarm_recs(data):
    """Larmrekommendationer baserat på anomalier och trender."""
    recs = []
    anomalier_df = data["anomalier"]
    anl_df = data["anlaggning"]

    if not anomalier_df.empty:
        larm_anomalier = anomalier_df[anomalier_df["mal"] == "larm_manad"]
        if not larm_anomalier.empty:
            for _, a in larm_anomalier.iterrows():
                if a["typ"] == "hog":
                    recs.append(make_rec(
                        1, "Larm", f"Larmanomali: {a['label']}",
                        f"Månaden {a['label']} hade anomalt höga larm "
                        f"({a['varde']:.0f}, z-score {a['z_score']:.1f}).",
                        f"Värde: {a['varde']:.0f}, z-score: {a['z_score']:.1f}",
                        "Identifiera och eliminera orsaken till larmspiken",
                        [
                            "Utred specifika larmkategorier för den aktuella månaden",
                            "Kontrollera om systemfel, uppgradering eller extern händelse förklarar spiken",
                            "Installera larmtrösklar för tidig varning vid liknande spikar",
                        ],
                    ))

    if not anl_df.empty:
        larm_trend_cols = [c for c in anl_df.columns if c == "Larm_totalt_trend_class"]
        if larm_trend_cols:
            tc = anl_df[larm_trend_cols[0]].iloc[0]
            if tc == "okande":
                recs.append(make_rec(
                    2, "Larm", "Ökande larmtrend",
                    "Larmen visar en ökande trend. Utred orsak för att undvika eskalering.",
                    f"Trend: {tc}",
                    "Minska larmfrekvensen till föregående års nivå",
                    [
                        "Identifiera mest frekventa larmkategorier",
                        "Åtgärdsprogram per kategori",
                        "Mål: återvänd till föregående års snittnivå inom 6 månader",
                    ],
                ))

    return recs


def generate_branch_recs(data):
    """Grenrekommendationer baserat på grenanalys."""
    recs = []
    grenar_df = data["grenar"]
    if grenar_df.empty:
        return recs

    kritiska_grenar = grenar_df[grenar_df["halsopoang"] < GREN_HALSA_KRITISK]
    if not kritiska_grenar.empty:
        gren_details = ", ".join(
            f"Gren {int(r['Gren'])} ({r['halsopoang']:.0f}p)"
            for _, r in kritiska_grenar.iterrows()
        )
        recs.append(make_rec(
            1, "Infrastruktur", "Grenar med kritisk hälsopoäng",
            f"{len(kritiska_grenar)} grenar har hälsopoäng under {GREN_HALSA_KRITISK}.",
            gren_details,
            "Höja hälsopoäng för alla grenar över 70 inom 6 månader",
            [
                "Genomför grenspecifik inspektion (rör, ventiler, anslutningar)",
                "Prioritera ventilbyte/underhåll inom dessa grenar",
                "Utvärdera om redesign behövs för grenar med systematiskt låga poäng",
            ],
        ))

    basta = grenar_df.nlargest(3, "halsopoang")
    if not basta.empty and not grenar_df.empty:
        benchmark_tillg = basta["medel_tillg"].mean()
        recs.append(make_rec(
            4, "Infrastruktur", "Modellgrenar som benchmark",
            f"De 3 bästa grenarna har medeltillgänglighet {benchmark_tillg:.1f}%. "
            f"Använd som målstandard för övriga.",
            "Topp-3: " + ", ".join(f"Gren {int(r['Gren'])}" for _, r in basta.iterrows()),
            "Sprid framgångsrika metoder till svagare grenar",
            [
                "Dokumentera underhållsrutiner för modellgrenar",
                "Jämför konfiguration, ålder och underhållshistorik",
            ],
        ))

    return recs


def generate_strategic_goals(data):
    """Genererar strategiska KPI-mål med milstolpar."""
    goals = []
    ventiler_df = data["ventiler"]
    grenar_df = data["grenar"]
    anl_df = data["anlaggning"]

    if not ventiler_df.empty:
        current_avg = ventiler_df.groupby("Ventil_ID")["Tillganglighet"].mean().mean()
        goals.append({
            "KPI": "Medeltillgänglighet",
            "Nuvarande": f"{current_avg:.1f}%",
            "Mal_3m": f"{min(current_avg + 0.3, 100):.1f}%",
            "Mal_6m": f"{min(current_avg + 0.5, 100):.1f}%",
            "Mal_12m": f"{min(current_avg + 1.0, 100):.1f}%",
            "Strategi": "Fokusera på sämsta ventilerna först — större marginaleffekt",
        })

        avg_per = ventiler_df.groupby("Ventil_ID")["Tillganglighet"].mean()
        pct_over98 = (avg_per >= 98).mean() * 100
        goals.append({
            "KPI": "Andel ventiler över 98%",
            "Nuvarande": f"{pct_over98:.0f}%",
            "Mal_3m": f"{min(pct_over98 + 2, 100):.0f}%",
            "Mal_6m": f"{min(pct_over98 + 5, 100):.0f}%",
            "Mal_12m": f"{min(pct_over98 + 10, 100):.0f}%",
            "Strategi": "Lyft ventiler från 95–98% till över 98%",
        })

    if not ventiler_df.empty:
        total_errors = ventiler_df["Totala_fel"].sum()
        goals.append({
            "KPI": "Totala ventilfel/år",
            "Nuvarande": f"{total_errors:,}",
            "Mal_3m": f"-10%",
            "Mal_6m": f"-25%",
            "Mal_12m": f"-40%",
            "Strategi": "LONG_TIME_SINCE_LAST_COLLECTION är dominerande — optimera tömningsintervall",
        })

    if not anl_df.empty and "kWh_per_tomning" in anl_df.columns:
        current_kwh = anl_df["kWh_per_tomning"].mean()
        best_kwh = anl_df["kWh_per_tomning"].min()
        goals.append({
            "KPI": "kWh per tömning (årsmedel)",
            "Nuvarande": f"{current_kwh:.2f}",
            "Mal_3m": f"{current_kwh * 0.95:.2f}",
            "Mal_6m": f"{current_kwh * 0.90:.2f}",
            "Mal_12m": f"{best_kwh:.2f} (bästa månadens nivå)",
            "Strategi": "Identifiera och replikera förhållanden från bästa månaden",
        })

    if not grenar_df.empty:
        perfect_branches = len(grenar_df[grenar_df["medel_tillg"] >= 99.5])
        total_branches = len(grenar_df)
        goals.append({
            "KPI": "Grenar med >99.5% tillgänglighet",
            "Nuvarande": f"{perfect_branches}/{total_branches}",
            "Mal_3m": f"{min(perfect_branches + 2, total_branches)}/{total_branches}",
            "Mal_6m": f"{min(perfect_branches + 5, total_branches)}/{total_branches}",
            "Mal_12m": f"{min(perfect_branches + 8, total_branches)}/{total_branches}",
            "Strategi": "Rikta insatser mot grenar som är nära 99.5%-gränsen",
        })

    return goals


def generate_operator_agenda(recs, goals, data):
    """Genererar formaterad mötesagenda."""
    lines = []
    lines.append("=" * 70)
    lines.append("  DRIFTSMÖTE — SOPSUGANLÄGGNINGEN")
    lines.append(f"  Genererad: {datetime.now().strftime('%Y-%m-%d')}")
    lines.append("=" * 70)

    lines.append("\n1. ANLÄGGNINGSSTATUS\n")
    anl_df = data["anlaggning"]
    if not anl_df.empty:
        total_kwh = anl_df["Energi_kWh"].sum()
        total_tom = anl_df["Tomningar"].sum() if "Tomningar" in anl_df.columns else 0
        lines.append(f"   Total energi (2025):   {total_kwh:,.0f} kWh")
        lines.append(f"   Totala tömningar:       {total_tom:,.0f}")
        if "kWh_per_tomning" in anl_df.columns:
            avg_kwh_t = anl_df["kWh_per_tomning"].mean()
            lines.append(f"   Medel kWh/tömning:     {avg_kwh_t:.2f}")

    ventiler_df = data["ventiler"]
    if not ventiler_df.empty:
        avg_tillg = ventiler_df.groupby("Ventil_ID")["Tillganglighet"].mean().mean()
        total_fel = ventiler_df["Totala_fel"].sum()
        lines.append(f"   Medeltillgänglighet:   {avg_tillg:.1f}%")
        lines.append(f"   Totala ventilfel:      {total_fel:,}")

    lines.append("\n2. AKUTA ÅTGÄRDER (Prio 1)\n")
    prio1 = [r for r in recs if r["prioritet"] == 1]
    if prio1:
        for i, r in enumerate(prio1, 1):
            lines.append(f"   {i}. {r['rekommendation']}")
            lines.append(f"      Dataunderlag: {r['dataunderlag']}")
            for a in r["atgarder"]:
                lines.append(f"      - {a}")
            lines.append("")
    else:
        lines.append("   Inga akuta åtgärder just nu.\n")

    lines.append("3. PLANERADE FÖRBÄTTRINGAR (Prio 2–3)\n")
    prio23 = [r for r in recs if r["prioritet"] in (2, 3)]
    for i, r in enumerate(prio23, 1):
        lines.append(f"   {i}. [{r['kategori']}] {r['mal']}")
        lines.append(f"      {r['rekommendation']}")
        for a in r["atgarder"]:
            lines.append(f"      - {a}")
        lines.append("")

    lines.append("4. STRATEGISKA MÅL\n")
    for g in goals:
        lines.append(f"   {g['KPI']}:")
        lines.append(f"     Nu: {g['Nuvarande']}  →  3m: {g['Mal_3m']}  →  6m: {g['Mal_6m']}  →  12m: {g['Mal_12m']}")
        lines.append(f"     Strategi: {g['Strategi']}")
        lines.append("")

    lines.append("5. DISKUSSIONSPUNKTER\n")
    anomalier_df = data["anomalier"]
    if not anomalier_df.empty:
        larm_anom = anomalier_df[anomalier_df["mal"] == "larm_manad"]
        if not larm_anom.empty:
            lines.append("   - Larmspikar: Vad orsakade de anomala perioderna?")
    lines.append("   - Prioritering: Är resursallokering korrekt för kommande kvartal?")
    lines.append("   - Tömningsintervall: Kan LONG_TIME_SINCE_LAST_COLLECTION minskas?")
    lines.append("   - Energi: Vilka faktorer driver kWh/tömning-variationen?")

    lines.append("\n" + "=" * 70)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ensure_output_dir()

    print("Laddar trenddata...")
    data = load_all()

    missing = [k for k, v in data.items() if v.empty]
    if missing:
        print(f"  OBS: Saknar data för: {', '.join(missing)}")
        if all(v.empty for v in data.values()):
            print("  Inga data alls — kör trendanalys.py först!")
            return

    print("\nGenererar rekommendationer...")

    all_recs = []
    all_recs.extend(generate_maintenance_recs(data))
    print(f"  Underhåll: {sum(1 for r in all_recs if r['kategori'] == 'Underhåll')} rekommendationer")

    all_recs.extend(generate_energy_recs(data))
    print(f"  Energi: {sum(1 for r in all_recs if r['kategori'] == 'Energi')} rekommendationer")

    all_recs.extend(generate_alarm_recs(data))
    print(f"  Larm: {sum(1 for r in all_recs if r['kategori'] == 'Larm')} rekommendationer")

    all_recs.extend(generate_branch_recs(data))
    print(f"  Infrastruktur: {sum(1 for r in all_recs if r['kategori'] == 'Infrastruktur')} rekommendationer")

    all_recs.sort(key=lambda r: r["prioritet"])

    print("\nGenererar strategiska mål...")
    goals = generate_strategic_goals(data)
    print(f"  {len(goals)} KPI:er definierade")

    print("Genererar operatörsagenda...")
    agenda = generate_operator_agenda(all_recs, goals, data)

    print("\nSparar output...")

    json_path = OUTPUT_DIR / "rekommendationer.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"rekommendationer": all_recs, "kpi_mal": goals}, f,
                  ensure_ascii=False, indent=2)
    print(f"  {json_path}")

    csv_path = OUTPUT_DIR / "rekommendationer.csv"
    rec_df = pd.DataFrame([
        {
            "Prioritet": r["prioritet"],
            "Kategori": r["kategori"],
            "Mål": r["mal"],
            "Rekommendation": r["rekommendation"],
            "Förväntad_effekt": r["forvantad_effekt"],
        }
        for r in all_recs
    ])
    rec_df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"  {csv_path}")

    kpi_path = OUTPUT_DIR / "kpi_mal.csv"
    kpi_df = pd.DataFrame(goals)
    kpi_df.to_csv(kpi_path, index=False, encoding="utf-8-sig")
    print(f"  {kpi_path}")

    agenda_path = OUTPUT_DIR / "operatorsagenda.txt"
    with open(agenda_path, "w", encoding="utf-8") as f:
        f.write(agenda)
    print(f"  {agenda_path}")

    print("\n" + "=" * 60)
    print("REKOMMENDATIONER KLARA")
    print("=" * 60)
    print(f"\n  Totalt: {len(all_recs)} rekommendationer")
    for prio in sorted(set(r["prioritet"] for r in all_recs)):
        n = sum(1 for r in all_recs if r["prioritet"] == prio)
        print(f"    Prio {prio}: {n}")

    print(f"\n  Topp-prioriteringar:")
    for r in all_recs[:3]:
        print(f"    [{r['prioritet']}] {r['mal']}")

    print(f"\n  KPI-mål:")
    for g in goals:
        print(f"    {g['KPI']}: {g['Nuvarande']} → {g['Mal_12m']} (12 mån)")


if __name__ == "__main__":
    main()
