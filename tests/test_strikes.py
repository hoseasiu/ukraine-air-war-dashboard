"""Strike table tests. All inputs are made up; no source rows are copied.

The last section checks the committed tables, which needs no raw data.
"""

import json
import re
from datetime import date

import pandas as pd
import pytest

from pipeline import strikes
from pipeline.columns import COLUMNS
from pipeline.errors import PipelineError
from pipeline.sources import KAGGLE_DAILY, PROCESSED_DIR, REFERENCE_DIR, ROOT
from pipeline.strikes import build_strike_tables
from pipeline.weapon_classes import WeaponClass, WeaponClasses, load_weapon_classes

WEAPONS = WeaponClasses(
    classes={
        "shahed_drone": WeaponClass("shahed_drone", True, True),
        "cruise": WeaponClass("cruise", True, True),
        "mixed": WeaponClass("mixed", True, False),
        "other_uav": WeaponClass("other_uav", False, False),
    },
    models={
        "Drone A": "shahed_drone", "Drone B": "shahed_drone", "Missile": "cruise",
        "Both": "mixed", "Scout": "other_uav",
    },
)
NATIONAL = "https://t.me/kpszsu/1"
REGIONAL = "PvKPivden/posts/1"


def row(end="2024-03-05 09:00", model="Drone A", launched="20", destroyed="15", **changes):
    start = f"{(pd.Timestamp(end[:10]) - pd.Timedelta(days=1)).date()} 18:00"
    values = {column: "" for column in COLUMNS[KAGGLE_DAILY].values()}
    values.update(
        time_start=start, time_end=end, model=model, source=NATIONAL,
        launched=f"{launched}.0" if launched else "",
        destroyed=f"{destroyed}.0" if destroyed else "",
    )
    values.update(changes)
    return values


def tables(*rows):
    return build_strike_tables(pd.DataFrame(rows), WEAPONS, {"url": "made up"})


def pick(table, class_id, key=None):
    column = "date" if table["table"] == "nights" else "month"
    found = [r for r in table["rows"]
             if r["class"] == class_id and (key is None or r[column] == key)]
    assert len(found) == 1, found
    return found[0]


# ---- which rows count ----

def test_both_tables_group_by_class_with_flags():
    nights, monthly, _ = tables(
        row(model="Drone A", launched="20", destroyed="15", launch_place="North"),
        row(model="Drone B", launched="10", destroyed="5", launch_place="South"),
        row(model="Drone B", launched="1", destroyed="1", launch_place="South"),
        row(model="Missile", launched="4", destroyed="1"),
    )
    night = pick(nights, "shahed_drone")
    assert night == {
        "date": "2024-03-05", "class": "shahed_drone", "launched": 31, "destroyed": 21,
        "launched_with_outcome": 31, "n_models": 2, "n_unknown_launched": 0,
        "is_massive": False, "launch_places": ["North", "South"],
        "launch_place_missing": False, "destroyed_includes_ew": True,
        "ballistic_restricted": False,
    }
    assert [r["class"] for r in nights["rows"]] == ["shahed_drone", "cruise"]
    month = pick(monthly, "shahed_drone")
    assert (month["month"], month["launched"], month["destroyed"]) == ("2024-03", 31, 21)
    assert pick(nights, "cruise")["launch_place_missing"] is True


def test_a_night_is_keyed_by_the_date_it_ends():
    nights, monthly, _ = tables(row(end="2024-04-01 08:00", time_start="2024-03-31 18:00"))
    assert nights["rows"][0]["date"] == "2024-04-01"
    assert monthly["rows"][0]["month"] == "2024-04"


def test_excluded_classes_and_other_accounts_are_left_out_but_reconciled():
    _, monthly, check = tables(
        row(launched="20", destroyed="15"),
        row(model="Scout", launched="3", destroyed="3"),
        row(model="Scout", launched="1", destroyed="1", source="watch/?v=1"),
        row(launched="7", destroyed="7", source=REGIONAL),
    )
    assert pick(monthly, "shahed_drone")["launched"] == 20
    assert [r["class"] for r in monthly["rows"]] == ["shahed_drone"]
    assert check["raw_daily_file"]["launched_as_published"] == 31
    assert {k: v["launched_as_published"] for k, v in check["buckets"].items()} == {
        "excluded_class": 4, "not_a_national_account": 7, "hidden": 0,
        "in_monthly_totals": 20,
    }
    assert check["excluded_class_rows"]["other_uav"]["rows"] == 2


@pytest.mark.parametrize(("start", "end", "daytime"), [
    ("2024-03-05 06:30", "2024-03-05 19:00", True),
    ("2024-03-05 05:00", "2024-03-05 15:00", True),
    ("2024-03-05 12:59", "2024-03-05 20:00", True),
    ("2024-03-05 13:00", "2024-03-05 20:00", False),
    ("2024-03-05 04:59", "2024-03-05 19:00", False),
    ("2024-03-05 06:00", "2024-03-05 14:59", False),
    ("2024-03-04 06:00", "2024-03-05 19:00", False),
    ("2024-03-05", "2024-03-05 19:00", False),
    ("2024-03-05 06:00", "2024-03-05", False),
    ("2024-03-05 6:00 ", "2024-03-05 19:00 ", True),
])
def test_daytime_reports_count_in_months_but_not_nights(start, end, daytime):
    nights, monthly, _ = tables(
        row(launched="20", destroyed="15"),
        row(end=end, time_start=start, launched="100", destroyed="100"),
    )
    assert pick(nights, "shahed_drone")["launched"] == (20 if daytime else 120)
    assert pick(monthly, "shahed_drone")["launched"] == 120


# ---- unknown counts ----

def test_hidden_counts_are_unknown_never_zero():
    hidden = row(end="2026-08-11 09:00", model="Missile", launched="4", destroyed="2",
                 status_data="hidden")
    nights, monthly, check = tables(hidden, row(end="2026-08-11 09:00"))
    for table in (nights, monthly):
        cell = pick(table, "cruise")
        assert cell["launched"] is None and cell["destroyed"] is None
        assert cell["launched_with_outcome"] is None
        assert (cell["n_models"], cell["n_unknown_launched"]) == (1, 1)
        assert cell["destroyed_includes_ew"] is False
    assert check["buckets"]["hidden"] == {
        "rows": 1, "launched_as_published": 4, "destroyed_as_published": 2,
    }


def test_an_unknown_count_does_not_hide_the_known_ones():
    nights, _, _ = tables(
        row(launched="20", destroyed="15"),
        row(model="Drone B", launched="", destroyed="0"),
    )
    cell = pick(nights, "shahed_drone")
    assert (cell["launched"], cell["destroyed"], cell["n_unknown_launched"]) == (20, 15, 1)


@pytest.mark.parametrize("destroyed", ["", "25"])
def test_unusable_destroyed_keeps_the_launches_and_leaves_the_outcome(destroyed):
    nights, monthly, _ = tables(
        row(launched="30", destroyed="15"),
        row(launched="20", destroyed=destroyed),
    )
    for table in (nights, monthly):
        cell = pick(table, "shahed_drone")
        assert (cell["launched"], cell["destroyed"], cell["launched_with_outcome"]) == (
            50, 15, 30,
        )
    assert pick(monthly, "shahed_drone")["intercept_rate"] == 0.5


def test_a_date_with_no_known_count_has_no_massive_label():
    nights, _, _ = tables(
        row(end="2026-09-01 09:00", model="Missile", launched="0", destroyed="0",
            status_data="hidden"),
        row(end="2026-09-02 09:00"),
    )
    assert pick(nights, "cruise")["is_massive"] is None
    assert nights["massive"]["years"][0]["n_nights"] == 1


# ---- massive nights ----

def test_massive_means_more_than_the_years_95th_percentile():
    days = {date(2024, 1, n): n for n in range(1, 22)}  # 1..21: the percentile is 20
    days |= {date(2025, 1, 1): 500, date(2025, 1, 2): 500}
    massive, years = strikes.massive_nights(days)
    # Equal to the bar isn't massive, and each year has its own bar.
    assert massive == {date(2024, 1, 21)}
    assert [(y["year"], y["massive_above"], y["n_nights"], y["n_massive"]) for y in years] == [
        (2024, 20.0, 21, 1), (2025, 500.0, 2, 0),
    ]


def test_massive_uses_the_whole_night_and_marks_every_class_row():
    quiet = [row(end=f"2024-01-{n:02d} 09:00", launched="10", destroyed="1")
             for n in range(1, 21)]
    big = [row(end="2024-01-21 09:00", launched="9", destroyed="1"),
           row(end="2024-01-21 09:00", model="Missile", launched="9", destroyed="1")]
    nights, _, _ = tables(*quiet, *big)
    assert {(r["date"], r["class"]) for r in nights["rows"] if r["is_massive"]} == {
        ("2024-01-21", "shahed_drone"), ("2024-01-21", "cruise"),
    }


# ---- intercept rates ----

@pytest.mark.parametrize(("launched", "rate", "gap"), [
    ("9", None, "below_minimum"), ("10", 0.5, None),
])
def test_rate_needs_ten_eligible_launches(launched, rate, gap):
    _, monthly, _ = tables(row(launched=launched, destroyed="5"))
    cell = pick(monthly, "shahed_drone")
    assert (cell["intercept_rate"], cell["intercept_rate_gap"]) == (rate, gap)
    assert cell["destroyed"] == 5


def test_rate_adds_counts_before_dividing():
    _, monthly, _ = tables(row(launched="10", destroyed="10"), row(launched="30", destroyed="0"))
    assert pick(monthly, "shahed_drone")["intercept_rate"] == 0.25


def test_missile_rates_stop_at_july_2026_and_mixed_has_none():
    _, monthly, _ = tables(*[
        row(end=f"{month}-20 09:00", model=model)
        for month in ("2026-07", "2026-08")
        for model in ("Drone A", "Missile", "Both")
    ])
    got = {(r["month"], r["class"]): r["intercept_rate_gap"] for r in monthly["rows"]}
    assert got == {
        ("2026-07", "shahed_drone"): None,
        ("2026-07", "cruise"): None,
        ("2026-07", "mixed"): "no_class_rate",
        ("2026-08", "shahed_drone"): None,
        ("2026-08", "cruise"): "missile_reporting_restricted",
        ("2026-08", "mixed"): "no_class_rate",
    }


# ---- restriction flag ----

def test_restriction_flag_starts_aug_11_for_nights_and_covers_all_of_august():
    nights, monthly, _ = tables(
        row(end="2026-08-10 09:00"), row(end="2026-08-11 09:00"),
        row(end="2026-08-03 09:00", model="Missile"),
        row(end="2026-07-31 09:00"),
    )
    assert {r["date"]: r["ballistic_restricted"] for r in nights["rows"]} == {
        "2026-07-31": False, "2026-08-03": False, "2026-08-10": False, "2026-08-11": True,
    }
    assert {(r["month"], r["ballistic_restricted"]) for r in monthly["rows"]} == {
        ("2026-07", False), ("2026-08", True),
    }


def test_restriction_date_matches_the_site():
    flags = (ROOT / "site" / "src" / "chart" / "flags.ts").read_text(encoding="utf-8")
    found = re.search(r'BALLISTIC_RESTRICTION_FROM = "([\d-]+)"', flags)
    assert found and found.group(1) == strikes.RESTRICTION_FROM.isoformat()


# ---- bad input fails loudly ----

@pytest.mark.parametrize(("changes", "message"), [
    ({"model": "New Weapon"}, "no class in model_classes.csv for \\['New Weapon'\\]"),
    # Even in a row that wouldn't count.
    ({"model": "New Weapon", "source": REGIONAL}, "no class"),
    ({"model": "Drone A "}, "no class"),
    ({"source": "https://t.me/new_channel/1"}, "unknown source account"),
    ({"source": "watch/?v=1"}, "names no account"),
    ({"status_data": "partial"}, "status_data"),
    ({"status_data": "hidden"}, "hidden before"),
    ({"launched": "2.5"}, "whole number"),
    ({"destroyed": "-1"}, "whole number"),
    ({"launched": "about 5"}, "whole number"),
    ({"time_start": "March 4"}, "time_start"),
    ({"time_end": "2024-02-30"}, "time_end"),
    ({"time_end": "2024-03-01"}, "before its time_start"),
    ({"launch_place": "Курськ"}, "launch_place"),
])
def test_unexpected_values_fail(changes, message):
    with pytest.raises(PipelineError, match=message):
        tables(row(), {**row(), **changes})


def test_the_cyrillic_lookalike_in_kursk_is_read_as_latin():
    nights, _, _ = tables(row(launch_place="Кursk oblast"), row(launch_place="Kursk oblast"))
    assert nights["rows"][0]["launch_places"] == ["Kursk oblast"]


def test_a_new_class_with_its_own_rate_needs_a_decision():
    weapons = WeaponClasses(
        {**WEAPONS.classes, "new_missile": WeaponClass("new_missile", True, True)},
        WEAPONS.models,
    )
    with pytest.raises(PipelineError, match="cut-off"):
        build_strike_tables(pd.DataFrame([row()]), weapons, {})


@pytest.mark.parametrize("column", ["launched", "destroyed", "launched_with_outcome"])
def test_reconciliation_catches_a_table_that_lost_a_count(monkeypatch, column):
    build = strikes.build_monthly

    def broken(*args):
        result = build(*args)
        result[0][column] -= 1
        return result

    monkeypatch.setattr(strikes, "build_monthly", broken)
    with pytest.raises(PipelineError, match=f"monthly {column}"):
        tables(row())


@pytest.mark.parametrize(("name", "text", "message"), [
    ("model_classes.csv", "model,class\nA,cruise\nA,cruise\n", "twice"),
    ("model_classes.csv", "model,class\nA,rocket\n", "unknown class"),
    ("weapon_classes.csv",
     "class,counts_in_totals,own_intercept_rate\ncruise,maybe,yes\n", "yes or no"),
])
def test_bad_reference_tables_fail(tmp_path, name, text, message):
    for file in ("weapon_classes.csv", "model_classes.csv"):
        source = (REFERENCE_DIR / file).read_text(encoding="utf-8-sig")
        (tmp_path / file).write_text(source, encoding="utf-8")
    (tmp_path / name).write_text(text, encoding="utf-8")
    with pytest.raises(PipelineError, match=message):
        load_weapon_classes(tmp_path)


# ---- the committed tables ----

def committed(name):
    return json.loads((PROCESSED_DIR / f"{name}.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("name", ["nights", "monthly_by_class"])
def test_committed_tables_match_the_reconciliation(name):
    table, check = committed(name), committed("strike_reconciliation")
    for column, total in check["table_totals"][name].items():
        assert sum(r[column] or 0 for r in table["rows"]) == total
    buckets = check["buckets"].values()
    for key, total in check["raw_daily_file"].items():
        assert sum(bucket[key] for bucket in buckets) == total
    used = check["buckets"]["in_monthly_totals"]
    daytime = check["within_monthly_totals"]["daytime_reports_not_in_nights"]
    expected = used["launched_as_published"]
    if name == "nights":
        expected -= daytime["launched_as_published"]
    assert check["table_totals"][name]["launched"] == expected


def test_committed_tables_come_from_the_current_raw_file_and_classes():
    manifest = committed("manifest")
    nights, check = committed("nights"), committed("strike_reconciliation")
    daily = manifest["sources"]["kaggle"]["files"][0]
    assert check["raw_daily_file"]["rows"] == daily["rows"]
    assert nights["last_day"] == manifest["snapshot_date"]
    weapons = load_weapon_classes(REFERENCE_DIR)
    counted = {c for c, info in weapons.classes.items() if info.counts_in_totals}
    for name in ("nights", "monthly_by_class"):
        assert {r["class"] for r in committed(name)["rows"]} <= counted


def test_committed_rows_keep_the_rules():
    weapons = load_weapon_classes(REFERENCE_DIR)
    monthly, nights = committed("monthly_by_class"), committed("nights")
    for r in monthly["rows"]:
        rate, gap = strikes.rate_for(r, weapons.classes[r["class"]], r["month"])
        assert (r["intercept_rate"], r["intercept_rate_gap"]) == (rate, gap)
        assert r["ballistic_restricted"] == (r["month"] >= "2026-08")
    for r in nights["rows"]:
        assert r["ballistic_restricted"] == (r["date"] >= "2026-08-11")
    for r in monthly["rows"] + nights["rows"]:
        assert r["destroyed_includes_ew"] == (r["destroyed"] is not None)
        if r["destroyed"] is not None:
            assert 0 <= r["destroyed"] <= r["launched_with_outcome"] <= r["launched"]
    totals = {}
    for r in nights["rows"]:
        if r["launched"] is not None:
            day = date.fromisoformat(r["date"])
            totals[day] = totals.get(day, 0) + r["launched"]
    massive, years = strikes.massive_nights(totals)
    assert years == nights["massive"]["years"]
    assert {r["date"] for r in nights["rows"] if r["is_massive"]} == {
        d.isoformat() for d in massive
    }
