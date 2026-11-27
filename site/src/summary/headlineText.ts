/**
 * The headline over each chart on the exploration tabs (#69). Each one is worked
 * out from the rows its chart draws, so it follows the filters and a data
 * refresh, and the chart's badges cover its figures. It says what the chart
 * shows and never why (AGENTS.md rule 6).
 *
 * The owner approved the wording on Nov 26, 2026 (#69). A change to it needs
 * their review again.
 *
 * The before/after chart has none, on the owner's choice (#69): a rate before and
 * after an event, as a heading, could read as the event's effect.
 *
 * Each function returns undefined where there is nothing to say, and the chart
 * then keeps its name as its heading. Guided stops don't use these.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { MapRow } from "../alerts/alertData.ts";
import type { AlertLaunchRow } from "../alerts/alertLaunchData.ts";
import type { ComparisonRow } from "../alerts/comparisonData.ts";
import { RATE_SHOWN, type RateChartRow, type SaturationRow, type SizeBinRow } from "../defense/defenseData.ts";
import {
  launchPanels,
  median,
  sumKnown,
  type BreakdownRow,
  type GapRow,
  type MonthChartRow,
  type MonthTable,
  type SizeBinRow as NightSizeRow,
  type WeekdayRow,
  type YearNightRow,
} from "../strikes/strikeData.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";
import { count, month, percent, whole } from "./format.ts";

type Labels = Record<ClassId, string>;

/** A class's name without its bracketed note, as a headline says it. */
const className = (labels: Labels, id: ClassId) => labels[id].replace(/ \(.*\)$/, "");

/** The same name inside a sentence. "Shahed" is a proper name and keeps its capital. */
function midSentence(labels: Labels, id: ClassId): string {
  const name = className(labels, id);
  return id === "shahed_drone" ? name : name[0]!.toLowerCase() + name.slice(1);
}

/** Said where a class is off, so a night's size isn't read as the whole night's. */
const subsetNote = (rows: readonly { classes_not_split: boolean }[]) =>
  rows.some((row) => row.classes_not_split) ? ", in the classes shown" : "";

const plural = (n: number, one: string, many = `${one}s`) => `${count.format(n)} ${n === 1 ? one : many}`;

/** The item with the highest value. The first wins a tie; one with no value is passed over. */
function highest<T>(items: readonly T[], value: (item: T) => number | null): T | undefined {
  let best: T | undefined;
  for (const item of items) {
    const found = value(item);
    if (found !== null && (best === undefined || found > value(best)!)) best = item;
  }
  return best;
}

function peakMonth(rows: readonly MonthChartRow[]): { month: string; total: number } | undefined {
  const totals = [...new Set(rows.map((row) => row.month))].map((key) => ({
    month: key,
    total: sumKnown(rows.filter((row) => row.month === key).map((row) => row.launched)),
  }));
  const best = highest(totals, (entry) => entry.total);
  return best && { month: best.month, total: best.total! };
}

/** `split` is the tab's two panels: drones, then the other classes. */
export function monthlyHeadline(rows: readonly MonthChartRow[], split: boolean): string | undefined {
  if (split) {
    const [drones, others] = launchPanels(rows).map((panel) => peakMonth(panel.rows));
    if (drones && others) {
      return (
        `Most launches in one month: ${whole.format(drones.total)} drones (${month(drones.month)}); ` +
        `${whole.format(others.total)} in missile and mixed classes (${month(others.month)})`
      );
    }
  }
  const peak = peakMonth(rows);
  return peak && `Most published launches in one month: ${whole.format(peak.total)}, in ${month(peak.month)}`;
}

/** The largest class's share over the months shown, out of all counted classes, like the chart's shares. */
export function mixHeadline(
  rows: readonly MonthChartRow[],
  table: MonthTable,
  months: readonly string[],
  labels: Labels,
): string | undefined {
  const all = sumKnown(table.rows.filter((row) => months.includes(row.month)).map((row) => row.launched));
  const classes = CLASS_IDS.map((id) => ({
    id,
    launched: sumKnown(rows.filter((row) => row.class === id).map((row) => row.launched)),
  }));
  const best = highest(classes, (entry) => entry.launched);
  if (!best || !all) return undefined;
  return (
    `${className(labels, best.id)}: ${percent.format(best.launched! / all)} of all published launches in the ` +
    "months shown"
  );
}

export function salvoHeadline(rows: readonly NightSizeRow[]): string | undefined {
  const years = [...new Map(rows.map((row) => [row.year, row.year_median]))];
  const first = years[0];
  const last = years.at(-1);
  if (!first || !last) return undefined;
  const note = subsetNote(rows);
  if (first[0] === last[0]) return `Median night in ${first[0]}: ${count.format(first[1])} weapons launched${note}`;
  return (
    `Median night: ${count.format(first[1])} weapons launched in ${first[0]}, ` +
    `${count.format(last[1])} in ${last[0]}${note}`
  );
}

export function breakdownHeadline(rows: readonly BreakdownRow[], labels: Labels): string | undefined {
  const best = highest(rows, (row) => row.launched);
  if (!best || best.night_total === null) return undefined;
  const lead = rows.length > 1 ? "Largest class shown: " : "";
  return (
    `${lead}${className(labels, best.class)}, ${count.format(best.launched!)} of the ` +
    `${count.format(best.night_total)} weapons launched that night`
  );
}

export function nightContextHeadline(rows: readonly YearNightRow[], date: string): string | undefined {
  const chosen = rows.find((row) => row.date === date);
  if (!chosen || rows.length < 2) return undefined;
  const smaller = rows.filter((row) => row.total < chosen.total).length;
  const year = date.slice(0, 4);
  if (smaller === rows.length - 1) return `No other night in ${year} had as many weapons launched, in all counted classes`;
  return (
    `More weapons launched than on ${count.format(smaller)} of the other ${count.format(rows.length - 1)} nights ` +
    `in ${year}, in all counted classes`
  );
}

/** The dates counted are those in the months shown that the data covers. */
export function calendarHeadline(
  rows: readonly { date: string }[],
  table: { firstDay: string; lastDay: string },
  months: readonly string[],
): string | undefined {
  if (!rows.length) return undefined;
  const shown = new Set(months);
  let dates = 0;
  for (let time = Date.parse(table.firstDay); time <= Date.parse(table.lastDay); time += 86_400_000) {
    if (shown.has(new Date(time).toISOString().slice(0, 7))) dates += 1;
  }
  return `${count.format(rows.length)} of the ${count.format(dates)} dates shown have a night in the data`;
}

export function weekdayHeadline(rows: readonly WeekdayRow[]): string | undefined {
  const known = rows.filter((row) => row.median_size !== null);
  const most = highest(known, (row) => row.median_size);
  const least = highest(known, (row) => -row.median_size!);
  if (!most || !least) return undefined;
  return (
    `Median night size by weekday: from ${count.format(least.median_size!)} (${least.weekday}) to ` +
    `${count.format(most.median_size!)} (${most.weekday})${subsetNote(rows)}`
  );
}

export function gapHeadline(rows: readonly GapRow[]): string | undefined {
  const gaps = rows.flatMap((row) => (row.gap_days === null ? [] : [row.gap_days]));
  const middle = median(gaps);
  if (middle === null) return undefined;
  return `Median gap between massive nights: ${plural(middle, "day")}`;
}

/** The range for drones and cruise missiles, the two large panels, or else for the first class with a rate. */
export function interceptHeadline(rows: readonly RateChartRow[], labels: Labels): string | undefined {
  const ranges = CLASS_IDS.flatMap((id) => {
    const rates = rows.flatMap((row) =>
      row.class === id && row.status === RATE_SHOWN ? [row.intercept_rate!] : [],
    );
    return rates.length ? [{ id, low: Math.min(...rates), high: Math.max(...rates) }] : [];
  });
  const large = ranges.filter((range) => range.id === "shahed_drone" || range.id === "cruise");
  const chosen = large.length ? large : ranges.slice(0, 1);
  if (!chosen.length) return undefined;
  const text = chosen.map((range) => {
    const span =
      range.low === range.high ? percent.format(range.low) : `${percent.format(range.low)} to ${percent.format(range.high)}`;
    return `${span} for ${midSentence(labels, range.id)}`;
  });
  return `Monthly reported intercept rates: ${text.join("; ")}`;
}

export function saturationHeadline(rows: readonly SaturationRow[]): string | undefined {
  const middle = median(rows.flatMap((row) => (row.not_intercepted === null ? [] : [row.not_intercepted])));
  if (middle === null) return undefined;
  return `Median night plotted: ${plural(middle, "weapon")} not reported destroyed`;
}

/**
 * The size group that has a median in the most years, then the most nights: the
 * lowest and highest of those years' medians. Not the first and last, which
 * would read as a trend and hide the years between.
 */
export function sizeBinHeadline(rows: readonly SizeBinRow[]): string | undefined {
  const groups = [...new Set(rows.map((row) => row.bin))].map((bin) => {
    const shown = rows.filter((row) => row.bin === bin && row.median_not_destroyed_share !== null);
    return { bin, shown, nights: shown.reduce((sum, row) => sum + row.n_nights, 0) };
  });
  // Years count for more than any number of nights.
  const best = highest(groups, (group) => group.shown.length * 1e6 + group.nights);
  const high = best && highest(best.shown, (row) => row.median_not_destroyed_share);
  const low = best && highest(best.shown, (row) => -row.median_not_destroyed_share!);
  if (!best || !high || !low) return undefined;
  const share = (row: SizeBinRow) => percent.format(row.median_not_destroyed_share!);
  const start = `Nights of ${best.bin} weapons: median share not reported destroyed`;
  if (best.shown.length === 1) return `${start} ${share(low)} in ${low.year}`;
  return `${start} from ${share(low)} (${low.year}) to ${share(high)} (${high.year})`;
}

export function mapHeadline(rows: readonly MapRow[]): string | undefined {
  const best = highest(rows, (row) => row.hours);
  if (!best) return undefined;
  const tied = rows.filter((row) => row.hours === best.hours).map((row) => row.name);
  const names = new Intl.ListFormat("en-US").format(tied);
  return `Most alert hours in ${month(best.month)}: ${names}, ${whole.format(best.hours!)}`;
}

/**
 * With several areas, the one that was highest in the most months (a tied month
 * counts for none). With one, its range.
 */
export function comparisonHeadline(rows: readonly ComparisonRow[]): string | undefined {
  const names = [...new Set(rows.map((row) => row.name))];
  const [only] = names;
  if (only === undefined) return undefined;
  if (names.length === 1) {
    const hours = rows.map((row) => row.hours);
    return (
      `${only}: from ${whole.format(Math.min(...hours))} to ${whole.format(Math.max(...hours))} alert hours a month`
    );
  }
  const wins = new Map(names.map((name) => [name, 0]));
  const months = [...new Set(rows.map((row) => row.month))];
  for (const key of months) {
    const own = rows.filter((row) => row.month === key);
    const top = Math.max(...own.map((row) => row.hours));
    const leaders = own.filter((row) => row.hours === top);
    if (leaders.length === 1) wins.set(leaders[0]!.name, wins.get(leaders[0]!.name)! + 1);
  }
  const best = highest(names, (name) => wins.get(name)!)!;
  if (!wins.get(best) || names.some((name) => name !== best && wins.get(name) === wins.get(best))) return undefined;
  return (
    `Of these areas, ${best} had the most alert hours in ${count.format(wins.get(best)!)} of ` +
    plural(months.length, "month")
  );
}

export function alertLaunchHeadline(rows: readonly AlertLaunchRow[]): string | undefined {
  const launches = highest(rows, (row) => row.launched);
  const hours = highest(rows, (row) => row.hours);
  const parts = [
    launches && `most reported launches in ${month(launches.month)} (${whole.format(launches.launched!)})`,
    hours && `most mean alert hours in ${month(hours.month)} (${whole.format(hours.hours!)})`,
  ].filter((part) => !!part);
  if (!parts.length) return undefined;
  const text = parts.join("; ");
  return text[0]!.toUpperCase() + text.slice(1);
}
