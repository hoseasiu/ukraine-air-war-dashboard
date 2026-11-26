"""The alert tables, `alert_hours_monthly` and `alert_daily` (#8).

The roll-up rule is the one the owner accepted on #2 (docs/data-audit.md#roll-up-rule):

1. Drop exact duplicate rows.
2. Leave out the areas with `in_alert_totals = no` (Luhansk, Crimea, Sevastopol).
3. Leave out hromada-level rows.
4. For each raion, take the union of the area's oblast-level rows and that raion's rows.
5. The area's figure is the mean over its raions. An area with no raions is one unit.
6. Split at midnight, Kyiv time, to assign days and months.

Only the official file is used. Intervals are whole seconds since the Unix epoch,
and raion totals are added as integers and divided once at the end, so rounding
can't push a day past its own length.
"""

from bisect import bisect_right
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

from pipeline.errors import PipelineError

OFFICIAL = "official_data_en.csv"
TIME_ZONE = "Europe/Kyiv"
KYIV = ZoneInfo(TIME_ZONE)
UTC_EPOCH = pd.Timestamp(0, tz="UTC")

# Both ends included, and both decided by the owner: figures end at July 2026 (#2) and
# start in April 2022, the official file's first whole month (#8).
FIRST_DAY = date(2022, 4, 1)
LAST_DAY = date(2026, 7, 31)

# The raion switch phased in during 2025. Keep in step with
# ALERT_GRANULARITY_CHANGE_FROM in site/src/chart/flags.ts (a test checks it).
GRANULARITY_CHANGE_FROM = date(2025, 1, 1)

# The upstream parser gives an unfinished official alert an end one hour after its
# start, and doesn't mark it. A real alert can also last exactly an hour, so this
# finds the ends that *may* be assumed. Every other end wasn't set by that rule.
ASSUMED_LENGTH_SECONDS = 3600

LEVELS = ("oblast", "raion", "hromada")
# The only timestamp shape in the file. Another offset or format needs a look.
TIMESTAMP = r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+00:00"


# ---- reading and checking ----

def _epoch_seconds(column, name):
    bad = column[~column.str.fullmatch(TIMESTAMP)]
    if not bad.empty:
        raise PipelineError(
            f"{OFFICIAL}: {len(bad)} {name} value(s) aren't UTC timestamps, "
            f"such as {bad.iloc[0]!r}."
        )
    try:
        stamps = pd.to_datetime(column, format="%Y-%m-%d %H:%M:%S%z", utc=True)
    except ValueError as error:
        raise PipelineError(f"{OFFICIAL}: impossible {name} value: {error}") from error
    return (stamps - UTC_EPOCH) // pd.Timedelta(seconds=1)


def prepare(official, gazetteer):
    """Check the renamed official frame and return distinct rows with `iso`, `start`, `end`.

    Every row is checked, including the ones the roll-up later leaves out.
    """
    frame = official.drop_duplicates().copy()

    unknown = sorted(set(frame["oblast"]) - set(gazetteer.aliases))
    if unknown:
        raise PipelineError(
            f"{OFFICIAL}: no alias in oblast_aliases.csv for {unknown}. "
            "Add it by hand after checking which area it means."
        )
    frame["iso"] = frame["oblast"].map(gazetteer.aliases)
    nationwide = sorted(set(frame.loc[frame["iso"] == "", "oblast"]))
    if nationwide:
        raise PipelineError(f"{OFFICIAL}: {nationwide} doesn't name one area.")

    levels = sorted(set(frame["level"]) - set(LEVELS))
    if levels:
        raise PipelineError(f"{OFFICIAL}: unknown level value(s) {levels}.")
    if ((frame["level"] == "raion") & (frame["raion"] == "")).any():
        raise PipelineError(f"{OFFICIAL}: a raion-level row has no raion.")
    if ((frame["level"] == "oblast") & ((frame["raion"] != "") | (frame["hromada"] != ""))).any():
        raise PipelineError(f"{OFFICIAL}: an oblast-level row names a raion or hromada.")

    frame["start"] = _epoch_seconds(frame["started_at"], "started_at")
    frame["end"] = _epoch_seconds(frame["finished_at"], "finished_at")
    negative = frame[frame["end"] < frame["start"]]
    if not negative.empty:
        row = negative.iloc[0]
        raise PipelineError(
            f"{OFFICIAL}: {len(negative)} alert(s) end before they start, such as "
            f"{row['oblast']} {row['started_at']} to {row['finished_at']}."
        )
    return frame


def check_raions(frame, gazetteer):
    """The raion list is each area's denominator, so it must match the file exactly (#4).

    Excluded areas have no list and aren't checked.
    """
    named = frame[frame["raion"] != ""].groupby("iso")["raion"].agg(set).to_dict()
    problems = []
    for iso, area in gazetteer.areas.items():
        if not area.in_alert_totals:
            continue
        seen, listed = named.get(iso, set()), gazetteer.raions.get(iso, frozenset())
        if seen - listed:
            problems.append(f"{area.name}: {sorted(seen - listed)} not in raions.csv")
        if listed - seen:
            problems.append(f"{area.name}: {sorted(listed - seen)} not in {OFFICIAL}")
    if problems:
        raise PipelineError("The raion names don't match raions.csv. " + "; ".join(problems))


def check_coverage(frame, first_day, last_day):
    """A day outside the file's span would come out as a false zero."""
    if frame.empty:
        raise PipelineError(f"{OFFICIAL} has no rows.")
    if frame["start"].min() >= midnight(first_day) or frame["start"].max() < midnight(
        last_day + timedelta(days=1)
    ):
        raise PipelineError(
            f"{OFFICIAL} doesn't run from before {first_day} to after {last_day}, "
            "so some days would wrongly show no alerts."
        )


# ---- intervals ----

def midnight(day):
    """The start of a Kyiv calendar day, in epoch seconds."""
    return int(datetime(day.year, day.month, day.day, tzinfo=KYIV).timestamp())


def merge(intervals):
    """The union of (start, end) pairs, sorted. Touching intervals become one.

    Zero-length rows are dropped: they add no time and aren't counted as alerts.
    """
    merged = []
    for start, end in sorted(pair for pair in intervals if pair[1] > pair[0]):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def seconds_by_day(intervals, edges):
    """(day index, seconds) for each Kyiv day an interval touches inside the edges.

    `edges` holds each day's midnight plus the one after the last day.
    """
    for start, end in intervals:
        start, end = max(start, edges[0]), min(end, edges[-1])
        index = bisect_right(edges, start) - 1
        while start < end:
            piece_end = min(end, edges[index + 1])
            yield index, piece_end - start
            start = piece_end
            index += 1


# ---- the roll-up ----

def _pairs(rows):
    return list(zip(rows["start"].tolist(), rows["end"].tolist(), strict=True))


def _one_area(rows, raions, edges):
    """Per day: seconds and alert starts summed over raions, and the assumed-end mark."""
    days = len(edges) - 1
    seconds, starts, assumed = [0] * days, [0] * days, [False] * days
    rows = rows[rows["level"] != "hromada"]
    whole = rows[rows["level"] == "oblast"]
    # An area with no raions (Kyiv city) is one unit made of its oblast-level rows.
    units = [
        pd.concat([whole, rows[(rows["level"] == "raion") & (rows["raion"] == name)]])
        for name in sorted(raions)
    ] or [whole]
    for unit in units:
        union = merge(_pairs(unit))
        for index, value in seconds_by_day(union, edges):
            seconds[index] += value
        # An alert belongs to the day it started, even if it runs past midnight.
        for start, _ in union:
            if edges[0] <= start < edges[-1]:
                starts[bisect_right(edges, start) - 1] += 1
        hour_long = unit[unit["end"] - unit["start"] == ASSUMED_LENGTH_SECONDS]
        for index, _ in seconds_by_day(_pairs(hour_long), edges):
            assumed[index] = True
    return len(units), seconds, starts, assumed


def roll_up(frame, gazetteer, first_day=FIRST_DAY, last_day=LAST_DAY):
    """{ISO code: (units, seconds, starts, assumed)} for every area in alert totals."""
    days = (last_day - first_day).days + 1
    edges = [midnight(first_day + timedelta(days=n)) for n in range(days + 1)]
    by_area = dict(tuple(frame.groupby("iso")))
    result = {}
    for iso, area in sorted(gazetteer.areas.items()):
        if not area.in_alert_totals:
            continue
        if iso not in by_area:
            raise PipelineError(
                f"{OFFICIAL} has no rows for {area.name}, which is in alert totals."
            )
        result[iso] = _one_area(by_area[iso], gazetteer.raions.get(iso, ()), edges)
    return result


# ---- the two tables ----

def _header(table, gazetteer, source, first_day, last_day):
    return {
        "table": table,
        "source": {**source, "file": OFFICIAL},
        "time_zone": TIME_ZONE,
        "first_day": first_day.isoformat(),
        "last_day": last_day.isoformat(),
        "areas": [iso for iso, a in sorted(gazetteer.areas.items()) if a.in_alert_totals],
        "excluded_areas": [
            {"oblast": iso, "name": a.name, "reason": a.exclusion_reason}
            for iso, a in sorted(gazetteer.areas.items())
            if not a.in_alert_totals
        ],
    }


def build_tables(official, gazetteer, source, first_day=FIRST_DAY, last_day=LAST_DAY):
    """Return (alert_hours_monthly, alert_daily) as JSON-ready dicts.

    Excluded areas have no figures at all. They're listed, never shown as zero.
    """
    if (first_day.day, (last_day + timedelta(days=1)).day) != (1, 1):
        raise ValueError("The window must be whole months.")
    frame = prepare(official, gazetteer)
    check_raions(frame, gazetteer)
    check_coverage(frame, first_day, last_day)
    rolled = roll_up(frame, gazetteer, first_day, last_day)

    dates = [first_day + timedelta(days=n) for n in range((last_day - first_day).days + 1)]
    month_days = {}
    for index, day in enumerate(dates):
        month_days.setdefault(day.isoformat()[:7], []).append(index)

    rows, hours, assumed_days = [], {}, {}
    for iso, (units, seconds, starts, assumed) in rolled.items():
        per_hour = units * 3600
        hours[iso] = [round(value / per_hour, 2) for value in seconds]
        assumed_days[iso] = [d.isoformat() for d, flag in zip(dates, assumed, strict=True) if flag]
        for month, indexes in month_days.items():
            rows.append({
                "oblast": iso,
                "month": month,
                "hours": round(sum(seconds[i] for i in indexes) / per_hour, 2),
                "n_alerts": round(sum(starts[i] for i in indexes) / units, 2),
                "alert_end_assumed": any(assumed[i] for i in indexes),
                "alert_regions_excluded": True,
                "alert_granularity_change": dates[indexes[0]] >= GRANULARITY_CHANGE_FROM,
            })

    monthly = {**_header("alert_hours_monthly", gazetteer, source, first_day, last_day),
               "rows": rows}
    daily = {
        **_header("alert_daily", gazetteer, source, first_day, last_day),
        "flags": {
            "alert_regions_excluded": True,
            "alert_granularity_change_from": GRANULARITY_CHANGE_FROM.isoformat(),
            "alert_end_assumed_days": assumed_days,
        },
        "hours": hours,
    }
    return monthly, daily
