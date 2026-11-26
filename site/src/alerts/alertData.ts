/**
 * The monthly alert table and the map boundaries: checks on both, and the rows
 * the map draws. Columns are described in data/README.md.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { Area } from "../buildData.ts";

export interface AlertMonth {
  /** ISO 3166-2 code. */
  oblast: string;
  /** YYYY-MM, in Kyiv time. */
  month: string;
  /** Alert hours, averaged over the oblast's raions. */
  hours: number;
  /** Alert periods that started in the month, averaged over the raions. */
  n_alerts: number;
  alert_end_assumed: boolean;
  alert_regions_excluded: boolean;
  alert_granularity_change: boolean;
}

export interface AlertTable {
  /** Every month the table covers, in order. */
  months: string[];
  rows: AlertMonth[];
}

/** What the map and its table show for one area in one month. */
export interface MapRow extends Omit<AlertMonth, "hours" | "n_alerts"> {
  name: string;
  /** False for areas the alert data doesn't cover. Their figures are null, never 0. */
  included: boolean;
  hours: number | null;
  n_alerts: number | null;
}

function fail(message: string): never {
  throw new Error(`alert_hours_monthly.json: ${message}`);
}

function monthsBetween(first: string, last: string): string[] {
  const months: string[] = [];
  let [year, month] = first.split("-").map(Number) as [number, number];
  for (;;) {
    const text = `${year}-${String(month).padStart(2, "0")}`;
    if (text > last) return months;
    months.push(text);
    if (month === 12) [year, month] = [year + 1, 1];
    else month += 1;
  }
}

function day(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) {
    fail(`${name} must be a YYYY-MM-DD date, got ${JSON.stringify(value)}`);
  }
  return value;
}

/** Requires exactly one row for every area in alert totals and every month, and none for the others. */
export function parseAlertMonthly(json: unknown, areas: readonly Area[]): AlertTable {
  const table = (json ?? {}) as { first_day?: unknown; last_day?: unknown; rows?: unknown };
  const months = monthsBetween(day(table.first_day, "first_day").slice(0, 7), day(table.last_day, "last_day").slice(0, 7));
  if (!months.length || !Array.isArray(table.rows)) fail("needs rows and a first_day no later than last_day");

  const included = new Set(areas.filter((area) => area.inAlertTotals).map((area) => area.id));
  const seen = new Set<string>();
  const rows = (table.rows as AlertMonth[]).map((row) => {
    const where = `${row.oblast} ${row.month}`;
    if (!included.has(row.oblast)) fail(`${where}: not an area in alert totals`);
    if (!months.includes(row.month)) fail(`${where}: month is outside the table's dates`);
    if (seen.has(where)) fail(`${where}: repeated`);
    seen.add(where);
    for (const column of ["hours", "n_alerts"] as const) {
      const value = row[column];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        fail(`${where}: ${column} must be a number of at least 0, got ${JSON.stringify(value)}`);
      }
    }
    for (const column of ["alert_end_assumed", "alert_regions_excluded", "alert_granularity_change"] as const) {
      if (typeof row[column] !== "boolean") fail(`${where}: ${column} must be true or false`);
    }
    return row;
  });
  const expected = included.size * months.length;
  if (rows.length !== expected) fail(`expected ${expected} rows (every area and month), got ${rows.length}`);

  return { months, rows };
}

/** The table's months within the chosen range (both ends included). Can be empty. */
export function monthsInRange(table: AlertTable, from: string, to: string): string[] {
  return table.months.filter((month) => month >= from && month <= to);
}

/** The month itself if it's offered; otherwise the nearest one. With no earlier choice, the latest. */
export function nearestMonth(months: readonly [string, ...string[]], wanted: string | undefined): string {
  const latest = months[months.length - 1]!;
  if (wanted === undefined || wanted > latest) return latest;
  return months.find((month) => month >= wanted)!;
}

/** One row per area, by name, including the areas without figures. */
export function mapRows(table: AlertTable, areas: readonly Area[], month: string): MapRow[] {
  const figures = new Map(table.rows.filter((row) => row.month === month).map((row) => [row.oblast, row]));
  return [...areas]
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map(({ id, name, inAlertTotals }) => {
      if (!inAlertTotals) {
        return {
          oblast: id,
          name,
          month,
          included: false,
          hours: null,
          n_alerts: null,
          alert_end_assumed: false,
          alert_regions_excluded: true,
          alert_granularity_change: false,
        };
      }
      const row = figures.get(id);
      if (!row) throw new Error(`No alert figures for ${id} in ${month}`);
      return { ...row, name, included: true };
    });
}

export interface Boundary {
  type: "Feature";
  properties: { iso_3166_2: string; name: string };
  geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
}

export interface Boundaries {
  type: "FeatureCollection";
  /** The credit that has to be shown with the map. */
  attribution: string;
  license: string;
  features: Boundary[];
}

/** Requires exactly one boundary for every area in the gazetteer. */
export function parseBoundaries(text: string, areas: readonly Area[]): Boundaries {
  const parsed = JSON.parse(text) as Boundaries;
  if (!parsed.attribution || !parsed.license || !Array.isArray(parsed.features)) {
    throw new Error("ukraine_admin1.geojson: needs features, attribution and license");
  }
  const ids = parsed.features.map((feature) => feature.properties?.iso_3166_2).sort();
  const wanted = areas.map((area) => area.id).sort();
  if (ids.join() !== wanted.join()) {
    throw new Error(`ukraine_admin1.geojson and oblasts.csv disagree. Boundaries: ${ids}. Areas: ${wanted}.`);
  }
  return parsed;
}
