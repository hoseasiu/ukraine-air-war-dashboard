# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Check the weapon-class mapping against the raw strike data (issue #3).

Run from anywhere:  uv run pipeline/audit/weapon_classes.py

Reads data/raw/ and data/reference/, writes nothing, and exits nonzero if a
raw `model` string doesn't have exactly one valid mapping. It also prints the
figures quoted in data/reference/README.md. Those use every row as published,
so they show the effect of the class choices and aren't headline numbers.
"""

import csv
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DAILY = ROOT / "data" / "raw" / "missile_attacks_daily.csv"
CLASSES = ROOT / "data" / "reference" / "weapon_classes.csv"
MAPPING = ROOT / "data" / "reference" / "model_classes.csv"

# Components that never appear as a `model` string of their own.
COMPONENT_ONLY = {"Geran-2": "shahed_drone", "X-32": "antiship_other"}


def read(path):
    if not path.exists():
        sys.exit(f"Missing {path}. See data/README.md.")
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def number(value):
    return float(value) if value.strip() else 0.0


def components(row):
    return [c.strip() for c in row["components"].split(";") if c.strip()]


def expected_class(parts, by_model):
    """The draft rule for combined rows (data/reference/README.md)."""
    found = set()
    for part in parts:
        if part in by_model:
            found.add(by_model[part]["class"])
        elif part in COMPONENT_ONLY:
            found.add(COMPONENT_ONLY[part])
        else:
            return None
    if len(found) > 1:
        return "mixed_cruise" if found <= {"cruise", "mixed_cruise"} else "mixed"
    only = found.pop()
    # Plan section 4: several cruise missiles in one row go to mixed_cruise.
    return "mixed_cruise" if only == "cruise" else only


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    daily = read(DAILY)
    classes = {r["class"]: r for r in read(CLASSES)}
    mapping = read(MAPPING)

    models = Counter(r["model"] for r in daily)
    listed = Counter(r["model"] for r in mapping)
    by_model = {r["model"]: r for r in mapping}

    errors = []
    errors += [f"no mapping: {m!r}" for m in sorted(models.keys() - listed.keys())]
    errors += [f"mapped {n} times: {m!r}" for m, n in listed.items() if n > 1]
    errors += [f"unknown class {r['class']!r}: {r['model']!r}"
               for r in mapping if r["class"] not in classes]
    errors += [f"mapping not in the daily file: {m!r}"
               for m in sorted(listed.keys() - models.keys())]
    errors += [f"combined string without components: {m!r}"
               for m, r in by_model.items() if " and " in m and not components(r)]
    for row in mapping:
        parts = components(row)
        if not parts:
            continue
        if " and " in row["model"] and parts != row["model"].split(" and "):
            errors.append(f"components don't match the string: {row['model']!r}")
        want = expected_class(parts, by_model)
        if want is None:
            errors.append(f"unmapped component in {row['model']!r}")
        elif row["class"] != want:
            errors.append(f"{row['model']!r} is {row['class']}, "
                          f"but the combined-row rule gives {want}")
    if errors:
        print("FAILED")
        for e in errors:
            print("  " + e)
        sys.exit(1)
    print(f"OK: {len(models)} distinct model strings, each mapped exactly once.")

    total = defaultdict(lambda: [0, 0, 0.0, 0.0])  # strings, rows, launched, destroyed
    for m in models:
        total[by_model[m]["class"]][0] += 1
    for r in daily:
        t = total[by_model[r["model"]]["class"]]
        t[1] += 1
        t[2] += number(r["launched"])
        t[3] += number(r["destroyed"])

    print("\nBy class, all rows as published (hidden launched = 0 left in;")
    print("counts from Aug 2026 are affected by the missile-reporting restriction)")
    print(f"{'class':26}{'counted':>8}{'strings':>8}{'rows':>7}{'launched':>10}{'destroyed':>10}")
    for c, info in classes.items():
        s, n, launched, destroyed = total[c]
        print(f"{c:26}{info['counts_in_totals']:>8}{s:>8}{n:>7}{launched:>10.0f}{destroyed:>10.0f}")

    for label, keys in (("C-300 / C-400 only rows", {"C-300", "C-400", "C-300/C-400"}),
                        ("X-31 and X-35 family rows",
                         {"X-31", "X-31P", "X-31PD", "X-35", "X-35Y"}),
                        ("Unknown Missile rows", {"Unknown Missile"}),
                        ("Banderol rows", {"Banderol", "Banderol/Dan-T"}),
                        ("Geran rows", {m for m in models if m.startswith("Geran")}),
                        ("Lancet, Kub and Молнія rows",
                         {"Lancet", "Kub", "Молнія", "Молнія and Lancet"}),
                        ("other_uav rows",
                         {m for m in models if by_model[m]["class"] == "other_uav"})):
        rows = [r for r in daily if r["model"] in keys]
        print(f"\n{label}: {len(rows)} rows, "
              f"launched {sum(number(r['launched']) for r in rows):.0f}, "
              f"destroyed {sum(number(r['destroyed']) for r in rows):.0f}, "
              f"launched == destroyed in "
              f"{sum(number(r['launched']) == number(r['destroyed']) for r in rows)}")

    print("\nLaunched in combined rows that cross classes, and so leave every class rate")
    mixed = [r for r in daily if by_model[r["model"]]["class"] == "mixed"]
    holding = Counter()
    for r in mixed:
        touched = set()
        for part in components(by_model[r["model"]]):
            touched.add(by_model[part]["class"] if part in by_model else COMPONENT_ONLY[part])
        for c in touched:
            holding[c] += number(r["launched"])
    for c, launched in holding.most_common():
        print(f"  rows containing {c}: {launched:.0f} launched "
              f"(class's own rows: {total[c][2]:.0f})")
    print("  These overlap: one row counts under every class it contains.")

    print("\nNightly totals, keyed by end date (provisional: all accounts, no de-duplication)")
    for label, keep in (("counted classes only", {"yes"}),
                        ("every class", {"yes", "no"})):
        nights = defaultdict(float)
        for r in daily:
            if classes[by_model[r["model"]]["class"]]["counts_in_totals"] in keep:
                nights[r["time_end"][:10]] += number(r["launched"])
        values = list(nights.values())
        p95 = statistics.quantiles(values, n=20, method="inclusive")[-1]
        print(f"  {label}: {len(values)} nights, median {statistics.median(values):.0f}, "
              f"95th pct {p95:.1f}, nights >= 100: {sum(v >= 100 for v in values)}, "
              f"nights above 95th pct: {sum(v > p95 for v in values)}")


if __name__ == "__main__":
    main()
