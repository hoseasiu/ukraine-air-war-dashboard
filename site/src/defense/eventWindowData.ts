/**
 * Reported intercept rates in equal windows before and after an annotated event
 * (plan §2 B3), added up from the nights table. These only describe the two
 * windows; nothing here compares them or tests a difference.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { Annotation } from "../annotations/annotationData.ts";
import { BALLISTIC_RESTRICTION_FROM } from "../chart/flags.ts";
import { sumKnown } from "../strikes/strikeData.ts";
import type { ClassId } from "../theme/classStyles.ts";
import { RATE_CLASSES, RATE_SHOWN, type OutcomeTable, type RateTable } from "./defenseData.ts";

/** The events offered, by annotation id, the first one by default. The agent's choice (plan §11). */
export const PANEL_EVENT_IDS = [
  "us-aid-pause-2025-03-03",
  "us-aid-resumed-2025-03-11",
  "energy-strikes-2022-10-10",
] as const;

/** Window lengths in days. The same length is used before and after. */
export const WINDOW_DAYS = [30, 60, 90] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];
export const DEFAULT_WINDOW_DAYS: WindowDays = 90;

/** The offered events, in the order above. Throws if one isn't verified and approved. */
export function panelEvents(annotations: readonly Annotation[]): Annotation[] {
  return PANEL_EVENT_IDS.map((id) => {
    const found = annotations.find((annotation) => annotation.id === id);
    if (!found) throw new Error(`Before/after panels: annotation ${id} is missing, unverified or not approved`);
    return found;
  });
}

export const SIDES = ["Before", "After"] as const;
export type Side = (typeof SIDES)[number];

function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** Days from one date to another, counting both. */
const daysIn = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

export interface EventWindow {
  side: Side;
  /** The window cut to the dates the data covers. */
  from: string;
  to: string;
  /** The days asked for, and how many of them the data covers. */
  days: number;
  daysCovered: number;
  /** Dates with a night, in any counted class. */
  nights: number;
}

/**
 * Equal windows either side of the event's date, which is in neither: a night is
 * keyed by the date it ends, so that date can't be placed before or after.
 */
export function eventWindows(table: OutcomeTable, date: string, days: number): [EventWindow, EventWindow] {
  const build = (side: Side, start: string, end: string): EventWindow => {
    const from = start > table.firstDay ? start : table.firstDay;
    const to = end < table.lastDay ? end : table.lastDay;
    if (from > to) throw new Error(`Before/after panels: no data ${side.toLowerCase()} ${date}`);
    const nights = new Set(table.rows.filter((row) => row.date >= from && row.date <= to).map((row) => row.date));
    return { side, from, to, days, daysCovered: daysIn(from, to), nights: nights.size };
  };
  return [
    build("Before", addDays(date, -days), addDays(date, -1)),
    build("After", addDays(date, 1), addDays(date, days)),
  ];
}

/** Other annotated events dated inside either window. */
export function eventsInWindows(
  annotations: readonly Annotation[],
  chosen: Annotation,
  windows: readonly EventWindow[],
): { event: Annotation; side: Side }[] {
  return annotations.flatMap((event) => {
    if (event.id === chosen.id) return [];
    const found = windows.find((window) => event.date >= window.from && event.date <= window.to);
    return found ? [{ event, side: found.side }] : [];
  });
}

export interface WindowRow {
  class: ClassId;
  side: Side;
  from: string;
  to: string;
  /** A fraction. null is a gap, never zero. */
  intercept_rate: number | null;
  /** Reported destroyed, electronic warfare included, over rows where both counts are usable. */
  destroyed: number | null;
  launched_with_outcome: number | null;
  /** Nights with a report for this class. */
  n_nights: number;
  /** null if there's no report for the class. */
  n_unknown_launched: number | null;
  status: string;
  destroyed_includes_ew: boolean;
  ballistic_restricted: boolean;
}

/**
 * One row for each window and selected class that can have a rate. The rate
 * rules are the monthly ones (data audit): at least the minimum launches with an
 * outcome, and no missile-class rate or counts once a window reaches the months
 * where those rates end.
 */
export function windowRows(
  table: OutcomeTable,
  rules: Pick<RateTable, "minLaunched" | "missileClasses" | "missileRatesEndBefore">,
  windows: readonly EventWindow[],
  classes: readonly ClassId[],
): WindowRow[] {
  return RATE_CLASSES.filter((id) => classes.includes(id)).flatMap((id) =>
    windows.map(({ side, from, to }): WindowRow => {
      const parts = table.rows.filter((row) => row.class === id && row.date >= from && row.date <= to);
      const withheld = rules.missileClasses.includes(id) && to.slice(0, 7) >= rules.missileRatesEndBefore;
      const destroyed = withheld ? null : sumKnown(parts.map((part) => part.destroyed));
      const launched = withheld ? null : sumKnown(parts.map((part) => part.launched_with_outcome));
      const rate = launched !== null && launched >= rules.minLaunched ? destroyed! / launched : null;
      const status = withheld
        ? "Gap: missile reporting restricted"
        : !parts.length
          ? "Gap: no report for this class"
          : rate !== null
            ? RATE_SHOWN
            : `Gap: fewer than ${rules.minLaunched} launches with an outcome`;
      return {
        class: id,
        side,
        from,
        to,
        intercept_rate: rate,
        destroyed,
        launched_with_outcome: launched,
        n_nights: parts.length,
        n_unknown_launched: parts.length ? parts.reduce((sum, part) => sum + part.n_unknown_launched, 0) : null,
        status,
        destroyed_includes_ew: destroyed !== null,
        ballistic_restricted: to >= BALLISTIC_RESTRICTION_FROM,
      };
    }),
  );
}

/** The panels' fixed wording, kept here so a test can check it. */
export const NOT_CAUSAL =
  "A difference between the two doesn’t show that the event caused it: the weapons used, the size of attacks, " +
  "reporting and much else can differ between windows too.";

export function panelHowToRead(minLaunched: number): string {
  return (
    "Each panel adds up the nights in one window: the same number of days before and after the event’s date, " +
    "which is in neither. Bars show the share of each class’s launches reported destroyed, from 0% to 100%, with " +
    `the counts behind it; a class needs ${minLaunched} launches with an outcome. ${NOT_CAUSAL} ` +
    "Try more than one window length."
  );
}

export const PANEL_NOTES = [
  "Rate = reported destroyed ÷ launches in the same reports, added up over the window. Reports that are unpublished, " +
    "blank or give more destroyed than launched are left out of both. These are reported figures, not verified " +
    "performance, and say nothing about hits or damage.",
  "Daytime reports are left out, as in other night-by-night figures, so these don’t add up to the monthly rates. " +
    "A date with no night may be quiet or unreported.",
  "Counts reported jointly for different classes (“mixed”) have no class rate. The anti-ship and other group is " +
    "varied, so read its figures with care.",
  "The weapon classes chosen above apply here. “Months shown” doesn’t: the windows are set by the event’s date. " +
    "No difference is calculated or tested.",
];
