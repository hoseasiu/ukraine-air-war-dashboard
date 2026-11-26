import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chartFlags, monthPeriod, type ColumnSpec } from "../src/chart/flags.ts";
import {
  allNights,
  breakdownRows,
  largestNight,
  massiveDates,
  massiveGaps,
  median,
  monthRows,
  monthsShown,
  parseMonthly,
  parseNights,
  sizeBins,
  sizeCap,
  sumKnown,
  weekdayIndex,
  weekdayRows,
  yearNightRows,
  type Selection,
} from "../src/strikes/strikeData.ts";
import { CLASS_IDS } from "../src/theme/classStyles.ts";
import { NIGHT_BINS, nightBin } from "../src/theme/nightScale.ts";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../data/processed/${name}`, import.meta.url), "utf8"));

const nightsJson = read("nights.json");
const monthlyJson = read("monthly_by_class.json");
const nights = parseNights(nightsJson);
const monthly = parseMonthly(monthlyJson);
const everything: Selection = { from: "2022-03", to: "2026-11", classes: CLASS_IDS };
const total = (values: (number | null)[]) => sumKnown(values) ?? 0;
const day = (date: string) => date;

const copy = (change: (json: typeof nightsJson) => void) => {
  const json = structuredClone(nightsJson);
  change(json);
  return json;
};

test("bad strike tables are rejected", () => {
  assert.throws(() => parseNights(copy((j) => j.rows.push(j.rows[0]))), /repeated/);
  assert.throws(() => parseNights(copy((j) => (j.rows[0].class = "other_uav"))), /unknown class/);
  assert.throws(() => parseNights(copy((j) => (j.rows[0].launched = -1))), /count or null/);
  assert.throws(() => parseNights(copy((j) => (j.rows[0].is_massive = true))), /disagrees/);
  assert.throws(() => parseNights(copy((j) => j.massive.years.shift())), /no bar/);
  const monthCopy = structuredClone(monthlyJson);
  monthCopy.rows[0].ballistic_restricted = "false";
  assert.throws(() => parseMonthly(monthCopy), /true or false/);
});

test("the month filter is clamped to the strike data", () => {
  assert.deepEqual(monthsShown(monthly, "2022-03", "2022-10"), ["2022-09", "2022-10"]);
  assert.deepEqual(monthsShown(monthly, "2022-03", "2022-08"), []);
  assert.equal(monthsShown(monthly, "2022-03", "2027-03").at(-1), "2026-11");
});

test("monthly rows keep every published launch, and shares don't move with the class toggles", () => {
  const rows = monthRows(monthly, everything, day);
  assert.equal(rows.length, monthly.rows.length);
  assert.equal(total(rows.map((r) => r.launched)), total(monthly.rows.map((r) => r.launched)));
  const shares = rows.filter((r) => r.month === "2024-01").reduce((sum, r) => sum + (r.share ?? 0), 0);
  assert.ok(Math.abs(shares - 1) < 1e-9);
  const only = monthRows(monthly, { ...everything, classes: ["cruise"] }, day);
  assert.ok(only.every((r) => r.class === "cruise"));
  assert.equal(
    only.find((r) => r.month === "2024-01")!.share,
    rows.find((r) => r.month === "2024-01" && r.class === "cruise")!.share,
  );
  assert.equal(rows[0]!.days, "Partial: from 2022-09-28");
  assert.equal(rows.at(-1)!.days, "Partial: through 2026-11-21");
  // An unpublished month stays null, with no share.
  for (const row of rows) if (row.launched === null) assert.equal(row.share, null);
});

test("every night with a known size lands in exactly one histogram bin", () => {
  const bins = sizeBins(nights, everything);
  const known = allNights(nights, CLASS_IDS).filter((n) => n.size !== null);
  assert.equal(total(bins.map((b) => b.nights)), known.length);
  for (const year of nights.years) {
    const own = bins.filter((b) => b.year === year.year);
    assert.equal(own[0]!.year_nights, year.n_nights);
    assert.equal(own[0]!.massive_above, year.massive_above);
    // Bins run without holes from 0.
    own.forEach((bin, index) => assert.equal(bin.bin_from, index * 25));
    const sizes = allNights(nights, CLASS_IDS)
      .filter((n) => n.date.startsWith(`${year.year}-`) && n.size !== null)
      .map((n) => n.size!);
    assert.equal(own[0]!.year_max, Math.max(...sizes));
    // Each bin holds the nights in its range; only the one at the cap is open-ended.
    for (const bin of own) {
      const inside = sizes.filter((size) => size >= bin.bin_from && (bin.bin_to === null || size <= bin.bin_to));
      assert.equal(bin.nights, inside.length);
      assert.equal(bin.bin_to === null, bin.bin_from === sizeCap(nights));
    }
  }
});

test("the size axis is capped above every massive bar", () => {
  assert.ok(nights.years.every((year) => year.massive_above < sizeCap(nights)));
  const bars = (massive_above: number) => ({ ...nights, years: [{ ...nights.years[0]!, massive_above }] });
  assert.equal(sizeCap(bars(100)), 600);
  assert.equal(sizeCap(bars(640)), 700);
});

test("a year's strip has all its nights, marks one, and flags a restricted bar", () => {
  const date = massiveDates(nights, everything)[0]!;
  const rows = yearNightRows(nights, date);
  const year = nights.years.find((entry) => date.startsWith(`${entry.year}-`))!;
  assert.equal(rows.length, year.n_nights);
  assert.equal(rows.filter((r) => r.massive === "Massive night").length, year.n_massive);
  assert.deepEqual(rows.filter((r) => r.shown === "The night broken down").map((r) => r.date), [date]);
  assert.ok(rows.every((r) => r.massive_above === year.massive_above && !r.ballistic_restricted));
  // The 2026 bar uses restricted nights, so even earlier nights are flagged.
  const spring = massiveDates(nights, { from: "2026-01", to: "2026-07" })[0]!;
  assert.ok(yearNightRows(nights, spring).every((r) => r.ballistic_restricted));
});

test("the massive bar is withheld when a class is off, and sizes count only the classes shown", () => {
  const bins = sizeBins(nights, { ...everything, classes: ["cruise"] });
  assert.ok(bins.every((b) => b.massive_above === null && b.classes_not_split));
  const cruise = allNights(nights, ["cruise"]);
  // A night with no cruise report is left out, not counted as a night of 0.
  assert.equal(total(bins.map((b) => b.nights)), cruise.filter((n) => n.size !== null).length);
  assert.ok(cruise.some((n) => !n.reported && n.size === null));
  assert.deepEqual(sizeBins(nights, { ...everything, classes: [] }), []);
});

test("weekday rows account for every night shown and every massive night", () => {
  assert.equal(weekdayIndex("2026-11-23"), 0); // a Monday
  assert.equal(median([3, 1, 10, 2]), 2.5);
  assert.equal(median([]), null);
  const rows = weekdayRows(nights, everything);
  assert.equal(rows.length, 7);
  assert.equal(total(rows.map((r) => r.massive_nights)), total(nights.years.map((y) => y.n_massive)));
  assert.equal(total(rows.map((r) => r.nights)), total(nights.years.map((y) => y.n_nights)));
  assert.deepEqual(weekdayRows(nights, { ...everything, classes: [] }), []);
});

test("gaps run between consecutive massive nights, even across the start of the range", () => {
  const all = massiveGaps(nights, everything);
  assert.equal(all.length, total(nights.years.map((y) => y.n_massive)));
  assert.deepEqual([all[0]!.previous, all[0]!.gap_days], [null, null]);
  for (const [index, row] of all.entries()) {
    if (index) assert.equal(row.previous, all[index - 1]!.date);
    assert.ok(row.total > row.massive_above);
  }
  const later = massiveGaps(nights, { from: "2025-01", to: "2025-12" });
  assert.ok(later[0]!.previous!.startsWith("2024-"));
});

test("a night's breakdown lists launch areas as reported and follows the class toggles", () => {
  const date = largestNight(nights, massiveDates(nights, everything))!;
  const rows = breakdownRows(nights, date, CLASS_IDS);
  assert.equal(total(rows.map((r) => r.launched)), rows[0]!.night_total);
  const most = Math.max(...allNights(nights, CLASS_IDS).map((n) => n.total ?? 0));
  assert.equal(rows[0]!.night_total, most);
  assert.ok(rows.every((r) => r.massive === "Massive night" && r.places.length > 0));
  const one = breakdownRows(nights, date, [rows[0]!.class]);
  assert.equal(one.length, 1);
  // The night's total stays the all-class one.
  assert.equal(one[0]!.night_total, most);
});

test("launch figures from Aug 11, 2026 carry the restriction flag", () => {
  const columns: ColumnSpec[] = [{ key: "nights", label: "Nights", type: "number", measure: "launch_derived" }];
  const flagged = (rows: { from: string; to: string }[]) =>
    chartFlags({ columns, rows, coverage: (row) => row }).includes("ballistic_restricted");
  assert.ok(flagged(sizeBins(nights, everything)));
  assert.ok(flagged(weekdayRows(nights, everything)));
  assert.ok(!flagged(sizeBins(nights, { ...everything, to: "2025-12" })));
  assert.ok(!flagged(weekdayRows(nights, { ...everything, to: "2025-12" })));
  // The 2026 bar uses restricted nights, so it's flagged even in earlier months.
  const early: Selection = { ...everything, from: "2026-01", to: "2026-07" };
  assert.ok(flagged(sizeBins(nights, early)));
  assert.ok(flagged(weekdayRows(nights, early)));
  assert.ok(massiveGaps(nights, early).every((row) => row.ballistic_restricted));
  const spring = massiveDates(nights, early)[0]!;
  assert.ok(breakdownRows(nights, spring, CLASS_IDS).every((row) => row.ballistic_restricted));
  // With a class off, the histogram shows no bar, so only the nights themselves count.
  assert.ok(!flagged(sizeBins(nights, { ...early, classes: ["cruise"] })));
  const august = monthRows(monthly, { ...everything, from: "2026-08", to: "2026-08" }, day);
  assert.ok(
    chartFlags({ columns, rows: august, coverage: (r) => monthPeriod(r.month) }).includes("ballistic_restricted"),
  );
  assert.ok(massiveGaps(nights, everything).some((row) => row.ballistic_restricted));
});

test("tab A shows no destroyed counts, so its rows carry no EW flag", () => {
  const columns: ColumnSpec[] = [{ key: "launched", label: "Launched", type: "number", measure: "launched" }];
  const date = massiveDates(nights, everything)[0]!;
  const tables: object[][] = [monthRows(monthly, everything, day), breakdownRows(nights, date, CLASS_IDS)];
  for (const rows of tables) {
    assert.ok(!chartFlags({ columns, rows, coverage: monthPeriod("2023-01") }).includes("destroyed_includes_ew"));
  }
});

test("calendar color steps include their lower edge and cover every size", () => {
  assert.equal(nightBin(0), NIGHT_BINS[0]);
  assert.equal(nightBin(24), NIGHT_BINS[0]);
  assert.equal(nightBin(25), NIGHT_BINS[1]);
  assert.equal(nightBin(2000), NIGHT_BINS.at(-1));
});
