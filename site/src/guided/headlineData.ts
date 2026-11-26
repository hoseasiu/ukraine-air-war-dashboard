/**
 * Stop 1's three headline numbers. Each has its own dates, because the strike
 * and alert sources cover different ones.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { AlertTable } from "../alerts/alertData.ts";
import type { RateTable } from "../defense/defenseData.ts";
import { chartFlags, monthPeriod, type ColumnSpec, type FlagId, type Period } from "../chart/flags.ts";
import { monthFromNumber, monthNumber } from "../filters/state.ts";
import { sumKnown, type MonthTable } from "../strikes/strikeData.ts";

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
  alertHours: Headline & { areas: number };
}

const flagsFor = (column: ColumnSpec, rows: object[], coverage: Period) =>
  chartFlags({ columns: [column], rows, coverage });

export function headlines(strikes: MonthTable, rates: RateTable, alerts: AlertTable): Headlines {
  const strikePeriod = { from: strikes.firstDay, to: strikes.lastDay };
  const launched = sumKnown(strikes.rows.map((row) => row.launched));
  if (launched === null) throw new Error("Headlines: no published launch count");

  // An all-class share stops where the missile-class rates do, and says so
  // (the owner's decision on #9, docs/plan.md §11).
  const lastShareMonth = monthFromNumber(monthNumber(rates.missileRatesEndBefore) - 1);
  const inShare = rates.rows.filter((row) => row.month <= lastShareMonth);
  const destroyed = sumKnown(inShare.map((row) => row.destroyed));
  const withOutcome = sumKnown(inShare.map((row) => row.launched_with_outcome));
  if (destroyed === null || !withOutcome) throw new Error("Headlines: no reports with both counts");
  const sharePeriod = { from: strikes.firstDay, to: monthPeriod(lastShareMonth).to };

  const areas = new Set(alerts.rows.map((row) => row.oblast)).size;
  const alertPeriod = { from: monthPeriod(alerts.months[0]!).from, to: monthPeriod(alerts.months.at(-1)!).to };
  // An average month, not a total (the owner's choice on #9). Each area weighs
  // the same, whatever its size.
  const monthlyHours = alerts.rows.reduce((sum, row) => sum + row.hours, 0) / areas / alerts.months.length;

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
      value: monthlyHours,
      areas,
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
