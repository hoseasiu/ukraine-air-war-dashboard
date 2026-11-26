/**
 * Monthly launches beside monthly alert hours (plan §2 E3): checks on the part
 * of monthly_by_class.json this chart uses, and the rows it draws. Columns are
 * described in data/README.md.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { BALLISTIC_RESTRICTION_FROM, monthPeriod } from "../chart/flags.ts";
import { monthFromNumber, monthNumber } from "../filters/state.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";
import type { AlertTable } from "./alertData.ts";

export interface LaunchRow {
  month: string;
  class: ClassId;
  /** null means no count is known, never zero. */
  launched: number | null;
  n_unknown_launched: number;
  ballistic_restricted: boolean;
}

export interface LaunchTable {
  /** The first and last report end dates, so the first and last months can be partial. */
  firstDay: string;
  lastDay: string;
  rows: LaunchRow[];
}

function fail(message: string): never {
  throw new Error(`monthly_by_class.json: ${message}`);
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

export function parseLaunchTable(json: unknown): LaunchTable {
  const table = (json ?? {}) as { first_day?: unknown; last_day?: unknown; rows?: unknown };
  const day = (value: unknown, name: string): string => {
    if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) {
      fail(`${name} must be a YYYY-MM-DD date, got ${JSON.stringify(value)}`);
    }
    return value;
  };
  const firstDay = day(table.first_day, "first_day");
  const lastDay = day(table.last_day, "last_day");
  if (firstDay > lastDay || !Array.isArray(table.rows) || !table.rows.length) {
    fail("needs rows and a first_day no later than last_day");
  }

  const seen = new Set<string>();
  const rows = (table.rows as LaunchRow[]).map((row) => {
    const where = `${row.month} ${row.class}`;
    if (!CLASS_IDS.includes(row.class)) fail(`${where}: not a counted class`);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || row.month < firstDay.slice(0, 7) || row.month > lastDay.slice(0, 7)) {
      fail(`${where}: month is outside the table's dates`);
    }
    if (seen.has(where)) fail(`${where}: repeated`);
    seen.add(where);
    if (row.launched !== null && !isCount(row.launched)) {
      fail(`${where}: launched must be a count or null, got ${JSON.stringify(row.launched)}`);
    }
    if (!isCount(row.n_unknown_launched)) fail(`${where}: n_unknown_launched must be a count`);
    if (typeof row.ballistic_restricted !== "boolean") fail(`${where}: ballistic_restricted must be true or false`);
    return row;
  });
  return { firstDay, lastDay, rows };
}

export interface AlertLaunchRow {
  month: string;
  /** Known launches in the chosen classes. null when there's no known count, never 0 for unknown. */
  launched: number | null;
  /** What the launch figure does and doesn't cover this month. */
  launch_note: string;
  /** Mean over the areas in alert totals. null outside the alert table's months. */
  hours: number | null;
  ballistic_restricted: boolean;
  classes_not_split: boolean;
  alert_end_assumed: boolean;
  alert_regions_excluded: boolean;
  alert_granularity_change: boolean;
}

/** "Sept 28" */
function dayText(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(isoDate));
}

function launchNote(strikes: LaunchTable, month: string, found: readonly LaunchRow[], chosen: number): string {
  if (month < strikes.firstDay.slice(0, 7)) return "Before the strike data begins";
  const { from, to } = monthPeriod(month);
  const notes: string[] = [];
  if (strikes.firstDay > from) notes.push(`Reports from ${dayText(strikes.firstDay)} only`);
  if (strikes.lastDay < to) notes.push(`Reports through ${dayText(strikes.lastDay)} only`);
  const unknown = found.reduce((sum, row) => sum + row.n_unknown_launched, 0);
  if (!chosen) notes.push("No weapon classes chosen");
  else if (!found.length) notes.push("No report for the chosen classes");
  else if (unknown) notes.push(`${unknown} report${unknown === 1 ? "" : "s"} without a launch count`);
  return notes.join("; ") || "Whole month";
}

/**
 * One row per month in the range that either source covers. Either figure can
 * be missing: strike data starts later than alert data and runs past it.
 */
export function alertLaunchRows(
  alerts: AlertTable,
  strikes: LaunchTable,
  filters: { from: string; to: string; classes: readonly ClassId[] },
): AlertLaunchRow[] {
  const firstStrike = strikes.firstDay.slice(0, 7);
  const lastStrike = strikes.lastDay.slice(0, 7);
  const firstAlert = alerts.months[0]!;
  const lastAlert = alerts.months.at(-1)!;
  const earliest = firstAlert < firstStrike ? firstAlert : firstStrike;
  const latest = lastAlert > lastStrike ? lastAlert : lastStrike;
  const from = filters.from > earliest ? filters.from : earliest;
  const to = filters.to < latest ? filters.to : latest;
  const everyClass = CLASS_IDS.every((id) => filters.classes.includes(id));

  const rows: AlertLaunchRow[] = [];
  for (let number = monthNumber(from); number <= monthNumber(to); number++) {
    const month = monthFromNumber(number);
    const found = strikes.rows.filter((row) => row.month === month && filters.classes.includes(row.class));
    const known = found.flatMap((row) => (row.launched === null ? [] : [row.launched]));
    const areas = alerts.rows.filter((row) => row.month === month);
    rows.push({
      month,
      launched: known.length ? known.reduce((sum, count) => sum + count, 0) : null,
      launch_note: launchNote(strikes, month, found, filters.classes.length),
      hours: areas.length ? areas.reduce((sum, row) => sum + row.hours, 0) / areas.length : null,
      // By date as well as by row, so a month with no matching row is still marked.
      ballistic_restricted:
        found.some((row) => row.ballistic_restricted) || monthPeriod(month).to >= BALLISTIC_RESTRICTION_FROM,
      // A total over only some classes leaves out their share of jointly reported counts.
      classes_not_split: !everyClass && filters.classes.length > 0,
      alert_end_assumed: areas.some((row) => row.alert_end_assumed),
      alert_regions_excluded: areas.some((row) => row.alert_regions_excluded),
      alert_granularity_change: areas.some((row) => row.alert_granularity_change),
    });
  }
  return rows;
}
