"""The weapon-class tables in data/reference/ (rules: data/reference/README.md)."""

from dataclasses import dataclass

from pipeline.errors import PipelineError
from pipeline.reference_files import read_rows


@dataclass(frozen=True)
class WeaponClass:
    id: str
    counts_in_totals: bool
    own_intercept_rate: bool


@dataclass(frozen=True)
class WeaponClasses:
    classes: dict  # class id -> WeaponClass, in the table's order
    models: dict  # exact raw `model` string -> class id


def _yes_no(row, column):
    if row[column] not in ("yes", "no"):
        raise PipelineError(f"weapon_classes.csv: {column} must be yes or no for {row['class']}.")
    return row[column] == "yes"


def load_weapon_classes(reference_dir):
    classes = {}
    for row in read_rows(reference_dir / "weapon_classes.csv"):
        if row["class"] in classes:
            raise PipelineError(f"weapon_classes.csv lists {row['class']!r} twice.")
        classes[row["class"]] = WeaponClass(
            row["class"], _yes_no(row, "counts_in_totals"), _yes_no(row, "own_intercept_rate")
        )
    models = {}
    for row in read_rows(reference_dir / "model_classes.csv"):
        if row["model"] in models:
            raise PipelineError(f"model_classes.csv maps {row['model']!r} twice.")
        if row["class"] not in classes:
            raise PipelineError(
                f"model_classes.csv: unknown class {row['class']!r} for {row['model']!r}."
            )
        models[row["model"]] = row["class"]
    return WeaponClasses(classes, models)
