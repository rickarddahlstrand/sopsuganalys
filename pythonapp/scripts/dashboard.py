#!/usr/bin/env python3
"""Samlad dashboard för sopsugsanläggningen.

Läser output-CSV:er från de tre analysscripten och skapar
en samlad översiktsbild med 2x2 grid.

Kräver att följande script körts först:
  - scripts/energi_drift.py → output/energi_drift.csv
  - scripts/ventiler.py     → output/ventiler.csv
  - scripts/larm.py         → output/larm.csv

Output:
  - output/dashboard.png
"""

import sys

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import OUTPUT_DIR, ensure_output_dir


def load_csv(name):
    """Läser en output-CSV om den finns."""
    path = OUTPUT_DIR / name
    if not path.exists():
        print(f"Varning: {path} saknas. Kör motsvarande analysscript först.")
        return None
    return pd.read_csv(path)


def main():
    ensure_output_dir()

    energi_df = load_csv("energi_drift.csv")
    ventiler_df = load_csv("ventiler.csv")
    larm_df = load_csv("larm.csv")

    if all(df is None for df in [energi_df, ventiler_df, larm_df]):
        print("Inga CSV-filer hittades i output/. Kör analysscripten först:")
        print("  .venv/bin/python3 scripts/energi_drift.py")
        print("  .venv/bin/python3 scripts/ventiler.py")
        print("  .venv/bin/python3 scripts/larm.py")
        sys.exit(1)

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("Dashboard — Sopsuganläggningen 2025", fontsize=16, fontweight="bold")

    # 1. Energiförbrukning per månad (övre vänster)
    ax1 = axes[0, 0]
    if energi_df is not None and "Energi_kWh" in energi_df.columns:
        df = energi_df.sort_values("Månad_nr")
        ax1.bar(df["Månad"], df["Energi_kWh"], color="#2196F3")
        ax1.set_ylabel("kWh")
        ax1.bar_label(ax1.containers[0], fmt="%.0f", fontsize=6)
    ax1.set_title("Energiförbrukning per månad")

    # 2. Tömningar per månad (övre höger)
    ax2 = axes[0, 1]
    if energi_df is not None:
        # Hitta fraktionskolumner (allt utom Månad_nr, Månad, Energi_kWh, Drifttid_h)
        meta_cols = {"Månad_nr", "Månad", "Energi_kWh", "Drifttid_h"}
        frac_cols = [c for c in energi_df.columns if c not in meta_cols]
        if frac_cols:
            df = energi_df.sort_values("Månad_nr")
            df.set_index("Månad")[frac_cols].plot(kind="bar", stacked=True, ax=ax2, colormap="Set2")
            ax2.legend(fontsize=6, loc="upper left")
            ax2.tick_params(axis="x", rotation=0)
    ax2.set_title("Tömningar per månad")
    ax2.set_ylabel("Antal")

    # 3. Ventiltillgänglighet per månad (nedre vänster)
    ax3 = axes[1, 0]
    if ventiler_df is not None and "Medel_Tillgänglighet_%" in ventiler_df.columns:
        # ventiler.csv har per-ventil-data; visa fördelning
        ax3.hist(ventiler_df["Medel_Tillgänglighet_%"], bins=20, color="#4CAF50", edgecolor="white")
        ax3.set_xlabel("Tillgänglighet (%)")
        ax3.set_ylabel("Antal ventiler")
        avg = ventiler_df["Medel_Tillgänglighet_%"].mean()
        ax3.axvline(avg, color="red", linestyle="--", label=f"Medel: {avg:.1f}%")
        ax3.legend(fontsize=8)
    ax3.set_title("Ventiltillgänglighet (fördelning)")

    # 4. Totala larm per månad (nedre höger)
    ax4 = axes[1, 1]
    if larm_df is not None:
        meta_cols = {"Månad_nr", "Månad"}
        cat_cols = [c for c in larm_df.columns if c not in meta_cols]
        if cat_cols:
            df = larm_df.sort_values("Månad_nr")
            df["Totalt"] = df[cat_cols].sum(axis=1)
            ax4.bar(df["Månad"], df["Totalt"], color="#F44336")
            ax4.bar_label(ax4.containers[0], fmt="%.0f", fontsize=6)
            ax4.set_ylabel("Antal larm")
    ax4.set_title("Totala larm per månad")

    plt.tight_layout()
    output_path = OUTPUT_DIR / "dashboard.png"
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    print(f"Dashboard sparad: {output_path}")


if __name__ == "__main__":
    main()
