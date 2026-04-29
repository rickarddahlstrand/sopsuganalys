#!/usr/bin/env python3
"""Utforska larm- och 'Alarm reset'-mönster i CSV-eventloggen.

Skriver ut endast aggregerade mönster (inte rådata) för att kunna designa
matchning av larm mot 'Alarm reset' i webappens responstidsanalys.

Värden som ser ut som siffror, ID:n, sekvensnummer och felkoder ersätts
med platshållare så att inga konkreta driftsdata exponeras.
"""

import csv
import re
from collections import Counter
from pathlib import Path


CSV_FILE = (
    Path(__file__).resolve().parent.parent.parent
    / "testdata"
    / "export_events-table_2026-03-13.csv"
)


# Mönster som ersätter konkreta värden med platshållare ----------------------
PATTERN_REPLACERS = [
    # DV ventil-ID, t.ex. "DV 24:11" eller "DV 24:11:2"
    (re.compile(r"\bDV \d+:\d+(?::\d+)?\b"), "DV <ID>"),
    # Sekvens-ID
    (re.compile(r"\bSequence \d+\b"), "Sequence <N>"),
    # Separator
    (re.compile(r"\bSE \d+\b"), "SE <N>"),
    # Exhauster
    (re.compile(r"\b[Ee]xhauster \d+\b"), "Exhauster <N>"),
    # Container
    (re.compile(r"\bContainer \d+\b"), "Container <N>"),
    # Sub-pumpar etc
    (re.compile(r"\b(Pump|Valve|Inlet|Outlet|Block|Branch)\s+\d+\b"), r"\1 <N>"),
    # Ström/effektgränser
    (re.compile(r"\d+\s*kW\b"), "<N> kW"),
    # Procentvärden
    (re.compile(r"\b\d+(?:[.,]\d+)?\s*%"), "<N>%"),
    # Timmar/minuter/sekunder
    (re.compile(r"\b\d+\s*(minutes?|hours?|seconds?)\b"), r"<N> \1"),
    # Felkoder t.ex. (E12) eller [F03]
    (re.compile(r"\([EF]\d+\)"), "(<CODE>)"),
    # Generella restnummer (efter ovanstående) — ersätt 2+ siffror
    (re.compile(r"\b\d{2,}\b"), "<N>"),
]


# Identifierare som visas i larmtexter ---------------------------------------
ID_PATTERNS = {
    "Ventil (DV X:Y[:Z])": re.compile(r"\bDV (\d+:\d+(?::\d+)?)\b"),
    "Sekvens (Sequence N)": re.compile(r"\bSequence (\d+)\b"),
    "Separator (SE N)": re.compile(r"\bSE (\d+)\b"),
    "Exhauster": re.compile(r"\b[Ee]xhauster (\d+)\b"),
    "Container": re.compile(r"\bContainer (\d+)\b"),
    "Felkod (Eddd/Fddd)": re.compile(r"[EF]\d{2,}"),
}


def anonymise(text: str) -> str:
    """Ersätter konkreta värden med platshållare."""
    out = text
    for pattern, replacement in PATTERN_REPLACERS:
        out = pattern.sub(replacement, out)
    return out


def main():
    if not CSV_FILE.exists():
        print(f"FEL: CSV saknas: {CSV_FILE}")
        return

    type_counts = Counter()
    alarm_templates = Counter()
    reset_templates = Counter()
    id_pattern_hits = Counter()
    has_id_in_alarm = 0
    has_id_in_reset = 0
    total_alarms = 0
    total_resets = 0

    with CSV_FILE.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            typ = (row.get("Typ") or "").strip()
            text = (row.get("Text") or "").strip()
            type_counts[typ] += 1

            is_reset = text.lower().startswith("alarm reset")
            if typ == "Information":
                continue

            template = anonymise(text)

            if is_reset:
                total_resets += 1
                reset_templates[template] += 1
                for label, pat in ID_PATTERNS.items():
                    if pat.search(text):
                        id_pattern_hits[f"reset:{label}"] += 1
                        has_id_in_reset += 1
                        break
            else:
                total_alarms += 1
                alarm_templates[template] += 1
                for label, pat in ID_PATTERNS.items():
                    if pat.search(text):
                        id_pattern_hits[f"alarm:{label}"] += 1
                        has_id_in_alarm += 1
                        break

    print(f"CSV: {CSV_FILE}")
    print()
    print("Antal rader per Typ:")
    for typ, n in type_counts.most_common():
        print(f"  {typ:20s} {n:>6d}")
    print()
    print(f"Totalt larm (ej Information, ej 'Alarm reset'): {total_alarms}")
    print(f"Totalt 'Alarm reset'-rader: {total_resets}")
    print()
    print(f"Larm med identifierare: {has_id_in_alarm}/{total_alarms} "
          f"({100 * has_id_in_alarm / max(total_alarms, 1):.1f}%)")
    print(f"Reset med identifierare: {has_id_in_reset}/{total_resets} "
          f"({100 * has_id_in_reset / max(total_resets, 1):.1f}%)")
    print()
    print("Identifier-träffar per kategori:")
    for label, n in sorted(id_pattern_hits.items(), key=lambda kv: -kv[1]):
        print(f"  {label:45s} {n:>6d}")
    print()
    print("Topp 20 larm-textmallar (anonymiserade):")
    for tpl, n in alarm_templates.most_common(20):
        print(f"  [{n:>4d}] {tpl}")
    print()
    print("Topp 20 'Alarm reset'-textmallar (anonymiserade):")
    for tpl, n in reset_templates.most_common(20):
        print(f"  [{n:>4d}] {tpl}")

    print()
    print("--- Analys av reset-strategi ---")
    # Eftersom alla resets verkar vara generiska, simulera tidsbaserad
    # parning: hur många öppna larm finns när en reset inträffar?
    rows = []
    with CSV_FILE.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            typ = (row.get("Typ") or "").strip()
            text = (row.get("Text") or "").strip()
            tid = (row.get("Tid") or "").strip()
            if typ == "Information":
                continue
            rows.append((tid, typ, text))
    rows.sort(key=lambda r: r[0])

    # Räkna: när en reset kommer, hur många olösta larm finns sedan senaste reset?
    open_alarms = []
    pending_per_reset = []
    for tid, typ, text in rows:
        if text.lower().startswith("alarm reset"):
            pending_per_reset.append(len(open_alarms))
            open_alarms = []  # Reset clears all
        else:
            open_alarms.append((tid, typ, text))

    if pending_per_reset:
        from statistics import median
        print(f"Antal reset-händelser: {len(pending_per_reset)}")
        print(f"Median antal larm sedan föregående reset: {median(pending_per_reset)}")
        print(f"Snitt: {sum(pending_per_reset)/len(pending_per_reset):.2f}")
        print(f"Max: {max(pending_per_reset)}")
        print(f"Reset utan föregående larm: "
              f"{sum(1 for n in pending_per_reset if n == 0)}")
        print(f"Reset med exakt 1 öppet larm: "
              f"{sum(1 for n in pending_per_reset if n == 1)}")
        print(f"Larm efter sista reset (omatchade): {len(open_alarms)}")


if __name__ == "__main__":
    main()
