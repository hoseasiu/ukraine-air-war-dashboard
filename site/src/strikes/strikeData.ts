/**
 * The strike tables: checks on both, and the rows each tab A chart draws.
 * Columns are described in data/README.md.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { monthPeriod, type Period } from "../chart/flags.ts";
import { monthFromNumber, monthNumber } from "../filters/state.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";

interface ClassCounts {
  class: ClassId;
  /** Sum of the published counts. null means none is known, never zero. */
  launched: number | null;
  /** Reports whose launch count is unpublished or blank. */
  n_unknown_launched: number;
  ballistic_restricted: boolean;
}

export interface NightRow extends ClassCounts {
  /** The Kyiv date the night's reports end on. */
  date: string;
  is_massive: boolean | null;
  /** As reported. One entry can name several places, and counts can't be divided among them. */
  launch_places: string[];
  launch_place_missing: boolean;
}

export interface MonthRow extends ClassCounts {
  month: string;
}

export interface MassiveYear {
  year: number;
  /** A massive night had more weapons launched than this. */
  massive_above: number;
  n_nights: number;
  n_massive: number;
  first_night: string;
  last_night: string;
}

export interface NightTable {
  firstDay: string;
  lastDay: string;
  quantile: number;
  years: MassiveYear[];
  rows: NightRow[];
}

export interface MonthTable {
  firstDay: string;
  lastDay: string;
  rows: MonthRow[];
}

const DATE = /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function checker(file: string) {
  return (ok: boolean, message: string): void => {
    if (!ok) throw new Error(`${file}: ${message}`);
  };
}

type Check = ReturnType<typeof checker>;

/**
 * Keeps only the columns named. The tables also carry destroyed counts and
 * their EW flag; a flag left on a row would badge a chart that shows neither.
 */
function pick<Row, Key extends keyof Row>(row: Row, keys: readonly Key[]): Pick<Row, Key> {
  return Object.fromEntries(keys.map((key) => [key, row[key]])) as Pick<Row, Key>;
}

const COUNT_KEYS = ["class", "launched", "n_unknown_launched", "ballistic_restricted"] as const;

const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;

function checkCounts(row: ClassCounts, where: string, check: Check): void {
  check((CLASS_IDS as string[]).includes(row.class), `${where}: unknown class ${JSON.stringify(row.class)}`);
  check(row.launched === null || isCount(row.launched), `${where}: launched must be a count or null`);
  check(isCount(row.n_unknown_launched), `${where}: n_unknown_launched must be a count`);
  check(typeof row.ballistic_restricted === "boolean", `${where}: ballistic_restricted must be true or false`);
}

function header(json: unknown, check: Check) {
  const table = (json ?? {}) as { first_day?: string; last_day?: string; rows?: unknown };
  check(DATE.test(table.first_day ?? "") && DATE.test(table.last_day ?? ""), "needs first_day and last_day");
  check(Array.isArray(table.rows) && table.rows.length > 0, "needs rows");
  return { firstDay: table.first_day!, lastDay: table.last_day!, rows: table.rows as unknown[] };
}

export function parseMonthly(json: unknown): MonthTable {
  const check: Check = checker("monthly_by_class.json");
  const { firstDay, lastDay, rows } = header(json, check);
  const seen = new Set<string>();
  for (const row of rows as MonthRow[]) {
    const where = `${row.month} ${row.class}`;
    check(MONTH.test(row.month), `${where}: month must be YYYY-MM`);
    check(!seen.has(where), `${where}: repeated`);
    seen.add(where);
    checkCounts(row, where, check);
  }
  return { firstDay, lastDay, rows: (rows as MonthRow[]).map((row) => pick(row, ["month", ...COUNT_KEYS])) };
}

/** The sum of the known counts, or null if none is known. */
export function sumKnown(values: readonly (number | null)[]): number | null {
  const known = values.filter((value) => value !== null);
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const found = groups.get(key(item));
    if (found) found.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

/** Also checks that each night's massive label agrees with its size and its year's bar. */
export function parseNights(json: unknown): NightTable {
  const check: Check = checker("nights.json");
  const { firstDay, lastDay, rows } = header(json, check);
  const massive = (json as { massive?: { quantile?: unknown; years?: unknown } }).massive;
  check(typeof massive?.quantile === "number" && Array.isArray(massive.years), "needs massive.quantile and massive.years");
  const years = massive!.years as MassiveYear[];
  for (const year of years) {
    check(
      Number.isInteger(year.year) && Number.isFinite(year.massive_above),
      `massive.years: needs a year and its bar, got ${JSON.stringify(year)}`,
    );
  }

  const seen = new Set<string>();
  for (const row of rows as NightRow[]) {
    const where = `${row.date} ${row.class}`;
    check(DATE.test(row.date), `${where}: date must be YYYY-MM-DD`);
    check(!seen.has(where), `${where}: repeated`);
    seen.add(where);
    checkCounts(row, where, check);
    check(row.is_massive === null || typeof row.is_massive === "boolean", `${where}: is_massive must be true, false or null`);
    check(Array.isArray(row.launch_places), `${where}: launch_places must be a list`);
    check(typeof row.launch_place_missing === "boolean", `${where}: launch_place_missing must be true or false`);
  }

  for (const [date, parts] of groupBy(rows as NightRow[], (row) => row.date)) {
    const bar = years.find((year) => year.year === Number(date.slice(0, 4)));
    check(!!bar, `${date}: massive.years has no bar for its year`);
    const size = sumKnown(parts.map((part) => part.launched));
    const expected = size === null ? null : size > bar!.massive_above;
    check(
      parts.every((part) => part.is_massive === expected),
      `${date}: is_massive disagrees with the night's size and its year's bar`,
    );
  }
  const kept = (rows as NightRow[]).map((row) =>
    pick(row, ["date", ...COUNT_KEYS, "is_massive", "launch_places", "launch_place_missing"]),
  );
  return { firstDay, lastDay, quantile: massive!.quantile as number, years, rows: kept };
}

/** The months and classes a chart shows. */
export interface Selection {
  /** First and last month shown, both included, as YYYY-MM. */
  from: string;
  to: string;
  classes: readonly ClassId[];
}

const inMonths = (month: string, { from, to }: Pick<Selection, "from" | "to">) => month >= from && month <= to;

/** The selected months that fall within the table's dates, in order. */
export function monthsShown(table: { firstDay: string; lastDay: string }, from: string, to: string): string[] {
  const first = [from, table.firstDay.slice(0, 7)].sort()[1]!;
  const last = [to, table.lastDay.slice(0, 7)].sort()[0]!;
  const months: string[] = [];
  for (let n = monthNumber(first); n <= monthNumber(last); n++) months.push(monthFromNumber(n));
  return months;
}

/** The part of a month that the data covers. */
function coveredMonth(table: { firstDay: string; lastDay: string }, month: string): Period {
  const whole = monthPeriod(month);
  return {
    from: whole.from < table.firstDay ? table.firstDay : whole.from,
    to: whole.to > table.lastDay ? table.lastDay : whole.to,
  };
}

export interface MonthChartRow extends MonthRow {
  /** Says which days a partial month has; otherwise "Whole month". */
  days: string;
  /** This class's share of the month's published launches in all counted classes, or null. */
  share: number | null;
}

/**
 * One row per month and class that has a report. The share's denominator is
 * every counted class, so a class's share doesn't change with the class toggles.
 */
export function monthRows(table: MonthTable, selection: Selection, formatDay: (date: string) => string): MonthChartRow[] {
  const totals = new Map(
    [...groupBy(table.rows, (row) => row.month)].map(([month, rows]) => [month, sumKnown(rows.map((r) => r.launched))]),
  );
  return table.rows
    .filter((row) => inMonths(row.month, selection) && selection.classes.includes(row.class))
    .sort((a, b) => a.month.localeCompare(b.month) || CLASS_IDS.indexOf(a.class) - CLASS_IDS.indexOf(b.class))
    .map((row) => {
      const whole = monthPeriod(row.month);
      const covered = coveredMonth(table, row.month);
      const days =
        covered.from !== whole.from
          ? `Partial: from ${formatDay(covered.from)}`
          : covered.to !== whole.to
            ? `Partial: through ${formatDay(covered.to)}`
            : "Whole month";
      const total = totals.get(row.month) ?? null;
      return { ...row, days, share: row.launched === null || !total ? null : row.launched / total };
    });
}

export interface Night {
  date: string;
  /** Known launches in the selected classes. null if none is known. */
  size: number | null;
  /** Known launches in all counted classes: the size the massive test uses. */
  total: number | null;
  is_massive: boolean | null;
  /** Reports in the selected classes with no published count. */
  n_unknown_launched: number;
  /** False if no selected class has a report this night. */
  reported: boolean;
  ballistic_restricted: boolean;
}

/**
 * True if a year's massive bar is calculated partly from nights under the
 * missile-reporting restriction. Anything that shows that bar, or labels a
 * night with it, is then flagged too, even for earlier nights (AGENTS.md rule 3).
 */
export const barIsRestricted = (table: NightTable, year: number): boolean =>
  table.rows.some((row) => row.ballistic_restricted && row.date.startsWith(`${year}-`));

const yearOf = (date: string) => Number(date.slice(0, 4));

/** Every date with a night, in order, whatever is selected. */
export function allNights(table: NightTable, classes: readonly ClassId[]): Night[] {
  return [...groupBy(table.rows, (row) => row.date)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => {
      const chosen = rows.filter((row) => classes.includes(row.class));
      return {
        date,
        size: sumKnown(chosen.map((row) => row.launched)),
        total: sumKnown(rows.map((row) => row.launched)),
        is_massive: rows[0]!.is_massive,
        n_unknown_launched: chosen.reduce((sum, row) => sum + row.n_unknown_launched, 0),
        reported: chosen.length > 0,
        ballistic_restricted: rows.some((row) => row.ballistic_restricted),
      };
    });
}

export const nightsInRange = (nights: readonly Night[], range: Pick<Selection, "from" | "to">): Night[] =>
  nights.filter((night) => inMonths(night.date.slice(0, 7), range));

/** True if some counted class is off, so night sizes are no longer the ones the massive test uses. */
export const isSubset = (classes: readonly ClassId[]) => CLASS_IDS.some((id) => !classes.includes(id));

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Facts shared by rows that summarize several nights. */
export interface Summary {
  /** First and last night summarized. */
  from: string;
  to: string;
  ballistic_restricted: boolean;
  classes_not_split: boolean;
}

function summary(nights: readonly Night[], classes: readonly ClassId[]): Summary {
  return {
    from: nights[0]!.date,
    to: nights[nights.length - 1]!.date,
    ballistic_restricted: nights.some((night) => night.ballistic_restricted),
    classes_not_split: isSubset(classes),
  };
}

export const SIZE_BIN_WIDTH = 25;

/** Where the size axis usually ends. Larger nights share one overflow bin. */
const SIZE_CAP = 600;

/**
 * The size from which nights share the overflow bin. It rises past SIZE_CAP if
 * needed, so every year's massive bar stays on the axis. It uses all the bars,
 * so the filters don't move it.
 */
export function sizeCap(table: NightTable): number {
  const highest = Math.max(...table.years.map((year) => year.massive_above));
  return Math.max(SIZE_CAP, Math.ceil((highest + SIZE_BIN_WIDTH) / 100) * 100);
}

export interface SizeBinRow extends Summary {
  year: number;
  /** The bin holds sizes from bin_from to bin_to, both included. */
  bin_from: number;
  /** null for the overflow bin, which has no upper end. */
  bin_to: number | null;
  bin: string;
  /** Nights shown in this year whose size is in the bin. */
  nights: number;
  year_nights: number;
  year_median: number;
  /** The year's largest night shown, so the overflow bin doesn't hide it. */
  year_max: number;
  /** null when a class is off: the year's bar is defined on all counted classes. */
  massive_above: number | null;
}

/**
 * Night sizes by year, in bins of SIZE_BIN_WIDTH from 0, with one overflow bin
 * from sizeCap(). Every bin up to the one holding the year's largest night has
 * a row, so an empty bin reads as no nights. A night
 * with no known count in the selected classes is left out, never counted as 0.
 */
export function sizeBins(table: NightTable, selection: Selection): SizeBinRow[] {
  const shown = nightsInRange(allNights(table, selection.classes), selection).filter((night) => night.size !== null);
  const overflow = sizeCap(table) / SIZE_BIN_WIDTH;
  const binOf = (size: number) => Math.min(overflow, Math.floor(size / SIZE_BIN_WIDTH));
  return [...groupBy(shown, (night) => Number(night.date.slice(0, 4)))].flatMap(([year, nights]) => {
    const sizes = nights.map((night) => night.size!);
    const largest = Math.max(...sizes);
    const counts = new Array<number>(binOf(largest) + 1).fill(0);
    for (const size of sizes) counts[binOf(size)]! += 1;
    const bar = table.years.find((entry) => entry.year === year)!.massive_above;
    const facts = summary(nights, selection.classes);
    if (!isSubset(selection.classes) && barIsRestricted(table, year)) facts.ballistic_restricted = true;
    return counts.map((count, index) => {
      const bin_from = index * SIZE_BIN_WIDTH;
      const bin_to = index === overflow ? null : bin_from + SIZE_BIN_WIDTH - 1;
      return {
        ...facts,
        year,
        bin_from,
        bin_to,
        bin: bin_to === null ? `${bin_from} or more` : `${bin_from}–${bin_to}`,
        nights: count,
        year_nights: nights.length,
        year_median: median(sizes)!,
        year_max: largest,
        massive_above: isSubset(selection.classes) ? null : bar,
      };
    });
  });
}

/** Monday first. */
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

export interface WeekdayRow extends Summary {
  weekday: (typeof WEEKDAYS)[number];
  /** Nights with a known count in the selected classes. */
  nights: number;
  median_size: number | null;
  /** Massive nights among them. The label comes from all counted classes. */
  massive_nights: number;
}

/** By the weekday of the date a night ends on. Empty if no night is shown. */
export function weekdayRows(table: NightTable, selection: Selection): WeekdayRow[] {
  const shown = nightsInRange(allNights(table, selection.classes), selection).filter((night) => night.size !== null);
  if (!shown.length) return [];
  const facts = summary(shown, selection.classes);
  if (shown.some((night) => barIsRestricted(table, yearOf(night.date)))) facts.ballistic_restricted = true;
  return WEEKDAYS.map((weekday, index) => {
    const nights = shown.filter((night) => weekdayIndex(night.date) === index);
    return {
      ...facts,
      weekday,
      nights: nights.length,
      median_size: median(nights.map((night) => night.size!)),
      massive_nights: nights.filter((night) => night.is_massive).length,
    };
  });
}

export interface GapRow {
  date: string;
  /** The massive night before this one, even if it's outside the months shown. */
  previous: string | null;
  /** Days from the previous massive night. null for the first in the data. */
  gap_days: number | null;
  total: number;
  /** This night's year's bar. */
  massive_above: number;
  ballistic_restricted: boolean;
}

/** Massive nights are labeled on all counted classes, so the class toggles don't apply. */
export function massiveGaps(table: NightTable, range: Pick<Selection, "from" | "to">): GapRow[] {
  const massive = allNights(table, CLASS_IDS).filter((night) => night.is_massive);
  return massive
    .map((night, index) => {
      const previous = massive[index - 1]?.date ?? null;
      return {
        date: night.date,
        previous,
        gap_days: previous === null ? null : (Date.parse(night.date) - Date.parse(previous)) / 86_400_000,
        total: night.total!,
        massive_above: table.years.find((year) => year.year === Number(night.date.slice(0, 4)))!.massive_above,
        ballistic_restricted: night.ballistic_restricted || barIsRestricted(table, yearOf(night.date)),
      };
    })
    .filter((row) => inMonths(row.date.slice(0, 7), range));
}

export interface BreakdownRow extends NightRow {
  places: string;
  night_total: number | null;
  /** The bar for the night's year. */
  massive_above: number;
  massive: string;
}

/** What one night's reports list, by class, in chart order. */
export function breakdownRows(table: NightTable, date: string, classes: readonly ClassId[]): BreakdownRow[] {
  const night = table.rows.filter((row) => row.date === date);
  const total = sumKnown(night.map((row) => row.launched));
  const bar = table.years.find((year) => year.year === Number(date.slice(0, 4)));
  return night
    .filter((row) => classes.includes(row.class))
    .sort((a, b) => CLASS_IDS.indexOf(a.class) - CLASS_IDS.indexOf(b.class))
    .map((row) => {
      const listed = row.launch_places.join("; ");
      const places = !listed
        ? "None named"
        : row.launch_place_missing
          ? `${listed} (at least one report names no place)`
          : listed;
      return {
        ...row,
        places,
        ballistic_restricted: row.ballistic_restricted || barIsRestricted(table, yearOf(date)),
        night_total: total,
        massive_above: bar!.massive_above,
        massive: row.is_massive === null ? "Massive: unknown" : row.is_massive ? "Massive night" : "Not massive",
      };
    });
}

export interface YearNightRow {
  date: string;
  /** Known launches in all counted classes: the size the massive test uses. */
  total: number;
  massive_above: number;
  massive: string;
  /** Says whether this is the night the breakdown shows. */
  shown: string;
  ballistic_restricted: boolean;
}

/**
 * Every night with a known size in the same year as `date`, to set one night's
 * size against. It counts all counted classes, so the year's bar applies.
 */
export function yearNightRows(table: NightTable, date: string): YearNightRow[] {
  const year = yearOf(date);
  const bar = table.years.find((entry) => entry.year === year)!.massive_above;
  const restricted = barIsRestricted(table, year);
  return allNights(table, CLASS_IDS)
    .filter((night) => yearOf(night.date) === year && night.total !== null)
    .map((night) => ({
      date: night.date,
      total: night.total!,
      massive_above: bar,
      massive: night.is_massive ? "Massive night" : "Not massive",
      shown: night.date === date ? "The night broken down" : "Another night",
      ballistic_restricted: night.ballistic_restricted || restricted,
    }));
}

/** The massive nights in the months shown. */
export const massiveDates = (table: NightTable, range: Pick<Selection, "from" | "to">): string[] =>
  massiveGaps(table, range).map((row) => row.date);

/** The date with the most known launches among those given. The earliest wins a tie. */
export function largestNight(table: NightTable, dates: readonly string[]): string | undefined {
  let best: Night | undefined;
  for (const night of allNights(table, CLASS_IDS)) {
    if (dates.includes(night.date) && (!best || (night.total ?? 0) > (best.total ?? 0))) best = night;
  }
  return best?.date;
}
