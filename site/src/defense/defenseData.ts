/**
 * Tab B's view of the strike tables: checks on the destroyed counts and rates,
 * and the rows each chart draws. Columns are described in data/README.md.
 *
 * The tab A parsers drop destroyed counts, so these keep them, always with
 * destroyed_includes_ew.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { BALLISTIC_RESTRICTION_FROM } from "../chart/flags.ts";
import {
  monthsShown,
  parseMonthly,
  parseNights,
  sumKnown,
  type MonthRow,
  type NightRow,
  type NightTable,
  type Selection,
} from "../strikes/strikeData.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";

interface Outcome {
  /** Reported destroyed, electronic warfare included, over rows where both counts are usable. */
  destroyed: number | null;
  /** Launches in those same rows. */
  launched_with_outcome: number | null;
  destroyed_includes_ew: boolean;
}

export type RateGap = "no_class_rate" | "missile_reporting_restricted" | "below_minimum";

export interface RateMonthRow extends MonthRow, Outcome {
  /** A fraction. null is a gap, never zero. */
  intercept_rate: number | null;
  intercept_rate_gap: RateGap | null;
}

export type OutcomeNightRow = NightRow & Outcome;

export interface RateTable {
  firstDay: string;
  lastDay: string;
  minLaunched: number;
  missileClasses: ClassId[];
  /** The first month, as YYYY-MM, with no missile-class rate. */
  missileRatesEndBefore: string;
  rows: RateMonthRow[];
}

export interface OutcomeTable extends NightTable {
  rows: OutcomeNightRow[];
}

/** Every counted class but mixed, which has no class rate. */
export const RATE_CLASSES: ClassId[] = CLASS_IDS.filter((id) => id !== "mixed");

const RATE_GAPS: readonly RateGap[] = ["no_class_rate", "missile_reporting_restricted", "below_minimum"];

function checker(file: string) {
  return (ok: boolean, message: string): void => {
    if (!ok) throw new Error(`${file}: ${message}`);
  };
}

type Check = ReturnType<typeof checker>;

const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;

function checkOutcome(row: Outcome & { launched: number | null }, where: string, check: Check): Outcome {
  const { destroyed, launched_with_outcome: withOutcome, destroyed_includes_ew: ew } = row;
  check(destroyed === null || isCount(destroyed), `${where}: destroyed must be a count or null`);
  check(withOutcome === null || isCount(withOutcome), `${where}: launched_with_outcome must be a count or null`);
  check((destroyed === null) === (withOutcome === null), `${where}: destroyed and launched_with_outcome go together`);
  check(destroyed === null || destroyed <= withOutcome!, `${where}: more destroyed than launched with an outcome`);
  check(
    withOutcome === null || (row.launched !== null && withOutcome <= row.launched),
    `${where}: launched_with_outcome is more than launched`,
  );
  // A destroyed figure without the EW flag could lose its caveat.
  check(ew === (destroyed !== null), `${where}: destroyed_includes_ew must be true exactly where destroyed is given`);
  return { destroyed, launched_with_outcome: withOutcome, destroyed_includes_ew: ew };
}

/** monthly_by_class.json with its destroyed counts and rates. */
export function parseRates(json: unknown): RateTable {
  const base = parseMonthly(json);
  const check: Check = checker("monthly_by_class.json");
  const raw = json as {
    rows: RateMonthRow[];
    intercept_rate?: { min_launched?: unknown; missile_classes?: unknown; missile_rates_end_before?: unknown };
  };
  const rule = raw.intercept_rate;
  const minLaunched = rule?.min_launched as number;
  check(isCount(minLaunched) && minLaunched > 0, "intercept_rate.min_launched must be a positive count");
  const missileClasses = rule?.missile_classes as ClassId[];
  const expected = RATE_CLASSES.filter((id) => id !== "shahed_drone");
  check(
    Array.isArray(missileClasses) &&
      missileClasses.length === expected.length &&
      expected.every((id) => missileClasses.includes(id)),
    `intercept_rate.missile_classes must be ${expected.join(", ")}`,
  );
  const end = rule?.missile_rates_end_before;
  // The owner ended missile-class rates at July 2026 (#5). A table can't move that by itself.
  const restrictedMonth = BALLISTIC_RESTRICTION_FROM.slice(0, 7);
  check(end === restrictedMonth, `intercept_rate.missile_rates_end_before must be ${restrictedMonth}`);

  const rows = base.rows.map((row, index): RateMonthRow => {
    const source = raw.rows[index]!;
    const where = `${source.month} ${source.class}`;
    const outcome = checkOutcome(source, where, check);
    const { intercept_rate: rate, intercept_rate_gap: gap } = source;
    check(rate === null ? RATE_GAPS.includes(gap!) : gap === null, `${where}: needs either a rate or a known gap reason`);
    const mixed = source.class === "mixed";
    const restricted = missileClasses.includes(source.class) && source.month >= restrictedMonth;
    check(!mixed || gap === "no_class_rate", `${where}: mixed rows have no class rate`);
    check(!restricted || gap === "missile_reporting_restricted", `${where}: missile classes have no rate from ${end}`);
    if (rate !== null) {
      check(
        outcome.launched_with_outcome !== null && outcome.launched_with_outcome >= minLaunched,
        `${where}: a rate needs at least ${minLaunched} launches with an outcome`,
      );
      // The table rounds to four decimals.
      check(
        Number.isFinite(rate) && Math.abs(rate - outcome.destroyed! / outcome.launched_with_outcome!) <= 0.000051,
        `${where}: intercept_rate disagrees with its counts`,
      );
    }
    return { ...row, ...outcome, intercept_rate: rate, intercept_rate_gap: gap };
  });
  return {
    firstDay: base.firstDay,
    lastDay: base.lastDay,
    minLaunched,
    missileClasses,
    missileRatesEndBefore: end as string,
    rows,
  };
}

/** nights.json with its destroyed counts. */
export function parseOutcomes(json: unknown): OutcomeTable {
  const base = parseNights(json);
  const check: Check = checker("nights.json");
  const raw = (json as { rows: OutcomeNightRow[] }).rows;
  const rows = base.rows.map((row, index) => ({
    ...row,
    ...checkOutcome(raw[index]!, `${row.date} ${row.class}`, check),
  }));
  return { ...base, rows };
}

export interface RateChartRow {
  month: string;
  class: ClassId;
  /** null in a gap, and the two counts are also null where they mustn't be used. */
  intercept_rate: number | null;
  destroyed: number | null;
  launched_with_outcome: number | null;
  status: string;
  n_unknown_launched: number | null;
  destroyed_includes_ew: boolean;
  ballistic_restricted: boolean;
}

export const RATE_SHOWN = "Rate shown";

/** The status of a month with a report but too few launches for a rate. */
export const tooFewStatus = (minLaunched: number): string =>
  `Gap: fewer than ${minLaunched} launches with an outcome`;

/**
 * One row for every month shown and every selected class that can have a rate,
 * so a month with no report breaks a line the same way a suppressed one does.
 * Counts are withheld where missile reporting is restricted: they would give
 * back the rate that was left out.
 */
export function rateRows(table: RateTable, selection: Selection): RateChartRow[] {
  const found = new Map(table.rows.map((row) => [`${row.month} ${row.class}`, row]));
  const classes = RATE_CLASSES.filter((id) => selection.classes.includes(id));
  return monthsShown(table, selection.from, selection.to).flatMap((month) =>
    classes.map((id): RateChartRow => {
      const row = found.get(`${month} ${id}`);
      const restrictedMonth = month >= BALLISTIC_RESTRICTION_FROM.slice(0, 7);
      const withheld = table.missileClasses.includes(id) && month >= table.missileRatesEndBefore;
      const status = withheld
        ? "Gap: missile reporting restricted"
        : !row
          ? "Gap: no report for this class"
          : row.intercept_rate_gap === "below_minimum"
            ? tooFewStatus(table.minLaunched)
            : RATE_SHOWN;
      return {
        month,
        class: id,
        intercept_rate: row?.intercept_rate ?? null,
        destroyed: withheld ? null : (row?.destroyed ?? null),
        launched_with_outcome: withheld ? null : (row?.launched_with_outcome ?? null),
        status,
        n_unknown_launched: row?.n_unknown_launched ?? null,
        destroyed_includes_ew: !withheld && (row?.destroyed_includes_ew ?? false),
        ballistic_restricted: row?.ballistic_restricted ?? restrictedMonth,
      };
    }),
  );
}

/** How many classes a night's reports cover. Panels of the saturation chart's split view, in order. */
export const MIX_GROUPS = ["One class reported", "Two classes reported", "Three or more classes reported"] as const;
export type MixGroup = (typeof MIX_GROUPS)[number];

export interface SaturationRow {
  date: string;
  /** The selected class with the most published launches. A tie goes to the first in class order. */
  class: ClassId;
  mix: MixGroup;
  /** Published launches by class, in words. */
  composition: string;
  /** Published launches in the selected classes. */
  size: number;
  launched_with_outcome: number | null;
  destroyed: number | null;
  /**
   * launched_with_outcome − destroyed. null unless every published launch has
   * an outcome: otherwise it would count the missing ones as destroyed.
   */
  not_intercepted: number | null;
  n_unknown_launched: number;
  destroyed_includes_ew: boolean;
  ballistic_restricted: boolean;
}

/**
 * One row per night with a published launch count in the selected classes.
 * A night with none has no size, so it's left out, never placed at 0.
 */
export function saturationRows(
  table: OutcomeTable,
  selection: Selection,
  labels: Record<ClassId, string>,
): SaturationRow[] {
  const nights = new Map<string, OutcomeNightRow[]>();
  for (const row of table.rows) {
    const month = row.date.slice(0, 7);
    if (month < selection.from || month > selection.to || !selection.classes.includes(row.class)) continue;
    const found = nights.get(row.date);
    if (found) found.push(row);
    else nights.set(row.date, [row]);
  }
  return [...nights]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, parts]): SaturationRow[] => {
      const size = sumKnown(parts.map((part) => part.launched));
      if (size === null) return [];
      parts.sort((a, b) => CLASS_IDS.indexOf(a.class) - CLASS_IDS.indexOf(b.class));
      // Sorting is stable, so a tie keeps class order.
      const lead = [...parts].sort((a, b) => (b.launched ?? -1) - (a.launched ?? -1))[0]!;
      const withOutcome = sumKnown(parts.map((part) => part.launched_with_outcome));
      const destroyed = sumKnown(parts.map((part) => part.destroyed));
      return [
        {
          date,
          class: lead.class,
          mix: MIX_GROUPS[Math.min(parts.length, MIX_GROUPS.length) - 1]!,
          composition: parts
            .map((part) => `${labels[part.class]}: ${part.launched ?? "count not published"}`)
            .join("; "),
          size,
          launched_with_outcome: withOutcome,
          destroyed,
          not_intercepted: withOutcome === size ? withOutcome - destroyed! : null,
          n_unknown_launched: parts.reduce((sum, part) => sum + part.n_unknown_launched, 0),
          destroyed_includes_ew: destroyed !== null,
          ballistic_restricted: parts.some((part) => part.ballistic_restricted),
        },
      ];
    });
}

/** Bins of night size for the summary beside the saturation chart. `max` is included. */
export const SIZE_BINS = [
  { label: "1–9", min: 1, max: 9 },
  { label: "10–24", min: 10, max: 24 },
  { label: "25–49", min: 25, max: 49 },
  { label: "50–99", min: 50, max: 99 },
  { label: "100–199", min: 100, max: 199 },
  { label: "200–399", min: 200, max: 399 },
  { label: "400 or more", min: 400, max: Infinity },
] as const;

/** Fewer nights than this in a year's bin give no median. The agent's choice (plan §11). */
export const MIN_BIN_NIGHTS = 5;

export const MEDIAN_SHOWN = "Median shown";

export interface SizeBinRow {
  year: string;
  bin: string;
  /** The first and last nights counted in this year, whatever their size. */
  from: string;
  to: string;
  /**
   * The median, over the bin's nights, of the share not reported destroyed:
   * not_intercepted ÷ size. A fraction. null is a gap, never zero.
   */
  median_not_destroyed_share: number | null;
  n_nights: number;
  status: string;
  destroyed_includes_ew: boolean;
  ballistic_restricted: boolean;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Every size bin for every year with a counted night. This adds classes
 * together, so like any all-class share it stops before the month where
 * missile-class rates end (the owner's decision on #9). A night counts only if
 * it has a point on the saturation chart.
 */
export function sizeBinRows(
  rows: readonly SaturationRow[],
  table: Pick<RateTable, "missileRatesEndBefore">,
): SizeBinRow[] {
  const end = `${table.missileRatesEndBefore}-01`;
  const counted = rows.filter((row) => row.date < end && row.size > 0 && row.not_intercepted !== null);
  const years = [...new Set(counted.map((row) => row.date.slice(0, 4)))].sort();
  return years.flatMap((year) => {
    const own = counted.filter((row) => row.date.startsWith(year));
    const dates = own.map((row) => row.date).sort();
    return SIZE_BINS.map((bin): SizeBinRow => {
      const found = own.filter((row) => row.size >= bin.min && row.size <= bin.max);
      const enough = found.length >= MIN_BIN_NIGHTS;
      return {
        year,
        bin: bin.label,
        from: dates[0]!,
        to: dates[dates.length - 1]!,
        median_not_destroyed_share: enough ? median(found.map((row) => row.not_intercepted! / row.size)) : null,
        n_nights: found.length,
        status: enough ? MEDIAN_SHOWN : `Gap: fewer than ${MIN_BIN_NIGHTS} nights`,
        destroyed_includes_ew: enough,
        ballistic_restricted: found.some((row) => row.ballistic_restricted),
      };
    });
  });
}
