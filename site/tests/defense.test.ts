import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chartFlags, monthPeriod, type ColumnSpec } from "../src/chart/flags.ts";
import {
  MEDIAN_SHOWN,
  MIN_BIN_NIGHTS,
  parseOutcomes,
  parseRates,
  RATE_CLASSES,
  RATE_SHOWN,
  rateRows,
  saturationRows,
  SIZE_BINS,
  sizeBinRows,
  type SaturationRow,
} from "../src/defense/defenseData.ts";
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

test("the size-bin summary counts each night with a point once, and stops before August 2026", () => {
  const rows = saturationRows(outcomes, everything, labels);
  const bins = sizeBinRows(rows, rates);
  const counted = rows.filter((r) => r.date < "2026-08-01" && r.not_intercepted !== null && r.size > 0);
  assert.ok(counted.length < rows.length);
  assert.equal(bins.reduce((sum, b) => sum + b.n_nights, 0), counted.length);
  assert.deepEqual([...new Set(bins.map((b) => b.year))], ["2022", "2023", "2024", "2025", "2026"]);
  assert.equal(bins.length, 5 * SIZE_BINS.length);
  for (const bin of bins) {
    assert.ok(bin.to <= "2026-07-31" && !bin.ballistic_restricted, bin.year);
    assert.equal(bin.median_not_destroyed_share !== null, bin.n_nights >= MIN_BIN_NIGHTS);
    assert.equal(bin.destroyed_includes_ew, bin.median_not_destroyed_share !== null);
  }
  // Every size falls in exactly one bin.
  for (const size of [1, 9, 10, 24, 25, 49, 50, 99, 100, 199, 200, 399, 400, 5000]) {
    assert.equal(SIZE_BINS.filter((b) => size >= b.min && size <= b.max).length, 1, String(size));
  }
});

test("a bin's figure is the median night's share, and too few nights give a gap, not zero", () => {
  const night = (date: string, size: number, missed: number | null): SaturationRow => ({
    ...saturationRows(outcomes, everything, labels)[0]!,
    date,
    size,
    not_intercepted: missed,
    ballistic_restricted: false,
  });
  const odd = [0, 1, 2, 3, 20].map((missed, i) => night(`2024-01-0${i + 1}`, 20, missed));
  const shown = sizeBinRows([...odd, night("2024-01-09", 20, null)], rates).find((b) => b.bin === "10–24")!;
  assert.deepEqual([shown.n_nights, shown.median_not_destroyed_share, shown.status], [5, 0.1, MEDIAN_SHOWN]);
  const even = sizeBinRows([...odd, night("2024-02-01", 10, 3)], rates).find((b) => b.bin === "10–24")!;
  assert.equal(even.median_not_destroyed_share, (0.1 + 0.15) / 2);
  const few = sizeBinRows(odd.slice(1), rates).find((b) => b.bin === "10–24")!;
  assert.deepEqual([few.n_nights, few.median_not_destroyed_share], [4, null]);
  assert.deepEqual(sizeBinRows([], rates), []);
  const columns: ColumnSpec[] = [
    { key: "median_not_destroyed_share", label: "Median share not reported destroyed", type: "number", measure: "not_intercepted" },
  ];
  assert.ok(chartFlags({ columns, rows: [few], coverage: (r) => r }).includes("destroyed_includes_ew"));
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
