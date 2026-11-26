# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Check the oblast gazetteer against the raw data (issue #4).

Run from anywhere:  uv run pipeline/audit/gazetteer.py

Reads data/raw/ and data/reference/, writes nothing, and exits nonzero if

* an oblast name in either alert file, or a Kaggle `affected region` item,
  has no exact match in oblast_aliases.csv;
* the raion names in the official alert file differ from raions.csv; or
* the `seen_in` column disagrees with the files it can check.

The `_uk` alert files aren't in data/raw/, so their `seen_in` values aren't
rechecked here.
"""

import ast
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
REFERENCE = ROOT / "data" / "reference"

# seen_in value -> (raw file, column holding one area name)
ALERT_FILES = {
    "alerts_official_en": ("official_data_en.csv", "oblast"),
    "alerts_volunteer_en": ("volunteer_data_en.csv", "region"),
}
KAGGLE = "kaggle_affected_region"


def read(path):
    if not path.exists():
        sys.exit(f"Missing {path}. See data/README.md.")
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    areas = {r["iso_3166_2"]: r for r in read(REFERENCE / "oblasts.csv")}
    aliases = {r["alias"]: r for r in read(REFERENCE / "oblast_aliases.csv")}
    listed = defaultdict(set)
    for r in read(REFERENCE / "raions.csv"):
        listed[r["iso_3166_2"]].add(r["raion"])

    problems = []
    found = {}
    official = []
    for source, (name, column) in ALERT_FILES.items():
        rows = read(RAW / name)
        found[source] = Counter(r[column] for r in rows)
        if source == "alerts_official_en":
            official = rows

    items = Counter()
    lists = 0
    for row in read(RAW / "missile_attacks_daily.csv"):
        text = row["affected region"]
        if text:
            lists += 1
            # A Python-style list stored as text. Items are matched exactly.
            items.update(ast.literal_eval(text))
    found[KAGGLE] = items

    for source, values in found.items():
        unmatched = sorted(set(values) - set(aliases))
        for value in unmatched:
            problems.append(f"{source}: no alias for {value!r} ({values[value]} uses)")
        types = Counter(aliases[v]["match_type"] for v in values if v in aliases)
        print(f"{source}: {len(values)} distinct values, "
              f"{len(values) - len(unmatched)} resolve; by match type {dict(types)}")
        if source != KAGGLE:
            for value in values:
                if value in aliases and not aliases[value]["iso_3166_2"]:
                    problems.append(f"{source}: {value!r} doesn't name one area")
    print(f"rows with a non-blank `affected region`: {lists:,}")

    for alias, row in aliases.items():
        claimed = set(row["seen_in"].split(";")) - {""}
        for source, values in found.items():
            if (source in claimed) != (alias in values):
                problems.append(f"seen_in for {alias!r} is wrong about {source}")

    raions = defaultdict(set)
    for row in official:
        alias = aliases.get(row["oblast"])
        if alias and row["raion"]:
            raions[alias["iso_3166_2"]].add(row["raion"])
        if row["level"] == "raion" and not row["raion"]:
            problems.append(f"raion-level row with no raion: {row['oblast']}")
    for iso in sorted(set(raions) | set(listed)):
        name = areas[iso]["name"] if iso in areas else iso
        for raion in sorted(raions[iso] - listed[iso]):
            problems.append(f"{name}: {raion!r} is in the data, not in raions.csv")
        for raion in sorted(listed[iso] - raions[iso]):
            problems.append(f"{name}: {raion!r} is in raions.csv, not in the data")
    print(f"official raion names: {sum(map(len, raions.values()))} "
          f"in {len(raions)} areas; raions.csv has {sum(map(len, listed.values()))}")

    included = {i for i, r in areas.items() if r["in_alert_totals"] == "yes"}
    present = {aliases[v]["iso_3166_2"] for v in found["alerts_official_en"] if v in aliases}
    for iso in sorted(included - present):
        problems.append(f"{areas[iso]['name']}: in alert totals but has no official rows")
    print(f"areas in alert totals: {len(included)}; excluded:",
          sorted(areas[i]["name"] for i in set(areas) - included))

    if problems:
        print("\nFAILED:")
        for problem in problems:
            print("  " + problem)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
