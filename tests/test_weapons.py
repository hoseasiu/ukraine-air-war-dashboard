"""Checks the hand-edited weapon reference tables. Standard library only."""

import datetime
import unittest

from pipeline.reference.weapon_summary import MEASURES, REFERENCE, read, render, replace_summary

CLASSES = {"shahed_drone", "cruise", "ballistic", "aeroballistic_hypersonic", "antiship_other"}
UNITS = {
    "length": {"m"},
    "wingspan": {"m"},
    "diameter": {"m"},
    "warhead": {"kg"},
    "range": {"km"},
    "speed": {"km/h", "m/s", "Mach"},
}
# Sea-level conversions, used only to sort a published speed into a category.
KMH = {"km/h": 1, "m/s": 3.6, "Mach": 1225}
CATEGORIES = {"subsonic", "supersonic", "hypersonic", "unknown"}
COLUMNS = {
    "weapon_members.csv": [
        "member", "class", "name", "model_strings", "role", "role_sources",
        "launch_platform", "platform_sources", "speed_category", "speed_sources", "note",
    ],
    "weapon_figures.csv": ["member", "measure", "low", "high", "unit", "source", "note"],
    "weapon_sources.csv": [
        "source", "publisher", "title", "kind", "url", "page_date", "checked_on",
    ],
}


def split(value):
    return [item for item in value.split(";") if item]


def category(kmh):
    if kmh < KMH["Mach"]:
        return "subsonic"
    return "supersonic" if kmh <= 5 * KMH["Mach"] else "hypersonic"


class WeaponTablesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.members = read("weapon_members.csv")
        cls.figures = read("weapon_figures.csv")
        cls.sources = read("weapon_sources.csv")
        cls.models = read("model_classes.csv")

    def test_shape(self):
        for name, columns in COLUMNS.items():
            rows = read(name)
            self.assertTrue(rows, name)
            for row in rows:
                self.assertEqual(list(row), columns, name)
                self.assertNotIn(None, row.values(), name)

    def test_ids_unique(self):
        for rows, column in ((self.members, "member"), (self.sources, "source")):
            ids = [r[column] for r in rows]
            self.assertEqual(len(ids), len(set(ids)), column)

    def test_membership_follows_model_classes(self):
        classes = {r["model"]: r["class"] for r in self.models}
        listed = set()
        for m in self.members:
            self.assertIn(m["class"], CLASSES, m["member"])
            self.assertTrue(split(m["model_strings"]), m["member"])
            for model in split(m["model_strings"]):
                # A part of a combined row, such as Geran-2, may have no row of its own.
                if model in classes:
                    self.assertEqual(classes[model], m["class"], f"{m['member']}: {model}")
                listed.add((model, m["class"]))
        # Every string in the five classes, or each part of a combined one, has a member.
        for r in self.models:
            if r["class"] in CLASSES:
                for model in split(r["components"].replace("; ", ";")) or [r["model"]]:
                    self.assertIn((model, r["class"]), listed, r["model"])

    def test_listed_strings_are_in_the_mapping(self):
        known = {r["model"] for r in self.models}
        for r in self.models:
            known.update(split(r["components"].replace("; ", ";")))
        for m in self.members:
            self.assertLessEqual(set(split(m["model_strings"])), known, m["member"])

    def test_every_measure_has_a_row(self):
        have = {(r["member"], r["measure"]) for r in self.figures}
        want = {(m["member"], measure) for m in self.members for measure, _ in MEASURES}
        self.assertEqual(have, want)

    def test_figures_are_cited_or_unknown(self):
        sources = {r["source"] for r in self.sources}
        known, unknown = set(), set()
        for r in self.figures:
            key = (r["member"], r["measure"])
            label = " ".join(key)
            if r["low"] or r["high"]:
                known.add(key)
                self.assertIn(r["source"], sources, label)
                self.assertIn(r["unit"], UNITS[r["measure"]], label)
                self.assertGreater(float(r["low"]), 0, label)
                self.assertLessEqual(float(r["low"]), float(r["high"]), label)
            else:
                unknown.add(key)
                self.assertEqual((r["unit"], r["source"]), ("", ""), label)
                self.assertTrue(r["note"], f"{label}: say why it's unknown")
        self.assertFalse(known & unknown)

    def test_text_is_cited_or_unknown(self):
        sources = {r["source"] for r in self.sources}
        for m in self.members:
            for text, cites in (("role", "role_sources"), ("launch_platform", "platform_sources"),
                                ("speed_category", "speed_sources")):
                self.assertTrue(m[text], m["member"])
                self.assertEqual(m[text] == "unknown", not m[cites], f"{m['member']}: {text}")
                self.assertLessEqual(set(split(m[cites])), sources, m["member"])

    def test_speed_category_matches_figures(self):
        for m in self.members:
            self.assertIn(m["speed_category"], CATEGORIES, m["member"])
            speeds = [
                float(r["high"]) * KMH[r["unit"]] for r in self.figures
                if r["member"] == m["member"] and r["measure"] == "speed" and r["low"]
            ]
            if speeds:
                self.assertEqual(m["speed_category"], category(max(speeds)), m["member"])

    def test_sources(self):
        used = {r["source"] for r in self.figures if r["source"]}
        for m in self.members:
            for column in ("role_sources", "platform_sources", "speed_sources"):
                used.update(split(m[column]))
        self.assertEqual(used, {r["source"] for r in self.sources})
        for r in self.sources:
            self.assertTrue(r["url"].startswith("https://"), r["source"])
            self.assertIn(
                r["kind"], {"research", "ukrainian_official", "news", "encyclopedia"}, r["source"]
            )
            datetime.date.fromisoformat(r["checked_on"])
            if r["page_date"]:
                datetime.date.fromisoformat(r["page_date"])

    def test_summary_is_current(self):
        document = (REFERENCE / "weapons.md").read_text(encoding="utf-8")
        self.assertEqual(
            document, replace_summary(document, render()),
            "Run: uv run pipeline/reference/weapon_summary.py",
        )


if __name__ == "__main__":
    unittest.main()
