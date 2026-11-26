"""The data build.

A stub so far: it checks the inputs and writes the manifest and the snapshot date.
The strike tables (#7) and alert tables (#8) are added here.
"""

import json
from datetime import date

from pipeline.columns import read_raw
from pipeline.errors import PipelineError
from pipeline.sources import (
    ALERTS_COMMIT,
    ALERTS_REPO,
    ALERTS_SHA256,
    KAGGLE_DAILY,
    KAGGLE_FILES,
    KAGGLE_URL,
    fetch_alerts,
    require_kaggle,
    sha256_of,
)

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


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote {path.name}")


def build(raw_dir, out_dir, alert_checksums=ALERTS_SHA256):
    # Kaggle first: it can't be downloaded, so fail before fetching anything.
    require_kaggle(raw_dir)
    fetch_alerts(raw_dir, alert_checksums)

    kaggle = {name: read_raw(raw_dir, name) for name in KAGGLE_FILES}
    snapshot = snapshot_date(kaggle[KAGGLE_DAILY])
    manifest = {
        "snapshot_date": snapshot,
        "sources": {
            "kaggle": {
                "url": KAGGLE_URL,
                "license": "CC BY-NC-SA 4.0",
                "files": [describe(raw_dir, name, frame) for name, frame in kaggle.items()],
            },
            "alerts": {
                "url": f"https://github.com/{ALERTS_REPO}",
                "commit": ALERTS_COMMIT,
                "license": "MIT",
                "files": [
                    describe(raw_dir, name, read_raw(raw_dir, name)) for name in alert_checksums
                ],
            },
        },
    }

    # No build time in either file: the same inputs must give the same bytes.
    out_dir.mkdir(parents=True, exist_ok=True)
    write_json(out_dir / "manifest.json", manifest)
    write_json(out_dir / "build_info.json", {"snapshot_date": snapshot})
    print(f"Snapshot date: {snapshot}. No derived tables yet (#7, #8).")
