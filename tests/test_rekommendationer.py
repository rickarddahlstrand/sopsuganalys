"""Tester for rekommendationer.py — rekommendationsmotor."""

import sys
from pathlib import Path

import pandas as pd
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from rekommendationer import (
    generate_maintenance_recs,
    generate_energy_recs,
    generate_alarm_recs,
    generate_branch_recs,
    generate_strategic_goals,
)


def _make_valve_data(avails, errors, trends=None):
    """Hjalpare: skapar ventil-DataFrame med tillganglighet/fel/trend."""
    rows = []
    for i, (vid, avg, err) in enumerate(zip(
        [f"{g}:{v}" for g in [1, 2, 3] for v in range(1, 4)],
        avails,
        errors,
    )):
        for m in range(1, 13):
            rows.append({
                "Ventil_ID": vid,
                "Manad_nr": m,
                "Tillganglighet": avg + np.random.normal(0, 0.5),
                "Totala_fel": err // 12,
                "trend_class": (trends or ["stabil"] * len(avails))[i],
            })
    return pd.DataFrame(rows)


class TestGenerateMaintenanceRecs:
    def test_critical_valves_detected(self):
        """Ventiler under 95% bor ge prio 1."""
        data = {
            "ventiler": _make_valve_data(
                [90, 99, 99, 99, 99, 99, 99, 99, 99],
                [100, 0, 0, 0, 0, 0, 0, 0, 0],
            ),
        }
        recs = generate_maintenance_recs(data)
        prio1 = [r for r in recs if r["prioritet"] == 1]
        assert len(prio1) > 0
        assert "kritisk tillgänglighet" in prio1[0]["mal"].lower()

    def test_no_recs_for_perfect_valves(self):
        """Perfekta ventiler ger inga rekommendationer."""
        data = {
            "ventiler": _make_valve_data(
                [100] * 9,
                [0] * 9,
            ),
        }
        recs = generate_maintenance_recs(data)
        assert len(recs) == 0

    def test_fragile_valves_detected(self):
        """Ventiler med 100% tillg men manga fel bor flaggas."""
        data = {
            "ventiler": _make_valve_data(
                [100] * 9,
                [100, 100, 100, 100, 100, 100, 100, 100, 100],
            ),
        }
        recs = generate_maintenance_recs(data)
        brackliga = [r for r in recs if "bräcklig" in r["mal"].lower()]
        assert len(brackliga) > 0


class TestGenerateEnergyRecs:
    def test_energy_spread_detected(self):
        """Stor spridning i kWh/tomning bor ge rekommendation."""
        data = {
            "anlaggning": pd.DataFrame({
                "Manad_nr": range(1, 13),
                "Energi_kWh": [80000 + i * 1000 for i in range(12)],
                "kWh_per_tomning": [30, 28, 26, 24, 22, 20, 18, 16, 15, 14, 14, 14],
                "Energi_kWh_trend_class": ["minskande"] * 12,
            }),
        }
        recs = generate_energy_recs(data)
        assert len(recs) > 0

    def test_empty_data(self):
        data = {"anlaggning": pd.DataFrame()}
        recs = generate_energy_recs(data)
        assert len(recs) == 0


class TestGenerateAlarmRecs:
    def test_alarm_anomaly(self):
        data = {
            "anomalier": pd.DataFrame([
                {"mal": "larm_manad", "label": "Jan", "varde": 5000, "z_score": 3.5, "typ": "hog"},
            ]),
            "anlaggning": pd.DataFrame({"Manad_nr": [1], "Larm_totalt_trend_class": ["stabil"]}),
        }
        recs = generate_alarm_recs(data)
        assert len(recs) > 0
        assert any("Jan" in r["mal"] for r in recs)

    def test_no_anomalies(self):
        data = {
            "anomalier": pd.DataFrame(columns=["mal", "label", "varde", "z_score", "typ"]),
            "anlaggning": pd.DataFrame(),
        }
        recs = generate_alarm_recs(data)
        assert len(recs) == 0


class TestGenerateBranchRecs:
    def test_critical_branches(self, trend_grenar_df):
        data = {"grenar": trend_grenar_df}
        recs = generate_branch_recs(data)
        # Gren 5 har halsopoang 65 (under 70)
        critical = [r for r in recs if r["prioritet"] == 1]
        assert len(critical) > 0

    def test_benchmark_rec(self, trend_grenar_df):
        data = {"grenar": trend_grenar_df}
        recs = generate_branch_recs(data)
        benchmark = [r for r in recs if "benchmark" in r["mal"].lower()]
        assert len(benchmark) > 0


class TestGenerateStrategicGoals:
    def test_goals_generated(self, valve_monthly_df, trend_grenar_df, trend_anlaggning_df):
        data = {
            "ventiler": valve_monthly_df,
            "grenar": trend_grenar_df,
            "anlaggning": trend_anlaggning_df,
        }
        goals = generate_strategic_goals(data)
        assert len(goals) >= 3  # Minst tillganglighet, fel, kwh
        kpi_names = [g["KPI"] for g in goals]
        assert "Medeltillgänglighet" in kpi_names
