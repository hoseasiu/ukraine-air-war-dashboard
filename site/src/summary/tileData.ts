/**
 * The summary tiles at the top of the exploration tabs (#69). They follow each
 * tab's filters, and each has its own dates and badges, worked out by the same
 * rules as the charts'.
 *
 * The choice of tiles and their wording are drafts until the owner approves
 * them on #69.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { monthsInRange, type AlertTable } from "../alerts/alertData.ts";
import { chartFlags, monthPeriod, type ColumnSpec, type FlagId, type Period } from "../chart/flags.ts";
import type { RateTable } from "../defense/defenseData.ts";
import { monthFromNumber, monthNumber } from "../filters/state.ts";
import {
  allNights,
  isSubset,
  median,
  monthsShown,
  nightsInRange,
  sumKnown,
  type MonthTable,
  type NightTable,
  type Selection,
} from "../strikes/strikeData.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";
import { count, day, month, percent, whole } from "./format.ts";

export interface Tile {
  id: string;
  /** The number as shown, or "No figure". Never 0 for unknown. */
  value: string;
  /** What the number is. */
  label: string;
  /** The dates the number covers. Left out where there's no figure. */
  period?: Period;
  /** What it leaves out, or why there's no figure. */
  note: string;
  flags: FlagId[];
}

const NO_FIGURE = "No figure";

const flagsFor = (columns: readonly ColumnSpec[], rows: object[], coverage: Period) =>
  chartFlags({ columns, rows, coverage });

const LAUNCHED: ColumnSpec = { key: "launched", label: "Launched", type: "number", measure: "launched" };
const SIZE: ColumnSpec = { key: "size", label: "Weapons in a night", type: "number", measure: "launch_derived" };

/** The part of these months that the data covers. */
function covered(table: { firstDay: string; lastDay: string }, months: readonly string[]): Period {
  const from = monthPeriod(months[0]!).from;
  const to = monthPeriod(months.at(-1)!).to;
  return { from: from < table.firstDay ? table.firstDay : from, to: to > table.lastDay ? table.lastDay : to };
}

/** Tab A: how much was launched, an ordinary night and the largest one. */
export function attackTiles(monthly: MonthTable, nights: NightTable, selection: Selection): Tile[] {
  const months = monthsShown(monthly, selection.from, selection.to);
  if (!months.length || !selection.classes.length) return [];
  const period = covered(monthly, months);
  const subset = isSubset(selection.classes);
  const classes = subset ? "the weapon classes chosen" : "all counted classes";

  const rows = monthly.rows.filter((row) => months.includes(row.month) && selection.classes.includes(row.class));
  const launched = sumKnown(rows.map((row) => row.launched));
  const sized = nightsInRange(allNights(nights, selection.classes), selection).filter((night) => night.size !== null);
  const sizes = sized.map((night) => night.size!);
  const middle = median(sizes);
  // The first night with the most wins a tie.
  const largest = sized.reduce<(typeof sized)[number] | undefined>(
    (best, night) => (!best || night.size! > best.size! ? night : best),
    undefined,
  );

  const flagRows = (source: readonly { ballistic_restricted: boolean }[]) =>
    source.map((row) => ({ ballistic_restricted: row.ballistic_restricted, classes_not_split: subset }));
  const nightPeriod = sized.length ? { from: sized[0]!.date, to: sized.at(-1)!.date } : undefined;
  const nightFlags = nightPeriod ? flagsFor([SIZE], flagRows(sized), nightPeriod) : [];

  return [
    {
      id: "launched",
      value: launched === null ? NO_FIGURE : whole.format(launched),
      label: "weapons launched, from published counts",
      period: launched === null ? undefined : period,
      note: `In ${classes}, daytime reports included. Unpublished counts are left out.`,
      flags: launched === null ? [] : flagsFor([LAUNCHED], flagRows(rows), period),
    },
    {
      id: "median_night",
      value: middle === null ? NO_FIGURE : count.format(middle),
      label: "weapons launched in the median night",
      period: nightPeriod,
      note:
        `Over ${whole.format(sizes.length)} ${sizes.length === 1 ? "night" : "nights"} with a published count, ` +
        `in ${classes}. Daytime reports are left out, and a date with no night isn’t counted as 0.`,
      flags: nightFlags,
    },
    {
      id: "largest_night",
      value: largest ? count.format(largest.size!) : NO_FIGURE,
      label: "weapons launched in the largest night",
      period: nightPeriod,
      note: largest
        ? `The night ending ${day(largest.date)}, in ${classes}. Published counts only.`
        : "No night shown has a published count.",
      flags: nightFlags,
    },
  ];
}

/** The classes with their own tile on tab B, after the one for all classes. */
const SHARE_TILES: readonly { id: ClassId; name: string }[] = [
  { id: "shahed_drone", name: "Shahed-type and decoy drone" },
  { id: "cruise", name: "cruise missile" },
  { id: "ballistic", name: "ballistic missile" },
];

/**
 * Tab B: the share reported destroyed over the months shown. A share that adds
 * classes together stops where missile-class rates end (the owner's decision on
 * #9), as a missile class's own share does. Under the minimum number of
 * launches there's no share, as for a monthly rate.
 */
export function defenseTiles(rates: RateTable, selection: Selection): Tile[] {
  const months = monthsShown(rates, selection.from, selection.to);
  if (!months.length || !selection.classes.length) return [];
  const lastMissileMonth = monthFromNumber(monthNumber(rates.missileRatesEndBefore) - 1);
  const endNote = `It stops at ${month(lastMissileMonth)}, because missile reporting was later restricted.`;

  function tile(id: string, label: string, classes: readonly ClassId[], single: boolean): Tile {
    const stops = !single || rates.missileClasses.includes(classes[0]!);
    const counted = stops ? months.filter((key) => key <= lastMissileMonth) : months;
    const rows = rates.rows.filter((row) => counted.includes(row.month) && classes.includes(row.class));
    const destroyed = sumKnown(rows.map((row) => row.destroyed));
    const withOutcome = sumKnown(rows.map((row) => row.launched_with_outcome));
    const note = stops ? ` ${endNote}` : "";
    if (destroyed === null || withOutcome === null || withOutcome < rates.minLaunched) {
      return {
        id,
        value: NO_FIGURE,
        label,
        note: `The months shown have fewer than ${rates.minLaunched} launches with an outcome to count.${note}`,
        flags: [],
      };
    }
    const period = covered(rates, counted);
    const columns: ColumnSpec[] = [{ key: "share", label: "Share reported destroyed", type: "number", measure: "intercept_rate" }];
    // One class's figures don't cover its share of jointly reported counts.
    if (single) columns.push({ key: "class", label: "Class", type: "class" });
    return {
      id,
      value: percent.format(destroyed / withOutcome),
      label,
      period,
      note:
        `${whole.format(destroyed)} of ${whole.format(withOutcome)} launches in reports where both counts are ` +
        `usable.${note}`,
      flags: flagsFor(
        columns,
        rows.map((row) => ({
          destroyed_includes_ew: row.destroyed_includes_ew,
          ballistic_restricted: row.ballistic_restricted,
          classes_not_split: !single && isSubset(classes),
        })),
        period,
      ),
    };
  }

  const chosen = CLASS_IDS.filter((id) => selection.classes.includes(id));
  const together = isSubset(chosen) ? "the classes chosen" : "all counted classes";
  return [
    tile(
      "share_all",
      `of launches reported destroyed, including by electronic warfare: ${together}`,
      chosen,
      false,
    ),
    ...SHARE_TILES.filter((entry) => chosen.includes(entry.id)).map((entry) =>
      tile(
        `share_${entry.id}`,
        `of ${entry.name} launches reported destroyed, including by electronic warfare`,
        [entry.id],
        true,
      ),
    ),
  ];
}

/**
 * Tab E: an average month's alert hours, for the mean over all areas and then
 * for each area the comparison draws.
 */
export function alertTiles(
  alerts: AlertTable,
  areas: readonly { id: string; name: string }[],
  compared: readonly string[],
  excluded: readonly string[],
  range: Pick<Selection, "from" | "to">,
): Tile[] {
  const months = monthsInRange(alerts, range.from, range.to);
  if (!months.length) return [];
  const period = { from: monthPeriod(months[0]!).from, to: monthPeriod(months.at(-1)!).to };
  const rows = alerts.rows.filter((row) => months.includes(row.month));
  const column: ColumnSpec = { key: "hours", label: "Alert hours", type: "number", measure: "alert_hours" };

  function tile(id: string, label: string, note: string, own: AlertTable["rows"]): Tile {
    // Each row is one area's month, so the mean weighs every area and month alike.
    const hours = own.reduce((sum, row) => sum + row.hours, 0) / own.length;
    return {
      id,
      value: whole.format(hours),
      label,
      period,
      note,
      flags: flagsFor(
        [column],
        own.map((row) => ({
          alert_end_assumed: row.alert_end_assumed,
          alert_regions_excluded: row.alert_regions_excluded,
          alert_granularity_change: row.alert_granularity_change,
        })),
        period,
      ),
    };
  }

  const total = new Set(rows.map((row) => row.oblast)).size;
  return [
    tile(
      "alert_hours_all",
      "hours under air-raid alert in an average month, mean per area",
      `The mean of ${total} areas (oblasts and Kyiv city). Not a national total. Leaves out ` +
        `${new Intl.ListFormat("en-US").format(excluded)}.`,
      rows,
    ),
    ...compared.map((id) => {
      const area = areas.find((candidate) => candidate.id === id);
      if (!area) throw new Error(`Alert tiles: unknown area ${id}`);
      return tile(
        `alert_hours_${id}`,
        `hours in an average month: ${area.name}`,
        "Averaged over the area’s raions, so it isn’t the time that any part of it was under alert.",
        rows.filter((row) => row.oblast === id),
      );
    }),
  ];
}
