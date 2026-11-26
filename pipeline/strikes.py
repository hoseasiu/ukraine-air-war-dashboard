"""The strike tables, `nights` and `monthly_by_class` (#7).

The rules are the Phase 0 definitions (docs/data-audit.md#definitions):

- Only classes with `counts_in_totals = yes`, and only national military reports.
- **A night is keyed by the Kyiv date its reports end on.** An overnight report
  that starts on March 4 and ends on March 5 belongs to the night of March 5.
  Daytime reports aren't part of a night. Monthly figures include them.
- A `hidden` row's counts are unknown, and so is a blank count. Unknown is never zero.
- "Destroyed" and intercept rates use only rows where both counts are usable.
- A massive night had more weapons launched than 95% of the nights in its calendar year.

Counts are added as integers. `reconcile` then checks the finished tables
against the raw rows, so a lost or doubled row stops the build.
"""

import re
from datetime import date

import pandas as pd

from pipeline.errors import PipelineError
from pipeline.sources import KAGGLE_DAILY

# The account at the start of a report's `source` link. National military accounts
# report for the whole Air Force or Armed Forces. The others are left out because
# they may repeat national figures. An account in neither list stops the build.
NATIONAL_ACCOUNTS = frozenset({"kpszsu", "CinCAFU", "GeneralStaff.ua"})
OTHER_ACCOUNTS = frozenset({
    "PvKPivden", "pvkshid", "PvkZahid", "PvkCenter", "war_monitor", "ChiefUkrDIU",
    "kharkivoda.gov.ua",
})
# Facebook video links don't name an account. They're only accepted in excluded
# classes, so that a counted report can't drop out unnoticed.
UNNAMED_ACCOUNT = "watch"
SOURCE_PREFIX = r"^https?://(www\.)?(t\.me/|facebook\.com/)?"

# A missile-reporting restriction. The first `hidden` rows end on this date. Keep in
# step with BALLISTIC_RESTRICTION_FROM in site/src/chart/flags.ts (a test checks it).
RESTRICTION_FROM = date(2026, 8, 11)
# Missile classes have no intercept rate from this month on (owner, #5).
MISSILE_RATES_END_BEFORE = "2026-08"
MISSILE_CLASSES = frozenset(
    {"cruise", "ballistic", "aeroballistic_hypersonic", "antiship_other"}
)
# The only other class with its own rate. A new one needs a decision about the cut-off.
DRONE_CLASSES = frozenset({"shahed_drone"})
MIN_RATE_LAUNCHED = 10
MASSIVE_QUANTILE = 0.95

TIME = r"\d{4}-\d{2}-\d{2}( \d{1,2}:\d{2})?"
COUNT = r"(\d+(\.0)?)?"
# One upstream spelling of "Kursk" starts with the Cyrillic letter that looks like K.
LOOKALIKES = str.maketrans({"К": "K"})


# ---- reading and checking ----

def _fail_on(bad, what):
    if not bad.empty:
        raise PipelineError(
            f"{KAGGLE_DAILY}: {len(bad)} row(s) with {what}, such as {bad.iloc[0]!r}."
        )


def _times(column, name):
    text = column.str.strip()
    _fail_on(column[~text.str.fullmatch(TIME)], f"an unreadable {name}")
    try:
        return text, pd.to_datetime(text, format="mixed")
    except ValueError as error:
        raise PipelineError(f"{KAGGLE_DAILY}: impossible {name}: {error}") from error


def _counts(column, name):
    """Whole numbers, with blank as unknown (<NA>)."""
    _fail_on(column[~column.str.fullmatch(COUNT)], f"a {name} that isn't a whole number")
    return pd.to_numeric(column.where(column != "")).astype("Int64")


def account_of(source):
    return re.sub(SOURCE_PREFIX, "", source.strip()).split("/")[0]


def prepare(daily, weapons):
    """Check every row of the renamed daily file and add the columns the rules need.

    Every row is checked, including the ones the tables later leave out.
    """
    if daily.empty:
        raise PipelineError(f"{KAGGLE_DAILY} has no rows.")
    unmapped = sorted(set(daily["model"]) - set(weapons.models))
    if unmapped:
        raise PipelineError(
            f"{KAGGLE_DAILY}: no class in model_classes.csv for {unmapped}. "
            "Add each one by hand, then run pipeline/audit/weapon_classes.py."
        )
    for class_id, info in weapons.classes.items():
        if info.own_intercept_rate and class_id not in MISSILE_CLASSES | DRONE_CLASSES:
            raise PipelineError(
                f"{class_id!r} has its own intercept rate, but pipeline/strikes.py doesn't "
                "say whether the missile cut-off applies to it."
            )
    _fail_on(
        daily.loc[~daily["status_data"].isin(["", "hidden"]), "status_data"],
        "an unknown status_data value",
    )

    start_text, start = _times(daily["time_start"], "time_start")
    end_text, end = _times(daily["time_end"], "time_end")
    # A date without a time would read as midnight, so compare days unless both have one.
    timed = (start_text.str.len() > 10) & (end_text.str.len() > 10)
    backwards = (end.dt.normalize() < start.dt.normalize()) | (timed & (end < start))
    _fail_on(daily.loc[backwards, "time_end"], "a time_end before its time_start")

    frame = pd.DataFrame({
        "model": daily["model"],
        "class": daily["model"].map(weapons.models),
        "date": end.dt.date,
        "month": end.dt.strftime("%Y-%m"),
        "launched": _counts(daily["launched"], "launched"),
        "destroyed": _counts(daily["destroyed"], "destroyed"),
        "hidden": daily["status_data"] == "hidden",
        "launch_place": daily["launch_place"].str.strip().str.translate(LOOKALIKES),
        "account": daily["source"].map(account_of),
    })
    frame["counted"] = frame["class"].map(
        {c: info.counts_in_totals for c, info in weapons.classes.items()}
    ).astype(bool)

    known = NATIONAL_ACCOUNTS | OTHER_ACCOUNTS | {UNNAMED_ACCOUNT}
    unknown = sorted(set(frame["account"]) - known)
    if unknown:
        raise PipelineError(
            f"{KAGGLE_DAILY}: unknown source account(s) {unknown}. Decide whether each "
            "reports nationally, then add it to a list in pipeline/strikes.py."
        )
    unnamed = frame["counted"] & (frame["account"] == UNNAMED_ACCOUNT)
    _fail_on(
        daily.loc[unnamed, "source"], "a counted class and a source that names no account"
    )
    frame["national"] = frame["account"].isin(NATIONAL_ACCOUNTS)

    # A launch place is shown as reported, so a new non-English one needs a look.
    _fail_on(
        frame.loc[~frame["launch_place"].map(str.isascii), "launch_place"],
        "a launch_place that isn't plain English text",
    )

    # A hidden row published too early would mean the restriction flag starts too late.
    _fail_on(
        daily.loc[frame["hidden"] & (frame["date"] < RESTRICTION_FROM), "time_end"],
        f"status_data = hidden before {RESTRICTION_FROM}",
    )

    # Daytime: starts 05:00-12:59 and ends from 15:00 the same day. Both need a time.
    frame["daytime"] = (
        timed & (start.dt.date == end.dt.date) & start.dt.hour.between(5, 12)
        & (end.dt.hour >= 15)
    )
    return frame


def counted_reports(frame):
    """The rows the tables are built from, with the counts each one may add.

    `known_launched` is the launch count, unless it's unpublished or blank.
    `outcome_launched` and `outcome_destroyed` are filled only where both counts
    are published and destroyed isn't above launched.
    """
    rows = frame[frame["counted"] & frame["national"]].copy()
    rows["known_launched"] = rows["launched"].mask(rows["hidden"])
    usable = (
        ~rows["hidden"] & rows["launched"].notna() & rows["destroyed"].notna()
        & (rows["destroyed"] <= rows["launched"]).fillna(False)
    )
    rows["outcome_launched"] = rows["launched"].where(usable)
    rows["outcome_destroyed"] = rows["destroyed"].where(usable)
    return rows


# ---- adding up ----

def _total(column):
    """The sum of the known values, or None if there are none. Never a made-up zero."""
    known = column.dropna()
    return None if known.empty else int(known.sum())


def _cell(rows):
    """The figures shared by both tables, for one class on one night or in one month."""
    return {
        "launched": _total(rows["known_launched"]),
        "destroyed": _total(rows["outcome_destroyed"]),
        "launched_with_outcome": _total(rows["outcome_launched"]),
        "n_models": int(rows["model"].nunique()),
        "n_unknown_launched": int(rows["known_launched"].isna().sum()),
    }


def _flags(cell, reaches):
    return {
        "destroyed_includes_ew": cell["destroyed"] is not None,
        "ballistic_restricted": reaches >= RESTRICTION_FROM,
    }


def _by_class(rows, key, order):
    """((key, class id), rows) pairs, by key and then in the class table's order."""
    groups = rows.groupby([key, "class"], sort=False)
    return sorted(groups, key=lambda item: (item[0][0], order[item[0][1]]))


def massive_nights(totals):
    """(set of massive dates, per-year bars) from {date: weapons launched}.

    "More than" the year's 95th percentile, with linear interpolation.
    """
    series = pd.Series(totals, dtype="float64").sort_index()
    massive, years = set(), []
    for year, nights in series.groupby(lambda day: day.year):
        bar = nights.quantile(MASSIVE_QUANTILE)
        chosen = nights[nights > bar]
        massive.update(chosen.index)
        years.append({
            "year": int(year),
            "massive_above": round(float(bar), 4),
            "n_nights": len(nights),
            "n_massive": len(chosen),
            "first_night": nights.index.min().isoformat(),
            "last_night": nights.index.max().isoformat(),
        })
    return massive, years


def build_nights(rows, order):
    """(table rows, per-year bars).

    A date has a night if it has any non-daytime report. If none of a date's
    launch counts is known, its size is unknown: it stays out of the percentile
    and `is_massive` is null.
    """
    rows = rows[~rows["daytime"]]
    totals = {
        day: int(known.sum())
        for day, group in rows.groupby("date")
        if not (known := group["known_launched"].dropna()).empty
    }
    massive, years = massive_nights(totals)
    table = []
    for (day, class_id), group in _by_class(rows, "date", order):
        cell = _cell(group)
        places = group["launch_place"]
        table.append({
            "date": day.isoformat(),
            "class": class_id,
            **cell,
            "is_massive": day in massive if day in totals else None,
            # As reported. One entry can name several places, and counts can't be
            # divided between them, so there are no figures by place.
            "launch_places": sorted(set(places) - {""}),
            "launch_place_missing": bool((places == "").any()),
            **_flags(cell, day),
        })
    return table, years


def rate_for(cell, info, month):
    """(intercept rate, None) or (None, why there's no rate)."""
    if not info.own_intercept_rate:
        return None, "no_class_rate"
    if info.id in MISSILE_CLASSES and month >= MISSILE_RATES_END_BEFORE:
        return None, "missile_reporting_restricted"
    if (cell["launched_with_outcome"] or 0) < MIN_RATE_LAUNCHED:
        return None, "below_minimum"
    return round(cell["destroyed"] / cell["launched_with_outcome"], 4), None


def month_end(month):
    return (pd.Period(month, "M").end_time).date()


def build_monthly(rows, weapons, order):
    """A class with no report in a month has no row. That isn't a count of zero."""
    table = []
    for (month, class_id), group in _by_class(rows, "month", order):
        cell = _cell(group)
        rate, gap = rate_for(cell, weapons.classes[class_id], month)
        table.append({
            "month": month,
            "class": class_id,
            **cell,
            "intercept_rate": rate,
            "intercept_rate_gap": gap,
            **_flags(cell, month_end(month)),
        })
    return table


# ---- reconciliation ----

def _bucket(rows):
    return {
        "rows": len(rows),
        "launched_as_published": int(rows["launched"].sum()),
        "destroyed_as_published": int(rows["destroyed"].sum()),
    }


def reconcile(frame, nights, monthly):
    """Account for every raw row, and check both tables against the raw rows.

    The left-out buckets don't overlap: a row goes in the first one that fits.
    Their "as published" sums include counts the tables treat as unknown, so
    they're bookkeeping and not figures to chart.
    """
    excluded = frame[~frame["counted"]]
    other_account = frame[frame["counted"] & ~frame["national"]]
    kept = frame[frame["counted"] & frame["national"]]
    hidden, used = kept[kept["hidden"]], kept[~kept["hidden"]]

    buckets = {
        "excluded_class": _bucket(excluded),
        "not_a_national_account": _bucket(other_account),
        "hidden": _bucket(hidden),
        "in_monthly_totals": _bucket(used),
    }
    raw = _bucket(frame)
    for key in raw:
        if sum(bucket[key] for bucket in buckets.values()) != raw[key]:
            raise PipelineError(f"Reconciliation: the buckets don't add up to the raw {key}.")

    # The same sums, worked out from the raw rows without the tables' grouping.
    outcome = used[(used["destroyed"] <= used["launched"]).fillna(False)]
    night_rows = used[~used["daytime"]]
    night_outcome = outcome[~outcome["daytime"]]
    checks = (
        ("monthly launched", monthly, "launched", used["launched"]),
        ("monthly destroyed", monthly, "destroyed", outcome["destroyed"]),
        ("monthly launched_with_outcome", monthly, "launched_with_outcome", outcome["launched"]),
        ("nights launched", nights, "launched", night_rows["launched"]),
        ("nights destroyed", nights, "destroyed", night_outcome["destroyed"]),
        ("nights launched_with_outcome", nights, "launched_with_outcome",
         night_outcome["launched"]),
    )
    for label, table, column, expected in checks:
        found = sum(row[column] or 0 for row in table)
        if found != int(expected.sum()):
            raise PipelineError(
                f"Reconciliation: {label} is {found}, but the raw rows give "
                f"{int(expected.sum())}."
            )

    daytime = used[used["daytime"]]
    over = used[(used["destroyed"] > used["launched"]).fillna(False)]
    return {
        "raw_daily_file": raw,
        "buckets": buckets,
        "excluded_class_rows": {
            class_id: _bucket(group) for class_id, group in excluded.groupby("class")
        },
        "within_monthly_totals": {
            "daytime_reports_not_in_nights": _bucket(daytime),
            "rows_with_blank_launched": int(used["launched"].isna().sum()),
            "rows_with_blank_destroyed": int(used["destroyed"].isna().sum()),
            "rows_with_destroyed_above_launched": len(over),
        },
        "table_totals": {
            name: {
                column: sum(row[column] or 0 for row in table)
                for column in ("launched", "destroyed", "launched_with_outcome")
            }
            for name, table in (("nights", nights), ("monthly_by_class", monthly))
        },
    }


# ---- the files ----

def build_strike_tables(daily, weapons, source):
    """Return (nights, monthly_by_class, strike_reconciliation) as JSON-ready dicts."""
    frame = prepare(daily, weapons)
    rows = counted_reports(frame)
    if rows.empty:
        raise PipelineError(f"{KAGGLE_DAILY} has no counted national reports.")
    order = {class_id: n for n, class_id in enumerate(weapons.classes)}
    night_rows, years = build_nights(rows, order)
    monthly_rows = build_monthly(rows, weapons, order)
    reconciliation = reconcile(frame, night_rows, monthly_rows)

    def header(table):
        return {
            "table": table,
            "source": {**source, "file": KAGGLE_DAILY},
            # From any row of the file, so a quiet start or end isn't cut off.
            "first_day": frame["date"].min().isoformat(),
            "last_day": frame["date"].max().isoformat(),
            "restriction_from": RESTRICTION_FROM.isoformat(),
        }

    nights = {
        **header("nights"),
        "massive": {"quantile": MASSIVE_QUANTILE, "years": years},
        "rows": night_rows,
    }
    monthly = {
        **header("monthly_by_class"),
        "intercept_rate": {
            "min_launched": MIN_RATE_LAUNCHED,
            "missile_classes": [c for c in weapons.classes if c in MISSILE_CLASSES],
            "missile_rates_end_before": MISSILE_RATES_END_BEFORE,
        },
        "rows": monthly_rows,
    }
    return nights, monthly, {**header("strike_reconciliation"), **reconciliation}
