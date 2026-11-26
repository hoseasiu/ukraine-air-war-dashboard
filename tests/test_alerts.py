"""Tests for the alert tables.

The roll-up tests use made-up alerts and need no raw data. The last group checks
the committed files in data/processed/, which need none either.
"""

import json
import re
from datetime import date, datetime, timedelta
from itertools import pairwise
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import pytest

from pipeline.alerts import (
    FIRST_DAY,
    GRANULARITY_CHANGE_FROM,
    LAST_DAY,
    build_tables,
    merge,
)
from pipeline.columns import COLUMNS
from pipeline.errors import PipelineError
from pipeline.gazetteer import Area, Gazetteer, load_gazetteer
from pipeline.sources import PROCESSED_DIR, REFERENCE_DIR

ROOT = Path(__file__).resolve().parents[1]
KYIV = ZoneInfo("Europe/Kyiv")
OBLAST, CITY, OUT = "UA-05", "UA-30", "UA-09"

GAZETTEER = Gazetteer(
    areas={
        OBLAST: Area(OBLAST, "Testova oblast", "oblast", True, ""),
        CITY: Area(CITY, "Test city", "city", True, ""),
        OUT: Area(OUT, "Excluded oblast", "oblast", False, "Not listed."),
    },
    aliases={"Testova": OBLAST, "City": CITY, "Excluded": OUT, "Everywhere": ""},
    raions={OBLAST: frozenset({"North", "South"})},
)


def row(start, end, oblast="Testova", raion="", hromada="", level=None):
    """An alert with Kyiv wall-clock times, written in UTC as the file has them."""

    def utc(text):
        local = datetime.fromisoformat(text).replace(tzinfo=KYIV)
        return str(local.astimezone(ZoneInfo("UTC")))

    return {
        "oblast": oblast,
        "raion": raion,
        "hromada": hromada,
        "level": level or ("hromada" if hromada else "raion" if raion else "oblast"),
        "started_at": utc(start),
        "finished_at": utc(end),
        "source": "official",
    }


def frame(rows, first, last):
    """The given rows plus what every file needs: all raions, all areas, full coverage."""
    early = f"{first - timedelta(days=10)} 12:00"
    late = f"{last + timedelta(days=10)} 12:00"
    filler = [
        row(early, early, raion="North"),
        row(early, early, raion="South"),
        row(early, early, oblast="City"),
        row(late, late),
    ]
    return pd.DataFrame([*rows, *filler], columns=list(COLUMNS["official_data_en.csv"]))


def tables(rows, first=date(2024, 3, 1), last=date(2024, 3, 31), gazetteer=GAZETTEER):
    return build_tables(frame(rows, first, last), gazetteer, {}, first, last)


def day(daily, iso, text):
    return daily["hours"][iso][(date.fromisoformat(text) - date.fromisoformat(
        daily["first_day"])).days]


def month(monthly, iso, text):
    (found,) = [r for r in monthly["rows"] if r["oblast"] == iso and r["month"] == text]
    return found


# ---- the roll-up rule ----

def test_merge_joins_overlapping_and_touching_and_drops_empty():
    assert merge([(5, 9), (1, 3), (3, 4), (6, 7), (20, 20)]) == [[1, 4], [5, 9]]


def test_raions_are_averaged():
    monthly, daily = tables([row("2024-03-05 10:00", "2024-03-05 12:00", raion="North")])
    assert day(daily, OBLAST, "2024-03-05") == 1.0
    assert month(monthly, OBLAST, "2024-03")["hours"] == 1.0
    assert month(monthly, OBLAST, "2024-03")["n_alerts"] == 0.5


def test_oblast_and_raion_rows_are_merged_not_added():
    monthly, daily = tables([
        row("2024-03-05 10:00", "2024-03-05 13:00"),
        row("2024-03-05 12:00", "2024-03-05 14:00", raion="North"),
    ])
    # North has 4 hours (10 to 14) and South 3.
    assert day(daily, OBLAST, "2024-03-05") == 3.5
    assert month(monthly, OBLAST, "2024-03")["n_alerts"] == 1.0


def test_duplicates_and_hromada_rows_add_nothing():
    alert = row("2024-03-05 10:00", "2024-03-05 12:00")
    monthly, daily = tables([
        alert,
        dict(alert),
        row("2024-03-06 10:00", "2024-03-06 12:00", raion="North", hromada="H"),
    ])
    assert day(daily, OBLAST, "2024-03-05") == 2.0
    assert day(daily, OBLAST, "2024-03-06") == 0.0
    assert month(monthly, OBLAST, "2024-03")["n_alerts"] == 1.0


def test_city_with_no_raions_is_one_unit():
    monthly, _ = tables([row("2024-03-05 10:00", "2024-03-05 11:30", oblast="City")])
    assert month(monthly, CITY, "2024-03")["hours"] == 1.5
    assert month(monthly, CITY, "2024-03")["n_alerts"] == 1.0


def test_split_at_kyiv_midnight_and_counted_where_it_starts():
    monthly, daily = tables(
        [row("2024-03-31 23:00", "2024-04-01 02:00")], date(2024, 3, 1), date(2024, 4, 30)
    )
    assert day(daily, OBLAST, "2024-03-31") == 1.0
    assert day(daily, OBLAST, "2024-04-01") == 2.0
    assert month(monthly, OBLAST, "2024-03")["n_alerts"] == 1.0
    assert month(monthly, OBLAST, "2024-04")["hours"] == 2.0
    assert month(monthly, OBLAST, "2024-04")["n_alerts"] == 0.0


def test_alerts_are_clipped_to_the_window():
    monthly, daily = tables([
        row("2024-02-29 22:00", "2024-03-01 01:00"),
        row("2024-03-31 23:00", "2024-04-01 05:00"),
    ])
    assert day(daily, OBLAST, "2024-03-01") == 1.0
    assert day(daily, OBLAST, "2024-03-31") == 1.0
    assert month(monthly, OBLAST, "2024-03")["hours"] == 2.0
    # The first one started before the window, so it isn't counted.
    assert month(monthly, OBLAST, "2024-03")["n_alerts"] == 1.0


@pytest.mark.parametrize("spring_or_autumn, length", [("2024-03-31", 23), ("2024-10-27", 25)])
def test_a_whole_dst_day_has_its_real_length(spring_or_autumn, length):
    when = date.fromisoformat(spring_or_autumn)
    first = when.replace(day=1)
    last = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    _, daily = tables(
        [row(f"{when - timedelta(days=1)} 12:00", f"{when + timedelta(days=1)} 12:00")],
        first, last,
    )
    assert day(daily, OBLAST, spring_or_autumn) == length


# ---- flags and exclusions ----

def test_excluded_area_has_no_figures_and_is_listed():
    monthly, daily = tables([row("2024-03-05 10:00", "2024-03-05 12:00", oblast="Excluded")])
    assert OUT not in daily["hours"]
    assert OUT not in {r["oblast"] for r in monthly["rows"]}
    for table in (monthly, daily):
        assert [a["oblast"] for a in table["excluded_areas"]] == [OUT]
    assert all(r["alert_regions_excluded"] for r in monthly["rows"])
    assert daily["flags"]["alert_regions_excluded"] is True


@pytest.mark.parametrize("seconds, flagged", [(3599, False), (3600, True), (3601, False)])
def test_hour_long_rows_are_flagged_as_possibly_assumed(seconds, flagged):
    end = datetime(2024, 3, 5, 10) + timedelta(seconds=seconds)
    monthly, daily = tables([row("2024-03-05 10:00", str(end))])
    assert month(monthly, OBLAST, "2024-03")["alert_end_assumed"] is flagged
    assert daily["flags"]["alert_end_assumed_days"][OBLAST] == (["2024-03-05"] if flagged else [])


def test_hour_long_hromada_row_is_not_flagged():
    monthly, _ = tables([row("2024-03-05 10:00", "2024-03-05 11:00", raion="North", hromada="H")])
    assert month(monthly, OBLAST, "2024-03")["alert_end_assumed"] is False


def test_granularity_flag_starts_with_2025():
    monthly, _ = tables([], date(2024, 12, 1), date(2025, 1, 31))
    assert month(monthly, OBLAST, "2024-12")["alert_granularity_change"] is False
    assert month(monthly, OBLAST, "2025-01")["alert_granularity_change"] is True


def test_granularity_date_matches_the_site():
    flags = (ROOT / "site" / "src" / "chart" / "flags.ts").read_text(encoding="utf-8")
    found = re.search(r'ALERT_GRANULARITY_CHANGE_FROM = "([\d-]+)"', flags)
    assert found and found.group(1) == GRANULARITY_CHANGE_FROM.isoformat()


# ---- bad input fails loudly ----

def alter(**changes):
    return {**row("2024-03-05 10:00", "2024-03-05 12:00", raion="North"), **changes}


@pytest.mark.parametrize("bad, message", [
    (alter(finished_at="2024-03-05 07:59:59+00:00"), "end before they start"),
    (alter(finished_at=""), "aren't UTC timestamps"),
    (alter(started_at="2024-03-05 10:00:00+02:00"), "aren't UTC timestamps"),
    (alter(started_at="2024-02-30 10:00:00+00:00"), "impossible"),
    (alter(oblast="Testova "), "no alias"),
    (alter(oblast="Everywhere"), "doesn't name one area"),
    (alter(level="district"), "unknown level"),
    (alter(raion=""), "has no raion"),
    (alter(level="oblast"), "names a raion"),
    (alter(raion="East"), "not in raions.csv"),
])
def test_bad_rows_fail(bad, message):
    with pytest.raises(PipelineError, match=message):
        tables([bad])


def test_bad_hromada_row_still_fails():
    bad = row("2024-03-05 12:00", "2024-03-05 10:00", raion="North", hromada="H")
    with pytest.raises(PipelineError, match="end before they start"):
        tables([bad])


def test_a_listed_raion_missing_from_the_file_fails():
    gazetteer = Gazetteer(
        GAZETTEER.areas, GAZETTEER.aliases, {OBLAST: frozenset({"North", "South", "West"})}
    )
    with pytest.raises(PipelineError, match="West"):
        tables([], gazetteer=gazetteer)


@pytest.mark.parametrize("keep", ["starts too late", "ends too early"])
def test_file_that_doesnt_cover_the_window_fails(keep):
    first, last = date(2024, 3, 1), date(2024, 3, 31)
    data = frame([row("2024-03-05 10:00", "2024-03-05 12:00")], first, last)
    if keep == "starts too late":
        data = data[data["started_at"] >= "2024-03-01"]
        extra = frame([], first, last).iloc[:3].assign(
            started_at="2024-03-02 10:00:00+00:00", finished_at="2024-03-02 10:00:00+00:00"
        )
        data = pd.concat([data, extra])
    else:
        data = data[data["started_at"] < "2024-04-01"]
    with pytest.raises(PipelineError, match="doesn't run from before"):
        build_tables(data, GAZETTEER, {}, first, last)


def test_an_area_with_no_rows_fails():
    first, last = date(2024, 3, 1), date(2024, 3, 31)
    data = frame([], first, last)
    with pytest.raises(PipelineError, match="no rows for Test city"):
        build_tables(data[data["oblast"] != "City"], GAZETTEER, {}, first, last)


# ---- the committed tables ----

def processed(name):
    return json.loads((PROCESSED_DIR / f"{name}.json").read_text(encoding="utf-8"))


def day_hours(when):
    def midnight(value):
        return datetime(value.year, value.month, value.day, tzinfo=KYIV).timestamp()

    return (midnight(when + timedelta(days=1)) - midnight(when)) / 3600


def all_days():
    return [FIRST_DAY + timedelta(days=n) for n in range((LAST_DAY - FIRST_DAY).days + 1)]


def included_areas():
    gazetteer = load_gazetteer(REFERENCE_DIR)
    return sorted(iso for iso, area in gazetteer.areas.items() if area.in_alert_totals)


def test_committed_daily_hours_fit_in_each_day():
    daily = processed("alert_daily")
    days = all_days()
    assert (daily["first_day"], daily["last_day"]) == ("2022-04-01", "2026-07-31")
    assert sorted(daily["hours"]) == daily["areas"] == included_areas()
    # The window really does include both kinds of clock change.
    assert {day_hours(d) for d in days} == {23, 24, 25}
    for series in daily["hours"].values():
        assert len(series) == len(days)
        assert all(0 <= value <= day_hours(d) for d, value in zip(days, series, strict=True))


def test_committed_monthly_table_is_complete_and_matches_daily():
    monthly, daily = processed("alert_hours_monthly"), processed("alert_daily")
    by_month = {}
    for index, when in enumerate(all_days()):
        by_month.setdefault(when.isoformat()[:7], []).append((index, when))
    keys = [(r["oblast"], r["month"]) for r in monthly["rows"]]
    assert keys == [(iso, m) for iso in included_areas() for m in by_month]
    assumed = daily["flags"]["alert_end_assumed_days"]
    for r in monthly["rows"]:
        days = by_month[r["month"]]
        assert 0 <= r["hours"] <= sum(day_hours(d) for _, d in days)
        assert r["n_alerts"] >= 0
        # Each daily figure is rounded to 0.01, so the sum can drift by half that per day.
        total = sum(daily["hours"][r["oblast"]][i] for i, _ in days)
        assert r["hours"] == pytest.approx(total, abs=0.005 * len(days) + 0.005)
        assert r["alert_end_assumed"] == any(
            d.startswith(r["month"]) for d in assumed[r["oblast"]]
        )
        assert r["alert_regions_excluded"] is True
        assert r["alert_granularity_change"] == (r["month"] >= "2025-01")
    for days_flagged in assumed.values():
        assert all(a < b for a, b in pairwise(days_flagged))
