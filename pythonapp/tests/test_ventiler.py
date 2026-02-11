"""Tester for ventiler.py — ventilanalys."""

import sys
from pathlib import Path

import pandas as pd
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from ventiler import create_summary_csv, create_monthly_summary


class TestCreateSummaryCsv:
    def test_basic_summary(self, tmp_path, monkeypatch):
        monkeypatch.setattr("ventiler.OUTPUT_DIR", tmp_path)
        avail_df = pd.DataFrame([
            {"Månad_nr": 1, "Månad": "Jan", "Ventil_ID": "1:1", "Tillgänglighet": 99.5},
            {"Månad_nr": 1, "Månad": "Jan", "Ventil_ID": "1:2", "Tillgänglighet": 95.0},
            {"Månad_nr": 2, "Månad": "Feb", "Ventil_ID": "1:1", "Tillgänglighet": 100.0},
            {"Månad_nr": 2, "Månad": "Feb", "Ventil_ID": "1:2", "Tillgänglighet": 97.0},
        ])
        error_df = pd.DataFrame([
            {"Månad_nr": 1, "Ventil_ID": "1:2", "Feltyp": "DOES_NOT_OPEN", "Antal": 3},
            {"Månad_nr": 2, "Ventil_ID": "1:2", "Feltyp": "LEVEL_ERROR", "Antal": 5},
        ])
        result = create_summary_csv(avail_df, error_df)
        assert not result.empty
        assert "Medel_Tillgänglighet_%" in result.columns
        assert "Totala_fel" in result.columns

        # Ventil 1:2 bor ha lagst tillganglighet
        worst = result.iloc[0]
        assert worst["Ventil_ID"] == "1:2"
        assert worst["Medel_Tillgänglighet_%"] == 96.0  # (95+97)/2
        assert worst["Totala_fel"] == 8  # 3+5

    def test_empty_avail(self, tmp_path, monkeypatch):
        monkeypatch.setattr("ventiler.OUTPUT_DIR", tmp_path)
        result = create_summary_csv(pd.DataFrame(), pd.DataFrame())
        assert result.empty


class TestCreateMonthlySummary:
    def test_basic_monthly(self):
        avail_df = pd.DataFrame([
            {"Månad_nr": 1, "Månad": "Jan", "Ventil_ID": "1:1", "Tillgänglighet": 99.5},
            {"Månad_nr": 1, "Månad": "Jan", "Ventil_ID": "1:2", "Tillgänglighet": 95.0},
            {"Månad_nr": 2, "Månad": "Feb", "Ventil_ID": "1:1", "Tillgänglighet": 100.0},
            {"Månad_nr": 2, "Månad": "Feb", "Ventil_ID": "1:2", "Tillgänglighet": 97.0},
        ])
        error_df = pd.DataFrame(columns=["Månad_nr", "Feltyp", "Antal"])
        avail_summary, err_summary = create_monthly_summary(avail_df, error_df)
        assert len(avail_summary) == 2  # 2 manader
        assert "Medel" in avail_summary.columns
        assert "Min" in avail_summary.columns
        jan = avail_summary[avail_summary["Månad_nr"] == 1].iloc[0]
        assert jan["Medel"] == pytest.approx(97.25, abs=0.01)
        assert jan["Min"] == 95.0
