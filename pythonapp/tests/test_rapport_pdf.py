"""Tester for rapport_pdf.py — PDF-rapportgenerering."""

import json
import sys
from pathlib import Path

import pandas as pd
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from rapport_pdf import (
    RapportPDF,
    add_title_page,
    add_summary_section,
    add_energy_section,
    add_valve_section,
    add_branch_section,
    add_alarm_section,
    add_manual_section,
    add_drifterfarenheter_section,
    add_sammanfattning_section,
    add_fraktion_section,
    add_gren_djup_section,
    add_recommendations_section,
    add_strategy_section,
    add_agenda_appendix,
    get_font_path,
)


def _make_minimal_data(tmp_path):
    """Skapar minimal testdata for PDF-rapporten."""
    data = {}

    # Anlaggning
    data["anlaggning"] = pd.DataFrame({
        "Manad_nr": range(1, 13),
        "Manad": ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
                   "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
        "Energi_kWh": [80000 - i * 2000 for i in range(12)],
        "Drifttid_h": [500] * 12,
        "Tomningar": [3500] * 12,
        "kWh_per_tomning": [22 - i * 0.5 for i in range(12)],
        "Larm_totalt": [1500] + [100] * 11,
    })

    # Ventiler
    rows = []
    for m in range(1, 13):
        for g in range(1, 4):
            for v in range(1, 4):
                rows.append({
                    "Ventil_ID": f"{g}:{v}",
                    "Manad_nr": m,
                    "Gren": g,
                    "Tillganglighet": 99.5 if not (g == 3 and v == 2) else 92.0,
                    "Totala_fel": 1 if not (g == 3 and v == 2) else 10,
                    "trend_class": "stabil",
                })
    data["ventiler"] = pd.DataFrame(rows)

    # Grenar
    data["grenar"] = pd.DataFrame({
        "Gren": [1, 2, 3],
        "antal_ventiler": [3, 3, 3],
        "medel_tillg": [99.5, 99.5, 97.0],
        "min_tillg": [99.0, 99.0, 92.0],
        "totala_fel": [10, 10, 50],
        "fel_per_ventil": [3.3, 3.3, 16.7],
        "samsta_ventil": ["1:1", "2:1", "3:2"],
        "trend_class": ["stabil", "stabil", "stabil"],
        "trend_slope": [0, 0, -0.1],
        "halsopoang": [85, 85, 60],
    })

    # Korrelationer
    data["korrelationer"] = pd.DataFrame({
        "Par": ["energi_vs_tomningar", "tomningar_vs_larm"],
        "pearson_r": [0.3, 0.98],
        "pearson_p": [0.1, 0.001],
        "tolkning": ["svag positiv", "stark positiv"],
    })

    # Anomalier
    data["anomalier"] = pd.DataFrame({
        "mal": ["larm_manad", "ventil_tillganglighet"],
        "label": ["Jan", "3:2"],
        "varde": [1500, 92.0],
        "z_score": [3.3, -5.0],
        "typ": ["hog", "lag"],
    })

    # Manuell analys
    data["manuell_analys"] = pd.DataFrame({
        "Manad_nr": range(1, 13),
        "Manad": ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
                   "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
        "MAN_totalt": [100, 90, 80, 70, 60, 50, 50, 40, 30, 30, 20, 20],
        "AUTO_totalt": [3500] * 12,
        "Total_CMD": [3600, 3590, 3580, 3570, 3560, 3550, 3550, 3540, 3530, 3530, 3520, 3520],
        "Manuell_andel_%": [2.8, 2.5, 2.2, 2.0, 1.7, 1.4, 1.4, 1.1, 0.8, 0.8, 0.6, 0.6],
        "Ventiler_med_MAN": [20] * 12,
        "Andel_ventiler_MAN_%": [10] * 12,
        "Drifttid_h": [500] * 12,
        "MAN_per_drifttimme": [0.2, 0.18, 0.16, 0.14, 0.12, 0.1, 0.1, 0.08, 0.06, 0.06, 0.04, 0.04],
    })

    # Manuell ventiler
    data["manuell_ventiler"] = pd.DataFrame({
        "Ventil_ID": [f"{g}:{v}" for g in [1, 2, 3] for v in [1, 2, 3]],
        "Gren": [g for g in [1, 2, 3] for _ in [1, 2, 3]],
        "MAN_totalt": [5, 3, 8, 2, 10, 6, 4, 7, 1],
        "AUTO_totalt": [300] * 9,
        "Total_CMD": [305, 303, 308, 302, 310, 306, 304, 307, 301],
        "Manuell_andel_%": [1.6, 1.0, 2.6, 0.7, 3.2, 2.0, 1.3, 2.3, 0.3],
        "Medel_tillg": [99.5, 100, 99, 100, 92, 99, 100, 98, 100],
    })

    # Sammanfattning (Sheet1)
    data["sammanfattning"] = pd.DataFrame({
        "Nyckel": ["Antal lagenheter", "Antal ventiler"],
        "Jan": [3086, 206],
        "Feb": [3086, 206],
    })
    data["sammanfattning_kpi_lista"] = pd.DataFrame({
        "KPI": ["Antal lagenheter", "Antal ventiler"],
        "Typ": ["numerisk", "numerisk"],
        "Min": [3086, 206],
        "Max": [3086, 206],
        "Medel": [3086, 206],
        "Enhet": ["", ""],
    })

    # Fraktion
    frac_rows = []
    for m in range(1, 13):
        for frac in ["Rest", "Plast", "Organiskt"]:
            frac_rows.append({
                "Manad_nr": m,
                "Manad": "X",
                "Fraktion": frac,
                "Tomningar": int(np.random.uniform(500, 2000)),
                "kWh": round(np.random.uniform(5000, 20000), 1),
                "Timmar_hog_fyllnad": round(np.random.uniform(1, 8), 2),
                "Tomning_per_minut": round(np.random.uniform(0.01, 0.05), 4),
                "kWh_per_tomning": round(np.random.uniform(5, 30), 3),
            })
    data["fraktion_analys"] = pd.DataFrame(frac_rows)

    # Grendjup
    gren_rows = []
    for m in range(1, 13):
        for g in [1, 2, 3]:
            gren_rows.append({
                "Manad_nr": m, "Gren": g,
                "Medel_tillganglighet": 99.0,
                "Totala_fel": 5, "MAN_CMD": 10, "AUTO_CMD": 300,
                "Total_CMD": 310, "Manuell_andel_%": 3.2,
            })
    data["gren_djupanalys"] = pd.DataFrame(gren_rows)
    data["gren_profiler"] = pd.DataFrame({
        "Gren": [1, 2, 3],
        "Antal_ventiler": [3, 3, 3],
        "Medel_tillganglighet": [99.5, 99.5, 97.0],
        "Totala_fel_aret": [10, 10, 50],
        "Manuell_andel_%": [2, 2, 5],
        "Info": ["Rest; Plast", "Rest; Plast", "Rest; Plast"],
        "Grentyp": ["Ovrigt", "Ovrigt", "Ovrigt"],
        "Sasongstyp": ["Jamn", "Jamn", "Sommarsvacka"],
        "CV_%": [15, 15, 30],
        "Sommar_CMD": [280, 280, 150],
        "Vinter_CMD": [320, 320, 350],
    })

    # Drifterfarenheter
    data["drifterfarenheter"] = {
        "manual_vs_felkoder": {
            "korrelationer": {"DOES_NOT_OPEN": {"pearson_r": 0.57, "p_varde": 0.0, "totalt_antal": 37}},
            "risk_ventiler": [{"ventil": "3:2", "gren": 3, "manuell_andel": 10.0,
                              "tillganglighet": 100.0, "totala_fel": 50,
                              "dominerande_fel": "LEVEL_ERROR", "dominerande_fel_antal": 30}],
        },
        "energieffektivitet": {
            "kwh_per_tomning_medel": 24.0, "kwh_per_tomning_min": 15.0, "kwh_per_tomning_max": 31.0,
            "basta_manad": "Dec", "samsta_manad": "Feb", "spridning_pct": 50,
            "halvars_forandring_pct": -10, "total_kwh": 900000, "total_tomningar": 40000,
            "korrelation_energi_drifttid": {"r": 0.85, "p": 0.001},
        },
        "manuell_trend": {"arsandel_pct": 2.4, "h1_andel_pct": 2.6, "h2_andel_pct": 1.8},
        "larmmonster": {
            "totala_larm": 7000, "januari_larm": 5800, "januari_faktor_vs_resten": 49,
            "feb_dec_medel": 120, "feb_dec_variationskoefficient": 30,
            "felfordelning": {"LONG_TIME": {"antal": 6000, "andel_pct": 90}},
        },
        "huvudfynd": [
            {"omrade": "Test", "fynd": "Testfynd", "prioritet": 1},
        ],
    }

    # Rekommendationer
    data["recs"] = [
        {"prioritet": 1, "kategori": "Underhall", "mal": "Test",
         "rekommendation": "Testrekommendation", "dataunderlag": "Testdata",
         "forvantad_effekt": "Positiv", "atgarder": ["Atgard 1"]},
    ]
    data["goals"] = [
        {"KPI": "Test-KPI", "Nuvarande": "99%", "Mal_3m": "99.5%",
         "Mal_6m": "99.8%", "Mal_12m": "100%", "Strategi": "Test"},
    ]

    # Skapa minimala PNG-platshallare (1x1 pixel)
    import struct, zlib
    def _make_tiny_png():
        raw = b"\x00\x00\x00\x00"
        ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
        def _chunk(ctype, data):
            c = ctype + data
            return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
        return b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", zlib.compress(raw)) + _chunk(b"IEND", b"")
    tiny_png = _make_tiny_png()
    for name in [
        "trend_energi_forbrukning", "trend_energi_effektivitet",
        "trend_energi_fraktioner", "trend_energi_korrelation",
        "trend_ventiler_tillganglighet", "trend_ventiler_feltyper",
        "trend_ventiler_samsta", "trend_ventiler_felfordelning",
        "trend_grenar_halsopoang", "trend_grenar_heatmap",
        "trend_larm_trend", "trend_larm_jamforelse",
        "manuell_kommandon", "manuell_trend", "manuell_topp_ventiler", "manuell_grenar",
        "fraktion_tomningar", "fraktion_fyllnad", "fraktion_genomstromning",
        "fraktion_effektivitet", "fraktion_heatmap", "fraktion_sasong",
        "gren_tillganglighet_heatmap", "gren_feltrend", "gren_manuell",
        "gren_sasong", "gren_typer", "gren_ranking",
        "sammanfattning_1", "sammanfattning_2", "sammanfattning_3",
    ]:
        (tmp_path / f"{name}.png").write_bytes(tiny_png)

    return data


class TestRapportPDF:
    def test_pdf_creation(self):
        """Testar att PDF-objektet skapas."""
        pdf = RapportPDF()
        assert pdf is not None
        assert pdf.default_font in ["DejaVu", "Helvetica"]

    def test_font_found(self):
        """Testar att DejaVuSans hittas."""
        path = get_font_path()
        assert path is not None
        assert Path(path).exists()


class TestTitlePage:
    def test_title_page_adds_page(self):
        pdf = RapportPDF()
        add_title_page(pdf)
        assert pdf.page_no() == 1


class TestAllSections:
    """Testar att varje sektion kan genereras utan krasch."""

    def test_summary_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_summary_section(pdf, data, data["recs"])
        assert pdf.page_no() >= 1

    def test_energy_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_energy_section(pdf, data)
        assert pdf.page_no() >= 1

    def test_valve_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_valve_section(pdf, data)
        assert pdf.page_no() >= 1

    def test_branch_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_branch_section(pdf, data)
        assert pdf.page_no() >= 1

    def test_alarm_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_alarm_section(pdf, data)
        assert pdf.page_no() >= 1

    def test_manual_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_manual_section(pdf, data)
        assert pdf.page_no() >= 1

    def test_drifterfarenheter_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_drifterfarenheter_section(pdf, data)
        assert pdf.page_no() >= 1

    def test_sammanfattning_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_sammanfattning_section(pdf, data)
        assert pdf.page_no() >= 1

    def test_fraktion_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_fraktion_section(pdf, data)
        assert pdf.page_no() >= 1

    def test_gren_djup_section(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)
        pdf = RapportPDF()
        pdf.add_page()
        add_gren_djup_section(pdf, data)
        assert pdf.page_no() >= 1

    def test_recommendations_section(self, sample_recs):
        pdf = RapportPDF()
        pdf.add_page()
        add_recommendations_section(pdf, sample_recs)
        assert pdf.page_no() >= 1

    def test_strategy_section(self, sample_goals):
        pdf = RapportPDF()
        pdf.add_page()
        add_strategy_section(pdf, sample_goals)
        assert pdf.page_no() >= 1


class TestFullReport:
    """Testar att en komplett rapport kan genereras."""

    def test_full_pdf_generation(self, tmp_path, monkeypatch):
        monkeypatch.setattr("rapport_pdf.OUTPUT_DIR", tmp_path)
        data = _make_minimal_data(tmp_path)

        pdf = RapportPDF()
        add_title_page(pdf)
        add_summary_section(pdf, data, data["recs"])
        add_sammanfattning_section(pdf, data)
        add_energy_section(pdf, data)
        add_fraktion_section(pdf, data)
        add_valve_section(pdf, data)
        add_branch_section(pdf, data)
        add_gren_djup_section(pdf, data)
        add_alarm_section(pdf, data)
        add_manual_section(pdf, data)
        add_drifterfarenheter_section(pdf, data)
        add_recommendations_section(pdf, data["recs"])
        add_strategy_section(pdf, data["goals"])
        add_agenda_appendix(pdf)

        output_path = tmp_path / "test_rapport.pdf"
        pdf.output(str(output_path))

        assert output_path.exists()
        assert output_path.stat().st_size > 1000  # Rimlig storlek
        assert pdf.page_no() >= 5  # Minst nagra sidor
