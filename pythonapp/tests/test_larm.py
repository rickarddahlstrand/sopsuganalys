"""Tester for larm.py — larmanalys."""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from larm import create_summary_csv


class TestCreateSummaryCsv:
    def test_basic_pivot(self, alarm_df, tmp_path, monkeypatch):
        monkeypatch.setattr("larm.OUTPUT_DIR", tmp_path)
        result = create_summary_csv(alarm_df)
        assert not result.empty
        assert "Månad_nr" in result.columns or "Manad_nr" in result.columns
        # Bor ha en kolumn per kategori
        assert "Ventilfel" in result.columns
        assert "Systemlarm" in result.columns
        assert len(result) == 12  # 12 manader

    def test_empty_df(self, tmp_path, monkeypatch):
        monkeypatch.setattr("larm.OUTPUT_DIR", tmp_path)
        result = create_summary_csv(pd.DataFrame())
        assert result.empty

    def test_csv_saved(self, alarm_df, tmp_path, monkeypatch):
        monkeypatch.setattr("larm.OUTPUT_DIR", tmp_path)
        create_summary_csv(alarm_df)
        assert (tmp_path / "larm.csv").exists()
