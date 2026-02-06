"""Tester for energi_drift.py — energianalys."""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from energi_drift import create_summary_csv
from common import ensure_output_dir, OUTPUT_DIR


class TestCreateSummaryCsv:
    def test_basic_merge(self, energy_df, fraction_df, tmp_path, monkeypatch):
        """Testar att energi + fraktion mergas korrekt."""
        monkeypatch.setattr("energi_drift.OUTPUT_DIR", tmp_path)
        result = create_summary_csv(energy_df, fraction_df)
        assert not result.empty
        assert "Energi_kWh" in result.columns
        assert len(result) == 12  # 12 manader

    def test_empty_fractions(self, energy_df, tmp_path, monkeypatch):
        """Testar med tom fraktionsdata."""
        monkeypatch.setattr("energi_drift.OUTPUT_DIR", tmp_path)
        result = create_summary_csv(energy_df, pd.DataFrame())
        assert not result.empty
        assert "Energi_kWh" in result.columns
        assert len(result) == 12

    def test_csv_saved(self, energy_df, fraction_df, tmp_path, monkeypatch):
        """Testar att CSV sparas."""
        monkeypatch.setattr("energi_drift.OUTPUT_DIR", tmp_path)
        create_summary_csv(energy_df, fraction_df)
        assert (tmp_path / "energi_drift.csv").exists()
