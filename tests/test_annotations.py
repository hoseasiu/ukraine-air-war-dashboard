"""Checks the hand-edited annotation table. Standard library only."""

import csv
import datetime
import pathlib
import unittest

PATH = pathlib.Path(__file__).parents[1] / "data" / "reference" / "annotations.csv"
COLUMNS = [
    "id", "date", "date_marks", "label", "description", "source_url", "source_url_2",
    "verification", "checked_on", "owner_review", "origin", "notes",
]


class AnnotationsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with PATH.open(encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            cls.columns = reader.fieldnames
            cls.rows = list(reader)

    def test_shape(self):
        self.assertEqual(self.columns, COLUMNS)
        self.assertTrue(self.rows)
        for row in self.rows:
            # DictReader files extra fields under None and fills missing ones with None.
            self.assertNotIn(None, row, row["id"])
            self.assertNotIn(None, row.values(), row["id"])

    def test_ids_unique(self):
        ids = [r["id"] for r in self.rows]
        self.assertEqual(len(ids), len(set(ids)))

    def test_allowed_values(self):
        for r in self.rows:
            self.assertIn(r["verification"], {"verified", "unverified"}, r["id"])
            self.assertIn(r["owner_review"], {"pending", "approved", "rejected"}, r["id"])
            self.assertIn(r["origin"], {"issue", "kas"}, r["id"])

    def test_required_fields(self):
        for r in self.rows:
            for column in ("id", "date_marks", "label", "description"):
                self.assertTrue(r[column].strip(), f"{r['id']}: {column}")
            if r["verification"] == "verified":
                for column in ("date", "source_url", "checked_on"):
                    self.assertTrue(r[column], f"{r['id']}: {column}")

    def test_dates_and_urls(self):
        for r in self.rows:
            for column in ("date", "checked_on"):
                if r[column]:
                    datetime.date.fromisoformat(r[column])
            for column in ("source_url", "source_url_2"):
                if r[column]:
                    self.assertTrue(r[column].startswith("https://"), f"{r['id']}: {column}")

    def test_unverified_never_approved(self):
        for r in self.rows:
            if r["verification"] != "verified":
                self.assertNotEqual(r["owner_review"], "approved", r["id"])


if __name__ == "__main__":
    unittest.main()
