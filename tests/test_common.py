"""Tester for common.py — hjalpfunktioner."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from common import parse_valve_id, MANAD_NAMN


class TestParseValveId:
    def test_normal(self):
        assert parse_valve_id("3:7") == (3, 7)

    def test_two_digit_branch(self):
        assert parse_valve_id("24:11") == (24, 11)

    def test_single_digit(self):
        assert parse_valve_id("1:1") == (1, 1)


class TestManadNamn:
    def test_has_12_months(self):
        assert len(MANAD_NAMN) == 12

    def test_jan_is_first(self):
        assert MANAD_NAMN[1] == "Jan"

    def test_dec_is_last(self):
        assert MANAD_NAMN[12] == "Dec"
