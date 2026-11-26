"""The data build.

It checks the inputs, writes the manifest, the snapshot date, the alert tables and
the strike tables, and prints the summary report.
"""

import json
from datetime import date

from pipeline.alerts import OFFICIAL, build_tables
from pipeline.budget import BUDGET_BYTES, check_budget, reference_sizes
from pipeline.columns import read_raw
from pipeline.errors import PipelineError
from pipeline.gazetteer import load_gazetteer
from pipeline.sources import (
    ALERTS_COMMIT,
    ALERTS_REPO,
    ALERTS_SHA256,
    KAGGLE_DAILY,
    KAGGLE_FILES,
    KAGGLE_LICENSE,
    KAGGLE_URL,
    REFERENCE_DIR,
    fetch_alerts,
    require_kaggle,
    sha256_of,
)
from pipeline.strikes import build_strike_tables
from pipeline.summary import summary_report
from pipeline.weapon_classes import load_weapon_classes

# `time_end` comes as a date, with or without a time of day, sometimes with trailing spaces.
TIME_END = r"\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?"


def snapshot_date(daily):
    """The latest `time_end` date in the daily strike file, as YYYY-MM-DD.

    It comes from the data, not from file timestamps, which change when files are
    copied. It describes the strike data only; alert figures end at July 2026.
    """
    if daily.empty:
        raise PipelineError(f"{KAGGLE_DAILY} has no rows.")
    ends = daily["time_end"].str.strip()
    bad = ends[~ends.str.fullmatch(TIME_END)]
    if not bad.empty:
        raise PipelineError(
            f"{KAGGLE_DAILY} has {len(bad)} unreadable time_end value(s), "
            f"such as {bad.iloc[0]!r}."
        )
    try:
        return max(date.fromisoformat(day) for day in set(ends.str[:10])).isoformat()
    except ValueError as error:
        raise PipelineError(f"{KAGGLE_DAILY} has an impossible time_end date: {error}") from error


def describe(raw_dir, name, frame):
    path = raw_dir / name
    return {
        "name": name,
        "rows": len(frame),
        "bytes": path.stat().st_size,
        "sha256": sha256_of(path),
    }


def render_json(value):
    return json.dumps(value, indent=2) + "\n"


def dump_lines(items, opener, closer, indent):
    """One item per line, so a rebuild gives a readable diff and the file stays small."""
    pad = " " * indent
    body = ",\n".join(f"{pad}  {item}" for item in items)
    return f"{opener}\n{body}\n{pad}{closer}"


def compact(value):
    return json.dumps(value, separators=(",", ":"))


def render_table(table):
    """Like render_json, but with one row (or one area's series) per line."""
    parts = []
    for key, value in table.items():
        if key == "rows":
            text = dump_lines(map(compact, value), "[", "]", 2)
        elif key == "hours":
            text = dump_lines(
                (f"{compact(k)}:{compact(v)}" for k, v in value.items()), "{", "}", 2
            )
        else:
            text = compact(value)
        parts.append(f"{compact(key)}: {text}")
    return dump_lines(parts, "{", "}", 0) + "\n"


def build(raw_dir, out_dir, alert_checksums=ALERTS_SHA256, reference_dir=REFERENCE_DIR):
    # Kaggle first: it can't be downloaded, so fail before fetching anything.
    require_kaggle(raw_dir)
    fetch_alerts(raw_dir, alert_checksums)

    kaggle = {name: read_raw(raw_dir, name) for name in KAGGLE_FILES}
    snapshot = snapshot_date(kaggle[KAGGLE_DAILY])
    alerts = {name: read_raw(raw_dir, name) for name in alert_checksums}
    # Build every table before writing anything, so a failure leaves no mixed outputs.
    alert_source = {
        "url": f"https://github.com/{ALERTS_REPO}",
        "commit": ALERTS_COMMIT,
        "license": "MIT",
    }
    monthly, daily = build_tables(alerts[OFFICIAL], load_gazetteer(reference_dir), alert_source)
    kaggle_source = {"url": KAGGLE_URL, "license": KAGGLE_LICENSE}
    nights, monthly_by_class, reconciliation = build_strike_tables(
        kaggle[KAGGLE_DAILY], load_weapon_classes(reference_dir), kaggle_source
    )
    manifest = {
        "snapshot_date": snapshot,
        "sources": {
            "kaggle": {
                **kaggle_source,
                "files": [describe(raw_dir, name, frame) for name, frame in kaggle.items()],
            },
            "alerts": {
                **alert_source,
                "files": [describe(raw_dir, name, frame) for name, frame in alerts.items()],
            },
        },
    }

    # No build time in any file: the same inputs must give the same bytes.
    outputs = {
        "manifest.json": render_json(manifest),
        "build_info.json": render_json({"snapshot_date": snapshot}),
        "alert_hours_monthly.json": render_table(monthly),
        "alert_daily.json": render_table(daily),
        "nights.json": render_table(nights),
        "monthly_by_class.json": render_table(monthly_by_class),
        "strike_reconciliation.json": render_json(reconciliation),
    }
    sizes = {name: len(content.encode("utf-8")) for name, content in outputs.items()}
    sizes.update(reference_sizes(reference_dir))
    check_budget(sizes)

    out_dir.mkdir(parents=True, exist_ok=True)
    for name, content in outputs.items():
        (out_dir / name).write_text(content, encoding="utf-8", newline="\n")
        print(f"Wrote {name}")
    print(
        f"Snapshot date: {snapshot}. Alert figures run {monthly['first_day']} to "
        f"{monthly['last_day']}. Strike figures run {nights['first_day']} to "
        f"{nights['last_day']}."
    )
    print()
    print(
        summary_report(nights, monthly_by_class, monthly, reconciliation, sizes, BUDGET_BYTES)
    )
