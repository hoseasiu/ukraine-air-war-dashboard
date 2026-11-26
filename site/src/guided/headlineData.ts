/**
 * Stop 1's three headline numbers. Each has its own dates, because the strike
 * and alert sources cover different ones.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { AlertTable } from "../alerts/alertData.ts";
import { chartFlags, monthPeriod, type ColumnSpec, type FlagId, type Period } from "../chart/flags.ts";
import { monthFromNumber, monthNumber } from "../filters/state.ts";
import { sumKnown, type MonthTable } from "../strikes/strikeData.ts";

export interface OutcomeRow {
  month: string;
  /** Reported destroyed, including by electronic warfare. */
  destroyed: number | null;
  /** Launches in the reports where both counts are usable. */
  launched_with_outcome: number | null;
  destroyed_includes_ew: boolean;
}

export interface OutcomeTable {
  /** The first month with no missile-class intercept rate, YYYY-MM. */
  missileRatesEndBefore: string;
  rows: OutcomeRow[];
}

/** The outcome columns of monthly_by_class.json. parseMonthly() leaves them out. */
export function parseOutcomes(json: unknown): OutcomeTable {
  function fail(message: string): never {
    throw new Error(`monthly_by_class.json: ${message}`);
  }
  const table = (json ?? {}) as { intercept_rate?: { missile_rates_end_before?: unknown }; rows?: unknown };
  const cutoff = table.intercept_rate?.missile_rates_end_before;
  if (typeof cutoff !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(cutoff)) {
    fail("needs intercept_rate.missile_rates_end_before as YYYY-MM");
  }
  if (!Array.isArray(table.rows)) fail("needs rows");
  const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
  const rows = (table.rows as (OutcomeRow & { class: string })[]).map((row) => {
    const { month, destroyed, launched_with_outcome, destroyed_includes_ew } = row;
    const where = `${month} ${row.class}`;
    const both = isCount(destroyed) && isCount(launched_with_outcome) && destroyed! <= launched_with_outcome!;
    if (!both && !(destroyed === null && launched_with_outcome === null)) {
      fail(`${where}: destroyed and launched_with_outcome must both be null, or counts with destroyed no larger`);
    }
    if (destroyed_includes_ew !== (destroyed !== null)) fail(`${where}: destroyed_includes_ew must match destroyed`);
    return { month, destroyed, launched_with_outcome, destroyed_includes_ew };
  });
  return { missileRatesEndBefore: cutoff, rows };
}

export interface Headline {
  id: "launched" | "destroyed_share" | "alert_hours";
  value: number;
  /** The dates this number covers. */
  period: Period;
  /** The badges it must carry, worked out by the same rules as the charts'. */
  flags: FlagId[];
}

export interface Headlines {
  launched: Headline;
  destroyedShare: Headline & { destroyed: number; launchedWithOutcome: number };
  alertHours: Headline & { areas: number; months: number };
}

const flagsFor = (column: ColumnSpec, rows: object[], coverage: Period) =>
  chartFlags({ columns: [column], rows, coverage });

export function headlines(strikes: MonthTable, outcomes: OutcomeTable, alerts: AlertTable): Headlines {
  const strikePeriod = { from: strikes.firstDay, to: strikes.lastDay };
  const launched = sumKnown(strikes.rows.map((row) => row.launched));
  if (launched === null) throw new Error("Headlines: no published launch count");

  // The all-class share stops where the missile-class rates do. Whether it
  // should is still open (docs/plan.md §11); the stop says what it covers.
  const lastShareMonth = monthFromNumber(monthNumber(outcomes.missileRatesEndBefore) - 1);
  const inShare = outcomes.rows.filter((row) => row.month <= lastShareMonth);
  const destroyed = sumKnown(inShare.map((row) => row.destroyed));
  const withOutcome = sumKnown(inShare.map((row) => row.launched_with_outcome));
  if (destroyed === null || !withOutcome) throw new Error("Headlines: no reports with both counts");
  const sharePeriod = { from: strikes.firstDay, to: monthPeriod(lastShareMonth).to };

  const areas = new Set(alerts.rows.map((row) => row.oblast)).size;
  const alertPeriod = { from: monthPeriod(alerts.months[0]!).from, to: monthPeriod(alerts.months.at(-1)!).to };
  // Each area weighs the same, whatever its size.
  const meanHours = alerts.rows.reduce((sum, row) => sum + row.hours, 0) / areas;

  return {
    launched: {
      id: "launched",
      value: launched,
      period: strikePeriod,
      flags: flagsFor(
        { key: "launched", label: "Launched", type: "number", measure: "launched" },
        strikes.rows.map((row) => ({ ballistic_restricted: row.ballistic_restricted })),
        strikePeriod,
      ),
    },
    destroyedShare: {
      id: "destroyed_share",
      value: destroyed / withOutcome,
      destroyed,
      launchedWithOutcome: withOutcome,
      period: sharePeriod,
      flags: flagsFor(
        { key: "share", label: "Share reported destroyed", type: "number", measure: "intercept_rate" },
        inShare.map((row) => ({ destroyed_includes_ew: row.destroyed_includes_ew })),
        sharePeriod,
      ),
    },
    alertHours: {
      id: "alert_hours",
      value: meanHours,
      areas,
      months: alerts.months.length,
      period: alertPeriod,
      flags: flagsFor(
        { key: "hours", label: "Alert hours", type: "number", measure: "alert_hours" },
        alerts.rows.map((row) => ({
          alert_end_assumed: row.alert_end_assumed,
          alert_regions_excluded: row.alert_regions_excluded,
          alert_granularity_change: row.alert_granularity_change,
        })),
        alertPeriod,
      ),
    },
  };
}
