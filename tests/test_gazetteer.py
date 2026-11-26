"""Checks the oblast gazetteer and boundary file. Standard library only.

Needs no raw data; pipeline/audit/gazetteer.py checks against that.
"""

import csv
import json
import pathlib
import unittest
from itertools import pairwise

REFERENCE = pathlib.Path(__file__).parents[1] / "data" / "reference"


def read(name):
    with (REFERENCE / name).open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def signed_area(ring):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in pairwise(ring)) / 2


class GazetteerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.areas = read("oblasts.csv")
        cls.aliases = read("oblast_aliases.csv")
        cls.raions = read("raions.csv")
        cls.by_iso = {r["iso_3166_2"]: r for r in cls.areas}
        cls.lookup = {r["alias"]: r["iso_3166_2"] for r in cls.aliases}
        text = (REFERENCE / "ukraine_admin1.geojson").read_text(encoding="utf-8")
        cls.boundaries = json.loads(text)

    def test_areas_unique(self):
        self.assertEqual(len(self.areas), 27)
        for column in ("iso_3166_2", "name", "name_uk", "boundary_pcode"):
            self.assertEqual(len({r[column] for r in self.areas}), 27, column)
        for r in self.areas:
            self.assertRegex(r["iso_3166_2"], r"^UA-\d\d$")
            self.assertIn(r["kind"], {"oblast", "city", "autonomous_republic"})

    def test_alert_exclusions(self):
        for r in self.areas:
            self.assertIn(r["in_alert_totals"], {"yes", "no"})
            self.assertEqual(r["in_alert_totals"] == "no",
                             bool(r["alert_exclusion_reason"]), r["name"])
        excluded = {r["name"] for r in self.areas if r["in_alert_totals"] == "no"}
        self.assertEqual(excluded, {"Luhansk oblast", "Crimea", "Sevastopol"})

    def test_aliases(self):
        self.assertEqual(len(self.lookup), len(self.aliases), "duplicate alias")
        for r in self.aliases:
            self.assertEqual(r["alias"], r["alias"].strip())
            self.assertIn(r["match_type"], {"name", "typo", "city_within", "nationwide"})
            if r["match_type"] == "nationwide":
                self.assertEqual(r["iso_3166_2"], "", r["alias"])
            else:
                self.assertIn(r["iso_3166_2"], self.by_iso, r["alias"])
        for r in self.areas:
            for column in ("name", "name_uk"):
                self.assertEqual(self.lookup[r[column]], r["iso_3166_2"], r[column])

    def test_kyiv_city_and_oblast_stay_apart(self):
        for alias in ("Kyiv", "Kyiv City", "Kyiv city", "Київ", "м. Київ"):
            self.assertEqual(self.lookup[alias], "UA-30", alias)
        for alias in ("Kyiv oblast", "Kyivska oblast", "Київська область"):
            self.assertEqual(self.lookup[alias], "UA-32", alias)

    def test_boundary_codes_are_not_iso_codes(self):
        # The two schemes share digits for different areas, so join on the table.
        self.assertEqual(self.by_iso["UA-30"]["boundary_pcode"], "UA80")
        self.assertEqual(self.by_iso["UA-77"]["boundary_pcode"], "UA73")

    def test_raions(self):
        pairs = [(r["iso_3166_2"], r["raion"]) for r in self.raions]
        self.assertEqual(len(pairs), len(set(pairs)))
        self.assertEqual(len(pairs), 118)
        # Kyiv city is one unit; excluded areas need no denominator.
        expected = {r["iso_3166_2"] for r in self.areas
                    if r["in_alert_totals"] == "yes" and r["kind"] == "oblast"}
        self.assertEqual({iso for iso, _ in pairs}, expected)

    def test_boundaries_match_gazetteer(self):
        properties = [f["properties"] for f in self.boundaries["features"]]
        self.assertEqual(
            [(p["iso_3166_2"], p["name"]) for p in properties],
            sorted((r["iso_3166_2"], r["name"]) for r in self.areas))
        self.assertIn("Kartographia", self.boundaries["attribution"])
        self.assertIn("CC BY-IGO", self.boundaries["license"])

    def test_boundaries_wound_for_d3(self):
        for feature in self.boundaries["features"]:
            geometry = feature["geometry"]
            polygons = (geometry["coordinates"] if geometry["type"] == "MultiPolygon"
                        else [geometry["coordinates"]])
            for outer, *holes in polygons:
                for ring in (outer, *holes):
                    self.assertEqual(ring[0], ring[-1])
                self.assertLess(signed_area(outer), 0, feature["properties"]["name"])
                for hole in holes:
                    self.assertGreater(signed_area(hole), 0)


if __name__ == "__main__":
    unittest.main()
