# /// script
# requires-python = ">=3.12"
# dependencies = ["shapely==2.1.2"]
# ///
"""Build the Admin-1 boundary file for the map (issue #4).

Run from anywhere:  uv run pipeline/reference/build_boundaries.py

Reads the OCHA COD-AB download in data/raw/ (see data/README.md) and
data/reference/oblasts.csv. Writes data/reference/ukraine_admin1.geojson.
License and border notes are in data/reference/gazetteer.md.

Rings are wound for d3-geo (outer rings clockwise), which is the opposite of
RFC 7946. With RFC 7946 winding, d3-geo would fill the rest of the globe.
"""

import csv
import hashlib
import json
import sys
import zipfile
from pathlib import Path

import shapely
from shapely.geometry import shape
from shapely.geometry.polygon import orient

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data" / "raw" / "ukr_admin_boundaries.geojson.zip"
SOURCE_SHA256 = "b8604bc983e1e54a6f7c10186a5cf8474cb8ed49eb038b4bef8091d92c286790"
MEMBER = "ukr_admin1.geojson"
GAZETTEER = ROOT / "data" / "reference" / "oblasts.csv"
OUTPUT = ROOT / "data" / "reference" / "ukraine_admin1.geojson"

# In degrees. Chosen for a country-wide map; not for measuring or locating.
TOLERANCE = 0.01
DECIMALS = 4

ATTRIBUTION = (
    'Boundaries: State Scientific Production Enterprise "Kartographia", '
    "via OCHA (COD-AB Ukraine v05, HDX). Simplified."
)
LICENSE = "CC BY-IGO: https://creativecommons.org/licenses/by/3.0/igo/legalcode"


def rounded(ring):
    """Round a ring and drop the repeated points that rounding creates."""
    points = []
    for x, y in ring:
        point = [round(x, DECIMALS), round(y, DECIMALS)]
        if not points or point != points[-1]:
            points.append(point)
    return points


def polygons(geometry):
    return list(geometry.geoms) if geometry.geom_type == "MultiPolygon" else [geometry]


def clockwise_rings(geometry):
    out = []
    for polygon in polygons(geometry):
        # sign=-1: outer ring clockwise, holes counterclockwise.
        wound = orient(polygon, sign=-1.0)
        rings = [rounded(r.coords) for r in (wound.exterior, *wound.interiors)]
        out.append(rings)
    return out


def main():
    if not SOURCE.exists():
        sys.exit(f"Missing {SOURCE}. See data/README.md.")
    found = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if found != SOURCE_SHA256:
        sys.exit(f"{SOURCE.name} has SHA-256 {found}, not {SOURCE_SHA256}. "
                 "The download changed: review it, then update this script and the docs.")
    with zipfile.ZipFile(SOURCE) as archive:
        source = json.loads(archive.read(MEMBER).decode("utf-8"))

    with GAZETTEER.open(encoding="utf-8", newline="") as f:
        areas = {r["boundary_pcode"]: r for r in csv.DictReader(f)}
    by_code = {f["properties"]["adm1_pcode"]: f for f in source["features"]}
    if set(by_code) != set(areas) or len(by_code) != len(source["features"]):
        sys.exit("Boundary P-codes don't match oblasts.csv: "
                 f"only in file {sorted(set(by_code) - set(areas))}, "
                 f"only in table {sorted(set(areas) - set(by_code))}")

    codes = sorted(areas, key=lambda c: areas[c]["iso_3166_2"])
    shapes = [shape(by_code[c]["geometry"]) for c in codes]
    if not shapely.coverage_is_valid(shapes):
        sys.exit("Source polygons aren't a valid coverage; shared edges don't match.")
    # Simplifies each shared edge once, so neighbors stay joined.
    simple = shapely.coverage_simplify(shapes, TOLERANCE)

    features = []
    for code, geometry in zip(codes, simple, strict=True):
        parts = clockwise_rings(geometry)
        result = ({"type": "Polygon", "coordinates": parts[0]} if len(parts) == 1
                  else {"type": "MultiPolygon", "coordinates": parts})
        if not shape(result).is_valid:
            sys.exit(f"Invalid geometry after rounding: {areas[code]['name']}")
        features.append({
            "type": "Feature",
            "properties": {"iso_3166_2": areas[code]["iso_3166_2"],
                           "name": areas[code]["name"]},
            "geometry": result,
        })

    collection = {"type": "FeatureCollection", "attribution": ATTRIBUTION,
                  "license": LICENSE, "features": features}
    text = json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n"
    OUTPUT.write_text(text, encoding="utf-8", newline="\n")

    before = sum(shapely.get_num_coordinates(s) for s in shapes)
    after = sum(shapely.get_num_coordinates(shape(f["geometry"])) for f in features)
    total = shapely.union_all(shapes)
    drawn = shapely.union_all([shape(f["geometry"]) for f in features])
    print(f"features {len(features)}; points {before:,} -> {after:,}; "
          f"bytes {len(text.encode()):,}")
    print("bounds (lon/lat):", [round(v, 2) for v in drawn.bounds])
    print(f"area changed against source: {drawn.symmetric_difference(total).area / total.area:.3%}")
    overlap = sum(shape(f["geometry"]).area for f in features) - drawn.area
    print(f"overlap between features after rounding (share of area): {overlap / drawn.area:.6%}")


if __name__ == "__main__":
    main()
