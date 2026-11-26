/**
 * Periods shaded on time axes, and which months of an axis each one covers. The
 * bands only place the periods in time. periodBandMarks.ts draws them.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import {
  ALERT_GRANULARITY_CHANGE_FROM,
  ALERT_GRANULARITY_CHANGE_TO,
  BALLISTIC_RESTRICTION_FROM,
  monthPeriod,
} from "./flags.ts";

export interface BandPeriod {
  /** First day, YYYY-MM-DD. */
  from: string;
  /** Last day, or null for a period that hasn't ended. */
  to: string | null;
  label: string;
}

/** On axes of strike figures. */
export const RESTRICTED_BAND: BandPeriod = {
  from: BALLISTIC_RESTRICTION_FROM,
  to: null,
  label: "missile counts restricted",
};

/** On axes of alert figures: the months in which areas moved to raion alerts. */
export const RAION_BAND: BandPeriod = {
  from: ALERT_GRANULARITY_CHANGE_FROM,
  to: ALERT_GRANULARITY_CHANGE_TO,
  label: "move to raion alerts",
};

/**
 * The first and last months on an axis that the period reaches, or null if none
 * does. A month is shaded whole if any of it is in the period, as its figures are.
 */
export function bandMonths(months: readonly string[], period: BandPeriod): { first: string; last: string } | null {
  const inside = months.filter((month) => {
    const { from, to } = monthPeriod(month);
    return to >= period.from && (period.to === null || from <= period.to);
  });
  return inside.length ? { first: inside[0]!, last: inside[inside.length - 1]! } : null;
}
