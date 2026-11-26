# /// script
# requires-python = ">=3.12"
# dependencies = ["pandas==2.2.3"]
# ///
"""Evidence for the "massive" night and intercept-rate definitions (issue #5).

Run from anywhere:  uv run pipeline/audit/definitions.py

Reads data/raw/ and data/reference/, prints the figures quoted in the
"Definitions evidence" appendix of docs/data-audit.md, and writes nothing. The
row rules here are the ones that note describes. The strikes pipeline (#7) owns
the real implementation.
"""

import re
import sys
import warnings
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DAILY = ROOT / "data" / "raw" / "missile_attacks_daily.csv"
CLASSES = ROOT / "data" / "reference" / "weapon_classes.csv"
MAPPING = ROOT / "data" / "reference" / "model_classes.csv"

# Source accounts that report for the whole Armed Forces or the Air Force.
NATIONAL_ACCOUNTS = {"kpszsu", "CinCAFU", "GeneralStaff.ua"}
MISSILE_CLASSES = ["cruise", "ballistic", "aeroballistic_hypersonic", "antiship_other"]
RESTRICTION_START = pd.Timestamp("2026-08-11")  # first end date with a `hidden` row
MIN_LAUNCHED = 10
CUTOFFS = ["2024-12-31", "2025-06-30", "2025-12-31", "2026-06-30"]


def section(title):
    print(f"\n{'=' * 8} {title} {'=' * 8}")


def account(source):
    s = re.sub(r"^https?://(www\.)?(t\.me/|facebook\.com/)?", "", str(source).strip())
    return s.split("/")[0]


def load():
    for path in (DAILY, CLASSES, MAPPING):
        if not path.exists():
            sys.exit(f"Missing {path}. See data/README.md.")
    d = pd.read_csv(DAILY, encoding="utf-8")
    classes = pd.read_csv(CLASSES, encoding="utf-8-sig")
    mapping = pd.read_csv(MAPPING, encoding="utf-8-sig")
    d["class"] = d.model.map(dict(zip(mapping.model, mapping["class"])))
    if d["class"].isna().any():
        sys.exit(f"Unmapped model strings: {sorted(set(d.model[d['class'].isna()]))}")

    start_text, end_text = d.time_start.str.strip(), d.time_end.str.strip()
    start = pd.to_datetime(start_text, format="mixed")
    end = pd.to_datetime(end_text, format="mixed")
    d["date"] = end.dt.normalize()
    d["day_report"] = (
        (start_text.str.len() > 10) & (end_text.str.len() > 10)
        & (start.dt.normalize() == d.date)
        & start.dt.hour.between(5, 12) & (end.dt.hour >= 15)
    )
    d["account"] = d.source.map(account)
    d["hidden"] = d.status_data == "hidden"
    counted = set(classes["class"][classes.counts_in_totals == "yes"])
    d["counted"] = d["class"].isin(counted)
    return d


def totals(rows):
    """Launched by attack date. Unknown (hidden or blank) counts add nothing."""
    return rows[~rows.hidden].dropna(subset=["launched"]).groupby("date").launched.sum()


def above(series, q=0.95):
    return series[series > series.quantile(q)]


def top_by_year(nights, q=0.95):
    return nights[nights > nights.groupby(nights.index.year).transform("quantile", q)]


def top_trailing(nights, q=0.95, days=365, min_nights=100):
    chosen, first = [], None
    for date, value in nights.items():
        window = nights[(nights.index < date) & (nights.index >= date - pd.Timedelta(days=days))]
        if len(window) >= min_nights:
            first = first or date
            if value > window.quantile(q):
                chosen.append(date)
    return nights[chosen], first


def by_year(selected):
    return {int(k): int(v) for k, v in selected.groupby(selected.index.year).size().items()}


def main():
    # pandas 2.2.3 trips a NumPy deprecation inside its own Timedelta arithmetic.
    warnings.filterwarnings("ignore", message=".*generic.*timedelta.*")
    sys.stdout.reconfigure(encoding="utf-8")
    pd.set_option("display.width", 200)
    d = load()
    counted = d[d.counted]
    national = counted[counted.account.isin(NATIONAL_ACCOUNTS)]
    night_rows = national[~national.day_report]
    nights = totals(night_rows)

    section("Which rows count")
    for label, rows in (("counted classes, all accounts", counted),
                        ("national accounts only", national),
                        ("... and target 'Ukraine' only", national[national.target == "Ukraine"]),
                        ("national accounts, day reports out (proposed nights)", night_rows)):
        n = totals(rows)
        print(f"{label}: rows {len(rows)}, launched {int(n.sum())}, dates {len(n)}, "
              f"median {n.median():.0f}, 95th pct {n.quantile(0.95):.1f}, "
              f"over it {len(above(n))}, dates >= 100: {int((n >= 100).sum())}")
    dropped = counted[~counted.account.isin(NATIONAL_ACCOUNTS)]
    print("rows from other accounts:", len(dropped), "| launched", int(dropped.launched.sum()),
          "| of that, Geran:", int(dropped.launched[dropped.model.str.startswith("Geran")].sum()),
          "| rows with destroyed == launched:",
          int((dropped.launched == dropped.destroyed).sum()))
    day = national[national.day_report]
    day_by_year = day.groupby(day.date.dt.year).launched.sum()
    print("day reports (start 05-12h, end the same day from 15h): rows", len(day),
          "| launched", int(day.launched.sum()),
          "| by year", {int(k): int(v) for k, v in day_by_year.items()},
          "| dates", day.date.nunique(), "| dates that also have a night:",
          len(set(day.date) & set(nights.index)))
    merged = totals(national)
    for label, pick in (("all-period top 5%", above), ("calendar-year top 5%", top_by_year)):
        a, b = set(pick(nights).index), set(pick(merged).index)
        print(f"merging day reports in, {label}: {len(a)} -> {len(b)} dates, {len(a & b)} in both")

    section("Salvo size by year (proposed nights)")
    print(nights.groupby(nights.index.year).describe(percentiles=[0.5, 0.75, 0.95])
          .round(0).astype(int).to_string())

    section("What each definition of 'massive' selects")
    missiles = (night_rows[(night_rows["class"] != "shahed_drone") & ~night_rows.hidden]
                .groupby("date").launched.sum().reindex(nights.index, fill_value=0))
    trailing, first = top_trailing(nights)
    options = {
        "fixed 100+": nights[nights >= 100],
        "fixed 300+": nights[nights >= 300],
        "all-period top 5%": above(nights),
        "calendar-year top 5%": top_by_year(nights),
        "trailing-365-day top 5%": trailing,
        "30+ missiles (counted non-Shahed, incl. mixed)": nights[missiles >= 30],
    }
    sizes = by_year(nights)
    print("nights per year:", sizes)
    print("trailing window can first classify a night on", first.date())
    for label, chosen in options.items():
        counts = by_year(chosen)
        share = {y: f"{counts.get(y, 0) / sizes[y]:.0%}" for y in sizes}
        print(f"\n{label}: {len(chosen)} nights, smallest {int(chosen.min())} launched")
        print("  by year:", counts, "\n  share of year:", share)
    thresholds = nights.groupby(nights.index.year).quantile(0.95)
    print("\ncalendar-year thresholds (massive = more than this):",
          {int(k): round(v, 1) for k, v in thresholds.items()})
    yearly = set(options["calendar-year top 5%"].index)
    for label, chosen in options.items():
        print(f"in both calendar-year top 5% and {label}: {len(yearly & set(chosen.index))}")
    print("\nlargest nights:")
    for date, value in nights.nlargest(5).items():
        print(f"  {date.date()}: {int(value)} launched, {int(missiles[date])} missiles")

    section("Stability: add data and see which labels survive")
    final_all = set(above(nights).index)
    final_year = set(top_by_year(nights).index)
    for cutoff in CUTOFFS:
        known = nights[:cutoff]
        then = above(known)
        year = known[known.index.year == pd.Timestamp(cutoff).year]
        year_then = above(year)
        print(f"data to {cutoff}: all-period threshold {known.quantile(0.95):.0f}, "
              f"{len(then)} massive, {len(set(then.index) & final_all)} still massive now | "
              f"that year to date: threshold {year.quantile(0.95):.0f}, "
              f"{len(year_then)} massive, "
              f"{len(set(year_then.index) & final_year)} still massive now")
    print(f"data to the snapshot: all-period threshold {nights.quantile(0.95):.0f}")
    print("fixed, trailing-window and missile-count labels never change when later data is added.")

    section("Mixed rows on massive nights (A3)")
    for label in ("calendar-year top 5%", "all-period top 5%"):
        on = night_rows[night_rows.date.isin(options[label].index) & ~night_rows.hidden]
        share = on.launched[on["class"] == "mixed"].sum() / on.launched.sum()
        missile_rows = on[on["class"] != "shahed_drone"]
        missile_share = (missile_rows.launched[missile_rows["class"] == "mixed"].sum()
                         / missile_rows.launched.sum())
        print(f"{label}: mixed rows hold {share:.1%} of launched, "
              f"{missile_share:.1%} of non-Shahed launched")

    section("Intercept rate: rows left out")
    print("hidden:", int(national.hidden.sum()),
          "| their published destroyed:", int(national.destroyed[national.hidden].sum()))
    blank = ~national.hidden & (national.launched.isna() | national.destroyed.isna())
    print("not hidden, blank launched or destroyed:", int(blank.sum()))
    over = ~national.hidden & (national.destroyed > national.launched)
    print("not hidden, destroyed > launched:", int(over.sum()))
    eligible = national[~national.hidden & ~blank & ~over]

    section(f"Intercept rate: class-months with at least {MIN_LAUNCHED} eligible launches")
    monthly = (eligible.assign(month=eligible.date.dt.to_period("M"))
               .groupby(["class", "month"])[["launched", "destroyed"]].sum())
    for name, group in monthly.groupby(level=0):
        shown = {m: int((group.launched >= m).sum()) for m in (1, 10, 20, 30)}
        recent = group[group.index.get_level_values(1) >= pd.Period("2026-08", "M")]
        print(f"{name}: months with launches {shown[1]}, at least 10: {shown[10]}, "
              f"20: {shown[20]}, 30: {shown[30]} | Aug 2026 on, at least 10: "
              f"{int((recent.launched >= MIN_LAUNCHED).sum())} of {len(recent)}")

    section("Missile rows before and after the restriction (not hidden)")
    rows = eligible[eligible["class"].isin(MISSILE_CLASSES) & (eligible.launched > 0)]
    period = pd.cut(
        rows.date,
        [pd.Timestamp("2022-01-01"), pd.Timestamp("2025-08-10"),
         RESTRICTION_START - pd.Timedelta(days=1), pd.Timestamp("2027-01-01")],
        labels=["to Aug 10, 2025", "year before restriction", "from Aug 11, 2026"])
    table = rows.assign(period=period, all_destroyed=rows.launched == rows.destroyed).groupby(
        ["class", "period"], observed=True).agg(
        rows=("model", "size"), all_destroyed=("all_destroyed", "sum"),
        launched=("launched", "sum"), destroyed=("destroyed", "sum"))
    print(table.to_string())

    section("B3: eligible launches by class and month around March 2025")
    around = monthly.launched.unstack(0).loc[pd.Period("2024-12", "M"):pd.Period("2025-06", "M")]
    print(around.fillna(0).astype(int).to_string())

    section("A4: dates with no night")
    calendar = pd.date_range(nights.index.min(), nights.index.max())
    absent = calendar.difference(nights.index)
    print(len(absent), "of", len(calendar), "| by year:", by_year(pd.Series(0, index=absent)))

    section("E3: months with both strike and alert figures")
    both = pd.period_range("2022-10", "2026-07", freq="M")
    print(f"{both[0]} to {both[-1]}: {len(both)} full months "
          f"(September 2022 strike data starts on the 28th)")


if __name__ == "__main__":
    main()
