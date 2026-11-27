import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAlertMonthly } from "../src/alerts/alertData.ts";
import { alertLaunchRows } from "../src/alerts/alertLaunchData.ts";
import { comparisonRows, DEFAULT_COMPARISON } from "../src/alerts/comparisonData.ts";
import { parseAreas } from "../src/buildData.ts";
import { parseOutcomes, parseRates, rateRows, saturationRows, sizeBinRows } from "../src/defense/defenseData.ts";
import { eventWindows, windowRows } from "../src/defense/eventWindowData.ts";
import {
  allNights,
  massiveGaps,
  monthRows,
  monthsShown,
  parseMonthly,
  parseNights,
  sizeBins,
  weekdayRows,
  yearNightRows,
} from "../src/strikes/strikeData.ts";
import * as headline from "../src/summary/headlineText.ts";
import { alertTiles, attackTiles, defenseTiles } from "../src/summary/tileData.ts";
import { CLASS_IDS, type ClassId } from "../src/theme/classStyles.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const monthly = JSON.parse(read("../../data/processed/monthly_by_class.json"));
const nightsJson = JSON.parse(read("../../data/processed/nights.json"));
const areas = parseAreas(read("../../data/reference/oblasts.csv"));
const strikes = parseMonthly(monthly);
const rates = parseRates(monthly);
const nights = parseNights(nightsJson);
const outcomes = parseOutcomes(nightsJson);
const alerts = parseAlertMonthly(JSON.parse(read("../../data/processed/alert_hours_monthly.json")), areas);

const everything = { from: "2022-03", to: "2026-11", classes: CLASS_IDS };
const labels = Object.fromEntries(CLASS_IDS.map((id) => [id, id])) as Record<ClassId, string>;
const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);
const rowsOf = (json: { rows: Record<string, any>[] }) => json.rows;
const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 1 });

function nightSizes(): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const row of rowsOf(nightsJson)) {
    if (row.launched !== null) sizes.set(row.date, (sizes.get(row.date) ?? 0) + row.launched);
  }
  return sizes;
}

test("tab A's tiles add up the built tables, with their own dates and the restriction badge", () => {
  const [launched, middle, largest] = attackTiles(strikes, nights, everything);
  assert.equal(launched!.value, number(sum(rowsOf(monthly).map((row) => row.launched))));
  assert.deepEqual(launched!.period, { from: monthly.first_day, to: monthly.last_day });
  const sorted = [...nightSizes().values()].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  assert.equal(middle!.value, number(sorted.length % 2 ? sorted[half]! : (sorted[half - 1]! + sorted[half]!) / 2));
  assert.equal(largest!.value, number(sorted.at(-1)!));
  for (const tile of [launched, middle, largest]) assert.deepEqual(tile!.flags, ["ballistic_restricted"]);
});

test("tab A's tiles follow the filters, and drop badges and tiles that don't apply", () => {
  const early = attackTiles(strikes, nights, { from: "2023-01", to: "2023-12", classes: ["cruise"] });
  assert.deepEqual(early[0]!.period, { from: "2023-01-01", to: "2023-12-31" });
  assert.deepEqual(early[0]!.flags, ["classes_not_split"]);
  assert.deepEqual(attackTiles(strikes, nights, { ...everything, classes: [] }), []);
  assert.deepEqual(attackTiles(strikes, nights, { ...everything, from: "2022-03", to: "2022-05" }), []);
});

test("every share tile carries the EW badge, and only the drone share runs past July 2026", () => {
  const tiles = defenseTiles(rates, everything);
  assert.deepEqual(
    tiles.map((tile) => tile.id),
    ["share_all", "share_shahed_drone", "share_cruise", "share_ballistic"],
  );
  for (const tile of tiles) {
    assert.ok(tile.flags.includes("destroyed_includes_ew"), tile.id);
    const drone = tile.id === "share_shahed_drone";
    assert.equal(tile.period!.to, drone ? monthly.last_day : "2026-07-31", tile.id);
    assert.equal(tile.flags.includes("ballistic_restricted"), drone, tile.id);
    const own = rowsOf(monthly).filter(
      (row) => (tile.id === "share_all" || `share_${row.class}` === tile.id) && (drone || row.month <= "2026-07"),
    );
    const share = sum(own.map((row) => row.destroyed)) / sum(own.map((row) => row.launched_with_outcome));
    assert.equal(tile.value, share.toLocaleString("en-US", { style: "percent", maximumFractionDigits: 1 }), tile.id);
  }
});

test("a share tile with nothing it may count shows no figure, not 0%", () => {
  const late = defenseTiles(rates, { from: "2026-08", to: "2026-11", classes: ["cruise"] });
  assert.equal(late.length, 2);
  for (const tile of late) {
    assert.equal(tile.value, "No figure");
    assert.equal(tile.period, undefined);
    assert.deepEqual(tile.flags, []);
  }
});

test("tab E's tiles are an average month for all areas and each compared one", () => {
  const tiles = alertTiles(alerts, areas, DEFAULT_COMPARISON, ["Crimea"], everything);
  assert.equal(tiles.length, 1 + DEFAULT_COMPARISON.length);
  assert.equal(tiles[0]!.value, Math.round(sum(alerts.rows.map((row) => row.hours)) / alerts.rows.length).toString());
  assert.deepEqual(tiles[0]!.period, { from: "2022-04-01", to: "2026-07-31" });
  for (const tile of tiles) {
    assert.ok(tile.flags.includes("alert_regions_excluded") && tile.flags.includes("alert_granularity_change"));
  }
  assert.deepEqual(alertTiles(alerts, areas, DEFAULT_COMPARISON, [], { from: "2026-09", to: "2026-11" }), []);
});

/** Every chart headline for the unfiltered tabs. */
function allHeadlines(): (string | undefined)[] {
  const months = monthsShown(strikes, everything.from, everything.to);
  const saturation = saturationRows(outcomes, everything, labels);
  const monthChart = monthRows(strikes, everything, String);
  const [before, after] = eventWindows(outcomes, "2025-03-03", 90);
  return [
    headline.monthlyHeadline(monthChart, true),
    headline.mixHeadline(monthChart, strikes, months, labels),
    headline.salvoHeadline(sizeBins(nights, everything)),
    headline.nightContextHeadline(yearNightRows(nights, "2025-09-07"), "2025-09-07"),
    headline.calendarHeadline(allNights(nights, CLASS_IDS), nights, months),
    headline.weekdayHeadline(weekdayRows(nights, everything)),
    headline.gapHeadline(massiveGaps(nights, everything)),
    headline.interceptHeadline(rateRows(rates, everything), labels),
    headline.saturationHeadline(saturation),
    headline.sizeBinHeadline(sizeBinRows(saturation, rates)),
    headline.eventHeadline(windowRows(outcomes, rates, [before, after], CLASS_IDS), labels),
    headline.comparisonHeadline(comparisonRows(alerts, areas, DEFAULT_COMPARISON, everything.from, everything.to)),
    headline.alertLaunchHeadline(alertLaunchRows(alerts, strikes, everything)),
  ];
}

test("every headline has something to say on the unfiltered tabs, with no causal wording", () => {
  const causal = /\b(because|caus\w*|due to|led to|after the|result\w*|driv\w*|drove|thanks to|impact\w*|effect\w*)\b/i;
  for (const text of allHeadlines()) {
    assert.ok(text, "a headline is missing");
    assert.doesNotMatch(text, causal);
    // "Destroyed" and "intercept" are only ever reported figures.
    if (/destroyed|intercept/i.test(text)) assert.match(text, /reported/i);
  }
});

test("a headline with nothing to say is left out, never filled with a zero", () => {
  const empty = [
    headline.monthlyHeadline([], true),
    headline.mixHeadline([], strikes, [], labels),
    headline.salvoHeadline([]),
    headline.breakdownHeadline([], labels),
    headline.nightContextHeadline([], "2025-09-07"),
    headline.calendarHeadline([], nights, []),
    headline.weekdayHeadline([]),
    headline.gapHeadline([]),
    headline.interceptHeadline([], labels),
    headline.saturationHeadline([]),
    headline.sizeBinHeadline([]),
    headline.eventHeadline([], labels),
    headline.mapHeadline([]),
    headline.comparisonHeadline([]),
    headline.alertLaunchHeadline([]),
  ];
  assert.deepEqual(empty, empty.map(() => undefined));
});

test("the year's largest night is called that, not compared with all the others", () => {
  const row = (date: string, total: number) => ({
    date,
    total,
    massive_above: 5,
    massive: "",
    shown: "",
    ballistic_restricted: false,
  });
  const rows = [row("2025-01-01", 3), row("2025-01-02", 9)];
  assert.equal(
    headline.nightContextHeadline(rows, "2025-01-02"),
    "No other night in 2025 had as many weapons launched, in all counted classes",
  );
  assert.equal(
    headline.nightContextHeadline([...rows, row("2025-01-03", 1)], "2025-01-01"),
    "More weapons launched than on 1 of the other 2 nights in 2025, in all counted classes",
  );
});

test("with a class off, headlines about night sizes say they count only the classes shown", () => {
  const some = { ...everything, classes: ["cruise"] as ClassId[] };
  for (const text of [
    headline.salvoHeadline(sizeBins(nights, some)),
    headline.weekdayHeadline(weekdayRows(nights, some)),
  ]) {
    assert.match(text!, /in the classes shown$/);
  }
  assert.doesNotMatch(headline.salvoHeadline(sizeBins(nights, everything))!, /classes shown/);
});

test("the size-group headline gives the lowest and highest year, and the comparison needs a clear leader", () => {
  const group = (year: string, share: number) =>
    ({ year, bin: "10–24", median_not_destroyed_share: share, n_nights: 9 }) as never;
  assert.equal(
    headline.sizeBinHeadline([group("2023", 0.2), group("2024", 0.4), group("2025", 0.1)]),
    "Nights of 10–24 weapons: median share not reported destroyed from 10% (2025) to 40% (2024)",
  );
  const alert = (name: string, hours: number) => ({ name, month: "2024-01", hours }) as never;
  assert.equal(headline.comparisonHeadline([alert("A", 5), alert("B", 5)]), undefined);
});
