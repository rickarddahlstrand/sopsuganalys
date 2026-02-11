"""Tester for trendanalys.py — statistiska funktioner."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from trendanalys import (
    compute_linear_trends,
    compute_moving_averages,
    detect_anomalies,
    compute_correlations,
    detect_seasonal_patterns,
    compute_branch_analysis,
)


class TestComputeLinearTrends:
    def test_increasing_trend(self):
        series = {"test": [(1, 10), (2, 20), (3, 30), (4, 40), (5, 50)]}
        result = compute_linear_trends(series)
        assert result["test"]["trend_class"] == "okande"
        assert result["test"]["slope"] == 10.0
        assert result["test"]["r2"] == 1.0

    def test_decreasing_trend(self):
        series = {"test": [(1, 50), (2, 40), (3, 30), (4, 20), (5, 10)]}
        result = compute_linear_trends(series)
        assert result["test"]["trend_class"] == "minskande"
        assert result["test"]["slope"] == -10.0

    def test_stable_no_trend(self):
        np.random.seed(42)
        series = {"test": [(i, 100 + np.random.normal(0, 0.1)) for i in range(1, 13)]}
        result = compute_linear_trends(series)
        assert result["test"]["trend_class"] == "stabil"

    def test_insufficient_data(self):
        series = {"test": [(1, 10), (2, 20)]}
        result = compute_linear_trends(series)
        assert result["test"]["trend_class"] == "otillracklig_data"

    def test_multiple_series(self):
        series = {
            "up": [(1, 10), (2, 20), (3, 30)],
            "down": [(1, 30), (2, 20), (3, 10)],
        }
        result = compute_linear_trends(series)
        assert "up" in result
        assert "down" in result


class TestComputeMovingAverages:
    def test_basic_ma(self):
        df = pd.DataFrame({"val": [10, 20, 30, 40, 50]})
        ma = compute_moving_averages(df, "val", window=3)
        assert len(ma) == 5
        assert ma.iloc[2] == pytest.approx(20.0)
        assert ma.iloc[4] == pytest.approx(40.0)

    def test_window_1(self):
        df = pd.DataFrame({"val": [10, 20, 30]})
        ma = compute_moving_averages(df, "val", window=1)
        assert list(ma) == [10, 20, 30]


class TestDetectAnomalies:
    def test_detects_spike(self):
        values = [100, 100, 100, 100, 100, 500, 100, 100, 100, 100]
        labels = list(range(10))
        anomalies = detect_anomalies(values, labels, threshold=2.0)
        assert len(anomalies) == 1
        assert anomalies[0]["index"] == 5
        assert anomalies[0]["typ"] == "hog"

    def test_detects_dip(self):
        values = [100, 100, 100, 0, 100, 100, 100, 100, 100, 100]
        labels = list(range(10))
        anomalies = detect_anomalies(values, labels, threshold=2.0)
        assert any(a["typ"] == "lag" for a in anomalies)

    def test_no_anomalies_for_uniform_data(self):
        values = [100] * 12
        anomalies = detect_anomalies(values)
        assert len(anomalies) == 0

    def test_handles_std_zero(self):
        values = [50, 50, 50]
        anomalies = detect_anomalies(values)
        assert len(anomalies) == 0

    def test_custom_threshold(self):
        values = [100, 100, 100, 200, 100, 100, 100]
        # Med lag threshold bor den hittas
        anomalies_low = detect_anomalies(values, threshold=1.0)
        anomalies_high = detect_anomalies(values, threshold=5.0)
        assert len(anomalies_low) >= len(anomalies_high)


class TestComputeCorrelations:
    def test_perfect_positive(self):
        data = {"test": ([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])}
        result = compute_correlations(data)
        assert result["test"]["pearson_r"] == pytest.approx(1.0, abs=0.001)
        assert "stark positiv" in result["test"]["tolkning"]

    def test_perfect_negative(self):
        data = {"test": ([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])}
        result = compute_correlations(data)
        assert result["test"]["pearson_r"] == pytest.approx(-1.0, abs=0.001)
        assert "negativ" in result["test"]["tolkning"]

    def test_no_correlation(self):
        np.random.seed(42)
        x = list(range(100))
        y = list(np.random.permutation(100))
        data = {"test": (x, y)}
        result = compute_correlations(data)
        assert abs(result["test"]["pearson_r"]) < 0.3
        assert "svag" in result["test"]["tolkning"]

    def test_insufficient_data(self):
        data = {"test": ([1, 2], [3, 4])}
        result = compute_correlations(data)
        assert result["test"]["tolkning"] == "otillracklig_data"

    def test_handles_nan(self):
        data = {"test": ([1, 2, np.nan, 4, 5], [2, 4, 6, 8, 10])}
        result = compute_correlations(data)
        assert "test" in result
        assert not np.isnan(result["test"]["pearson_r"])


class TestDetectSeasonalPatterns:
    def test_seasonal_signal(self):
        # Sinusvag: 12 manaders periodicitet
        values = [np.sin(2 * np.pi * i / 12) * 100 + 500 for i in range(12)]
        result = detect_seasonal_patterns(values)
        # En sinusvag bor ge sasongsmonster
        assert isinstance(result["har_sasongsmonster"], bool)

    def test_no_seasonal_for_constant(self):
        values = [100] * 12
        result = detect_seasonal_patterns(values)
        assert result["har_sasongsmonster"] is False

    def test_insufficient_data(self):
        result = detect_seasonal_patterns([100, 200])
        assert result["har_sasongsmonster"] is False


class TestComputeBranchAnalysis:
    def test_basic_branch_analysis(self, valve_monthly_df):
        result = compute_branch_analysis(valve_monthly_df)
        assert not result.empty
        assert "halsopoang" in result.columns
        assert "medel_tillg" in result.columns
        assert "fel_per_ventil" in result.columns
        assert len(result) == valve_monthly_df["Gren"].nunique()

    def test_empty_df(self):
        result = compute_branch_analysis(pd.DataFrame())
        assert result.empty

    def test_health_score_range(self, valve_monthly_df):
        result = compute_branch_analysis(valve_monthly_df)
        for _, row in result.iterrows():
            assert 0 <= row["halsopoang"] <= 100

    def test_sorted_by_health(self, valve_monthly_df):
        result = compute_branch_analysis(valve_monthly_df)
        assert list(result["halsopoang"]) == sorted(result["halsopoang"])
