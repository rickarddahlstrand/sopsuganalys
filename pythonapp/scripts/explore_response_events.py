#!/usr/bin/env python3
"""Utforska text-mönster för uppföljande operatörshändelser i CSV-eventloggen.

Sammanfattar (utan att läcka rådata):
  * Antal rader som matchar "remote login", "manual mode" och "Alarm reset".
  * Anonymiserade exempeltexter för var och en.
  * Hur stor andel av larmen som har en uppföljande händelse av varje typ
    inom 24 timmar.

Kör:
    pythonapp/.venv/bin/python3 pythonapp/scripts/explore_response_events.py
"""

from __future__ import annotations

import csv
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from statistics import median


CSV_FILE = (
    Path(__file__).resolve().parent.parent.parent
    / "testdata"
    / "export_events-table_2026-03-13.csv"
)


# ---------------------------------------------------------------------------
# Anonymisering — exempeltexter får inte läcka konkret driftdata
# ---------------------------------------------------------------------------

PATTERN_REPLACERS = [
    (re.compile(r"\bDV \d+:\d+(?::\d+)?\b"), "DV <ID>"),
    (re.compile(r"\bSequence \d+\b"), "Sequence <N>"),
    (re.compile(r"\bSE \d+\b"), "SE <N>"),
    (re.compile(r"\b[Ee]xhauster \d+\b"), "Exhauster <N>"),
    (re.compile(r"\bContainer \d+\b"), "Container <N>"),
    (re.compile(r"\b(Pump|Valve|Inlet|Outlet|Block|Branch)\s+\d+\b"), r"\1 <N>"),
    (re.compile(r"\bSCT \d+:\d+\b"), "SCT <ID>"),
    (re.compile(r"\bPDVE \d+\b"), "PDVE <N>"),
    (re.compile(r"\b\d+\s*kW\b"), "<N> kW"),
    (re.compile(r"\b\d+(?:[.,]\d+)?\s*%"), "<N>%"),
    (re.compile(r"\b\d+\s*(minutes?|hours?|seconds?)\b"), r"<N> \1"),
    (re.compile(r"\([EF]\d+\)"), "(<CODE>)"),
    # User/IP/IDs i remote login etc — generiska restnummer
    (re.compile(r"\b(\d{1,3}\.){3}\d{1,3}\b"), "<IP>"),
    (re.compile(r"\b\d{2,}\b"), "<N>"),
]


def anonymise(text: str) -> str:
    out = text
    for pattern, repl in PATTERN_REPLACERS:
        out = pattern.sub(repl, out)
    return out


# ---------------------------------------------------------------------------
# Mönster som ska klassificera uppföljande operatörshändelser
# ---------------------------------------------------------------------------

# Operatörens fjärrinloggning rapporteras som "Remote connection 1" (1=on/on-line)
# (motsvarar domänexpertens "remote login").
RE_REMOTE_LOGIN = re.compile(r"remote connection\s*1\b", re.IGNORECASE)
# Manuellt driftläge rapporteras som "Change to manual operation mode"
# (motsvarar domänexpertens "manual mode").
RE_MANUAL_MODE = re.compile(r"change to manual operation mode", re.IGNORECASE)
RE_ALARM_RESET = re.compile(r"^alarm reset", re.IGNORECASE)


def classify(text: str) -> set[str]:
    """Returnerar set med någon av: 'login', 'manual', 'reset' (kan vara fler)."""
    hits = set()
    if RE_REMOTE_LOGIN.search(text):
        hits.add("login")
    if RE_MANUAL_MODE.search(text):
        hits.add("manual")
    if RE_ALARM_RESET.search(text):
        hits.add("reset")
    return hits


# ---------------------------------------------------------------------------
# Tidsparsing — testar några vanliga format
# ---------------------------------------------------------------------------

DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
)


def parse_time(s: str) -> datetime | None:
    s = s.strip()
    if not s:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
def main() -> None:
    if not CSV_FILE.exists():
        print(f"FEL: CSV saknas: {CSV_FILE}")
        return

    rows: list[tuple[datetime | None, str, str]] = []
    with CSV_FILE.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tid = parse_time(row.get("Tid") or "")
            typ = (row.get("Typ") or "").strip()
            text = (row.get("Text") or "").strip()
            rows.append((tid, typ, text))

    # 1) Antal träffar per textmönster (case-insensitive)
    n_login = sum(1 for _, _, t in rows if RE_REMOTE_LOGIN.search(t))
    n_manual = sum(1 for _, _, t in rows if RE_MANUAL_MODE.search(t))
    n_reset = sum(1 for _, _, t in rows if RE_ALARM_RESET.search(t))

    print(f"CSV: {CSV_FILE}")
    print(f"Antal rader totalt: {len(rows)}")
    print()
    print("Antal rader per text-mönster (case-insensitive):")
    print(f"  remote login : {n_login}")
    print(f"  manual mode  : {n_manual}")
    print(f"  Alarm reset  : {n_reset}")
    print()

    # 2) 10 unika anonymiserade exempel per kategori
    def collect_examples(predicate) -> list[tuple[int, str]]:
        templates = Counter()
        for _, _, text in rows:
            if predicate(text):
                templates[anonymise(text)] += 1
        return templates.most_common(10)

    print("Topp 10 unika exempel — 'remote login' (anonymiserade):")
    for tpl, n in collect_examples(lambda t: bool(RE_REMOTE_LOGIN.search(t))):
        print(f"  [{n:>4d}] {tpl}")
    print()
    print("Topp 10 unika exempel — 'manual mode' (anonymiserade):")
    for tpl, n in collect_examples(lambda t: bool(RE_MANUAL_MODE.search(t))):
        print(f"  [{n:>4d}] {tpl}")
    print()
    print("Topp 10 unika exempel — 'Alarm reset' (anonymiserade):")
    for tpl, n in collect_examples(lambda t: bool(RE_ALARM_RESET.search(t))):
        print(f"  [{n:>4d}] {tpl}")
    print()

    # 3) Andel larm som har uppföljning av respektive typ inom 24 h
    # Larm = ej Information & ej "Alarm reset" & ej "remote login" & ej "manual mode"
    parsed_rows = [
        (tid, typ, text) for tid, typ, text in rows if tid is not None
    ]
    parsed_rows.sort(key=lambda r: r[0])

    def is_alarm(typ: str, text: str) -> bool:
        # Följande operatörshändelser identifieras oavsett typ-kolumn — de
        # förekommer som "Information" i loggen men ska inte betraktas som larm.
        if RE_ALARM_RESET.search(text):
            return False
        if RE_REMOTE_LOGIN.search(text):
            return False
        if RE_MANUAL_MODE.search(text):
            return False
        if typ == "Information":
            return False
        return True

    alarms = [(tid, typ, text) for tid, typ, text in parsed_rows if is_alarm(typ, text)]

    # Index: per typ, lista av tidpunkter (sorterade) — sökta oavsett Typ.
    times_login = [tid for tid, _, t in parsed_rows if RE_REMOTE_LOGIN.search(t)]
    times_manual = [tid for tid, _, t in parsed_rows if RE_MANUAL_MODE.search(t)]
    times_reset = [tid for tid, _, t in parsed_rows if RE_ALARM_RESET.search(t)]
    for arr in (times_login, times_manual, times_reset):
        arr.sort()

    import bisect
    WINDOW_SEC = 24 * 3600  # 24 timmar

    def first_after(arr, t):
        idx = bisect.bisect_left(arr, t)
        return arr[idx] if idx < len(arr) else None

    def find_within_window(arr, t):
        nxt = first_after(arr, t)
        if nxt is None:
            return None
        if (nxt - t).total_seconds() > WINDOW_SEC:
            return None
        return nxt

    n_with_login = 0
    n_with_manual = 0
    n_with_reset = 0
    n_with_engagement = 0

    delays_login = []
    delays_manual = []
    delays_reset = []
    delays_engagement = []

    for tid, _, _ in alarms:
        l = find_within_window(times_login, tid)
        m = find_within_window(times_manual, tid)
        r = find_within_window(times_reset, tid)
        if l is not None:
            n_with_login += 1
            delays_login.append((l - tid).total_seconds())
        if m is not None:
            n_with_manual += 1
            delays_manual.append((m - tid).total_seconds())
        if r is not None:
            n_with_reset += 1
            delays_reset.append((r - tid).total_seconds())
        candidates = [x for x in (l, m, r) if x is not None]
        if candidates:
            first = min(candidates)
            n_with_engagement += 1
            delays_engagement.append((first - tid).total_seconds())

    total_alarms = len(alarms)

    def fmt_pct(n: int) -> str:
        return f"{n}/{total_alarms} ({100 * n / max(total_alarms, 1):.1f}%)"

    def fmt_secs(s: float) -> str:
        if s < 60:
            return f"{s:.0f} s"
        if s < 3600:
            return f"{s/60:.1f} min"
        if s < 86400:
            return f"{s/3600:.1f} h"
        return f"{s/86400:.2f} dygn"

    print(f"Larm (ej Information / reset / login / manual): {total_alarms}")
    print()
    print("Andel larm med uppföljande händelse inom 24 h:")
    print(f"  remote login : {fmt_pct(n_with_login)}")
    print(f"  manual mode  : {fmt_pct(n_with_manual)}")
    print(f"  Alarm reset  : {fmt_pct(n_with_reset)}")
    print(f"  engagemang   : {fmt_pct(n_with_engagement)}  (första av login/manual/reset)")
    print()
    print("Median tid till uppföljning (matchade larm):")

    def stats(arr, label):
        if not arr:
            print(f"  {label:12s} — inga matchningar")
            return
        arr_sorted = sorted(arr)
        mid = median(arr_sorted)
        n = len(arr_sorted)
        p75 = arr_sorted[int(n * 0.75)] if n > 1 else arr_sorted[0]
        p90 = arr_sorted[int(n * 0.90)] if n > 1 else arr_sorted[0]
        print(
            f"  {label:12s} median {fmt_secs(mid):>10s}  "
            f"p75 {fmt_secs(p75):>10s}  p90 {fmt_secs(p90):>10s}  (n={n})"
        )

    stats(delays_login, "login")
    stats(delays_manual, "manual")
    stats(delays_reset, "reset")
    stats(delays_engagement, "engagement")


if __name__ == "__main__":
    main()
