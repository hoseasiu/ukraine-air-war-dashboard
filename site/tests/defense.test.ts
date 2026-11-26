import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chartFlags, monthPeriod, type ColumnSpec } from "../src/chart/flags.ts";
import { parseOutcomes, parseRates, RATE_CLASSES, RATE_SHOWN, rateRows, saturationRows } from "../src/defense/defenseData.ts";
import { allNights, type Selection } from "../src/strikes/strikeData.ts";
import { CLASS_IDS, type ClassId } from "../src/theme/classStyles.ts";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../data/processed/${name}`, import.meta.url), "utf8"));

const nightsJson = read("nights.json");
const monthlyJson = read("monthly_by_class.json");
const outcomes = parseOutcomes(nightsJson);
const rates = parseRates(monthlyJson);
const everything: Selection = { from: "2022-03", to: "2026-11", classes: CLASS_IDS };
const labels = Object.fromEntries(CLASS_IDS.map((id) => [id, id])) as Record<ClassId, string>;

const changed = (source: typeof monthlyJson, change: (json: typeof monthlyJson) => void) => {
  const json = structuredClone(source);
  change(json);
  return json;
};
const monthRow = (json: typeof monthlyJson, test: (row: Record<string, never>) => unknown) => json.rows.find(test);

test("tables with a missing caveat, a bad count or a revived rate are rejected", () => {
  const bad = (change: (json: typeof monthlyJson) => void, message: RegExp) =>
    assert.throws(() => parseRates(changed(monthlyJson, change)), message);
  const withRate = (j: typeof monthlyJson) => j.rows.find((r: { intercept_rate: number | null }) => r.intercept_rate !== null);

  bad((j) => (withRate(j).destroyed_includes_ew = false), /destroyed_includes_ew/);
  bad((j) => (withRate(j).intercept_rate = 0.12345), /disagrees with its counts/);
  bad((j) => (withRate(j).intercept_rate = null), /rate or a known gap reason/);
  bad((j) => (withRate(j).destroyed = withRate(j).launched_with_outcome + 1), /more destroyed/);
  bad((j) => (j.intercept_rate.missile_rates_end_before = "2026-12"), /must be 2026-08/);
  bad((j) => {
    const row = monthRow(j, (r: { class?: string; month?: string }) => r.class === "cruise" && r.month === "2026-09");
    Object.assign(row!, { intercept_rate: 1, intercept_rate_gap: null });
  }, /missile classes have no rate/);
  assert.throws(
    () => parseOutcomes(changed(nightsJson, (j) => (j.rows[0].destroyed = null))),
    /go together/,
  );
});

test("every month shown has a row for each rate class, so lines break wherever there is no rate", () => {
  const rows = rateRows(rates, everything);
  const months = new Set(rows.map((r) => r.month));
  assert.equal(months.size, 51);
  assert.equal(rows.length, months.size * RATE_CLASSES.length);
  assert.ok(!rows.some((r) => r.class === "mixed"));
  // The rates drawn are exactly the table's.
  assert.equal(
    rows.filter((r) => r.status === RATE_SHOWN).length,
    rates.rows.filter((r) => r.intercept_rate !== null).length,
  );
  for (const row of rows) {
    assert.equal(row.intercept_rate !== null, row.status === RATE_SHOWN, `${row.month} ${row.class}`);
  }
  assert.ok(rows.some((r) => r.status === "Gap: no report for this class"));
  assert.ok(rows.some((r) => r.status === "Gap: fewer than 10 launches with an outcome"));
  assert.ok(
    rows
      .filter((r) => r.status === "Gap: no report for this class")
      .every((r) => r.destroyed === null && r.launched_with_outcome === null),
  );
});

test("missile months from August 2026 have no rate and no counts that would give one back", () => {
  const later = rateRows(rates, { ...everything, from: "2026-08" });
  const missiles = later.filter((r) => r.class !== "shahed_drone");
  assert.ok(missiles.length > 0);
  for (const row of missiles) {
    assert.equal(row.status, "Gap: missile reporting restricted");
    assert.deepEqual([row.intercept_rate, row.destroyed, row.launched_with_outcome], [null, null, null]);
    assert.ok(row.ballistic_restricted);
  }
  assert.ok(later.some((r) => r.class === "shahed_drone" && r.status === RATE_SHOWN));
});

test("the rate and saturation figures carry the EW and restriction flags", () => {
  const rateColumns: ColumnSpec[] = [{ key: "intercept_rate", label: "Rate", type: "number", measure: "intercept_rate" }];
  // Even a selection with nothing but gaps keeps the caveat.
  const gaps = rateRows(rates, { from: "2022-09", to: "2022-09", classes: ["ballistic"] });
  assert.ok(gaps.every((r) => r.intercept_rate === null));
  assert.ok(
    chartFlags({ columns: rateColumns, rows: gaps, coverage: (r) => monthPeriod(r.month) }).includes(
      "destroyed_includes_ew",
    ),
  );
  const columns: ColumnSpec[] = [
    { key: "not_intercepted", label: "Not reported destroyed", type: "number", measure: "not_intercepted" },
  ];
  const flags = (to: string) =>
    chartFlags({
      columns,
      rows: saturationRows(outcomes, { ...everything, to }, labels),
      coverage: (r) => ({ from: r.date, to: r.date }),
    });
  assert.ok(flags("2026-07").includes("destroyed_includes_ew"));
  assert.ok(!flags("2026-07").includes("ballistic_restricted"));
  assert.ok(flags("2026-11").includes("ballistic_restricted"));
});

test("saturation has one row per night with a size, and never counts a missing outcome as destroyed", () => {
  const rows = saturationRows(outcomes, everything, labels);
  const sized = allNights(outcomes, CLASS_IDS).filter((n) => n.size !== null);
  assert.deepEqual(rows.map((r) => [r.date, r.size]), sized.map((n) => [n.date, n.size]));
  for (const row of rows) {
    if (row.launched_with_outcome === row.size) {
      assert.equal(row.not_intercepted, row.size - row.destroyed!);
    } else {
      assert.equal(row.not_intercepted, null, row.date);
    }
    assert.equal(row.destroyed_includes_ew, row.destroyed !== null);
  }
  // 25 cruise launched but only 7 with an outcome, and anti-ship with none.
  const partial = rows.find((r) => r.date === "2025-02-01")!;
  assert.deepEqual([partial.size, partial.launched_with_outcome, partial.not_intercepted], [162, 134, null]);
});

test("saturation mix, lead class and size follow the classes shown", () => {
  const row = (classes: readonly ClassId[]) =>
    saturationRows(outcomes, { ...everything, classes }, labels).find((r) => r.date === "2025-02-01")!;
  assert.deepEqual([row(CLASS_IDS).mix, row(CLASS_IDS).class], ["Three or more classes reported", "shahed_drone"]);
  const two = row(["cruise", "ballistic"]);
  assert.deepEqual([two.mix, two.class, two.size], ["Two classes reported", "cruise", 29]);
  assert.equal(two.composition, "cruise: 25; ballistic: 4");
  const one = row(["ballistic"]);
  assert.deepEqual([one.mix, one.size, one.not_intercepted], ["One class reported", 4, 4]);
  assert.deepEqual(saturationRows(outcomes, { ...everything, classes: [] }, labels), []);
});
