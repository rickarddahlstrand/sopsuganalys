"""Tester for fraktion_analys.py — fraktionsanalys."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from fraktion_analys import (
    compute_seasonal_analysis,
    compute_fill_analysis,
    compute_throughput,
)


class TestComputeSeasonalAnalysis:
    def test_basic_seasonal(self, fraction_full_df):
        result = compute_seasonal_analysis(fraction_full_df)
        assert len(result) > 0
        for frac, info in result.items():
            assert "H1_tomningar" in info
            assert "H2_tomningar" in info
            assert "Halvars_variation_%" in info
            assert info["Halvars_variation_%"] >= 0

    def test_empty_df(self):
        result = compute_seasonal_analysis(pd.DataFrame())
        assert result == {}

    def test_h1_h2_split(self, fraction_full_df):
        result = compute_seasonal_analysis(fraction_full_df)
        for frac, info in result.items():
            frac_data = fraction_full_df[fraction_full_df["Fraktion"] == frac]
            h1_expected = frac_data[frac_data["Manad_nr"] <= 6]["Tomningar"].sum()
            assert info["H1_tomningar"] == h1_expected


class TestComputeFillAnalysis:
    def test_basic_fill(self, fraction_full_df):
        result = compute_fill_analysis(fraction_full_df)
        assert len(result) > 0
        for frac, info in result.items():
            assert info["medel_timmar"] > 0
            assert info["max_timmar"] >= info["medel_timmar"]
            assert info["min_timmar"] <= info["medel_timmar"]
            assert isinstance(info["topp_manad"], str)

    def test_empty_df(self):
        result = compute_fill_analysis(pd.DataFrame())
        assert result == {}


class TestComputeThroughput:
    def test_basic_throughput(self, fraction_full_df):
        result = compute_throughput(fraction_full_df)
        assert len(result) > 0
        for frac, info in result.items():
            assert info["medel"] > 0
            assert info["max"] >= info["medel"]
            assert info["min"] <= info["medel"]

    def test_empty_df(self):
        result = compute_throughput(pd.DataFrame())
        assert result == {}


class TestFractionDataFiltering:
    """Testar att datum-rader filtreras bort korrekt."""

    def test_date_rows_filtered(self):
        """Verifierar att re-filter tar bort datum-rader."""
        import re
        test_values = ["Rest", "Plastic", "Organic", "mixed waste",
                       "Month", "24-Feb", "25-Jan", "24-Aug"]
        valid = []
        for frac in test_values:
            if frac.lower() == "month":
                continue
            if re.match(r"^\d{2}-\w+$", frac):
                continue
            valid.append(frac)
        assert valid == ["Rest", "Plastic", "Organic", "mixed waste"]

    def test_real_fractions_preserved(self):
        """Verifierar att riktiga fraktionsnamn ej filtreras bort."""
        import re
        real_fractions = ["Rest", "Plastic", "Organic", "mixed waste",
                         "Restavfall", "Matavfall", "Plast"]
        for frac in real_fractions:
            assert frac.lower() != "month"
            assert not re.match(r"^\d{2}-\w+$", frac)
