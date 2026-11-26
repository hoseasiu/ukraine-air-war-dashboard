import assert from "node:assert/strict";
import { test } from "node:test";
import { chartFlags, monthPeriod, type ColumnSpec, type Measure } from "../src/chart/flags.ts";

const number = (key: string, measure: Measure): ColumnSpec => ({ key, label: key, type: "number", measure });
const before = { from: "2025-01-01", to: "2026-08-11" };
const spanning = { from: "2026-08-01", to: "2026-08-31" };

test("every interception measure gets the EW caveat, with no row flags at all", () => {
  for (const measure of ["destroyed", "not_intercepted", "intercept_rate"] as const) {
    const flags = chartFlags({ columns: [number("value", measure)], rows: [{}], coverage: before });
    assert.ok(flags.includes("destroyed_includes_ew"), measure);
  }
});

test("a row flag of false can't remove a required badge", () => {
  const flags = chartFlags({
    columns: [number("intercept_rate", "intercept_rate")],
    rows: [{ destroyed_includes_ew: false, ballistic_restricted: false }],
    coverage: spanning,
  });
  assert.deepEqual(flags, ["destroyed_includes_ew", "ballistic_restricted"]);
});

test("launch-based figures are flagged from Aug 12, 2026", () => {
  const columns = [number("launched", "launched")];
  const flagged = (to: string) =>
    chartFlags({ columns, rows: [], coverage: { from: "2026-01-01", to } }).includes("ballistic_restricted");
  assert.equal(flagged("2026-08-11"), false);
  assert.equal(flagged("2026-08-12"), true);
  assert.equal(flagged("2026-11-21"), true);
  for (const measure of ["launch_derived", "destroyed", "intercept_rate"] as const) {
    assert.ok(chartFlags({ columns: [number("v", measure)], rows: [], coverage: spanning }).includes("ballistic_restricted"));
  }
});

test("per-row coverage flags a chart when any row reaches the date", () => {
  const input = {
    columns: [number("launched", "launched")],
    coverage: (row: { month: string }) => monthPeriod(row.month),
  };
  assert.deepEqual(chartFlags({ ...input, rows: [{ month: "2026-07" }] }), []);
  assert.deepEqual(chartFlags({ ...input, rows: [{ month: "2026-07" }, { month: "2026-08" }] }), ["ballistic_restricted"]);
});

test("a pipeline row flag adds a badge that the date rule wouldn't", () => {
  const flags = chartFlags({
    columns: [number("launched", "launched")],
    rows: [{ ballistic_restricted: 1 }],
    coverage: before,
  });
  assert.deepEqual(flags, ["ballistic_restricted"]);
});

test("a class breakdown of launches says that mixed rows aren't split", () => {
  const flags = chartFlags({
    columns: [{ key: "class", label: "Class", type: "class" }, number("launched", "launched")],
    rows: [],
    coverage: before,
  });
  assert.deepEqual(flags, ["classes_not_split"]);
});

test("alert charts show the excluded regions, and the 2025 change when they reach it", () => {
  const columns = [number("hours", "alert_hours")];
  const early = { from: "2022-04-01", to: "2024-12-31" };
  assert.deepEqual(chartFlags({ columns, rows: [], coverage: early }), ["alert_regions_excluded"]);
  assert.deepEqual(chartFlags({ columns, rows: [{ alert_end_assumed: true }], coverage: spanning }), [
    "alert_end_assumed",
    "alert_regions_excluded",
    "alert_granularity_change",
  ]);
});

test("a caveated figure declared as another measure is refused", () => {
  for (const [key, measure] of [
    ["destroyed", "launched"],
    ["intercept_rate", "launch_derived"],
    ["launched", "alert_count"],
  ] as const) {
    assert.throws(() => chartFlags({ columns: [number(key, measure)], rows: [], coverage: spanning }), /looks like/);
  }
});

test("bad input fails loudly instead of dropping a flag", () => {
  const columns = [number("launched", "launched")];
  assert.throws(() => chartFlags({ columns: [], rows: [], coverage: spanning }), /numeric column/);
  assert.throws(() => chartFlags({ columns, rows: [], coverage: { from: "2026-08", to: "2026-09" } }), /YYYY-MM-DD/);
  assert.throws(() => chartFlags({ columns, rows: [], coverage: { from: "2026-09-01", to: "2026-08-01" } }), /ordered/);
  assert.throws(() => chartFlags({ columns, rows: [{ ballistic_restricted: "false" }], coverage: before }), /boolean/);
  assert.throws(() => monthPeriod("2026-13"), /YYYY-MM-DD/);
  assert.equal(monthPeriod("2028-02").to, "2028-02-29");
});
