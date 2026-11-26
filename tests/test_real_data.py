"""Checks against the real files in data/raw/. Skipped where they're missing, as in CI.

The raw files are read here with the csv module and their own column names, so
these don't rely on the pipeline's reading, grouping or adding up.
"""

import csv
import json
from collections import Counter
from datetime import datetime

import pytest

from pipeline.build import build
from pipeline.sources import (
    ALERTS_SHA256,
    KAGGLE_DAILY,
    KAGGLE_FILES,
    PROCESSED_DIR,
    RAW_DIR,
    REFERENCE_DIR,
)
from pipeline.strikes import NATIONAL_ACCOUNTS, account_of

# Every raw file must be there, so that no test run starts a download.
MISSING = [n for n in (*KAGGLE_FILES, *ALERTS_SHA256) if not (RAW_DIR / n).is_file()]
pytestmark = pytest.mark.skipif(
    bool(MISSING), reason=f"needs real files in data/raw/ (see data/README.md): {MISSING}"
)

# Files in data/processed/ that the build doesn't write.
NOT_BUILT = {"LICENSE.md", ".gitkeep"}


def raw_rows(name, folder=RAW_DIR):
    with (folder / name).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def number(text):
    return int(float(text)) if text else 0


def processed(name):
    return json.loads((PROCESSED_DIR / name).read_text(encoding="utf-8"))


def test_one_build_reproduces_every_processed_file(tmp_path, capsys):
    build(RAW_DIR, tmp_path)
    committed = {p.name for p in PROCESSED_DIR.iterdir()} - NOT_BUILT
    assert {p.name for p in tmp_path.iterdir()} == committed
    for name in sorted(committed):
        # Git may check files out with CRLF if .gitattributes is ever lost.
        expected = (PROCESSED_DIR / name).read_bytes().replace(b"\r\n", b"\n")
        assert (tmp_path / name).read_bytes() == expected, f"{name} is out of date"
    report = capsys.readouterr().out
    assert "Summary report" in report and "Guided stop 1" in report


def test_every_raw_model_string_has_a_class():
    mapped = {r["model"] for r in raw_rows("model_classes.csv", REFERENCE_DIR)}
    assert {r["model"] for r in raw_rows(KAGGLE_DAILY)} - mapped == set()


def test_monthly_launches_reconcile_with_the_raw_rows():
    classes = {r["model"]: r["class"] for r in raw_rows("model_classes.csv", REFERENCE_DIR)}
    counted = {
        r["class"]
        for r in raw_rows("weapon_classes.csv", REFERENCE_DIR)
        if r["counts_in_totals"] == "yes"
    }
    rows = raw_rows(KAGGLE_DAILY)
    expected = Counter()
    for r in rows:
        class_id = classes[r["model"]]
        if (
            class_id in counted
            and account_of(r["source"]) in NATIONAL_ACCOUNTS
            and r["status_data"] != "hidden"
        ):
            expected[r["time_end"].strip()[:7], class_id] += number(r["launched"])
    found = {
        (r["month"], r["class"]): r["launched"] or 0
        for r in processed("monthly_by_class.json")["rows"]
    }
    # A month with only hidden rows has a table row and no raw launches to add.
    assert {key: value for key, value in found.items() if value} == +expected

    raw = processed("strike_reconciliation.json")["raw_daily_file"]
    assert raw["rows"] == len(rows)
    for column in ("launched", "destroyed"):
        assert raw[f"{column}_as_published"] == sum(number(r[column]) for r in rows)


@pytest.mark.parametrize("name", sorted(ALERTS_SHA256))
def test_raw_alert_durations_are_not_negative(name):
    rows = raw_rows(name)
    assert rows
    negative = [
        r for r in rows
        if datetime.fromisoformat(r["finished_at"]) < datetime.fromisoformat(r["started_at"])
    ]
    assert not negative, negative[:3]
