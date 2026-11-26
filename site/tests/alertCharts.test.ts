import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { nationalMonth, parseAlertMonthly } from "../src/alerts/alertData.ts";
import { sparklinePoints } from "../src/alerts/sparklineData.ts";
import { alertLaunchRows } from "../src/alerts/alertLaunchData.ts";
import {
  assignStyles,
  comparisonAreas,
  comparisonRows,
  DEFAULT_COMPARISON,
  endLabel,
  raionSwitchMonths,
  spreadLabels,
} from "../src/alerts/comparisonData.ts";
import { parseAreas } from "../src/buildData.ts";
import { chartFlags, combinedFlags, monthPeriod, type ColumnSpec } from "../src/chart/flags.ts";
import { parseMonthly } from "../src/strikes/strikeData.ts";
import { CLASS_IDS } from "../src/theme/classStyles.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const areas = parseAreas(read("../../data/reference/oblasts.csv"));
const alerts = parseAlertMonthly(JSON.parse(read("../../data/processed/alert_hours_monthly.json")), areas);
const strikes = parseMonthly(JSON.parse(read("../../data/processed/monthly_by_class.json")));

const everything = { from: "2022-03", to: "2026-11", classes: CLASS_IDS };
const launchRows = (change: Partial<Parameters<typeof alertLaunchRows>[2]> = {}) =>
  alertLaunchRows(alerts, strikes, { ...everything, ...change });
const row = (rows: ReturnType<typeof launchRows>, month: string) => rows.find((r) => r.month === month)!;
const columns: ColumnSpec[] = [
  { key: "launched", label: "Reported launches", type: "number", measure: "launched" },
  { key: "hours", label: "Alert hours", type: "number", measure: "alert_hours" },
];
const flags = (rows: ReturnType<typeof launchRows>) =>
  chartFlags({ columns, rows, coverage: (r) => monthPeriod(r.month) });

test("with no oblast chosen the comparison shows the three defaults, which all have figures", () => {
  assert.deepEqual(comparisonAreas([]), DEFAULT_COMPARISON);
  assert.deepEqual(comparisonAreas(["UA-51"]), ["UA-51"]);
  const rows = comparisonRows(alerts, areas, DEFAULT_COMPARISON, "2022-03", "2026-11");
  assert.equal(rows.length, 3 * alerts.months.length);
  assert.deepEqual(rows.slice(0, 3).map((r) => r.name), ["Kharkiv oblast", "Kyiv city", "Lviv oblast"]);
});

test("the comparison follows the month range and refuses excluded areas and a fourth oblast", () => {
  const rows = comparisonRows(alerts, areas, ["UA-30"], "2026-06", "2026-11");
  assert.deepEqual(rows.map((r) => r.month), ["2026-06", "2026-07"]);
  assert.deepEqual(comparisonRows(alerts, areas, ["UA-30"], "2026-08", "2026-11"), []);
  assert.throws(() => comparisonRows(alerts, areas, ["UA-43"], "2023-01", "2023-02"), /No alert figures/);
  assert.throws(
    () => comparisonRows(alerts, areas, ["UA-05", "UA-07", "UA-12", "UA-14"], "2023-01", "2023-02"),
    /up to 3/,
  );
});

test("an oblast keeps its line style when others are added or removed", () => {
  const first = assignStyles(["UA-63", "UA-30", "UA-46"]);
  assert.deepEqual([...first.values()], [0, 1, 2]);
  const fewer = assignStyles(["UA-30", "UA-46"], first);
  assert.deepEqual([...fewer], [["UA-30", 1], ["UA-46", 2]]);
  const added = assignStyles(["UA-30", "UA-46", "UA-51"], fewer);
  assert.deepEqual([...added], [["UA-30", 1], ["UA-46", 2], ["UA-51", 0]]);
});

test("monthly launches add up to the table's, and alert hours are a mean over areas", () => {
  const rows = launchRows();
  assert.equal(rows[0]!.month, "2022-04");
  assert.equal(rows.at(-1)!.month, "2026-11");
  const total = (list: { launched: number | null }[]) => list.reduce((sum, r) => sum + (r.launched ?? 0), 0);
  assert.equal(total(rows), total(strikes.rows));
  const july = alerts.rows.filter((r) => r.month === "2026-07");
  assert.equal(july.length, 24);
  assert.equal(row(rows, "2026-07").hours, july.reduce((sum, r) => sum + r.hours, 0) / 24);
});

test("months outside either source are unknown rather than zero", () => {
  const rows = launchRows();
  assert.equal(row(rows, "2022-08").launched, null);
  assert.equal(row(rows, "2022-08").launch_note, "Before the strike data begins");
  assert.match(row(rows, "2022-09").launch_note, /^Reports from Sep 28 only/);
  assert.match(row(rows, "2026-11").launch_note, /Reports through Nov 21 only/);
  assert.equal(row(rows, "2026-08").hours, null);
  assert.deepEqual(launchRows({ from: "2022-03", to: "2022-03" }), []);
});

test("the class filter changes launches only, and never turns a missing report into zero", () => {
  const ballistic = launchRows({ classes: ["ballistic"] });
  assert.equal(row(ballistic, "2026-07").launched, null);
  assert.equal(row(ballistic, "2026-07").launch_note, "No report for the chosen classes");
  assert.equal(row(ballistic, "2026-09").launched, null);
  assert.match(row(ballistic, "2026-09").launch_note, /without a launch count/);
  assert.deepEqual(ballistic.map((r) => r.hours), launchRows().map((r) => r.hours));
  assert.ok(launchRows({ classes: [] }).every((r) => r.launched === null));
});

test("the launch series carries the restriction flag from August 2026, whatever the classes", () => {
  for (const classes of [CLASS_IDS, ["shahed_drone" as const], []]) {
    const rows = launchRows({ classes });
    assert.ok(rows.every((r) => r.ballistic_restricted === r.month >= "2026-08"));
    assert.ok(flags(rows).includes("ballistic_restricted"));
  }
  assert.ok(!flags(launchRows({ to: "2026-07" })).includes("ballistic_restricted"));
});

test("a total over only some classes says that mixed rows aren't split", () => {
  assert.ok(!flags(launchRows()).includes("classes_not_split"));
  assert.ok(flags(launchRows({ classes: ["cruise"] })).includes("classes_not_split"));
});

test("the sparkline's months are the national means, on a scale from zero", () => {
  const rows = alerts.months.map((month) => nationalMonth(alerts, month));
  const launches = launchRows();
  assert.deepEqual(rows.map((r) => r.hours), alerts.months.map((month) => row(launches, month).hours));
  const { points, peak } = sparklinePoints(rows);
  assert.equal(points.length, alerts.months.length);
  assert.equal(points[0]!.x, 0);
  assert.equal(points.at(-1)!.x, 100);
  assert.equal(peak.hours, Math.max(...rows.map((r) => r.hours!)));
  assert.equal(points[rows.findIndex((r) => r.month === peak.month)]!.y, 0);
});

test("a month without figures is never drawn as zero", () => {
  assert.equal(nationalMonth(alerts, "2026-08").hours, null);
  assert.throws(
    () => sparklinePoints([nationalMonth(alerts, "2026-07"), nationalMonth(alerts, "2026-08")]),
    /No alert figures for 2026-08/,
  );
});

test("figures drawn beside a chart's rows add their badges once, in the usual order", () => {
  assert.deepEqual(
    combinedFlags(["alert_regions_excluded"], ["alert_granularity_change", "alert_end_assumed", "alert_regions_excluded"]),
    ["alert_end_assumed", "alert_regions_excluded", "alert_granularity_change"],
  );
});

test("the raion-switch band covers only the shown months of 2025", () => {
  assert.deepEqual(raionSwitchMonths(alerts.months), { first: "2025-01", last: "2025-12" });
  assert.deepEqual(raionSwitchMonths(["2025-11", "2025-12", "2026-01"]), { first: "2025-11", last: "2025-12" });
  assert.equal(raionSwitchMonths(["2024-11", "2024-12"]), undefined);
  assert.equal(raionSwitchMonths(["2026-01"]), undefined);
});

test("line-end names stay unambiguous", () => {
  assert.equal(endLabel("Lviv oblast"), "Lviv");
  assert.equal(endLabel("Kyiv oblast"), "Kyiv oblast");
  assert.equal(endLabel("Kyiv city"), "Kyiv city");
});

test("line-end labels move apart, keep their order and stay on the chart", () => {
  assert.deepEqual(spreadLabels([100, 200], 20, 0, 300), [100, 200]);
  assert.deepEqual(spreadLabels([105, 100], 20, 0, 300), [120, 100]);
  assert.deepEqual(spreadLabels([300, 298, 299], 20, 0, 300), [300, 260, 280]);
  assert.deepEqual(spreadLabels([2, 1], 20, 10, 300), [30, 10]);
});
