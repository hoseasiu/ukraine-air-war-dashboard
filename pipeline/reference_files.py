"""Reading the hand-editable CSVs in data/reference/."""

import csv

from pipeline.errors import PipelineError


def read_rows(path):
    try:
        with path.open(encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))
    except FileNotFoundError as error:
        raise PipelineError(f"Missing reference file {path}.") from error
