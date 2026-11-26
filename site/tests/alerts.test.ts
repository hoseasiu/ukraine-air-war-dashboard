import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { mapRows, monthsInRange, nearestMonth, parseAlertMonthly, parseBoundaries } from "../src/alerts/alertData.ts";
import { parseAreas } from "../src/buildData.ts";
import { chartFlags, monthPeriod, type ColumnSpec } from "../src/chart/flags.ts";
import { ALERT_BINS, alertBin } from "../src/theme/alertScale.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const areas = parseAreas(read("../../data/reference/oblasts.csv"));
const json = JSON.parse(read("../../data/processed/alert_hours_monthly.json"));
const table = parseAlertMonthly(json, areas);
const changed = (change: (rows: Record<string, unknown>[]) => void) => {
  const copy = structuredClone(json);
  change(copy.rows);
  return copy;
};

test("the committed table covers every included area in every month", () => {
  assert.equal(table.months[0], "2022-04");
  assert.equal(table.months.at(-1), "2026-07");
  assert.equal(table.months.length, 52);
  assert.equal(table.rows.length, 24 * 52);
});

test("a table with a missing, repeated, unknown or negative row is rejected", () => {
  assert.throws(() => parseAlertMonthly(changed((rows) => rows.pop()), areas), /expected 1248 rows/);
  assert.throws(() => parseAlertMonthly(changed((rows) => rows.push(rows[0]!)), areas), /repeated/);
  assert.throws(() => parseAlertMonthly(changed((rows) => (rows[0]!.oblast = "UA-43")), areas), /not an area/);
  assert.throws(() => parseAlertMonthly(changed((rows) => (rows[0]!.hours = -1)), areas), /at least 0/);
  assert.throws(() => parseAlertMonthly(changed((rows) => (rows[0]!.hours = null)), areas), /at least 0/);
  assert.throws(() => parseAlertMonthly(changed((rows) => (rows[0]!.alert_end_assumed = "false")), areas), /true or false/);
});

test("the map has a row for every area, with excluded areas unknown rather than zero", () => {
  const rows = mapRows(table, areas, "2026-07");
  assert.equal(rows.length, 27);
  assert.deepEqual(
    rows.filter((row) => !row.included).map((row) => row.oblast).sort(),
    ["UA-09", "UA-40", "UA-43"],
  );
  for (const row of rows) {
    if (row.included) assert.equal(typeof row.hours, "number");
    else assert.deepEqual([row.hours, row.n_alerts, row.alert_regions_excluded], [null, null, true]);
  }
  assert.deepEqual(rows.map((row) => row.name), rows.map((row) => row.name).sort((a, b) => a.localeCompare(b, "en")));
});

test("the month filter limits the slider to months with alert figures", () => {
  assert.deepEqual(monthsInRange(table, "2022-03", "2022-05"), ["2022-04", "2022-05"]);
  assert.deepEqual(monthsInRange(table, "2026-07", "2026-11"), ["2026-07"]);
  assert.deepEqual(monthsInRange(table, "2026-08", "2026-11"), []);
});

test("the map keeps its month where it can, and otherwise takes the nearest", () => {
  const months: [string, ...string[]] = ["2023-01", "2023-02", "2023-03"];
  assert.equal(nearestMonth(months, undefined), "2023-03");
  assert.equal(nearestMonth(months, "2023-02"), "2023-02");
  assert.equal(nearestMonth(months, "2022-06"), "2023-01");
  assert.equal(nearestMonth(months, "2024-06"), "2023-03");
});

test("map months get the exclusion badge, and the alert-area badge from 2025", () => {
  const columns: ColumnSpec[] = [{ key: "hours", label: "Hours", type: "number", measure: "alert_hours" }];
  const flags = (month: string) =>
    chartFlags({ columns, rows: mapRows(table, areas, month), coverage: monthPeriod(month) });
  assert.ok(flags("2023-06").includes("alert_regions_excluded"));
  assert.ok(!flags("2023-06").includes("alert_granularity_change"));
  assert.ok(flags("2025-12").includes("alert_granularity_change"));
});

test("color steps include their lower edge and cover every value", () => {
  assert.equal(alertBin(0), ALERT_BINS[0]);
  assert.equal(alertBin(24.99), ALERT_BINS[0]);
  assert.equal(alertBin(25), ALERT_BINS[1]);
  assert.equal(alertBin(744), ALERT_BINS.at(-1));
});

test("there is exactly one boundary for each gazetteer area, with its credit", () => {
  const text = read("../../data/reference/ukraine_admin1.geojson");
  const boundaries = parseBoundaries(text, areas);
  assert.equal(boundaries.features.length, 27);
  assert.match(boundaries.attribution, /Kartographia/);
  assert.match(boundaries.license, /https:\/\/creativecommons\.org/);
  const short = JSON.parse(text);
  short.features.pop();
  assert.throws(() => parseBoundaries(JSON.stringify(short), areas), /disagree/);
});
