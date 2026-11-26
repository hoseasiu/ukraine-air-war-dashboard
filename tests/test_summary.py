"""The summary report and the size budget. Report inputs are made up.

The last section checks the committed files, which needs no raw data.
"""

import re

import pytest

from pipeline.budget import (
    BUDGET_BYTES,
    SITE_REFERENCE_FILES,
    check_budget,
    reference_sizes,
)
from pipeline.errors import PipelineError
from pipeline.sources import PROCESSED_DIR, REFERENCE_DIR, ROOT
from pipeline.summary import intercept_share, mean_area_hours, summary_report


def month_row(month, class_id, launched, destroyed, outcome, unknown=0):
    return {
        "month": month, "class": class_id, "launched": launched, "destroyed": destroyed,
        "launched_with_outcome": outcome, "n_unknown_launched": unknown,
    }


MONTHLY = {
    "first_day": "2026-07-03",
    "last_day": "2026-09-20",
    "restriction_from": "2026-08-11",
    "rows": [
        month_row("2026-07", "shahed_drone", 1200, 600, 1000),
        month_row("2026-07", "mixed", 100, 50, 100),
        month_row("2026-09", "shahed_drone", 900, 810, 900),
        month_row("2026-09", "cruise", None, None, None, unknown=3),
    ],
}
NIGHTS = {
    "restriction_from": "2026-08-11",
    "massive": {"years": [
        {"year": 2025, "massive_above": 12.0, "n_massive": 1, "n_nights": 20,
         "last_night": "2025-12-31"},
        {"year": 2026, "massive_above": 40.5, "n_massive": 2, "n_nights": 30,
         "last_night": "2026-09-20"},
    ]},
    "rows": [{"date": "2026-07-03"}, {"date": "2026-07-03"}, {"date": "2026-09-20"}],
}
ALERTS = {
    "first_day": "2026-06-01",
    "last_day": "2026-07-31",
    "excluded_areas": [{"name": "Excluded oblast"}],
    "rows": [
        {"oblast": "A", "month": "2026-06", "hours": 10.0},
        {"oblast": "A", "month": "2026-07", "hours": 30.0},
        {"oblast": "B", "month": "2026-06", "hours": 0.0},
        {"oblast": "B", "month": "2026-07", "hours": 20.0},
    ],
}
RECONCILIATION = {
    "raw_daily_file": {"rows": 9},
    "buckets": {"hidden": {"rows": 3}, "in_monthly_totals": {"rows": 6}},
}


def report():
    return summary_report(NIGHTS, MONTHLY, ALERTS, RECONCILIATION, {"a": 1, "b": 2}, 100)


def test_share_adds_counts_before_dividing():
    assert intercept_share(MONTHLY["rows"]) == (1460, 2000)


def test_report_share_stops_at_the_end_of_july_2026():
    (line,) = [x for x in report().splitlines() if "launches with an outcome" in x]
    assert line.strip().startswith("2026-07-03 to 2026-07-31:")
    assert "stop at July 31, 2026" in report()


def test_alert_hours_are_a_mean_over_areas_not_a_sum():
    assert mean_area_hours(ALERTS) == (30.0, 2, 2)


def test_report_gives_the_stop_1_figures_with_their_dates():
    text = report()
    assert "launched, 2026-07-03 to 2026-09-20: 2,200" in text
    assert "2026-07-03 to 2026-07-31: 59.1% (650 of 1,100" in text
    assert "2026-06-01 to 2026-07-31:\n    30 hours in all, or 15.0 a month. Areas: 2." in text
    assert "Excluded, not zero: Excluded oblast." in text
    assert "Site data: 3 of 100 bytes" in text


def test_report_keeps_the_caveats():
    text = report()
    # The EW caveat comes with the share.
    assert '"Destroyed" includes weapons lost to electronic warfare.' in text
    assert text.count("restriction from 2026-08-11") + text.count(
        "RESTRICTION from 2026-08-11"
    ) >= 2
    (line,) = [x for x in text.splitlines() if x.strip().startswith("2026: more than")]
    assert "restriction" in line
    (line,) = [x for x in text.splitlines() if x.strip().startswith("2025: more than")]
    assert "restriction" not in line


def test_report_is_plain_ascii_for_the_windows_console():
    assert report().isascii()


def test_budget_adds_up_and_fails_over_the_limit():
    assert check_budget({"a": 60, "b": 40}, limit=100) == 100
    with pytest.raises(PipelineError, match="101 bytes, over the 100-byte budget.*a 61"):
        check_budget({"a": 61, "b": 40}, limit=100)


def test_reference_sizes_ignore_line_endings(tmp_path):
    (tmp_path / "oblasts.csv").write_bytes(b"a\r\nb\r\n")
    assert reference_sizes(tmp_path) == {"oblasts.csv": 4}


# ---- the committed files ----

def test_committed_site_data_is_within_budget():
    sizes = reference_sizes(REFERENCE_DIR)
    assert set(sizes) == set(SITE_REFERENCE_FILES)
    for path in PROCESSED_DIR.glob("*.json"):
        sizes[path.name] = len(path.read_bytes().replace(b"\r\n", b"\n"))
    assert check_budget(sizes) <= BUDGET_BYTES


def test_the_budget_counts_every_data_file_the_site_imports():
    imported = set()
    for path in (ROOT / "site" / "src").rglob("*.ts"):
        imported |= set(re.findall(
            r'(?:from\s+|import\()\s*"[./]*data/(processed|reference)/([^"?]+)',
            path.read_text(encoding="utf-8"),
        ))
    assert imported, "found no data imports; has the way the site loads data changed?"
    for folder, name in imported:
        if folder == "processed":
            assert name.endswith(".json"), f"the budget doesn't count {name}"
        else:
            assert name in SITE_REFERENCE_FILES, f"add {name} to pipeline/budget.py"
