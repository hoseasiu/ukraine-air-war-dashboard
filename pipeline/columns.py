"""The only place raw column names are renamed (AGENTS.md rule 4).

Files in data/raw/ keep their own names. Everything after `read_raw` uses the names
on the right. A header that doesn't match exactly stops the build, so a new or
renamed upstream column gets looked at instead of silently dropped.
"""

import pandas as pd

from pipeline.errors import PipelineError
from pipeline.sources import KAGGLE_DAILY, KAGGLE_REFERENCE


def _unchanged(*names):
    return {name: name for name in names}


# Each map is {raw name: pipeline name}.
COLUMNS = {
    KAGGLE_DAILY: {
        **_unchanged(
            "time_start", "time_end", "model", "launch_place", "target", "target_main",
            "status_data", "launched", "destroyed", "not_reach_goal", "still_attacking",
            "under_review", "num_hit_location", "num_fall_fragment_location", "is_shahed",
            "border_crossing", "carrier",
        ),
        "affected region": "affected_region",
        **_unchanged(
            "destroyed_types", "destroyed_details", "launched_details",
            "launch_place_details", "source",
        ),
    },
    KAGGLE_REFERENCE: {
        **_unchanged("model", "category", "national_origin", "type", "launch_platform", "name"),
        "name_NATO": "name_nato",
        "in_sevice": "in_service",
        **_unchanged("designer", "manufacturer", "guidance_system", "unit_cost"),
    },
    "official_data_en.csv": _unchanged(
        "oblast", "raion", "hromada", "level", "started_at", "finished_at", "source",
    ),
    "volunteer_data_en.csv": {
        "region": "oblast",
        **_unchanged("started_at", "finished_at", "naive"),
    },
}


def read_raw(raw_dir, name):
    """Read a raw file as text (blank stays "", nothing is coerced) with pipeline names."""
    try:
        frame = pd.read_csv(raw_dir / name, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    except (UnicodeDecodeError, pd.errors.ParserError, pd.errors.EmptyDataError) as error:
        raise PipelineError(f"Couldn't read {name}: {error}") from error
    expected = COLUMNS[name]
    missing = [c for c in expected if c not in frame.columns]
    unexpected = [c for c in frame.columns if c not in expected]
    if missing or unexpected:
        raise PipelineError(
            f"The columns in {name} don't match pipeline/columns.py. "
            f"Missing: {missing}. Unexpected: {unexpected}."
        )
    return frame.rename(columns=expected)
