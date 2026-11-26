import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAlertMonthly } from "../src/alerts/alertData.ts";
import { parseAnnotations } from "../src/annotations/annotationData.ts";
import { placeMarkers } from "../src/annotations/markerLayout.ts";
import { parseAreas } from "../src/buildData.ts";
import { parseRates } from "../src/defense/defenseData.ts";
import { headlines } from "../src/guided/headlineData.ts";
import { stepFrom, type Position } from "../src/guided/steps.ts";
import { parseMonthly } from "../src/strikes/strikeData.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const monthly = JSON.parse(read("../../data/processed/monthly_by_class.json"));
const strikes = parseMonthly(monthly);
const rates = parseRates(monthly);
const alerts = parseAlertMonthly(
  JSON.parse(read("../../data/processed/alert_hours_monthly.json")),
  parseAreas(read("../../data/reference/oblasts.csv")),
);

const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);

test("the launch headline is the whole monthly table, under the restriction badge", () => {
  const { launched } = headlines(strikes, rates, alerts);
  assert.equal(launched.value, sum(monthly.rows.map((row: { launched: number | null }) => row.launched)));
  assert.deepEqual(launched.period, { from: monthly.first_day, to: monthly.last_day });
  assert.deepEqual(launched.flags, ["ballistic_restricted"]);
});

test("the destroyed share ends before missile rates do, and carries the EW badge", () => {
  const { destroyedShare } = headlines(strikes, rates, alerts);
  assert.equal(monthly.intercept_rate.missile_rates_end_before, "2026-08");
  const rows = monthly.rows.filter((row: { month: string }) => row.month <= "2026-07");
  const destroyed = sum(rows.map((row: { destroyed: number | null }) => row.destroyed));
  const withOutcome = sum(rows.map((row: { launched_with_outcome: number | null }) => row.launched_with_outcome));
  assert.equal(destroyedShare.destroyed, destroyed);
  assert.equal(destroyedShare.launchedWithOutcome, withOutcome);
  assert.equal(destroyedShare.value, destroyed / withOutcome);
  assert.equal(destroyedShare.period.to, "2026-07-31");
  assert.deepEqual(destroyedShare.flags, ["destroyed_includes_ew"]);
});

test("the alert headline is an average month, as a mean over areas, with its own dates and badges", () => {
  const { alertHours } = headlines(strikes, rates, alerts);
  assert.equal(alertHours.areas, 24);
  assert.equal(alerts.months.length, 52);
  assert.ok(Math.abs(alertHours.value - sum(alerts.rows.map((row) => row.hours)) / 24 / 52) < 1e-9);
  assert.deepEqual(alertHours.period, { from: "2022-04-01", to: "2026-07-31" });
  assert.deepEqual(alertHours.flags, ["alert_end_assumed", "alert_regions_excluded", "alert_granularity_change"]);
});

const CSV_HEADER = "id,date,date_marks,label,description,source_url,source_url_2,verification,owner_review\n";
const line = (id: string, date: string, verification = "verified", review = "approved") =>
  `${id},${date},Day,Label ${id},About ${id},https://example.org/${id},,${verification},${review}\n`;

test("only verified and approved annotations are shown, oldest first", () => {
  const csv =
    CSV_HEADER +
    line("late", "2025-01-02") +
    line("early", "2023-01-02") +
    line("unverified", "2024-01-01", "unverified") +
    line("pending", "2024-01-01", "verified", "pending");
  assert.deepEqual(
    parseAnnotations(csv).map((event) => event.id),
    ["early", "late"],
  );
});

test("a shown annotation needs a date and a citation", () => {
  assert.throws(() => parseAnnotations(CSV_HEADER + line("a", "")), /date/);
  assert.throws(() => parseAnnotations(CSV_HEADER + "a,2025-01-01,Day,A,About a,,,verified,approved\n"), /citation/);
});

test("the committed annotation list parses", () => {
  assert.ok(parseAnnotations(read("../../data/reference/annotations.csv")).length > 0);
});

test("markers close together go in different rows, and months not shown get none", () => {
  const months = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05"];
  const event = (date: string) => ({ id: date, date, dateMarks: "", label: date, description: "", sources: [] });
  const markers = placeMarkers(
    ["2024-12-31", "2025-01-05", "2025-01-20", "2025-02-01", "2025-05-01"].map(event),
    months,
  );
  assert.deepEqual(
    markers.map(({ number, month, row }) => [number, month, row]),
    [
      [1, "2025-01", 0],
      [2, "2025-01", 1],
      [3, "2025-02", 2],
      [4, "2025-05", 0],
    ],
  );
});

test("a stop with a reveal takes two steps each way", () => {
  const stops = [{}, { reveal: true }, {}];
  const walk = (from: Position, step: 1 | -1, times: number) => {
    const seen: string[] = [];
    for (let i = 0; i < times; i++) {
      from = stepFrom(stops, from, step);
      seen.push(`${from.stop}${from.revealed ? "r" : ""}`);
    }
    return seen;
  };
  assert.deepEqual(walk({ stop: 1, revealed: false }, 1, 4), ["2", "2r", "3", "3"]);
  // Going back, a stop opens with its reveal hidden.
  assert.deepEqual(walk({ stop: 3, revealed: false }, -1, 3), ["2", "1", "1"]);
  assert.deepEqual(walk({ stop: 2, revealed: true }, -1, 2), ["2", "1"]);
});

test("a last stop with a reveal can still show it", () => {
  const stops = [{ reveal: true }];
  const shown = stepFrom(stops, { stop: 1, revealed: false }, 1);
  assert.deepEqual(shown, { stop: 1, revealed: true });
  assert.equal(stepFrom(stops, shown, 1), shown);
});
