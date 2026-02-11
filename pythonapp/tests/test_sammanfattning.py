"""Tester for sammanfattning.py — Sheet1-utvinning."""

import sys
from pathlib import Path

import pandas as pd
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from sammanfattning import identify_kpis, create_pivoted_csv, _guess_unit


class TestIdentifyKpis:
    def test_numeric_kpis(self):
        df = pd.DataFrame({
            "Nyckel": ["Antal"] * 12,
            "Varde": list(range(10, 22)),
            "Manad_nr": list(range(1, 13)),
        })
        result = identify_kpis(df)
        assert len(result) == 1
        assert result.iloc[0]["Typ"] == "numerisk"
        assert result.iloc[0]["Min"] == 10
        assert result.iloc[0]["Max"] == 21

    def test_text_kpis(self):
        df = pd.DataFrame({
            "Nyckel": ["Version"] * 3,
            "Varde": ["v1.0", "v1.1", "v1.2"],
            "Manad_nr": [1, 2, 3],
        })
        result = identify_kpis(df)
        assert len(result) == 1
        assert result.iloc[0]["Typ"] == "text"
        assert result.iloc[0]["Min"] is None

    def test_mixed_kpis(self):
        df = pd.DataFrame({
            "Nyckel": ["Antal", "Antal", "Version", "Version"],
            "Varde": [100, 200, "v1.0", "v1.1"],
            "Manad_nr": [1, 2, 1, 2],
        })
        result = identify_kpis(df)
        assert len(result) == 2

    def test_empty_df(self):
        result = identify_kpis(pd.DataFrame())
        assert result.empty


class TestGuessUnit:
    def test_kwh(self):
        assert _guess_unit("Energy kWh") == "kWh"

    def test_kpa(self):
        assert _guess_unit("Vacuum kPa") == "kPa"

    def test_ton(self):
        assert _guess_unit("Total tonnage") == "ton"

    def test_hours(self):
        assert _guess_unit("Operation time hours") == "h"

    def test_percent(self):
        assert _guess_unit("Availability %") == "%"

    def test_transport(self):
        assert _guess_unit("Transport count") == "st"

    def test_unknown(self):
        assert _guess_unit("No of apartments") == ""


class TestCreatePivotedCsv:
    def test_pivot_numeric(self, tmp_path, monkeypatch):
        monkeypatch.setattr("sammanfattning.OUTPUT_DIR", tmp_path)
        df = pd.DataFrame({
            "Nyckel": ["Antal"] * 3 + ["Temp"] * 3,
            "Varde": [100, 110, 120, 20, 22, 25],
            "Manad_nr": [1, 2, 3, 1, 2, 3],
            "Manad": ["Jan", "Feb", "Mar", "Jan", "Feb", "Mar"],
        })
        result = create_pivoted_csv(df)
        assert not result.empty
        assert (tmp_path / "sammanfattning.csv").exists()

    def test_empty_df(self, tmp_path, monkeypatch):
        monkeypatch.setattr("sammanfattning.OUTPUT_DIR", tmp_path)
        result = create_pivoted_csv(pd.DataFrame())
        assert result.empty
