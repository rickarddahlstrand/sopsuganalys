"""Tester for drifterfarenheter.py — drifterfarenhetsanalys."""

import sys
from pathlib import Path

import pandas as pd
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from drifterfarenheter import (
    analyze_energy_efficiency,
    analyze_manual_trend,
    analyze_alarm_patterns,
    create_summary,
)


class TestAnalyzeEnergyEfficiency:
    def test_basic_analysis(self, trend_anlaggning_df):
        data = {"anlaggning": trend_anlaggning_df}
        result = analyze_energy_efficiency(data)
        assert "kwh_per_tomning_medel" in result
        assert "basta_manad" in result
        assert "samsta_manad" in result
        assert "spridning_pct" in result
        assert result["spridning_pct"] > 0

    def test_halvars_comparison(self, trend_anlaggning_df):
        data = {"anlaggning": trend_anlaggning_df}
        result = analyze_energy_efficiency(data)
        assert "halvars_forandring_pct" in result
        # H2 bor vara battre (lagre kWh/tomning) da energin minskar
        assert isinstance(result["halvars_forandring_pct"], float)

    def test_empty_data(self):
        data = {"anlaggning": pd.DataFrame()}
        result = analyze_energy_efficiency(data)
        assert result == {}

    def test_total_values(self, trend_anlaggning_df):
        data = {"anlaggning": trend_anlaggning_df}
        result = analyze_energy_efficiency(data)
        assert result["total_kwh"] > 0
        assert result["total_tomningar"] > 0


class TestAnalyzeManualTrend:
    def test_basic_trend(self, drifterfarenheter_data):
        result = analyze_manual_trend(drifterfarenheter_data)
        assert "total_manuella" in result
        assert "total_kommandon" in result
        assert "arsandel_pct" in result
        assert 0 <= result["arsandel_pct"] <= 100

    def test_has_branch_data(self, drifterfarenheter_data):
        result = analyze_manual_trend(drifterfarenheter_data)
        if "grenar_med_hogst_manuell" in result:
            assert len(result["grenar_med_hogst_manuell"]) > 0
            for g in result["grenar_med_hogst_manuell"]:
                assert "gren" in g
                assert "manuell_andel" in g

    def test_empty_data(self):
        data = {"manuell_analys": pd.DataFrame(), "manuell_ventiler": pd.DataFrame()}
        result = analyze_manual_trend(data)
        assert result == {}


class TestAnalyzeAlarmPatterns:
    def test_basic_alarms(self, trend_anlaggning_df):
        data = {
            "anlaggning": trend_anlaggning_df,
            "ventiler": pd.DataFrame(),
            "anomalier": pd.DataFrame(columns=["mal"]),
        }
        result = analyze_alarm_patterns(data)
        assert "totala_larm" in result
        assert "medel_per_manad" in result
        assert result["totala_larm"] > 0

    def test_january_spike(self, trend_anlaggning_df):
        """Januari har anomalt hoga larm — bor ge hog faktor."""
        data = {
            "anlaggning": trend_anlaggning_df,
            "ventiler": pd.DataFrame(),
            "anomalier": pd.DataFrame(columns=["mal"]),
        }
        result = analyze_alarm_patterns(data)
        assert result["januari_faktor_vs_resten"] > 5

    def test_empty_data(self):
        data = {
            "anlaggning": pd.DataFrame(),
            "ventiler": pd.DataFrame(),
            "anomalier": pd.DataFrame(),
        }
        result = analyze_alarm_patterns(data)
        assert result == {}


class TestCreateSummary:
    def test_findings_generated(self):
        manual_errors = {
            "drivande_feltyp": "DOES_NOT_OPEN",
            "drivande_korrelation": 0.6,
            "risk_ventiler": [{"ventil": "1:1"}],
        }
        energy = {
            "spridning_pct": 50,
            "basta_manad": "Dec",
            "samsta_manad": "Feb",
            "kwh_per_tomning_min": 15.0,
            "kwh_per_tomning_max": 30.0,
            "halvars_forandring_pct": -20,
        }
        manual_trend = {}
        alarms = {
            "januari_faktor_vs_resten": 49,
            "januari_larm": 5800,
            "feb_dec_medel": 120,
            "feb_dec_variationskoefficient": 30,
            "felfordelning": {
                "LONG_TIME": {"antal": 7000, "andel_pct": 90},
            },
        }
        findings = create_summary(manual_errors, energy, manual_trend, alarms)
        assert len(findings) >= 3
        # Bor vara sorterade pa prioritet
        priorities = [f["prioritet"] for f in findings]
        assert priorities == sorted(priorities)

    def test_no_findings_for_empty(self):
        findings = create_summary({}, {}, {}, {})
        assert len(findings) == 0
