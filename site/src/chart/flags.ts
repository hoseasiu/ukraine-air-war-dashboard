/**
 * Data-quality flags (plan §4) and the rules for when a chart must show them.
 *
 * A chart doesn't choose its badges. The frame derives them from what each
 * column measures, the dates the chart covers, and the flag columns the
 * pipeline puts on rows. A row flag can add a badge; nothing can remove one
 * that a rule requires.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */

/** Also the badge order. These are the names of the pipeline's boolean row columns. */
export const FLAG_IDS = [
  "destroyed_includes_ew",
  "ballistic_restricted",
  "classes_not_split",
  "alert_end_assumed",
  "alert_regions_excluded",
  "alert_granularity_change",
] as const;

export type FlagId = (typeof FLAG_IDS)[number];

export interface FlagText {
  /** Short name, used on the badge and in tooltips. */
  label: string;
  /** The caveat in full. Opens from the badge and from the tab's data notes. */
  text: string;
}

export const FLAG_TEXT: Record<FlagId, FlagText> = {
  destroyed_includes_ew: {
    label: "“Destroyed” includes EW",
    text: "Reported “destroyed” counts include weapons lost to electronic warfare (EW). Launched minus destroyed is not a count of hits.",
  },
  ballistic_restricted: {
    label: "Missile reporting restricted",
    text: "From Aug 11, 2026, some missile counts have not been published, including ballistic, cruise and anti-ship missiles. Missile figures, totals and class mix from then on are incomplete. An unpublished count is unknown, not zero.",
  },
  classes_not_split: {
    label: "Mixed rows not split",
    text: "Counts reported jointly for different weapon classes are not split. A single class’s figures don’t cover every launch of that kind.",
  },
  alert_end_assumed: {
    label: "Some alert end times may be assumed",
    text: "The source gives an alert with no recorded end an assumed one, without marking it. Some end times here may be assumed.",
  },
  alert_regions_excluded: {
    label: "Luhansk and Crimea excluded",
    text: "Luhansk and Crimea are excluded because their permanent alerts are not listed. Excluded does not mean zero.",
  },
  alert_granularity_change: {
    label: "Alert areas changed",
    text: "During 2025, alerting moved from whole oblasts to raions (districts). Months after the switch are only partly comparable with earlier ones.",
  },
};

/**
 * What a numeric column counts. The list is closed on purpose: a new kind of
 * number means deciding here which caveats it carries.
 */
export const MEASURES = {
  launched: { launchBased: true, ew: false, alert: false },
  /** Worked out from launch counts: salvo sizes, massive nights, gaps between them. */
  launch_derived: { launchBased: true, ew: false, alert: false },
  destroyed: { launchBased: true, ew: true, alert: false },
  not_intercepted: { launchBased: true, ew: true, alert: false },
  /** A fraction: 0.5 is 50%. */
  intercept_rate: { launchBased: true, ew: true, alert: false },
  alert_hours: { launchBased: false, ew: false, alert: true },
  alert_count: { launchBased: false, ew: false, alert: true },
} as const;

export type Measure = keyof typeof MEASURES;

/**
 * First day whose launch-based figures are flagged (AGENTS.md rule 3). The
 * owner chose Aug 11, 2026 on #5: the first `hidden` rows end that day.
 */
export const BALLISTIC_RESTRICTION_FROM = "2026-08-11";

/** The raion switch phased in during 2025 (data audit; the owner accepted this start on #8). */
export const ALERT_GRANULARITY_CHANGE_FROM = "2025-01-01";

/** The last month an area switched in was Nov 2025; from December none had oblast rows (data audit). */
export const ALERT_GRANULARITY_CHANGE_TO = "2025-11-30";

/** An inclusive range of ISO dates, YYYY-MM-DD. */
export interface Period {
  from: string;
  to: string;
}

export type ColumnSpec = {
  /** The property of each row that this column shows. */
  key: string;
  label: string;
  /** Shown when the value is null or undefined. Missing is never shown as zero. */
  missing?: string;
} & (
  | { type: "text" | "date" | "month" | "class" }
  | { type: "number"; measure: Measure; format?: (value: number) => string }
);

export interface FlagInput<Row> {
  columns: readonly ColumnSpec[];
  rows: readonly Row[];
  /** The dates the figures cover: one range for the chart, or one per row. */
  coverage: Period | ((row: Row) => Period);
}

function isIsoDate(value: string): boolean {
  // The round trip rejects dates such as 2026-02-30.
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().startsWith(value)
  );
}

function checkPeriod(period: Period): Period {
  // A malformed date would compare wrongly and drop a flag without any sign.
  if (!isIsoDate(period.from) || !isIsoDate(period.to) || period.from > period.to) {
    throw new Error(`Chart coverage must be an ordered pair of YYYY-MM-DD dates, got ${JSON.stringify(period)}`);
  }
  return period;
}

/** The whole of a "YYYY-MM" month. */
export function monthPeriod(month: string): Period {
  const [year, number] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year ?? NaN, number ?? NaN, 0)).getUTCDate();
  return checkPeriod({ from: `${month}-01`, to: `${month}-${lastDay}` });
}

/**
 * Catches a column that is named like a caveated figure but declared as
 * something else, which would silently drop its badge.
 */
function checkColumns(columns: readonly ColumnSpec[]): void {
  if (!columns.some((column) => column.type === "number")) {
    throw new Error("A chart needs at least one numeric column with a measure");
  }
  for (const column of columns) {
    if (column.type !== "number") continue;
    const measure = MEASURES[column.measure];
    if (!measure) throw new Error(`Column ${column.key}: unknown measure ${JSON.stringify(column.measure)}`);
    const name = `${column.key} ${column.label}`;
    if (/destroy|intercept|shot.?down/i.test(name) && !measure.ew) {
      throw new Error(`Column ${column.key} looks like an interception figure, but "${column.measure}" has no EW caveat`);
    }
    if (/launch/i.test(name) && !measure.launchBased) {
      throw new Error(`Column ${column.key} looks like a launch figure, but "${column.measure}" isn't launch-based`);
    }
  }
}

function rowFlag(row: object, id: FlagId): boolean {
  const value = (row as Record<string, unknown>)[id];
  if (value === undefined || value === false || value === 0) return false;
  if (value === true || value === 1) return true;
  // For example the string "false", which would otherwise read as set.
  throw new Error(`Row flag ${id} must be a boolean, 0 or 1, got ${JSON.stringify(value)}`);
}

/** The flags that apply to one row, whatever the chart's columns are. */
export function rowFlags(row: object): FlagId[] {
  return FLAG_IDS.filter((id) => rowFlag(row, id));
}

/** What a tab's data-notes strip lists: each flag any of its charts shows, once, in badge order. */
export function notesFlags(shown: Iterable<string>): FlagId[] {
  const found = new Set(shown);
  const unknown = [...found].filter((id) => !(FLAG_IDS as readonly string[]).includes(id));
  if (unknown.length) throw new Error(`Unknown data-quality flag: ${unknown.join(", ")}`);
  return FLAG_IDS.filter((id) => found.has(id));
}

/** Every badge the chart must show, in a fixed order. */
export function chartFlags<Row extends object>({ columns, rows, coverage }: FlagInput<Row>): FlagId[] {
  checkColumns(columns);
  const measures = columns.flatMap((column) => (column.type === "number" ? [MEASURES[column.measure]] : []));
  const periods = (typeof coverage === "function" ? rows.map(coverage) : [coverage]).map(checkPeriod);
  const reaches = (date: string) => periods.some((period) => period.to >= date);

  const flags = new Set<FlagId>(rows.flatMap(rowFlags));
  if (measures.some((m) => m.ew)) flags.add("destroyed_includes_ew");
  if (measures.some((m) => m.launchBased)) {
    if (reaches(BALLISTIC_RESTRICTION_FROM)) flags.add("ballistic_restricted");
    if (columns.some((column) => column.type === "class")) flags.add("classes_not_split");
  }
  if (measures.some((m) => m.alert)) {
    flags.add("alert_regions_excluded");
    if (reaches(ALERT_GRANULARITY_CHANGE_FROM)) flags.add("alert_granularity_change");
  }

  return FLAG_IDS.filter((id) => flags.has(id));
}
