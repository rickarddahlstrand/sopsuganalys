"""Delade fixtures med syntetisk testdata for sopsugsanalys-tester.

Genererar realistisk exempeldata som efterliknar strukturen fran de riktiga
.xls-rapporterna, utan att anvanda nagra verkliga driftrapporter.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Lagg till scripts/ i path sa att imports fungerar
SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))


@pytest.fixture
def output_dir(tmp_path):
    """Temporar output-katalog."""
    d = tmp_path / "output"
    d.mkdir()
    return d


@pytest.fixture
def manad_namn():
    """Standardmappe manad_nr -> namn."""
    return {
        1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr",
        5: "Maj", 6: "Jun", 7: "Jul", 8: "Aug",
        9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec",
    }


# ---------------------------------------------------------------------------
# Ventildata (Sheet9/11-liknande)
# ---------------------------------------------------------------------------

@pytest.fixture
def valve_monthly_df():
    """Per-ventil per-manad data (liknande output fran trendanalys.collect_valve_monthly)."""
    np.random.seed(42)
    rows = []
    ventiler = [f"{g}:{v}" for g in [1, 2, 3, 4, 5] for v in range(1, 6)]
    for month in range(1, 13):
        manad = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Maj", 6: "Jun",
                 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec"}[month]
        for vid in ventiler:
            gren, ventilnr = int(vid.split(":")[0]), int(vid.split(":")[1])
            # Tillganglighet: de flesta nara 100%, nagra lagre
            if vid == "3:2":
                tillg = np.random.uniform(88, 95)
            elif vid == "5:4":
                tillg = np.random.uniform(92, 97)
            else:
                tillg = np.random.uniform(99, 100)

            totala_fel = np.random.poisson(5 if vid in ["3:2", "5:4"] else 1)
            kommandon = np.random.randint(50, 200)
            rows.append({
                "Manad_nr": month,
                "Manad": manad,
                "Ventil_ID": vid,
                "Gren": gren,
                "Ventilnr": ventilnr,
                "Tillganglighet": round(tillg, 2),
                "Totala_fel": totala_fel,
                "Kommandon": kommandon,
                "Fel_DOES_NOT_OPEN": np.random.poisson(0.3),
                "Fel_DOES_NOT_CLOSE": np.random.poisson(0.2),
                "Fel_LEVEL_ERROR": np.random.poisson(0.5),
                "Fel_LONG_TIME_SINCE_LAST_COLLECTION": np.random.poisson(2),
                "Fel_ERROR_FEEDBACK_FROM_USER": 0,
            })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Energi & driftdata (Sheet3/5/7-liknande)
# ---------------------------------------------------------------------------

@pytest.fixture
def energy_df():
    """Manatlig energi- och driftdata."""
    np.random.seed(42)
    rows = []
    for month in range(1, 13):
        manad = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Maj", 6: "Jun",
                 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec"}[month]
        # Energi minskar over aret (realistisk trend)
        base_energy = 90000 - month * 2000 + np.random.normal(0, 3000)
        rows.append({
            "Månad_nr": month,
            "Månad": manad,
            "Energi_kWh": round(max(base_energy, 50000), 1),
            "Drifttid_h": round(np.random.uniform(400, 600), 1),
        })
    return pd.DataFrame(rows)


@pytest.fixture
def fraction_df():
    """Tomningar per fraktion per manad."""
    np.random.seed(42)
    rows = []
    fraktioner = ["Rest", "Plast", "Organiskt", "Blandat"]
    for month in range(1, 13):
        manad = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Maj", 6: "Jun",
                 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec"}[month]
        for frac in fraktioner:
            base = {"Rest": 2000, "Plast": 500, "Organiskt": 800, "Blandat": 300}[frac]
            rows.append({
                "Månad_nr": month,
                "Månad": manad,
                "Fraktion": frac,
                "Tömningar": int(base + np.random.normal(0, base * 0.1)),
            })
    return pd.DataFrame(rows)


@pytest.fixture
def fraction_full_df():
    """Full fraktionsdata med alla kolumner (Sheet5)."""
    np.random.seed(42)
    rows = []
    fraktioner = ["Rest", "Plast", "Organiskt", "Blandat"]
    for month in range(1, 13):
        manad = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Maj", 6: "Jun",
                 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec"}[month]
        for frac in fraktioner:
            tomningar = int(np.random.uniform(200, 3000))
            kwh = round(np.random.uniform(5000, 40000), 1)
            rows.append({
                "Manad_nr": month,
                "Manad": manad,
                "Fraktion": frac,
                "Timmar_hog_fyllnad": round(np.random.uniform(0.5, 8), 2),
                "kWh": kwh,
                "Tomningar": tomningar,
                "Tomning_per_minut": round(np.random.uniform(0.01, 0.05), 4),
                "kWh_per_tomning": round(kwh / tomningar, 3) if tomningar > 0 else np.nan,
            })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Larmdata (Sheet13-liknande)
# ---------------------------------------------------------------------------

@pytest.fixture
def alarm_df():
    """Larmdata per kategori och manad."""
    np.random.seed(42)
    rows = []
    kategorier = ["Ventilfel", "Systemlarm", "Kommunikationsfel"]
    for month in range(1, 13):
        manad = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Maj", 6: "Jun",
                 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec"}[month]
        for kat in kategorier:
            # Januari med anomalt hoga larm
            base = 500 if month == 1 else np.random.randint(30, 80)
            rows.append({
                "Månad_nr": month,
                "Månad": manad,
                "Kategori": kat,
                "Aktuell_period": int(base),
                "Forega_snitt": round(np.random.uniform(40, 60), 1),
            })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Manuelldata
# ---------------------------------------------------------------------------

@pytest.fixture
def manual_df():
    """Per-ventil manuell/automatisk data."""
    np.random.seed(42)
    rows = []
    ventiler = [f"{g}:{v}" for g in [1, 2, 3, 4, 5] for v in range(1, 6)]
    for month in range(1, 13):
        manad = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Maj", 6: "Jun",
                 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec"}[month]
        for vid in ventiler:
            gren = int(vid.split(":")[0])
            auto = np.random.randint(50, 200)
            man = np.random.randint(0, 10)
            total = man + auto
            rows.append({
                "Manad_nr": month,
                "Manad": manad,
                "Ventil_ID": vid,
                "Gren": gren,
                "MAN_OPEN_CMD": man,
                "AUTO_OPEN_CMD": auto,
                "INLET_OPEN": np.random.randint(50, 200),
                "Total_CMD": total,
                "Manuell_andel_%": round(man / total * 100, 2) if total > 0 else 0,
                "Tillganglighet": round(np.random.uniform(98, 100), 2),
            })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Trendanalys-output
# ---------------------------------------------------------------------------

@pytest.fixture
def trend_anlaggning_df():
    """Anlaggningstrend-data (output fran trendanalys)."""
    np.random.seed(42)
    rows = []
    for month in range(1, 13):
        manad = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Maj", 6: "Jun",
                 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec"}[month]
        energy = 90000 - month * 2000 + np.random.normal(0, 1000)
        tomningar = int(3500 + np.random.normal(0, 200))
        larm = 1500 if month == 1 else int(120 + np.random.normal(0, 20))
        rows.append({
            "Manad_nr": month,
            "Manad": manad,
            "Energi_kWh": round(energy, 1),
            "Drifttid_h": round(np.random.uniform(400, 600), 1),
            "Tomningar": tomningar,
            "kWh_per_tomning": round(energy / tomningar, 3),
            "Larm_totalt": larm,
        })
    return pd.DataFrame(rows)


@pytest.fixture
def trend_grenar_df():
    """Grenanalysdata."""
    rows = []
    for gren in range(1, 6):
        rows.append({
            "Gren": gren,
            "antal_ventiler": 5,
            "medel_tillg": 99.5 - gren * 0.5,
            "min_tillg": 95 - gren * 2,
            "totala_fel": gren * 20,
            "fel_per_ventil": gren * 4,
            "samsta_ventil": f"{gren}:1",
            "trend_class": "stabil",
            "trend_slope": -0.01,
            "halsopoang": 90 - gren * 5,
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Grendjupanalys-data
# ---------------------------------------------------------------------------

@pytest.fixture
def branch_deep_df():
    """Per-gren per-manad data for grendjupanalys."""
    np.random.seed(42)
    rows = []
    for month in range(1, 13):
        manad = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Maj", 6: "Jun",
                 7: "Jul", 8: "Aug", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Dec"}[month]
        for gren in range(1, 6):
            rows.append({
                "Manad_nr": month,
                "Manad": manad,
                "Gren": gren,
                "Medel_tillganglighet": round(np.random.uniform(98, 100), 2),
                "Totala_fel": np.random.poisson(5),
                "MAN_CMD": np.random.randint(5, 30),
                "AUTO_CMD": np.random.randint(200, 500),
                "Total_CMD": 0,  # Beraknas nedan
                "Manuell_andel_%": 0,
                "Antal_ventiler": 5,
            })
    df = pd.DataFrame(rows)
    df["Total_CMD"] = df["MAN_CMD"] + df["AUTO_CMD"]
    df["Manuell_andel_%"] = (df["MAN_CMD"] / df["Total_CMD"] * 100).round(1)
    return df


@pytest.fixture
def valve_info_df():
    """Ventil-Info data."""
    rows = []
    for gren in range(1, 6):
        for v in range(1, 6):
            frac = ["Rest", "Plast", "Organiskt", "Blandat", "Rest"][v - 1]
            rows.append({
                "Ventil_ID": f"{gren}:{v}",
                "Gren": gren,
                "Ventilnr": v,
                "Info": frac,
            })
    return pd.DataFrame(rows)


@pytest.fixture
def gren_profiler_df():
    """Grenprofiler."""
    rows = []
    for gren in range(1, 6):
        rows.append({
            "Gren": gren,
            "Antal_ventiler": 5,
            "Medel_tillganglighet": round(99.5 - gren * 0.3, 2),
            "Totala_fel_aret": gren * 20,
            "Manuell_andel_%": round(2 + gren * 0.5, 1),
            "Info": "Rest; Plast; Organiskt",
            "Grentyp": "Ovrigt",
            "Sasongstyp": "Jamn",
            "CV_%": round(15 + gren * 2, 1),
            "Sommar_CMD": round(300 - gren * 20, 0),
            "Vinter_CMD": round(350 - gren * 10, 0),
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Rekommendationer & drifterfarenheter
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_recs():
    """Exempelrekommendationer."""
    return [
        {
            "prioritet": 1,
            "kategori": "Underhall",
            "mal": "Kritiska ventiler",
            "rekommendation": "Akut underhall for 2 ventiler.",
            "dataunderlag": "Ventil 3:2 (91%), 5:4 (94%)",
            "forvantad_effekt": "Hojd tillganglighet till >98%",
            "atgarder": ["Inspektera ventiler", "Byt slitdelar"],
        },
        {
            "prioritet": 2,
            "kategori": "Energi",
            "mal": "Energioptimering",
            "rekommendation": "Minska spridning i kWh/tomning.",
            "dataunderlag": "Spridning 53%",
            "forvantad_effekt": "Minska kWh/tomning med 20%",
            "atgarder": ["Analysera basta manader", "Optimera scheman"],
        },
    ]


@pytest.fixture
def sample_goals():
    """Exempel-KPI-mal."""
    return [
        {
            "KPI": "Medeltillganglighet",
            "Nuvarande": "99.5%",
            "Mal_3m": "99.8%",
            "Mal_6m": "99.9%",
            "Mal_12m": "100.0%",
            "Strategi": "Fokusera pa samsta ventilerna",
        },
    ]


@pytest.fixture
def drifterfarenheter_data(valve_monthly_df, manual_df, trend_anlaggning_df):
    """Data som drifterfarenheter.py forvanter sig."""
    # Skapa manuell_ventiler (arssammanfattning)
    mv = manual_df.groupby(["Ventil_ID", "Gren"]).agg(
        MAN_totalt=("MAN_OPEN_CMD", "sum"),
        AUTO_totalt=("AUTO_OPEN_CMD", "sum"),
        INLET_totalt=("INLET_OPEN", "sum"),
        Medel_tillg=("Tillganglighet", "mean"),
        Manader_aktiv=("Manad_nr", "nunique"),
    ).reset_index()
    mv["Total_CMD"] = mv["MAN_totalt"] + mv["AUTO_totalt"]
    mv["Manuell_andel_%"] = (mv["MAN_totalt"] / mv["Total_CMD"] * 100).round(2)
    mv["MAN_per_manad"] = (mv["MAN_totalt"] / mv["Manader_aktiv"]).round(1)

    # Skapa manuell_analys (manatlig)
    monthly = manual_df.groupby(["Manad_nr", "Manad"]).agg(
        MAN_totalt=("MAN_OPEN_CMD", "sum"),
        AUTO_totalt=("AUTO_OPEN_CMD", "sum"),
    ).reset_index()
    monthly["Total_CMD"] = monthly["MAN_totalt"] + monthly["AUTO_totalt"]
    monthly["Manuell_andel_%"] = (monthly["MAN_totalt"] / monthly["Total_CMD"] * 100).round(2)

    return {
        "ventiler": valve_monthly_df,
        "anlaggning": trend_anlaggning_df,
        "grenar": pd.DataFrame(),
        "anomalier": pd.DataFrame(columns=["mal", "label", "varde", "z_score", "typ"]),
        "manuell_analys": monthly,
        "manuell_ventiler": mv,
    }
