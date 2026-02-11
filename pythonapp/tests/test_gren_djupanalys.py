"""Tester for gren_djupanalys.py — grendjupanalys."""

import sys
from pathlib import Path

import pandas as pd
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from gren_djupanalys import identify_branch_characteristics


class TestIdentifyBranchCharacteristics:
    def test_basic_profiling(self, valve_info_df, branch_deep_df):
        result = identify_branch_characteristics(valve_info_df, branch_deep_df)
        assert not result.empty
        assert "Grentyp" in result.columns
        assert "Sasongstyp" in result.columns
        assert "CV_%" in result.columns
        assert len(result) == branch_deep_df["Gren"].nunique()

    def test_season_types(self, valve_info_df, branch_deep_df):
        result = identify_branch_characteristics(valve_info_df, branch_deep_df)
        valid_types = {"Sommarsvacka", "Sommartopp", "Jamn", "?"}
        for _, row in result.iterrows():
            assert row["Sasongstyp"] in valid_types

    def test_school_detection(self):
        """Testar att skola-nyckelord detekteras."""
        info_df = pd.DataFrame([
            {"Ventil_ID": "10:1", "Gren": 10, "Ventilnr": 1, "Info": "Skola Norra"},
            {"Ventil_ID": "10:2", "Gren": 10, "Ventilnr": 2, "Info": "Skola Norra"},
        ])
        branch_df = pd.DataFrame([
            {"Manad_nr": m, "Manad": "X", "Gren": 10, "Medel_tillganglighet": 99.0,
             "Totala_fel": 5, "MAN_CMD": 10, "AUTO_CMD": 200,
             "Total_CMD": 210, "Manuell_andel_%": 4.8, "Antal_ventiler": 2}
            for m in range(1, 13)
        ])
        result = identify_branch_characteristics(info_df, branch_df)
        assert result.iloc[0]["Grentyp"] == "Skola/forskola"

    def test_empty_dfs(self):
        result = identify_branch_characteristics(pd.DataFrame(), pd.DataFrame())
        assert result.empty

    def test_summer_dip_detection(self):
        """Testar att sommarsvacka detekteras nar sommar-CMD ar mycket lagre."""
        info_df = pd.DataFrame([
            {"Ventil_ID": "1:1", "Gren": 1, "Ventilnr": 1, "Info": "Test"},
        ])
        rows = []
        for m in range(1, 13):
            # Sommar (jun-aug) har manga farre kommandon
            cmd = 50 if m in [6, 7, 8] else 300
            rows.append({
                "Manad_nr": m, "Manad": "X", "Gren": 1,
                "Medel_tillganglighet": 99.0, "Totala_fel": 3,
                "MAN_CMD": 5, "AUTO_CMD": cmd,
                "Total_CMD": cmd + 5, "Manuell_andel_%": 1.0,
                "Antal_ventiler": 1,
            })
        branch_df = pd.DataFrame(rows)
        result = identify_branch_characteristics(info_df, branch_df)
        assert result.iloc[0]["Sasongstyp"] == "Sommarsvacka"
