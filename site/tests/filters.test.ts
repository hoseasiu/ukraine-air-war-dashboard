import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultFilters,
  filterSearch,
  monthFromNumber,
  monthNumber,
  parseFilters,
  type FilterBounds,
  type Filters,
} from "../src/filters/state.ts";
import { CLASS_IDS } from "../src/theme/classStyles.ts";

const bounds: FilterBounds = {
  firstMonth: "2022-03",
  lastMonth: "2026-11",
  oblastIds: ["UA-30", "UA-46", "UA-63", "UA-65"],
};

test("an empty query string gives the defaults, and the defaults write nothing", () => {
  assert.deepEqual(parseFilters("", bounds), defaultFilters(bounds));
  assert.equal(filterSearch(defaultFilters(bounds), bounds), "");
});

test("filters survive a round trip through the URL", () => {
  const cases: Filters[] = [
    { from: "2023-01", to: "2024-12", classes: ["cruise", "ballistic"], oblasts: ["UA-63", "UA-30", "UA-46"] },
    { from: "2022-03", to: "2022-03", classes: [], oblasts: [] },
    { from: "2026-11", to: "2026-11", classes: [...CLASS_IDS], oblasts: ["UA-65"] },
  ];
  for (const filters of cases) {
    assert.deepEqual(parseFilters(filterSearch(filters, bounds), bounds), filters);
  }
});

test("the query string is readable and leaves out filters at their defaults", () => {
  const filters: Filters = { ...defaultFilters(bounds), from: "2023-01", classes: ["cruise", "ballistic"] };
  assert.equal(filterSearch(filters, bounds), "?from=2023-01&classes=cruise,ballistic");
  assert.equal(filterSearch({ ...defaultFilters(bounds), classes: [] }, bounds), "?classes=none");
});

test("parameters that aren't filters are kept, and stale filters are removed", () => {
  assert.equal(filterSearch(defaultFilters(bounds), bounds, "?utm=x&from=2023-01"), "?utm=x");
});

test("encoded commas are read the same as plain ones", () => {
  assert.deepEqual(parseFilters("?oblasts=UA-63%2CUA-30", bounds).oblasts, ["UA-63", "UA-30"]);
});

test("months outside the data are moved to the nearest end", () => {
  const filters = parseFilters("?from=2001-01&to=2099-12", bounds);
  assert.deepEqual([filters.from, filters.to], ["2022-03", "2026-11"]);
});

test("a reversed date range is put in order", () => {
  const filters = parseFilters("?from=2025-06&to=2023-02", bounds);
  assert.deepEqual([filters.from, filters.to], ["2023-02", "2025-06"]);
});

test("unusable values fall back to the defaults", () => {
  for (const search of ["?from=2023-13&to=June", "?classes=", "?classes=guided_bomb,nope", "?oblasts=UA-09,Kyiv"]) {
    assert.deepEqual(parseFilters(search, bounds), defaultFilters(bounds), search);
  }
});

test("unknown classes are dropped and the rest keep chart order", () => {
  assert.deepEqual(parseFilters("?classes=ballistic,nope,shahed_drone,ballistic", bounds).classes, [
    "shahed_drone",
    "ballistic",
  ]);
});

test("at most three oblasts are taken, without repeats, in the order given", () => {
  assert.deepEqual(parseFilters("?oblasts=UA-65,UA-65,UA-09,UA-30,UA-46,UA-63", bounds).oblasts, [
    "UA-65",
    "UA-30",
    "UA-46",
  ]);
});

test("month numbers are consecutive across a new year", () => {
  assert.equal(monthNumber("2024-01") - monthNumber("2023-12"), 1);
  for (const month of ["2022-03", "2023-12", "2024-01", "2026-11"]) {
    assert.equal(monthFromNumber(monthNumber(month)), month);
  }
});
