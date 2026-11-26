# /// script
# requires-python = ">=3.12"
# dependencies = ["pandas==2.2.3", "tzdata==2025.2"]
# ///
"""Rerunnable Phase 0 audit of the air-raid sirens data (issue #2).

Run from anywhere:  uv run pipeline/audit/alerts.py

Reads data/raw/ and prints the figures quoted in docs/data-audit.md. It writes
no files and keeps raw column names. The roll-up measures below are candidates
being compared, not the pipeline (#8). Months are Kyiv-time calendar months.
"""

import hashlib
import sys
from collections import defaultdict
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
OFFICIAL = RAW / "official_data_en.csv"
VOLUNTEER = RAW / "volunteer_data_en.csv"
KYIV = ZoneInfo("Europe/Kyiv")

# Left out of totals: the permanent alerts there aren't listed.
EXCLUDED = {"Luhanska oblast", "Avtonomna Respublika Krym"}
CITY = "Kyiv City"
SAMPLE = ["Kharkivska oblast", CITY, "Lvivska oblast", "Dnipropetrovska oblast"]

MEASURES = {
    "sum_rows": "every row added up (double counts)",
    "oblast_only": "oblast-level rows only",
    "any_part": "union of all rows: any part of the oblast",
    "any_raion": "union of oblast and raion rows",
    "raion_avg": "mean over raions of (oblast + that raion's rows)",
    "raion_avg_h": "raion_avg, hromada rows counted for their whole raion",
    "all_raions": "time when every raion was covered at once",
    "volunteer": "volunteer file, union",
    "vol_no_naive": "volunteer file, union without naive rows",
}


def section(title):
    print(f"\n{'=' * 8} {title} {'=' * 8}")


def table(frame, digits=1):
    print(frame.round(digits).to_string())


def pct(part, whole):
    return f"{part:,}/{whole:,} ({part / whole:.1%})" if whole else "0/0"


# ---- intervals (integer seconds since the epoch) ----

def merge(intervals):
    out = []
    for start, end in sorted(intervals):
        if out and start <= out[-1][1]:
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return out


def covered_by_all(unions):
    """Intervals during which every one of several merged lists is active."""
    events = sorted(
        [(s, 1) for u in unions for s, _ in u] + [(e, -1) for u in unions for _, e in u]
    )
    out, depth, since = [], 0, None
    for time, step in events:
        depth += step
        if depth == len(unions) and since is None:
            since = time
        elif depth < len(unions) and since is not None:
            out.append((since, time))
            since = None
    return out


def month_edges(first, last):
    starts = pd.date_range(first, last, freq="MS")
    return [
        (d.strftime("%Y-%m"), int(d.tz_localize(KYIV).timestamp()),
         int((d + pd.offsets.MonthBegin(1)).tz_localize(KYIV).timestamp()))
        for d in starts
    ]


EDGES = month_edges("2022-02-01", "2026-12-01")
EDGE_STARTS = pd.Index([e[1] for e in EDGES])


def monthly_hours(intervals):
    hours = defaultdict(float)
    for start, end in intervals:
        i = EDGE_STARTS.searchsorted(start, side="right") - 1
        while i < len(EDGES) and EDGES[i][1] < end:
            month, lo, hi = EDGES[i]
            hours[month] += (min(end, hi) - max(start, lo)) / 3600
            i += 1
    return hours


def pairs(frame):
    return list(zip(frame["s"], frame["e"]))


def seconds(column):
    stamps = pd.to_datetime(column, utc=True, format="ISO8601")
    elapsed = stamps - pd.Timestamp(0, tz="UTC")
    return elapsed.dt.total_seconds().astype("int64")


def load(path):
    frame = pd.read_csv(path, encoding="utf-8", dtype=str, keep_default_na=False)
    if "naive" in frame:
        unknown = set(frame["naive"]) - {"True", "False"}
        if unknown:
            sys.exit(f"Unexpected naive values: {unknown}")
    frame["s"] = seconds(frame["started_at"])
    frame["e"] = seconds(frame["finished_at"])
    return frame


def when(stamp):
    return pd.Timestamp(stamp, unit="s").strftime("%Y-%m-%d %H:%M")


def describe(name, frame, area, raw_columns):
    section(f"{name}: shape, coverage, integrity")
    path = OFFICIAL if name == "official" else VOLUNTEER
    print("sha256", hashlib.sha256(path.read_bytes()).hexdigest())
    print(f"rows {len(frame):,}; columns {raw_columns}")
    print("first start", when(frame.s.min()), "| last start", when(frame.s.max()),
          "| last end", when(frame.e.max()), "(UTC)")
    for column in ("started_at", "finished_at"):
        print(column, "offsets:", frame[column].str[-6:].value_counts().to_dict())
    blanks = {c: int((frame[c] == "").sum()) for c in raw_columns}
    print("blank values:", blanks)
    length = frame.e - frame.s
    print(f"negative durations {(length < 0).sum()}; zero {(length == 0).sum()}; "
          f"over 24 h {(length > 86400).sum()}; longest {length.max() / 86400:.1f} days")
    print(f"{area} values: {frame[area].nunique()}; excluded rows:",
          frame[frame[area].isin(EXCLUDED)][area].value_counts().to_dict())


def same_place_overlaps(frame, keys):
    ordered = frame.sort_values(keys + ["s", "e"])
    previous_end = ordered.groupby(keys)["e"].cummax().groupby(
        [ordered[k] for k in keys]).shift()
    return int((ordered.s < previous_end).sum())


def duplicates(official, raw_columns):
    section("official: exact duplicate rows")
    counts = official.groupby(raw_columns).size()
    print(f"distinct rows {len(counts):,}; copies per distinct row:",
          counts.value_counts().sort_index().to_dict())
    month = official.started_at.str[:7]
    extra = official.duplicated(raw_columns)
    by_month = pd.DataFrame({"rows": month.value_counts(),
                             "extra_copies": month[extra].value_counts()}).fillna(0)
    table(by_month.sort_index().astype(int), 0)
    duplicated_starts = official[official.duplicated(raw_columns, keep=False)]
    print("last start that has a copy:", when(duplicated_starts.s.max()))


def gaps(name, frame):
    starts = frame.s.sort_values().drop_duplicates()
    step = starts.diff()
    print(f"{name}: gaps over 18 h between consecutive alert starts anywhere")
    for index in step[step > 18 * 3600].index:
        end = starts.loc[index]
        print(f"   {when(end - step.loc[index])} -> {when(end)} "
              f"({step.loc[index] / 3600:.1f} h)")


def naive_alerts(volunteer):
    section("volunteer: naive=True (assumed end) alerts")
    flag = volunteer.naive == "True"
    print("naive rows", pct(int(flag.sum()), len(volunteer)))
    print("naive durations in minutes:",
          ((volunteer[flag].e - volunteer[flag].s) / 60).round(2).value_counts().to_dict())
    print(f"median minutes where the end was observed: "
          f"{(volunteer[~flag].e - volunteer[~flag].s).median() / 60:.1f}; mean "
          f"{(volunteer[~flag].e - volunteer[~flag].s).mean() / 60:.1f}")
    for label, key in (("year", volunteer.started_at.str[:4]),
                       ("month", volunteer.started_at.str[:7]),
                       ("region", volunteer.region)):
        grouped = flag.groupby(key).agg(["size", "sum", "mean"])
        grouped.columns = ["rows", "naive", "share"]
        print(f"\nby {label}")
        table(grouped, 3)


def permanent(official, volunteer):
    section("permanent alerts: what is listed for Luhansk and Crimea")
    for name, frame, area in (("official", official, "oblast"),
                              ("volunteer", volunteer, "region")):
        rows = frame[frame[area].isin(EXCLUDED)]
        print(name)
        for _, row in rows.sort_values("s").iterrows():
            print(f"   {row[area]}: {row.started_at} -> {row.finished_at}")
        crimea = frame[area].str.contains("Krym|Crimea|Sevastopol", case=False).sum()
        print("   rows naming Crimea or Sevastopol:", int(crimea))


def stale_ends(official):
    section("official: ends that may be assumed (not flagged in the file)")
    hour = official[(official.e - official.s) == 3600]
    print("distinct rows lasting exactly 3600 s:", len(hour),
          hour.started_at.str[:4].value_counts().sort_index().to_dict())
    length = official.e - official.s
    print("\nlongest official rows")
    longest = official.assign(days=length / 86400).nlargest(10, "days")
    table(longest[["oblast", "raion", "hromada", "level", "started_at", "days"]])
    long_rows = official[length > 86400]
    print("rows over 24 h by level:", long_rows.level.value_counts().to_dict())


def roll_up(official, volunteer):
    results = {}
    raion_counts = {}
    for oblast, rows in official[~official.oblast.isin(EXCLUDED)].groupby("oblast"):
        whole = rows[rows.level == "oblast"]
        raions = sorted(set(rows.raion) - {""}) if oblast != CITY else []
        raion_counts[oblast] = max(len(raions), 1)
        out = {
            "sum_rows": monthly_hours(pairs(rows)),
            "oblast_only": monthly_hours(merge(pairs(whole))),
            "any_part": monthly_hours(merge(pairs(rows))),
            "any_raion": monthly_hours(merge(pairs(rows[rows.level != "hromada"]))),
        }
        for measure, levels in (("raion_avg", ["raion"]),
                                ("raion_avg_h", ["raion", "hromada"])):
            unions = [
                merge(pairs(whole) + pairs(rows[(rows.raion == r) & rows.level.isin(levels)]))
                for r in raions
            ] or [merge(pairs(rows))]
            total = defaultdict(float)
            for union in unions:
                for month, value in monthly_hours(union).items():
                    total[month] += value / len(unions)
            out[measure] = total
            if measure == "raion_avg":
                out["all_raions"] = monthly_hours(
                    merge(covered_by_all(unions) + pairs(whole)))
        results[oblast] = out
    for oblast, rows in volunteer[~volunteer.region.isin(EXCLUDED)].groupby("region"):
        results[oblast]["volunteer"] = monthly_hours(merge(pairs(rows)))
        results[oblast]["vol_no_naive"] = monthly_hours(
            merge(pairs(rows[rows.naive != "True"])))
    records = [
        (oblast, measure, month, hours)
        for oblast, measures in results.items()
        for measure, months in measures.items()
        for month, hours in months.items()
    ]
    long = pd.DataFrame(records, columns=["oblast", "measure", "month", "hours"])
    wide = long.pivot_table(index=["oblast", "month"], columns="measure",
                            values="hours", aggfunc="sum").fillna(0)
    # An oblast-month with no rows in a source is zero here.
    return wide.reindex(columns=list(MEASURES), fill_value=0), raion_counts


def comparisons(wide, raion_counts):
    section("roll-up: setup")
    for key, text in MEASURES.items():
        print(f"{key:13} {text}")
    print("raions per oblast, from names seen in the official file:", raion_counts)
    print("areas compared:", wide.index.get_level_values("oblast").nunique())

    national = wide.groupby("month").mean()
    section("mean hours per area per month (unweighted mean over areas)")
    print("2022-02, 2022-03 and 2026-09 are partial months in the official file; "
          "2026-11 is partial in the volunteer file.")
    table(national, 0)

    periods = {
        "2023": ("2023-01", "2023-12"),
        "2024": ("2024-01", "2024-12"),
        "2025-01..06": ("2025-01", "2025-06"),
        "2025-07..11": ("2025-07", "2025-11"),
        "2025-12..2026-07": ("2025-12", "2026-07"),
    }
    section("mean hours per area per month, by period")
    by_period = pd.DataFrame({
        label: national.loc[lo:hi].mean() for label, (lo, hi) in periods.items()})
    table(by_period.T)

    section("same, as a ratio to the volunteer union")
    table(by_period.div(by_period.loc["volunteer"]).T, 2)

    for oblast in SAMPLE:
        section(f"{oblast}: mean hours per month, by period")
        one = wide.loc[oblast]
        table(pd.DataFrame({
            label: one.loc[lo:hi].mean() for label, (lo, hi) in periods.items()}).T)

    section("per area, Dec 2025 to Jul 2026: mean hours per month")
    window = wide[wide.index.get_level_values("month").to_series(index=wide.index)
                  .between("2025-12", "2026-07")]
    table(window.groupby("oblast").mean()[
        ["raion_avg", "raion_avg_h", "any_raion", "any_part", "volunteer"]], 0)

    section("rank of areas, Dec 2025 to Jul 2026: Spearman correlation with raion_avg")
    means = window.groupby("oblast").mean()
    print(means.rank().corr()["raion_avg"].round(2).to_string())

    for label in ("2023", "2024", "2025-01..06"):
        lo, hi = periods[label]
        months = wide.index.get_level_values("month")
        part = wide[(months >= lo) & (months <= hi)].groupby("oblast").mean()[
            ["oblast_only", "volunteer"]]
        part["volunteer_over_official"] = part.volunteer / part.oblast_only
        section(f"before the switch, by area, {label}: official oblast-level vs volunteer")
        table(part.sort_values("volunteer_over_official"), 2)

    section("share of any_raion hours also covered by oblast-level rows, by month")
    share = (wide.oblast_only / wide.any_raion.where(wide.any_raion > 0)).unstack("oblast")
    print("median over areas")
    table(share.median(axis=1).loc["2025-01":], 2)
    print("\nfirst month from which the share stays under 50% (Kyiv City has no raions)")
    for oblast in share.columns:
        series = share[oblast].dropna()
        later_max = series[::-1].cummax()[::-1]
        under = later_max[later_max < 0.5]
        print(f"   {oblast}: {under.index[0] if len(under) else 'never'}")

    section("naive volunteer alerts: effect on volunteer hours")
    effect = national[["volunteer", "vol_no_naive"]].copy()
    effect["share_from_naive"] = 1 - effect.vol_no_naive / effect.volunteer
    yearly = effect.groupby(effect.index.str[:4])[["volunteer", "vol_no_naive"]].sum()
    yearly["share_from_naive"] = 1 - yearly.vol_no_naive / yearly.volunteer
    table(yearly, 3)
    area_total = wide.groupby("oblast")[["volunteer", "vol_no_naive"]].sum()
    print("\nlargest effect by area, all months")
    table((1 - area_total.vol_no_naive / area_total.volunteer)
          .sort_values(ascending=False).head(6), 3)
    month_area = 1 - wide.vol_no_naive / wide.volunteer.where(wide.volunteer > 0)
    print("\nlargest effect on a single area-month (with at least 20 volunteer hours)")
    table(month_area[wide.volunteer >= 20].sort_values(ascending=False).head(8), 3)

    section("agreement before the switch: oblast_only vs volunteer, 2023-2024 area-months")
    early = wide[[("2023-01" <= m <= "2024-12") for m in wide.index.get_level_values("month")]]
    difference = (early.volunteer - early.oblast_only) / early.oblast_only
    print(difference.describe().round(3).to_string())
    print("share of area-months within 5%:", round((difference.abs() <= 0.05).mean(), 3))


def long_volunteer_rows(volunteer):
    section("volunteer: very long alerts (observed ends)")
    rows = volunteer[~volunteer.region.isin(EXCLUDED)]
    length = rows.e - rows.s
    year = rows.started_at.str[:4]
    summary = pd.DataFrame({
        "rows_over_12h": (length > 12 * 3600).groupby(year).sum(),
        "rows_over_24h": (length > 24 * 3600).groupby(year).sum(),
        "hours_in_over_12h": length.where(length > 12 * 3600, 0).groupby(year).sum() / 3600,
        "all_hours": length.groupby(year).sum() / 3600,
    })
    summary["share"] = summary.hours_in_over_12h / summary.all_hours
    table(summary, 3)
    print("\nrows over 24 h")
    table(rows[length > 24 * 3600].assign(days=length / 86400)[
        ["region", "started_at", "finished_at", "naive", "days"]].sort_values("started_at"))


def official_gap(official, volunteer):
    section("the late-August 2026 hole: starts per day, 2026-08-26 to 2026-09-07")
    days = pd.DataFrame({
        name: frame.started_at.str[:10].value_counts()
        for name, frame in (("official_distinct", official), ("volunteer", volunteer))})
    table(days.reindex(pd.date_range("2026-08-26", "2026-09-07").strftime("%Y-%m-%d"))
          .fillna(0).astype(int), 0)
    lo, hi = (int(pd.Timestamp(t, tz="UTC").timestamp())
              for t in ("2026-08-29 05:00", "2026-09-02 13:00"))
    for name, frame in (("official", official), ("volunteer", volunteer)):
        active = frame[(frame.s < hi) & (frame.e > lo)]
        print(f"{name}: rows active at some time from 08-29 05:00 to 09-02 13:00 UTC:",
              len(active))


def start_offsets(official, volunteer):
    section("UTC check: nearest volunteer start to each oblast-level official start")
    whole = official[official.level == "oblast"]
    left = whole.rename(columns={"oblast": "area"})[["area", "s"]].astype({"s": "int64"})
    right = volunteer.rename(columns={"region": "area"})[["area", "s"]].astype({"s": "int64"})
    right["vs"] = right.s
    matched = pd.merge_asof(left.sort_values("s"), right.sort_values("s"), on="s",
                            by="area", direction="nearest", tolerance=6 * 3600).dropna()
    offset = matched.vs - matched.s
    month = pd.to_datetime(matched.s, unit="s").dt.month
    for label, months in (("Nov-Mar (Kyiv UTC+2)", [11, 12, 1, 2, 3]),
                          ("Apr-Oct (mostly UTC+3)", [4, 5, 6, 7, 8, 9, 10])):
        part = offset[month.isin(months)]
        print(f"{label}: matched {len(part):,}; median offset {part.median():.0f} s; "
              f"within 5 min {(part.abs() <= 300).mean():.1%}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    for path in (OFFICIAL, VOLUNTEER):
        if not path.exists():
            sys.exit(f"Missing {path}. See data/README.md.")
    official_raw = load(OFFICIAL)
    volunteer = load(VOLUNTEER)
    official_columns = [c for c in official_raw.columns if c not in ("s", "e")]
    volunteer_columns = [c for c in volunteer.columns if c not in ("s", "e")]

    describe("official", official_raw, "oblast", official_columns)
    print("level:", official_raw.level.value_counts().to_dict())
    print("source:", official_raw.source.value_counts().to_dict())
    duplicates(official_raw, official_columns)
    official = official_raw.drop_duplicates(official_columns)
    section("official after removing exact copies")
    print("rows", f"{len(official):,}", "| level:", official.level.value_counts().to_dict())
    for level in ("oblast", "raion", "hromada"):
        print(f"same-place overlaps at {level} level:", same_place_overlaps(
            official[official.level == level], ["oblast", "raion", "hromada"]))
    month = official.started_at.str[:7]
    print("\ndistinct rows by start month and level")
    table(pd.crosstab(month, official.level), 0)

    describe("volunteer", volunteer, "region", volunteer_columns)
    print("exact duplicate rows:", int(volunteer.duplicated(volunteer_columns).sum()))
    print("same-region overlaps:", same_place_overlaps(volunteer, ["region"]))

    section("coverage gaps")
    gaps("official", official)
    gaps("volunteer", volunteer)
    official_gap(official, volunteer)

    start_offsets(official, volunteer)
    permanent(official, volunteer)
    stale_ends(official)
    naive_alerts(volunteer)
    long_volunteer_rows(volunteer)
    comparisons(*roll_up(official, volunteer))


if __name__ == "__main__":
    main()
