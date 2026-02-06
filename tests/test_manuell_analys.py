"""Tester for manuell_analys.py — manuella korningar."""

import sys
from pathlib import Path

import pandas as pd
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from manuell_analys import (
    compute_monthly_kpis,
    compute_valve_summary,
    compute_branch_manual,
)


class TestComputeMonthlyKpis:
    def test_basic_kpis(self, manual_df):
        time_df = pd.DataFrame({
            "Manad_nr": range(1, 13),
            "Manad": ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
                       "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
            "Drifttid_h": [500] * 12,
        })
        result = compute_monthly_kpis(manual_df, time_df)
        assert not result.empty
        assert len(result) == 12
        assert "Manuell_andel_%" in result.columns
        assert "MAN_per_drifttimme" in result.columns
        assert "Ventiler_med_MAN" in result.columns
        # Manuell andel bor vara mellan 0 och 100
        for _, row in result.iterrows():
            assert 0 <= row["Manuell_andel_%"] <= 100

    def test_totals_correct(self, manual_df):
        time_df = pd.DataFrame({
            "Manad_nr": range(1, 13),
            "Manad": ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
                       "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
            "Drifttid_h": [500] * 12,
        })
        result = compute_monthly_kpis(manual_df, time_df)
        total_man = result["MAN_totalt"].sum()
        total_auto = result["AUTO_totalt"].sum()
        assert total_man == manual_df["MAN_OPEN_CMD"].sum()
        assert total_auto == manual_df["AUTO_OPEN_CMD"].sum()


class TestComputeValveSummary:
    def test_basic_summary(self, manual_df):
        result = compute_valve_summary(manual_df)
        assert not result.empty
        assert "Ventil_ID" in result.columns
        assert "Manuell_andel_%" in result.columns
        assert "MAN_per_manad" in result.columns

    def test_sorted_descending(self, manual_df):
        result = compute_valve_summary(manual_df)
        vals = result["Manuell_andel_%"].values
        assert list(vals) == sorted(vals, reverse=True)


class TestComputeBranchManual:
    def test_basic_branch(self, manual_df):
        result = compute_branch_manual(manual_df)
        assert not result.empty
        assert "Gren" in result.columns
        assert "Manuell_andel_%" in result.columns
        assert "MAN_per_ventil" in result.columns
        assert len(result) == manual_df["Gren"].nunique()

    def test_totals_match(self, manual_df):
        result = compute_branch_manual(manual_df)
        total_man = result["MAN_totalt"].sum()
        assert total_man == manual_df["MAN_OPEN_CMD"].sum()
