#!/usr/bin/env python3
"""PDF-rapportgenerator för sopsuganläggningen.

Kompilerar alla analysresultat till en professionell A4-rapport
med fpdf2 och DejaVuSans (svenska tecken).

Krav: Kör trendanalys.py och rekommendationer.py först.

Output:
  - output/rapport_2025.pdf
"""

import json
from pathlib import Path

import matplotlib
import pandas as pd
from fpdf import FPDF

from common import OUTPUT_DIR, ensure_output_dir


# ---------------------------------------------------------------------------
# Font
# ---------------------------------------------------------------------------

def get_font_path():
    """Hittar DejaVuSans.ttf via matplotlib."""
    mpl_data = Path(matplotlib.get_data_path())
    font_path = mpl_data / "fonts" / "ttf" / "DejaVuSans.ttf"
    if font_path.exists():
        return str(font_path)
    for p in [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf"),
    ]:
        if p.exists():
            return str(p)
    return None


def get_font_bold_path():
    """Hittar DejaVuSans-Bold.ttf."""
    mpl_data = Path(matplotlib.get_data_path())
    font_path = mpl_data / "fonts" / "ttf" / "DejaVuSans-Bold.ttf"
    if font_path.exists():
        return str(font_path)
    return None


# ---------------------------------------------------------------------------
# PDF-klass
# ---------------------------------------------------------------------------

class RapportPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(15, 15, 15)

        font_path = get_font_path()
        bold_path = get_font_bold_path()
        if font_path:
            self.add_font("DejaVu", "", font_path)
            if bold_path:
                self.add_font("DejaVu", "B", bold_path)
            self.default_font = "DejaVu"
        else:
            self.default_font = "Helvetica"
            print("  OBS: DejaVuSans hittades inte — svenska tecken kanske inte renderas korrekt")

    def header(self):
        if self.page_no() > 1:
            self.set_font(self.default_font, "", 7)
            self.set_text_color(128, 128, 128)
            self.cell(0, 5, "Driftsanalys Sopsuganläggning — Årsrapport 2025", align="L")
            self.cell(0, 5, f"Sida {self.page_no()}", align="R", new_x="LMARGIN", new_y="NEXT")
            self.line(15, 20, 195, 20)
            self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font(self.default_font, "", 7)
        self.set_text_color(128, 128, 128)
        self.cell(0, 5, "Konfidentiellt — Sopsuganläggningen", align="C")

    def section_title(self, title, level=1):
        if level == 1:
            self.set_font(self.default_font, "B", 16)
            self.set_text_color(33, 33, 33)
            self.ln(5)
            self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(33, 150, 243)
            self.set_line_width(0.5)
            self.line(15, self.get_y(), 195, self.get_y())
            self.ln(5)
        else:
            self.set_font(self.default_font, "B", 12)
            self.set_text_color(66, 66, 66)
            self.ln(3)
            self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
            self.ln(2)

    def body_text(self, text):
        self.set_font(self.default_font, "", 10)
        self.set_text_color(33, 33, 33)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def add_image_full(self, path, caption=None):
        if not Path(path).exists():
            self.body_text(f"[Bild saknas: {Path(path).name}]")
            return
        self.image(str(path), x=20, w=170)
        if caption:
            self.set_font(self.default_font, "", 8)
            self.set_text_color(100, 100, 100)
            self.cell(0, 5, caption, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(3)

    def add_table(self, headers, rows, col_widths=None):
        if not col_widths:
            available = 180
            col_widths = [available / len(headers)] * len(headers)

        # Header
        self.set_font(self.default_font, "B", 8)
        self.set_fill_color(33, 150, 243)
        self.set_text_color(255, 255, 255)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 7, str(h), border=1, fill=True, align="C")
        self.ln()

        # Rows
        self.set_font(self.default_font, "", 8)
        self.set_text_color(33, 33, 33)
        for row_idx, row in enumerate(rows):
            if row_idx % 2 == 0:
                self.set_fill_color(245, 245, 245)
            else:
                self.set_fill_color(255, 255, 255)

            if self.get_y() + 7 > 277:
                self.add_page()
                self.set_font(self.default_font, "B", 8)
                self.set_fill_color(33, 150, 243)
                self.set_text_color(255, 255, 255)
                for i, h in enumerate(headers):
                    self.cell(col_widths[i], 7, str(h), border=1, fill=True, align="C")
                self.ln()
                self.set_font(self.default_font, "", 8)
                self.set_text_color(33, 33, 33)
                if row_idx % 2 == 0:
                    self.set_fill_color(245, 245, 245)
                else:
                    self.set_fill_color(255, 255, 255)

            for i, val in enumerate(row):
                self.cell(col_widths[i], 7, str(val), border=1, fill=True, align="C")
            self.ln()
        self.ln(3)

    def add_kpi_box(self, label, value, color):
        """KPI-indikator med färg."""
        r, g, b = color
        self.set_fill_color(r, g, b)
        self.set_text_color(255, 255, 255)
        self.set_font(self.default_font, "B", 11)
        x = self.get_x()
        y = self.get_y()
        self.rect(x, y, 55, 18, "F")
        self.set_xy(x + 2, y + 2)
        self.cell(51, 6, label, align="C")
        self.set_xy(x + 2, y + 9)
        self.set_font(self.default_font, "B", 14)
        self.cell(51, 7, str(value), align="C")
        self.set_xy(x + 58, y)
        self.set_text_color(33, 33, 33)


# ---------------------------------------------------------------------------
# Sektioner
# ---------------------------------------------------------------------------

def add_title_page(pdf):
    pdf.add_page()
    pdf.ln(50)
    pdf.set_font(pdf.default_font, "B", 28)
    pdf.set_text_color(33, 33, 33)
    pdf.cell(0, 15, "Driftsanalys", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 15, "Sopsuganläggning", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    pdf.set_font(pdf.default_font, "", 18)
    pdf.set_text_color(100, 100, 100)
    pdf.ln(5)
    pdf.set_draw_color(33, 150, 243)
    pdf.set_line_width(1)
    pdf.line(60, pdf.get_y(), 150, pdf.get_y())
    pdf.ln(10)
    pdf.set_font(pdf.default_font, "B", 16)
    pdf.set_text_color(33, 150, 243)
    pdf.cell(0, 10, "Årsrapport 2025", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(40)
    pdf.set_font(pdf.default_font, "", 10)
    pdf.set_text_color(128, 128, 128)
    pdf.cell(0, 5, "Automatgenererad rapport baserad på driftsdata jan–dec 2025", align="C",
             new_x="LMARGIN", new_y="NEXT")


def add_summary_section(pdf, data, recs):
    pdf.add_page()
    pdf.section_title("Sammanfattning")

    pdf.body_text(
        "Denna sektion ger en överblick över anläggningens prestanda under 2025. "
        "De tre KPI-rutorna nedan visar årets viktigaste nyckeltal. "
        "Grön färg = bra, orange = behöver uppmärksamhet, röd = kritiskt."
    )

    # KPI-boxar
    anl_df = data.get("anlaggning", pd.DataFrame())
    ventiler_df = data.get("ventiler", pd.DataFrame())

    if not anl_df.empty:
        total_kwh = anl_df["Energi_kWh"].sum()
        pdf.add_kpi_box("Total energi", f"{total_kwh:,.0f} kWh", (33, 150, 243))

    if not ventiler_df.empty:
        avg_tillg = ventiler_df.groupby("Ventil_ID")["Tillganglighet"].mean().mean()
        color = (76, 175, 80) if avg_tillg >= 99 else (255, 152, 0) if avg_tillg >= 95 else (244, 67, 54)
        pdf.add_kpi_box("Tillgänglighet", f"{avg_tillg:.1f}%", color)

    if not anl_df.empty and "Tomningar" in anl_df.columns:
        total_tom = int(anl_df["Tomningar"].sum())
        pdf.add_kpi_box("Tömningar", f"{total_tom:,}", (156, 39, 176))

    pdf.ln(22)

    # Nyckelfynd
    pdf.section_title("Nyckelfynd", level=2)
    findings = []

    if not anl_df.empty:
        trend_cols = [c for c in anl_df.columns if c == "Energi_kWh_trend_class"]
        if trend_cols:
            tc = anl_df[trend_cols[0]].iloc[0]
            findings.append(f"Energiförbrukning: {tc} trend under året "
                          f"({anl_df['Energi_kWh'].iloc[0]:,.0f} → {anl_df['Energi_kWh'].iloc[-1]:,.0f} kWh)")

    if not ventiler_df.empty:
        n_valves = ventiler_df["Ventil_ID"].nunique()
        total_errors = ventiler_df["Totala_fel"].sum()
        findings.append(f"{n_valves} ventiler analyserade med totalt {total_errors:,} fel under året")

    anomalier_df = data.get("anomalier", pd.DataFrame())
    if not anomalier_df.empty:
        n_anom = len(anomalier_df)
        findings.append(f"{n_anom} anomalier detekterade (inkl. larmspikar)")

    grenar_df = data.get("grenar", pd.DataFrame())
    if not grenar_df.empty:
        kritiska = grenar_df[grenar_df["halsopoang"] < 70]
        if not kritiska.empty:
            findings.append(f"{len(kritiska)} grenar med kritisk hälsopoäng (under 70)")

    if not findings:
        findings.append("Ingen data tillgänglig för sammanfattning")

    for i, f in enumerate(findings, 1):
        pdf.body_text(f"{i}. {f}")

    # Topp-prioriteringar
    pdf.section_title("Topp-3 prioriteringar", level=2)
    for i, r in enumerate(recs[:3], 1):
        prio_label = {1: "AKUT", 2: "HÖG", 3: "MEDEL", 4: "LÅG"}.get(r["prioritet"], "?")
        pdf.body_text(f"{i}. [{prio_label}] {r['mal']}: {r['rekommendation']}")


def add_energy_section(pdf, data):
    pdf.section_title("Energi & effektivitet")

    pdf.body_text(
        "Energisektionen visar anläggningens totala elförbrukning, hur effektivt energin "
        "används per tömning, och hur fraktionsfördelningen ser ut över året."
    )
    pdf.body_text(
        "Graferna visar: Energiförbrukning per månad med trendlinje "
        "och glidande medelvärde MA(3) — titta efter om trenden är minskande (bra) eller "
        "ökande (utred orsak). kWh per tömning — ett mått på energieffektivitet; lägre "
        "är bättre. Tömningar per fraktion som areadiagram — visar säsongsmönster. "
        "Scatter-plot energi vs tömningar — stark korrelation (r>0.7) är normalt."
    )
    pdf.body_text(
        "Brytpunkter: Energiförbrukning över 100 000 kWh/månad bör utredas. "
        "kWh per tömning under 20 är bra, 20-30 acceptabelt, över 30 ineffektivt."
    )

    anl_df = data.get("anlaggning", pd.DataFrame())
    if anl_df.empty:
        pdf.body_text("Ingen energidata tillgänglig.")
        return

    pdf.add_image_full(OUTPUT_DIR / "trend_energi_forbrukning.png", "Energiförbrukning + trend")
    pdf.add_image_full(OUTPUT_DIR / "trend_energi_effektivitet.png", "Energieffektivitet (kWh/tömning)")
    pdf.add_image_full(OUTPUT_DIR / "trend_energi_fraktioner.png", "Tömningar per fraktion")
    pdf.add_image_full(OUTPUT_DIR / "trend_energi_korrelation.png", "Energi vs tömningar")

    pdf.section_title("Månadsöversikt", level=2)
    headers = ["Månad", "kWh", "Tömningar", "kWh/tömn", "Larm"]
    rows = []
    for _, r in anl_df.iterrows():
        rows.append([
            r["Manad"],
            f"{r['Energi_kWh']:,.0f}",
            f"{r.get('Tomningar', 0):,.0f}",
            f"{r.get('kWh_per_tomning', 0):.2f}",
            f"{r.get('Larm_totalt', 0):,.0f}",
        ])
    pdf.add_table(headers, rows, [30, 40, 35, 35, 40])

    pdf.section_title("Analys", level=2)
    trend_cols = [c for c in anl_df.columns if c == "Energi_kWh_trend_class"]
    if trend_cols:
        tc = anl_df[trend_cols[0]].iloc[0]
        pdf.body_text(f"Energitrend: {tc}. "
                     f"Förbrukningen gick från {anl_df['Energi_kWh'].iloc[0]:,.0f} kWh i januari "
                     f"till {anl_df['Energi_kWh'].iloc[-1]:,.0f} kWh i december.")


def add_valve_section(pdf, data):
    pdf.section_title("Ventilanalys")

    pdf.body_text(
        "Ventilanalysen visar tillgänglighet och felmönster för anläggningens alla ventiler. "
        "Varje ventil identifieras med formatet 'gren:ventilnr' (t.ex. 24:11 = gren 24, ventil 11)."
    )
    pdf.body_text(
        "Graferna visar: Medeltillgänglighet per månad med min/max-band — "
        "smalt band = stabil drift, brett band = stor variation. Feltyper per månad — "
        "LONG_TIME_SINCE_LAST_COLLECTION är vanligast men minst kritisk. "
        "DOES_NOT_OPEN och DOES_NOT_CLOSE är kritiska mekaniska fel. "
        "Topp-10 sämsta ventiler — 'spaghetti-plot' som visar individuella trender. "
        "Felfördelning — histogram som visar att de flesta ventiler har få fel."
    )
    pdf.body_text(
        "Brytpunkter: Tillgänglighet under 95% är kritisk, 95-99% krävs uppmärksamhet, "
        "över 99% är bra. Ventiler med över 50 fel/år bör prioriteras för underhåll."
    )

    ventiler_df = data.get("ventiler", pd.DataFrame())
    if ventiler_df.empty:
        pdf.body_text("Ingen ventildata tillgänglig.")
        return

    pdf.add_image_full(OUTPUT_DIR / "trend_ventiler_tillganglighet.png", "Tillgänglighet per månad")
    pdf.add_image_full(OUTPUT_DIR / "trend_ventiler_feltyper.png", "Feltyper per månad")
    pdf.add_image_full(OUTPUT_DIR / "trend_ventiler_samsta.png", "Topp-10 sämsta ventiler")
    pdf.add_image_full(OUTPUT_DIR / "trend_ventiler_felfordelning.png", "Felfördelning")

    pdf.section_title("Sämsta ventiler (årsmedel)", level=2)
    avg_per = ventiler_df.groupby("Ventil_ID").agg(
        tillg=("Tillganglighet", "mean"),
        fel=("Totala_fel", "sum"),
        gren=("Gren", "first"),
    ).sort_values("tillg").head(15).reset_index()

    headers = ["Ventil", "Gren", "Tillg (%)", "Fel (totalt)"]
    rows = []
    for _, r in avg_per.iterrows():
        rows.append([
            r["Ventil_ID"],
            str(int(r["gren"])) if pd.notna(r["gren"]) else "?",
            f"{r['tillg']:.1f}",
            f"{r['fel']:,.0f}",
        ])
    pdf.add_table(headers, rows, [40, 30, 50, 60])


def add_branch_section(pdf, data):
    pdf.section_title("Grenanalys")

    pdf.body_text(
        "Grenanalysen aggregerar ventildata per gren (rörledningssegment). "
        "Varje gren betjänar ett område och innehåller flera ventiler. "
        "Hälsopoängen är ett sammanvägt mått (0-100) baserat på: "
        "tillgänglighet (50%), felfrekvens per ventil (30%) och trend (20%)."
    )
    pdf.body_text(
        "Graferna visar: Hälsopoäng-ranking — röd <70 (kritisk), orange 70-85 "
        "(behöver åtgärd), grön >85 (bra). Tillgänglighets-heatmap per gren och månad — "
        "mörka rutor (grönt) är bra, ljusa/röda rutor visar problem. "
        "Titta efter grenar med genomgående ljusare färg."
    )
    pdf.body_text(
        "Brytpunkter: Hälsopoäng under 70 kräver akut åtgärd, 70-85 planerat underhåll, "
        "över 85 normal drift. Grenar med fler än 50 fel/ventil/år är problematiska."
    )

    grenar_df = data.get("grenar", pd.DataFrame())
    if grenar_df.empty:
        pdf.body_text("Ingen grendata tillgänglig.")
        return

    pdf.add_image_full(OUTPUT_DIR / "trend_grenar_halsopoang.png", "Hälsopoäng per gren")
    pdf.add_image_full(OUTPUT_DIR / "trend_grenar_heatmap.png", "Tillgänglighets-heatmap per gren")

    pdf.section_title("Grenranking", level=2)
    headers = ["Gren", "Ventiler", "Tillg (%)", "Fel/ventil", "Hälsopoäng", "Trend"]
    rows = []
    for _, r in grenar_df.sort_values("halsopoang").iterrows():
        rows.append([
            str(int(r["Gren"])),
            str(int(r["antal_ventiler"])),
            f"{r['medel_tillg']:.1f}",
            f"{r['fel_per_ventil']:.0f}",
            f"{r['halsopoang']:.0f}",
            r.get("trend_class", "?"),
        ])
    pdf.add_table(headers, rows, [20, 25, 30, 35, 35, 35])

    worst3 = grenar_df.head(3)
    if not worst3.empty:
        pdf.section_title("Spotlight: Sämsta grenarna", level=2)
        for _, r in worst3.iterrows():
            pdf.body_text(
                f"Gren {int(r['Gren'])}: Hälsopoäng {r['halsopoang']:.0f}, "
                f"tillgänglighet {r['medel_tillg']:.1f}%, "
                f"{r['fel_per_ventil']:.0f} fel/ventil, "
                f"sämsta ventil: {r.get('samsta_ventil', '?')}. "
                f"Trend: {r.get('trend_class', '?')}."
            )


def add_alarm_section(pdf, data):
    pdf.section_title("Larmanalys")

    pdf.body_text(
        "Larmsektionen visar hur många larm anläggningen genererat per månad, uppdelat "
        "på kategori (General, Critical, Total stop). General-larm är informativa, "
        "Critical kräver uppmärksamhet, och Total stop innebär att anläggningen stoppats."
    )
    pdf.body_text(
        "Graferna visar: Larmtrend med anomalimarkörer — röd '!' markerar månader "
        "med statistiskt avvikande larmantal (z-score > 2). Trendlinjen visar om larmen "
        "ökar eller minskar. 2025 jämfört med föregående års snitt — "
        "lägre staplar än det grå snittet är positivt."
    )
    pdf.body_text(
        "Anomalitabellen visar månader där larmantalet avviker kraftigt från normalt. "
        "Z-score över 2.0 innebär att värdet ligger mer än 2 standardavvikelser från medel. "
        "Sådan månad bör utredas — vad hände som orsakade spiken?"
    )
    pdf.body_text(
        "Korrelationstabellen visar samband mellan olika mått. Pearson r nära +1 eller -1 "
        "innebär starkt samband, nära 0 inget samband. Stark korrelation tömningar-larm "
        "är vanligt (fler tömningar = fler tillfällen för larm)."
    )

    pdf.add_image_full(OUTPUT_DIR / "trend_larm_trend.png", "Larmtrend med anomalier")
    pdf.add_image_full(OUTPUT_DIR / "trend_larm_jamforelse.png", "Larm: 2025 vs föregående år")

    anomalier_df = data.get("anomalier", pd.DataFrame())
    if not anomalier_df.empty:
        larm_anom = anomalier_df[anomalier_df["mal"] == "larm_manad"]
        if not larm_anom.empty:
            pdf.section_title("Larmanomalier", level=2)
            headers = ["Månad", "Antal larm", "Z-score", "Typ"]
            rows = []
            for _, a in larm_anom.iterrows():
                rows.append([
                    str(a.get("label", "?")),
                    f"{a.get('varde', 0):.0f}",
                    f"{a.get('z_score', 0):.1f}",
                    str(a.get("typ", "?")),
                ])
            pdf.add_table(headers, rows, [45, 45, 45, 45])

    korr_df = data.get("korrelationer", pd.DataFrame())
    if not korr_df.empty:
        pdf.section_title("Korrelationer", level=2)
        headers = ["Par", "Pearson r", "Tolkning"]
        rows = []
        for _, r in korr_df.iterrows():
            rows.append([
                str(r.get("Par", "")),
                f"{r.get('pearson_r', 0):.3f}" if pd.notna(r.get("pearson_r")) else "N/A",
                str(r.get("tolkning", "")),
            ])
        pdf.add_table(headers, rows, [70, 40, 70])


def add_manual_section(pdf, data):
    pdf.section_title("Manuella körningar")

    pdf.body_text(
        "Manuella körningar (MAN_OPEN_CMD) är ett mått på hur väl anläggningens automatik "
        "fungerar. När en ventil inte öppnas automatiskt måste en operatör öppna den manuellt. "
        "Hög manuell andel tyder på problem med automatiken."
    )
    pdf.body_text(
        "KPI-rutorna visar: Manuell andel (grön <3%, orange 3-10%, röd >10%), "
        "totalt antal manuella kommandon, och totalt antal kommandon (manuella + automatiska)."
    )
    pdf.body_text(
        "Graferna visar: Staplat diagram med manuella (röd) vs automatiska (grön) kommandon. "
        "Svart linje = MAN per drifttimme (normaliserat mått). Manuell andel över tid med "
        "trendlinje — minskande trend är positivt. Topp-15 ventiler med högst manuell "
        "andel — röd >50%, orange >20%, grön <20%. Manuell andel per gren."
    )
    pdf.body_text(
        "Brytpunkter: Under 3% manuell andel är normalt, 3-10% bör övervakas, "
        "över 10% kräver åtgärd. Ventiler med över 20% manuell andel och 100% tillgänglighet "
        "är 'dolda risker' — operatörer kompenserar för problemet."
    )

    man_df = data.get("manuell_analys", pd.DataFrame())
    man_v = data.get("manuell_ventiler", pd.DataFrame())

    # KPI-boxar
    if not man_df.empty:
        total_man = int(man_df["MAN_totalt"].sum())
        total_all = int(man_df["Total_CMD"].sum())
        ars_andel = total_man / total_all * 100 if total_all > 0 else 0
        color = (76, 175, 80) if ars_andel < 3 else (255, 152, 0) if ars_andel < 10 else (244, 67, 54)
        pdf.add_kpi_box("Manuell andel", f"{ars_andel:.1f}%", color)
        pdf.add_kpi_box("Manuella CMD", f"{total_man:,}", (33, 150, 243))
        pdf.add_kpi_box("Totala CMD", f"{total_all:,}", (100, 100, 100))
        pdf.ln(22)

    pdf.add_image_full(OUTPUT_DIR / "manuell_kommandon.png", "Manuella vs automatiska kommandon")
    pdf.add_image_full(OUTPUT_DIR / "manuell_trend.png", "Manuell andel — trend")
    pdf.add_image_full(OUTPUT_DIR / "manuell_topp_ventiler.png", "Topp-15 ventiler med högst manuell andel")
    pdf.add_image_full(OUTPUT_DIR / "manuell_grenar.png", "Manuell andel per gren")

    if not man_df.empty:
        pdf.section_title("Månadsöversikt", level=2)
        headers = ["Månad", "MAN", "AUTO", "Totalt", "MAN %", "MAN/drifth", "Ventiler m MAN"]
        rows = []
        for _, r in man_df.iterrows():
            rows.append([
                r["Manad"],
                f"{r['MAN_totalt']:,.0f}",
                f"{r['AUTO_totalt']:,.0f}",
                f"{r['Total_CMD']:,.0f}",
                f"{r['Manuell_andel_%']:.1f}",
                f"{r.get('MAN_per_drifttimme', 0):.3f}",
                f"{r.get('Ventiler_med_MAN', 0):.0f}",
            ])
        pdf.add_table(headers, rows, [22, 22, 24, 24, 22, 30, 36])

    if not man_v.empty:
        pdf.section_title("Ventiler med högst manuell andel", level=2)
        top10 = man_v[man_v["Total_CMD"] > 10].head(10)
        if not top10.empty:
            headers = ["Ventil", "Gren", "MAN", "Totalt", "MAN %", "Tillg %"]
            rows = []
            for _, r in top10.iterrows():
                rows.append([
                    r["Ventil_ID"],
                    str(int(r["Gren"])),
                    f"{r['MAN_totalt']:,.0f}",
                    f"{r['Total_CMD']:,.0f}",
                    f"{r['Manuell_andel_%']:.1f}",
                    f"{r['Medel_tillg']:.1f}" if pd.notna(r["Medel_tillg"]) else "?",
                ])
            pdf.add_table(headers, rows, [28, 20, 25, 28, 28, 28])

    if not man_df.empty:
        pdf.section_title("Analys", level=2)

        first = man_df.iloc[0]["Manuell_andel_%"]
        last = man_df.iloc[-1]["Manuell_andel_%"]
        if first > last:
            pdf.body_text(
                f"Manuell andel minskade från {first:.1f}% i januari till {last:.1f}% i december, "
                f"vilket indikerar att anläggningens automatik förbättrats under året."
            )
        elif last > first:
            pdf.body_text(
                f"Manuell andel ökade från {first:.1f}% i januari till {last:.1f}% i december, "
                f"vilket kan tyda på ökande problem med automatiken."
            )
        else:
            pdf.body_text(f"Manuell andel var stabil kring {first:.1f}% under året.")

        pdf.body_text(
            "Ventiler med hög manuell andel men 100% tillgänglighet tyder på att "
            "operatörer kompenserar för automatikproblem — dessa bör prioriteras "
            "för förebyggande underhåll."
        )


def add_drifterfarenheter_section(pdf, data):
    pdf.section_title("Detaljanalys — Felmönster & Driftkvalitet")

    pdf.body_text(
        "Denna sektion går djupare in i felmönster och korsrefererar data från "
        "flera källor: felkoder, manuella ingrepp, energiförbrukning och larm. "
        "Syftet är att identifiera rot-orsaker och dolda risker."
    )
    pdf.body_text(
        "Korrelationstabellen (feltyper vs manuella ingrepp) visar vilka feltyper "
        "som oftast leder till att operatörer måste ingripa manuellt. "
        "Pearson r > 0.5 = stark koppling, 0.3-0.5 = måttlig, <0.3 = svag. "
        "DOES_NOT_OPEN är typiskt den starkast drivande feltypen."
    )
    pdf.body_text(
        "Riskventiler är ventiler med hög manuell andel men 100% tillgänglighet. "
        "Dessa ser bra ut i statistiken men är beroende av att operatörer aktivt "
        "kompenserar — om ingripandet uteblir riskerar de plötsligt bortfall."
    )

    drift_data = data.get("drifterfarenheter", {})
    if not drift_data:
        pdf.body_text("Ingen data — kör drifterfarenheter.py först.")
        return

    # --- Huvudfynd ---
    findings = drift_data.get("huvudfynd", [])
    if findings:
        pdf.section_title("Huvudfynd", level=2)
        for i, f in enumerate(findings, 1):
            prio = f.get("prioritet", 3)
            if prio == 1:
                pdf.set_text_color(244, 67, 54)
                pdf.set_font(pdf.default_font, "B", 10)
            else:
                pdf.set_text_color(33, 33, 33)
                pdf.set_font(pdf.default_font, "B", 10)
            pdf.set_x(15)
            pdf.cell(0, 6, f"{i}. [{f.get('omrade', '')}]", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(33, 33, 33)
            pdf.body_text(f["fynd"])

    # --- Feltyper som driver manuella ingrepp ---
    man_err = drift_data.get("manual_vs_felkoder", {})
    korr = man_err.get("korrelationer", {})
    if korr:
        pdf.section_title("Feltyper som driver manuella ingrepp", level=2)
        pdf.body_text(
            "Korrelation mellan manuella kommandon och felkoder per ventil. "
            "Hög korrelation innebär att feltypen ofta leder till manuellt ingripande."
        )
        headers = ["Feltyp", "Pearson r", "Antal", "Signifikans"]
        rows = []
        for name, info in korr.items():
            r = info["pearson_r"]
            sig = "Stark" if abs(r) > 0.5 else "Måttlig" if abs(r) > 0.3 else "Svag"
            rows.append([
                name,
                f"{r:.3f}",
                f"{info['totalt_antal']:,}",
                sig,
            ])
        pdf.add_table(headers, rows, [60, 35, 40, 45])

        if man_err.get("drivande_feltyp"):
            pdf.body_text(
                f"Starkast drivande feltyp: {man_err['drivande_feltyp']} "
                f"(r={man_err['drivande_korrelation']:.3f})."
            )

    # --- Riskventiler ---
    risk = man_err.get("risk_ventiler", [])
    if risk:
        pdf.section_title("Riskventiler — dold automatikbrist", level=2)
        pdf.body_text(
            "Ventiler med hög manuell andel men 100% tillgänglighet. "
            "Operatörer kompenserar för automatikproblem — dessa ventiler "
            "riskerar plötsligt bortfall om ingripandet uteblir."
        )
        headers = ["Ventil", "Gren", "MAN %", "Tillg %", "Fel tot", "Dominerande fel"]
        rows = []
        for rv in risk:
            rows.append([
                rv["ventil"],
                str(rv["gren"]),
                f"{rv['manuell_andel']:.1f}",
                f"{rv['tillganglighet']:.1f}",
                str(rv["totala_fel"]),
                rv["dominerande_fel"],
            ])
        pdf.add_table(headers, rows, [28, 20, 22, 22, 25, 63])

    # --- Energieffektivitet ---
    energy = drift_data.get("energieffektivitet", {})
    if energy:
        pdf.section_title("Energieffektivitet", level=2)
        pdf.body_text(
            f"kWh per tömning: medel {energy['kwh_per_tomning_medel']:.1f}, "
            f"bäst {energy['kwh_per_tomning_min']:.1f} ({energy['basta_manad']}), "
            f"sämst {energy['kwh_per_tomning_max']:.1f} ({energy['samsta_manad']}). "
            f"Spridning {energy['spridning_pct']:.0f}%."
        )
        hf = energy.get("halvars_forandring_pct", 0)
        riktning = "bättre" if hf < 0 else "sämre"
        pdf.body_text(
            f"H2 var {abs(hf):.0f}% {riktning} än H1. "
            f"Korrelation energi/drifttid: r={energy['korrelation_energi_drifttid']['r']:.2f}."
        )

    # --- Larm & felfördelning ---
    alarms = drift_data.get("larmmonster", {})
    if alarms:
        pdf.section_title("Larmmönster", level=2)
        pdf.body_text(
            f"Totalt {alarms['totala_larm']:,} larm under året. "
            f"Januari: {alarms['januari_larm']:,} larm "
            f"({alarms['januari_faktor_vs_resten']:.0f}x högre än övriga månaders snitt). "
            f"Feb–dec medel: {alarms['feb_dec_medel']:.0f} "
            f"(variationskoefficient {alarms['feb_dec_variationskoefficient']:.0f}%)."
        )

        fel = alarms.get("felfordelning", {})
        if fel:
            pdf.section_title("Feltypsfördelning", level=2)
            headers = ["Feltyp", "Antal", "Andel"]
            rows = []
            for name, info in fel.items():
                rows.append([name, f"{info['antal']:,}", f"{info['andel_pct']:.1f}%"])
            pdf.add_table(headers, rows, [80, 50, 50])

    # --- Manuell trend per gren ---
    mt = drift_data.get("manuell_trend", {})
    grenar = mt.get("grenar_med_hogst_manuell", [])
    if grenar:
        pdf.section_title("Grenar med högst manuell andel", level=2)
        headers = ["Gren", "MAN %", "Manuella", "Ventiler"]
        rows = []
        for g in grenar:
            rows.append([
                str(g["gren"]),
                f"{g['manuell_andel']:.1f}",
                str(g["manuella"]),
                str(g["ventiler"]),
            ])
        pdf.add_table(headers, rows, [40, 45, 50, 45])


def add_sammanfattning_section(pdf, data):
    """Anlaggningssammanfattning fran Sheet1 KPI:er."""
    pdf.section_title("Anläggningssammanfattning (Sheet1)")

    pdf.body_text(
        "Sheet1 innehåller anläggningens grundkonfiguration och översiktliga nyckeltal "
        "som rapporteras månatligen. Dessa värden är oftast statiska (antal lägenheter, "
        "antal ventiler) men kan avslöja förändringar i anläggningens omfattning."
    )
    pdf.body_text(
        "Grafen visar de mest varierande KPI:erna över året. Titta efter plötsliga "
        "förändringar — dessa kan indikera utbyggnad, nedläggning av grenar, "
        "eller förändringar i anläggningens konfiguration."
    )
    pdf.body_text(
        "Tabellen visar alla upptäckta KPI:er med min/max/medelvärde. "
        "Om Min och Max är identiska är värdet konstant under hela året."
    )

    sammanfattning = data.get("sammanfattning", pd.DataFrame())
    kpi_lista = data.get("sammanfattning_kpi_lista", pd.DataFrame())

    if sammanfattning.empty and kpi_lista.empty:
        pdf.body_text("Ingen Sheet1-data tillgänglig — kör sammanfattning.py först.")
        return

    # Visa grafer (individuella filer)
    for i in range(1, 7):
        img_path = OUTPUT_DIR / f"sammanfattning_{i}.png"
        if img_path.exists():
            pdf.add_image_full(img_path, f"Sheet1-KPI:er 2025 ({i})")

    # Numeriska KPI:er
    if not kpi_lista.empty:
        numeric = kpi_lista[kpi_lista["Typ"] == "numerisk"]
        if not numeric.empty:
            pdf.section_title("Upptäckta KPI:er", level=2)
            headers = ["KPI", "Min", "Max", "Medel", "Enhet"]
            rows = []
            for _, r in numeric.head(15).iterrows():
                rows.append([
                    str(r["KPI"])[:35],
                    f"{r['Min']:.1f}" if pd.notna(r["Min"]) else "—",
                    f"{r['Max']:.1f}" if pd.notna(r["Max"]) else "—",
                    f"{r['Medel']:.1f}" if pd.notna(r["Medel"]) else "—",
                    str(r.get("Enhet", "")),
                ])
            pdf.add_table(headers, rows, [70, 25, 25, 25, 35])


def add_fraktion_section(pdf, data):
    """Fraktionsdjupanalys: fyllnadstider, genomstromning, sasong."""
    pdf.section_title("Fraktionsanalys")

    pdf.body_text(
        "Fraktionsanalysen visar hur de olika avfallstyperna (Rest, Plastic, Organic, mixed waste) "
        "beter sig över året. Den inkluderar fyllnadstider, genomströmning och säsongsvariation."
    )
    pdf.body_text(
        "Graferna visar: Tömningar per fraktion som area — visar säsongsmönster "
        "och relativ volym. Timmar vid hög fyllnadsgrad — hur länge containern står full "
        "innan tömning. Höga värden indikerar kapacitetsbrist. Genomströmning (tömning/minut) — "
        "högre är bättre och innebär snabbare tömningscykel. kWh per tömning per fraktion — "
        "visar vilka fraktioner som är mest energikrävande. Heatmap — mörka rutor visar "
        "månader med många tömningar. Sommar vs vinter — visar säsongsvariation."
    )
    pdf.body_text(
        "Brytpunkter: Fyllnadstid över 20 timmar indikerar att containern står full för länge "
        "och tömningsfrekvensen bör ökas. Genomströmning under 0.5 tömningar/minut är lågt. "
        "Stor säsongsvariation (>30% skillnad sommar/vinter) kan motivera säsongsanpassad "
        "tömningsplan."
    )

    frak_df = data.get("fraktion_analys", pd.DataFrame())
    if frak_df.empty:
        pdf.body_text("Ingen fraktionsdata — kör fraktion_analys.py först.")
        return

    pdf.add_image_full(OUTPUT_DIR / "fraktion_tomningar.png", "Tömningar per fraktion")
    pdf.add_image_full(OUTPUT_DIR / "fraktion_fyllnad.png", "Timmar vid hög fyllnadsgrad")
    pdf.add_image_full(OUTPUT_DIR / "fraktion_genomstromning.png", "Genomströmning (tömning/minut)")
    pdf.add_image_full(OUTPUT_DIR / "fraktion_effektivitet.png", "kWh per tömning per fraktion")
    pdf.add_image_full(OUTPUT_DIR / "fraktion_heatmap.png", "Tömningar — heatmap")
    pdf.add_image_full(OUTPUT_DIR / "fraktion_sasong.png", "Sommar vs vinter")

    # Arssammanfattning per fraktion
    pdf.section_title("Årssammanfattning per fraktion", level=2)

    fraktioner = frak_df.groupby("Fraktion").agg(
        Tomningar=("Tomningar", "sum"),
        kWh=("kWh", "sum"),
        Medel_fyllnad=("Timmar_hog_fyllnad", "mean"),
        Medel_genomstromning=("Tomning_per_minut", "mean"),
    ).reset_index().sort_values("Tomningar", ascending=False)

    headers = ["Fraktion", "Tomningar", "kWh", "Medel fyllnadstid (h)", "Genomstromning"]
    rows = []
    for _, r in fraktioner.iterrows():
        rows.append([
            str(r["Fraktion"]),
            f"{r['Tomningar']:,.0f}",
            f"{r['kWh']:,.0f}" if pd.notna(r["kWh"]) else "—",
            f"{r['Medel_fyllnad']:.1f}" if pd.notna(r["Medel_fyllnad"]) else "—",
            f"{r['Medel_genomstromning']:.4f}" if pd.notna(r["Medel_genomstromning"]) else "—",
        ])
    pdf.add_table(headers, rows, [40, 30, 30, 40, 40])



def add_gren_djup_section(pdf, data):
    """Grentyper, sasongsanalys, Info-metadata."""
    pdf.section_title("Grendjupanalys")

    pdf.body_text(
        "Grendjupanalysen utvidgar grenanalysen med metadata från ventilernas Info-fält, "
        "säsongsmönster och klassificering av grentyper. Info-fältet kan innehålla "
        "platsinformation (t.ex. skola, bostäder) som förklarar avvikande mönster."
    )
    pdf.body_text(
        "Graferna visar: Tillgänglighets-heatmap — per gren per månad, röd-gul-grön skala "
        "där grönt är bra (>99%). Feltrend för topp-5 sämsta grenar — titta efter "
        "ökande trender. Manuell andel per gren — horisontella staplar, "
        "röd >20%, orange >10%. Sommar vs vinter — visar säsongspåverkan på drift. "
        "Grentyp-cirkeldiagram. Tillgänglighetsranking."
    )
    pdf.body_text(
        "Säsongstyp: 'Sommarsvacka' = trafiken minskar kraftigt på sommaren "
        "(typiskt för skolor). 'Jämn' = stabil trafik hela året (bostäder). "
        "Grenar med hög variationskoefficient (CV >30%) har ojämn belastning."
    )
    pdf.body_text(
        "Profiltabellen visar varje gren med grentyp, säsongsmönster och nyckeltal. "
        "Grenar med låg tillgänglighet OCH hög manuell andel bör prioriteras."
    )

    gren_djup = data.get("gren_djupanalys", pd.DataFrame())
    profiler = data.get("gren_profiler", pd.DataFrame())

    if gren_djup.empty and profiler.empty:
        pdf.body_text("Ingen grendjupdata — kör gren_djupanalys.py först.")
        return

    pdf.add_image_full(OUTPUT_DIR / "gren_tillganglighet_heatmap.png", "Tillgänglighets-heatmap per gren")
    pdf.add_image_full(OUTPUT_DIR / "gren_feltrend.png", "Feltrend — topp-5 sämsta grenar")
    pdf.add_image_full(OUTPUT_DIR / "gren_manuell.png", "Manuell andel per gren")
    pdf.add_image_full(OUTPUT_DIR / "gren_sasong.png", "Sommar vs vinter per gren")
    pdf.add_image_full(OUTPUT_DIR / "gren_typer.png", "Grentyper")
    pdf.add_image_full(OUTPUT_DIR / "gren_ranking.png", "Tillgänglighetsranking")

    if not profiler.empty:
        pdf.section_title("Grenprofiler", level=2)
        headers = ["Gren", "Typ", "Ventiler", "Tillg %", "Fel", "MAN %", "Sasong"]
        rows = []
        for _, r in profiler.sort_values("Medel_tillganglighet").iterrows():
            rows.append([
                str(int(r["Gren"])),
                str(r.get("Grentyp", "?")),
                str(int(r.get("Antal_ventiler", 0))),
                f"{r['Medel_tillganglighet']:.1f}" if pd.notna(r["Medel_tillganglighet"]) else "—",
                f"{r.get('Totala_fel_aret', 0):,.0f}",
                f"{r.get('Manuell_andel_%', 0):.1f}",
                str(r.get("Sasongstyp", "?")),
            ])
        pdf.add_table(headers, rows, [18, 30, 22, 22, 25, 22, 41])

        # Info-text for samsta grenar
        worst = profiler.sort_values("Medel_tillganglighet").head(5)
        has_info = worst[worst["Info"].astype(str).str.len() > 0]
        if not has_info.empty:
            pdf.section_title("Grendetaljer (sämsta grenar)", level=2)
            for _, r in has_info.iterrows():
                info_text = str(r["Info"])[:200] if pd.notna(r["Info"]) else ""
                if info_text:
                    pdf.body_text(
                        f"Gren {int(r['Gren'])} ({r.get('Grentyp', '?')}): {info_text}"
                    )


def add_recommendations_section(pdf, recs):
    pdf.section_title("Rekommendationer")

    pdf.body_text(
        "Rekommendationerna är automatiskt genererade baserat på alla föregående analyser. "
        "De är prioriterade i fyra nivåer: (1) AKUT — kräver omedelbar åtgärd, "
        "(2) HÖG PRIORITET — bör åtgärdas inom 1-3 månader, "
        "(3) MEDEL — planera in under nästa kvartal, "
        "(4) LÅG — längre sikt/optimering."
    )
    pdf.body_text(
        "Varje rekommendation innehåller: dataunderlag (vilken analys den baseras på), "
        "förväntad effekt och konkreta åtgärder. Börja med de akuta och arbeta neråt."
    )

    for prio in [1, 2, 3, 4]:
        prio_recs = [r for r in recs if r["prioritet"] == prio]
        if not prio_recs:
            continue

        prio_labels = {1: "AKUT", 2: "HÖG PRIORITET", 3: "MEDEL PRIORITET", 4: "LÅG PRIORITET"}
        pdf.section_title(f"Prioritet {prio} — {prio_labels.get(prio, '?')}", level=2)

        for r in prio_recs:
            if prio == 1:
                pdf.set_text_color(244, 67, 54)
                pdf.set_font(pdf.default_font, "B", 10)
                pdf.cell(0, 6, f"[{r['kategori']}] {r['mal']}", new_x="LMARGIN", new_y="NEXT")
                pdf.set_text_color(33, 33, 33)
            else:
                pdf.set_font(pdf.default_font, "B", 10)
                pdf.cell(0, 6, f"[{r['kategori']}] {r['mal']}", new_x="LMARGIN", new_y="NEXT")

            pdf.body_text(r["rekommendation"])

            pdf.set_font(pdf.default_font, "", 9)
            pdf.set_text_color(100, 100, 100)
            pdf.set_x(15)
            pdf.multi_cell(0, 4.5, f"Dataunderlag: {r['dataunderlag']}")
            pdf.set_x(15)
            pdf.multi_cell(0, 4.5, f"Förväntad effekt: {r['forvantad_effekt']}")
            pdf.set_text_color(33, 33, 33)

            if r["atgarder"]:
                pdf.set_font(pdf.default_font, "", 9)
                for a in r["atgarder"]:
                    pdf.set_x(15)
                    pdf.multi_cell(0, 4.5, f"   - {a}")
            pdf.ln(4)


def add_strategy_section(pdf, goals):
    pdf.section_title("Strategi & Mål")

    pdf.body_text(
        "Strategisektionen översätter analysresultaten till mätbara mål på 3, 6 och "
        "12 månaders sikt. KPI-målen är baserade på nuvarande prestanda och realistiska "
        "förbättringar. Använd tabellen för att följa upp kvartalsvis."
    )
    pdf.body_text(
        "Kvartalsfokus ger en förenklad tidplan för att prioritera rätt åtgärder "
        "i rätt ordning: först de akuta (Q1), sedan optimering (Q2), "
        "konsolidering (Q3) och uppföljning (Q4)."
    )

    if not goals:
        pdf.body_text("Inga KPI-mål definierade.")
        return

    headers = ["KPI", "Nu", "3 mån", "6 mån", "12 mån"]
    rows = []
    for g in goals:
        rows.append([
            g["KPI"],
            g["Nuvarande"],
            g["Mal_3m"],
            g["Mal_6m"],
            g["Mal_12m"],
        ])
    pdf.add_table(headers, rows, [50, 30, 30, 30, 40])

    pdf.section_title("Strategier per KPI", level=2)
    for g in goals:
        pdf.set_font(pdf.default_font, "B", 10)
        pdf.cell(0, 6, g["KPI"], new_x="LMARGIN", new_y="NEXT")
        pdf.body_text(g["Strategi"])

    pdf.section_title("Kvartalsfokus", level=2)
    pdf.body_text(
        "Q1: Akuta åtgärder — åtgärda kritiska ventiler och grenar. "
        "Installera förstärkt övervakning."
    )
    pdf.body_text(
        "Q2: Optimering — implementera energibesparingsåtgärder. "
        "Utvärdera effekt av Q1-åtgärder."
    )
    pdf.body_text(
        "Q3: Konsolidering — dokumentera framgångsrika metoder. "
        "Sprida best practice till alla grenar."
    )
    pdf.body_text(
        "Q4: Uppföljning — årsutvärdering mot KPI:er. "
        "Planera 2026 baserat på resultat."
    )


def add_agenda_appendix(pdf):
    pdf.section_title("Bilaga: Mötesagenda")

    agenda_path = OUTPUT_DIR / "operatorsagenda.txt"
    if not agenda_path.exists():
        pdf.body_text("Mötesagenda saknas — kör rekommendationer.py först.")
        return

    with open(agenda_path, "r", encoding="utf-8") as f:
        text = f.read()

    pdf.set_font(pdf.default_font, "", 9)
    pdf.set_text_color(33, 33, 33)
    for line in text.split("\n"):
        if pdf.get_y() > 270:
            pdf.add_page()
        pdf.cell(0, 4.5, line, new_x="LMARGIN", new_y="NEXT")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def load_data():
    """Laddar alla datakällor."""
    data = {}

    for name in ["trend_anlaggning", "trend_ventiler", "trend_grenar",
                  "trend_korrelationer", "trend_anomalier"]:
        path = OUTPUT_DIR / f"{name}.csv"
        if path.exists():
            data[name.replace("trend_", "")] = pd.read_csv(path)
        else:
            data[name.replace("trend_", "")] = pd.DataFrame()
            print(f"  Varning: {path} saknas")

    # Manuell analys
    for name in ["manuell_analys", "manuell_ventiler"]:
        path = OUTPUT_DIR / f"{name}.csv"
        if path.exists():
            data[name] = pd.read_csv(path)
        else:
            data[name] = pd.DataFrame()
            print(f"  Varning: {path} saknas")

    # Fas 5: Nya analyser
    for name in ["sammanfattning", "sammanfattning_kpi_lista",
                  "fraktion_analys",
                  "gren_djupanalys", "gren_profiler"]:
        path = OUTPUT_DIR / f"{name}.csv"
        if path.exists():
            data[name] = pd.read_csv(path)
        else:
            data[name] = pd.DataFrame()
            print(f"  Varning: {path} saknas")

    # Drifterfarenheter
    drift_path = OUTPUT_DIR / "drifterfarenheter.json"
    if drift_path.exists():
        with open(drift_path, "r", encoding="utf-8") as f:
            data["drifterfarenheter"] = json.load(f)
    else:
        data["drifterfarenheter"] = {}
        print(f"  Varning: {drift_path} saknas")

    # Rekommendationer
    json_path = OUTPUT_DIR / "rekommendationer.json"
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            rec_data = json.load(f)
        data["recs"] = rec_data.get("rekommendationer", [])
        data["goals"] = rec_data.get("kpi_mal", [])
    else:
        data["recs"] = []
        data["goals"] = []
        print(f"  Varning: {json_path} saknas")

    return data


def main():
    ensure_output_dir()

    print("Laddar data för PDF-rapport...")
    data = load_data()

    print("Bygger PDF...")
    pdf = RapportPDF()

    print("  1. Titelsida")
    add_title_page(pdf)

    print("  2. Sammanfattning")
    add_summary_section(pdf, data, data["recs"])

    print("  3. Anlaggningssammanfattning (Sheet1)")
    add_sammanfattning_section(pdf, data)

    print("  4. Energi & effektivitet")
    add_energy_section(pdf, data)

    print("  5. Fraktionsanalys")
    add_fraktion_section(pdf, data)

    print("  6. Ventilanalys")
    add_valve_section(pdf, data)

    print("  7. Grenanalys")
    add_branch_section(pdf, data)

    print("  8. Grendjupanalys")
    add_gren_djup_section(pdf, data)

    print("  9. Larmanalys")
    add_alarm_section(pdf, data)

    print("  10. Manuella körningar")
    add_manual_section(pdf, data)

    print("  11. Drifterfarenheter")
    add_drifterfarenheter_section(pdf, data)

    print("  12. Rekommendationer")
    add_recommendations_section(pdf, data["recs"])

    print("  13. Strategi & mål")
    add_strategy_section(pdf, data["goals"])

    print("  14. Bilaga: Mötesagenda")
    add_agenda_appendix(pdf)

    output_path = OUTPUT_DIR / "rapport_2025.pdf"
    pdf.output(str(output_path))
    print(f"\nPDF sparad: {output_path}")
    print(f"Antal sidor: {pdf.page_no()}")


if __name__ == "__main__":
    main()
