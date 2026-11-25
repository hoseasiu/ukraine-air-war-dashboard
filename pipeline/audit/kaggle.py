# /// script
# requires-python = ">=3.12"
# dependencies = ["pandas==2.2.3"]
# ///
"""Rerunnable Phase 0 audit of the Kaggle strike data (issue #1).

Run from anywhere:  uv run pipeline/audit/kaggle.py

Reads data/raw/ and prints the figures quoted in docs/data-audit.md. It writes
no files, keeps raw column names and does not clean or map anything. The groups
below (ballistic, reconnaissance and so on) are rough audit filters, not the
weapon-class taxonomy (#3).
"""

import ast
import hashlib
import re
import sys
from pathlib import Path

import pandas as pd

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"
DAILY = RAW / "missile_attacks_daily.csv"
REF = RAW / "missiles_and_uavs.csv"

BALLISTIC = r"Iskander-M|KN-23|Kinzhal|Zircon|C-300|C-400|Ballistic"
MISSILE = BALLISTIC + r"|Oniks|X-\d|Kalibr|Iskander-K|Banderol|Unknown Missile"
RECON = {
    "Unknown UAV", "Reconnaissance UAV", "Orlan-10", "Orlan-30", "Supercam",
    "ZALA", "Merlin-VR", "Eleron", "Granat-4", "Forpost", "Картограф",
    "Привет-82", "Фенікс", "Orlan-10 and ZALA", "Orlan-10 and Supercam",
    "Orlan-10 and ZALA and Supercam",
    "Orlan-10 and Orlan-30 and ZALA and Supercam",
}


def section(title):
    print(f"\n{'=' * 8} {title} {'=' * 8}")


def literal(value):
    """Parse the dict-like strings in the detail columns (they contain NaN)."""
    if not isinstance(value, str):
        return {}
    return ast.literal_eval(re.sub(r"\bnan\b|\bNaN\b", "None", value))


def account(source):
    """The publishing account at the start of a `source` value."""
    s = re.sub(r"^https?://(www\.)?(t\.me/|facebook\.com/)?", "", str(source).strip())
    return s.split("/")[0]


def pct(part, whole):
    return f"{part}/{whole} ({part / whole:.1%})" if whole else "0/0"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    pd.set_option("display.width", 200)
    for path in (DAILY, REF):
        if not path.exists():
            sys.exit(f"Missing {path}. See data/README.md.")

    d = pd.read_csv(DAILY, encoding="utf-8")
    ref = pd.read_csv(REF, encoding="utf-8")
    raw_columns = list(d.columns)

    section("Files")
    for path, frame in ((DAILY, d), (REF, ref)):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        print(f"{path.name}: {len(frame)} rows, {frame.shape[1]} columns, sha256 {digest}")

    section("Schema and missing values")
    for name, frame in ((DAILY.name, d), (REF.name, ref)):
        print(f"\n{name}")
        print(pd.DataFrame({
            "dtype": frame.dtypes.astype(str),
            "blank": frame.isna().sum(),
            "distinct": frame.nunique(),
        }).to_string())
    print("\nborder_crossing equal to {}:", pct(int((d.border_crossing == "{}").sum()), len(d)))

    section("Dates and time formats")
    for col in ("time_start", "time_end"):
        shapes = d[col].str.replace(r"\d", "9", regex=True).value_counts()
        print(col, shapes.to_dict())
    start = pd.to_datetime(d.time_start.str.strip(), format="mixed")
    end = pd.to_datetime(d.time_end.str.strip(), format="mixed")
    start_timed = d.time_start.str.strip().str.len() > 10
    end_timed = d.time_end.str.strip().str.len() > 10
    day = end.dt.normalize()
    span = (day - start.dt.normalize()).dt.days
    print("first time_start", start.min(), "| last time_end", end.max())
    print("end before start:", int((end < start).sum()))
    print("only one of start/end has a time:", int((start_timed != end_timed).sum()))
    print("calendar days between start and end:", span.value_counts().sort_index().to_dict())
    hours = (end - start).dt.total_seconds() / 3600
    print("windows over 24 h (both timed):", int(((hours > 24) & start_timed & end_timed).sum()))
    calendar = pd.date_range(day.min(), day.max())
    absent = calendar.difference(pd.DatetimeIndex(day.unique()))
    print("end dates with no row:", pct(len(absent), len(calendar)),
          "| latest:", absent.max().date(),
          "| by year:", pd.Series(absent.year).value_counts().sort_index().to_dict())
    print("rows by year of time_end:", day.dt.year.value_counts().sort_index().to_dict())

    section("Model strings")
    models = set(d.model)
    unmapped = sorted(models - set(ref.model))
    cyrillic = sorted(m for m in models if re.search("[Ѐ-ӿ]", m))
    print("distinct:", len(models), "| not in reference:", len(unmapped),
          "| containing Cyrillic:", len(cyrillic))
    for m in unmapped:
        print(f"  unmapped: {m} ({int((d.model == m).sum())} rows)")
    print("Cyrillic:", cyrillic)
    print("reference models never used:", sorted(set(ref.model) - models))
    print("combined strings (' and ' or a slash-joined pair of weapons):",
          sum(" and " in m for m in models))
    table = d.assign(day=day).groupby("model").agg(
        rows=("model", "size"), launched=("launched", "sum"),
        destroyed=("destroyed", "sum"), first=("day", "min"), last=("day", "max"))
    print(table.sort_values("launched", ascending=False).to_string())

    recon = d.model.isin(RECON)
    print("\nreconnaissance, tactical and unknown UAV rows:", pct(int(recon.sum()), len(d)),
          "| launched:", int(d.launched[recon].sum()),
          "| rows with launched == destroyed:",
          pct(int((d.launched[recon] == d.destroyed[recon]).sum()), int(recon.sum())))

    section("Counts: blank and inconsistent")
    L, D = d.launched, d.destroyed
    print("total launched", int(L.sum()), "| total destroyed", int(D.sum()))
    print("blank launched", int(L.isna().sum()), "| blank destroyed", int(D.isna().sum()))
    print("launched == 0:", int((L == 0).sum()),
          "| of those, not hidden:", int(((L == 0) & d.status_data.isna()).sum()))
    over = d[D > L]
    print("destroyed > launched:", len(over),
          "| of those, not hidden:", int(over.status_data.isna().sum()))
    print(over[over.status_data.isna()][["time_end", "model", "launched", "destroyed"]]
          .to_string(index=False))

    section("Rows, reports, repeats and overlaps")
    acct = d.source.map(account)
    print("rows by source account:", acct.value_counts().to_dict())
    print("exact duplicate rows:", int(d[raw_columns].duplicated().sum()))
    key = ["time_start", "time_end", "model"]
    print("rows sharing start, end and model:", int(d.duplicated(key, keep=False).sum()))
    full_key = key + ["launch_place", "target"]
    print("  ... and launch_place and target:", int(d.duplicated(full_key, keep=False).sum()))
    print(d[d.duplicated(full_key, keep=False)].sort_values(full_key)
          [key + ["target", "launched", "destroyed"]].to_string(index=False))

    national = (acct == "kpszsu") & (d.target == "Ukraine")
    print("\n`national` below = account kpszsu and target 'Ukraine' (an audit filter)")
    print("national rows:", pct(int(national.sum()), len(d)),
          "| share of all launched:", f"{L[national].sum() / L.sum():.1%}")
    windows = d[national].assign(day=day[national]).groupby("day")[["time_start", "time_end"]] \
        .apply(lambda g: len(g.drop_duplicates()))
    print("end dates by number of distinct national windows:",
          windows.value_counts().sort_index().to_dict())
    shahed_nat = national & (d.model == "Shahed-136/131")
    per_day = day[shahed_nat].value_counts()
    print("end dates with 2+ national Shahed rows:", int((per_day > 1).sum()))
    timed = d[national & start_timed & end_timed].assign(
        start=start[national & start_timed & end_timed],
        end=end[national & start_timed & end_timed])
    overlaps = []
    for model, group in timed.groupby("model"):
        spans = sorted(set(zip(group.start, group.end)))
        overlaps += [(model, a, b) for i, a in enumerate(spans)
                     for b in spans[i + 1:] if b[0] < a[1]]
    print("overlapping national windows for the same model:", len(overlaps))
    for model, a, b in overlaps:
        print(f"  {model}: {a[0]} to {a[1]}  /  {b[0]} to {b[1]}")
    daytime = start_timed & end_timed & (span == 0) & start.dt.hour.between(5, 12) \
        & end.dt.hour.ge(15) & national
    print("national daytime windows (start 05-12h, end same day from 15h):",
          len(d[daytime][["time_start", "time_end"]].drop_duplicates()),
          "| first:", day[daytime].min().date(), "| in 2026-11:",
          len(d[daytime & (end >= "2026-11-01")][["time_start", "time_end"]].drop_duplicates()))

    section("Regional Geran rows against national Shahed rows (same window)")
    geran = d[d.model.str.startswith("Geran")]
    print("Geran rows:", len(geran), "| accounts:", acct[geran.index].value_counts().to_dict(),
          "| targets:", geran.target.value_counts().to_dict(),
          "| launched:", int(geran.launched.sum()),
          "| destroyed:", int(geran.destroyed.sum()),
          "| first:", day[geran.index].min().date())
    nat_windows = set(map(tuple, d[shahed_nat][["time_start", "time_end"]].values))
    matched = sum((s, e) in nat_windows for s, e in geran[["time_start", "time_end"]].values)
    print("Geran rows whose window equals a national Shahed window:", pct(matched, len(geran)))
    south = (acct == "PvKPivden")
    nat_days = set(day[shahed_nat])
    south_shahed = south & (d.model == "Shahed-136/131")
    print("southern-command Shahed rows:", int(south_shahed.sum()),
          "| on an end date that also has a national Shahed row:",
          int(day[south_shahed].isin(nat_days).sum()))

    section("A3: launch_place coverage")
    has_place = d.launch_place.notna()
    print("rows:", pct(int(has_place.sum()), len(d)))
    print("share of launched with a launch_place:", f"{L[has_place].sum() / L.sum():.1%}")
    print("national rows:", pct(int((has_place & national).sum()), int(national.sum())))
    multi = d.launch_place.str.contains(" and ", na=False)
    print("share of launched in rows listing several places:", f"{L[multi].sum() / L.sum():.1%}")
    recent = national & (end >= "2026-01-01")
    print("2026 national: share of launched with a place:",
          f"{L[recent & has_place].sum() / L[recent].sum():.1%}",
          "| in multi-place rows:", f"{L[recent & multi].sum() / L[recent].sum():.1%}")
    tokens = d.launch_place.dropna().str.split(" and ").explode().str.strip()
    print("distinct place tokens:", tokens.nunique())
    print("carrier filled:", pct(int(d.carrier.notna().sum()), len(d)))
    for col in ("launched_details", "launch_place_details"):
        print(f"{col} filled:", int(d[col].notna().sum()))

    section("A2/B2: sensitivity of nightly totals (provisional filters only)")
    attack = d[~recon].assign(day=day[~recon])
    for label, frame in (("all non-recon rows", attack),
                         ("national rows only", attack[national[~recon]])):
        nightly = frame.groupby("day").launched.sum()
        print(f"{label}: nights {len(nightly)}, median {nightly.median():.0f}, "
              f"95th pct {nightly.quantile(0.95):.0f}, "
              f"nights >= 100: {int((nightly >= 100).sum())}")
        print("  nights >= 100 by year:",
              nightly[nightly >= 100].groupby(lambda t: t.year).size().to_dict())
        print("  95th percentile by year:",
              nightly.groupby(lambda t: t.year).quantile(0.95).round().astype(int).to_dict())

    section("A5: not_reach_goal, is_shahed, destroyed_types, launched_details")
    for col in ("not_reach_goal", "is_shahed", "destroyed_types", "launched_details"):
        has = d[col].notna()
        print(f"{col}: {int(has.sum())} rows, {day[has].min().date()} to {day[has].max().date()}")
    is_rows = d[d.is_shahed.notna()]
    ratio = is_rows.is_shahed / is_rows.launched
    print("is_shahed models:", is_rows.model.value_counts().to_dict())
    print("is_shahed > launched:", int((ratio > 1).sum()),
          "| ratio median", round(ratio.median(), 3),
          "| multiples of 5:", pct(int((is_rows.is_shahed % 5 == 0).sum()), len(is_rows)))
    keys = pd.Series([k for v in d.destroyed_types.dropna() for k in literal(v)])
    print("destroyed_types keys:", keys.value_counts().to_dict())
    tj = d.destroyed_types.map(lambda v: literal(v).get("Turbojet", {}))
    tj_l = tj.map(lambda x: x.get("launched")).astype(float)
    tj_d = tj.map(lambda x: x.get("destroyed")).astype(float)
    print("Turbojet rows:", int(tj_l.notna().sum()), "| with destroyed:", int(tj_d.notna().sum()),
          "| Turbojet launched > row launched:", int((tj_l > L).sum()),
          "| Turbojet destroyed > Turbojet launched:", int((tj_d > tj_l).sum()))
    print(d[tj_d > tj_l][["time_end", "destroyed_types"]].to_string(index=False))

    monthly = d[shahed_nat].assign(month=end[shahed_nat].dt.to_period("M"), tj_l=tj_l[shahed_nat])
    monthly["tj_base"] = monthly.launched.where(monthly.tj_l.notna())
    coverage = monthly.groupby("month").agg(
        rows=("model", "size"), launched=("launched", "sum"),
        not_reach_goal=("not_reach_goal", "count"), is_shahed=("is_shahed", "count"),
        turbojet_rows=("tj_l", "count"), turbojet=("tj_l", "sum"),
        launched_in_turbojet_rows=("tj_base", "sum"))
    print("\nNational Shahed-136/131 rows by month")
    print(coverage[coverage.index >= pd.Period("2024-07", "M")].to_string())

    banderol_inside = d.destroyed_types.str.contains("Banderol", na=False)
    own = d[d.model.str.startswith("Banderol")]
    own_windows = set(map(tuple, own[["time_start", "time_end"]].values))
    inside = d[banderol_inside]
    print("\nBanderol inside a Shahed row's destroyed_types:", len(inside), "rows,",
          day[inside.index].min().date(), "to", day[inside.index].max().date(),
          "| Banderol own rows:", len(own),
          "| same window has both:",
          sum((s, e) in own_windows for s, e in inside[["time_start", "time_end"]].values))

    section("Ballistic and other restricted missile data")
    hidden = d.status_data == "hidden"
    print("status_data values:", d.status_data.value_counts(dropna=False).to_dict())
    print("hidden rows:", int(hidden.sum()), "| end dates:", day[hidden].nunique(),
          "| first:", day[hidden].min().date(), "| last:", day[hidden].max().date())
    print("hidden with launched == 0:", int((hidden & (L == 0)).sum()),
          "| hidden with launched > 0:", int((hidden & (L > 0)).sum()),
          "| hidden with destroyed > 0:", int((hidden & (D > 0)).sum()),
          "(destroyed sum", int(D[hidden].sum()), ")")
    print(d[hidden][["time_end", "model", "launched", "destroyed"]].to_string(index=False))
    restricted = end >= day[hidden].min()
    for label, pattern in (("ballistic-capable", BALLISTIC), ("any missile", MISSILE)):
        group = d.model.str.contains(pattern, regex=True)
        after = group & restricted
        print(f"\n{label} rows from first hidden date: {int(after.sum())}, "
              f"hidden {int((after & hidden).sum())}, "
              f"published launched {int(L[after & ~hidden].sum())}")
        print("  national rows only: ", int((after & national).sum()),
              "rows, hidden", int((after & national & hidden).sum()),
              ", published launched", int(L[after & national & ~hidden].sum()))
        by_month = d[group].assign(
            month=end[group].dt.to_period("M"), is_hidden=hidden[group],
            published=L[group].where(~hidden[group]))
        summary = by_month.groupby("month").agg(
            rows=("model", "size"), hidden_rows=("is_hidden", "sum"),
            published_launched=("published", "sum"))
        print(summary[summary.index >= pd.Period("2025-08", "M")].to_string())


if __name__ == "__main__":
    main()
