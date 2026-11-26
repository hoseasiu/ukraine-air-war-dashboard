"""The oblast gazetteer in data/reference/ (rules: data/reference/gazetteer.md)."""

from dataclasses import dataclass

from pipeline.errors import PipelineError
from pipeline.reference_files import read_rows


@dataclass(frozen=True)
class Area:
    iso: str
    name: str
    kind: str
    in_alert_totals: bool
    exclusion_reason: str


@dataclass(frozen=True)
class Gazetteer:
    areas: dict  # ISO 3166-2 code -> Area
    aliases: dict  # exact spelling -> ISO code, or "" for nationwide
    raions: dict  # ISO code -> frozenset of raion names, as in the official alert file


def load_gazetteer(reference_dir):
    areas = {}
    for row in read_rows(reference_dir / "oblasts.csv"):
        if row["in_alert_totals"] not in ("yes", "no"):
            raise PipelineError(
                f"oblasts.csv: in_alert_totals must be yes or no for {row['name']}."
            )
        areas[row["iso_3166_2"]] = Area(
            iso=row["iso_3166_2"],
            name=row["name"],
            kind=row["kind"],
            in_alert_totals=row["in_alert_totals"] == "yes",
            exclusion_reason=row["alert_exclusion_reason"],
        )
    aliases = {r["alias"]: r["iso_3166_2"] for r in read_rows(reference_dir / "oblast_aliases.csv")}
    raions = {}
    for row in read_rows(reference_dir / "raions.csv"):
        raions.setdefault(row["iso_3166_2"], set()).add(row["raion"])
    return Gazetteer(areas, aliases, {iso: frozenset(names) for iso, names in raions.items()})
