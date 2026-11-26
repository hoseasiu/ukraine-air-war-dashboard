/**
 * Monthly launches beside monthly alert hours (plan §2 E3): the rows that chart
 * draws. The strike table's parser is in strikes/strikeData.ts.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { BALLISTIC_RESTRICTION_FROM, monthPeriod } from "../chart/flags.ts";
import { monthFromNumber, monthNumber } from "../filters/state.ts";
import { sumKnown, type MonthRow, type MonthTable } from "../strikes/strikeData.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";
import { nationalMonth, type AlertTable } from "./alertData.ts";

export interface AlertLaunchRow {
  month: string;
  /** Known launches in the chosen classes. null when there's no known count, never 0 for unknown. */
  launched: number | null;
  /** What the launch figure does and doesn't cover this month. */
  launch_note: string;
  /** Mean over the areas in alert totals. null outside the alert table's months. */
  hours: number | null;
  ballistic_restricted: boolean;
  classes_not_split: boolean;
  alert_end_assumed: boolean;
  alert_regions_excluded: boolean;
  alert_granularity_change: boolean;
}

/** "Sept 28" */
function dayText(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(isoDate));
}

function launchNote(strikes: MonthTable, month: string, found: readonly MonthRow[], chosen: number): string {
  if (month < strikes.firstDay.slice(0, 7)) return "Before the strike data begins";
  const { from, to } = monthPeriod(month);
  const notes: string[] = [];
  if (strikes.firstDay > from) notes.push(`Reports from ${dayText(strikes.firstDay)} only`);
  if (strikes.lastDay < to) notes.push(`Reports through ${dayText(strikes.lastDay)} only`);
  const unknown = found.reduce((sum, row) => sum + row.n_unknown_launched, 0);
  if (!chosen) notes.push("No weapon classes chosen");
  else if (!found.length) notes.push("No report for the chosen classes");
  else if (unknown) notes.push(`${unknown} report${unknown === 1 ? "" : "s"} without a launch count`);
  return notes.join("; ") || "Whole month";
}

/**
 * One row per month in the range that either source covers. Either figure can
 * be missing: strike data starts later than alert data and runs past it.
 */
export function alertLaunchRows(
  alerts: AlertTable,
  strikes: MonthTable,
  filters: { from: string; to: string; classes: readonly ClassId[] },
): AlertLaunchRow[] {
  const firstStrike = strikes.firstDay.slice(0, 7);
  const lastStrike = strikes.lastDay.slice(0, 7);
  const firstAlert = alerts.months[0]!;
  const lastAlert = alerts.months.at(-1)!;
  const earliest = firstAlert < firstStrike ? firstAlert : firstStrike;
  const latest = lastAlert > lastStrike ? lastAlert : lastStrike;
  const from = filters.from > earliest ? filters.from : earliest;
  const to = filters.to < latest ? filters.to : latest;
  const everyClass = CLASS_IDS.every((id) => filters.classes.includes(id));

  const rows: AlertLaunchRow[] = [];
  for (let number = monthNumber(from); number <= monthNumber(to); number++) {
    const month = monthFromNumber(number);
    const found = strikes.rows.filter((row) => row.month === month && filters.classes.includes(row.class));
    const national = nationalMonth(alerts, month);
    rows.push({
      month,
      launched: sumKnown(found.map((row) => row.launched)),
      launch_note: launchNote(strikes, month, found, filters.classes.length),
      hours: national.hours,
      // By date as well as by row, so a month with no matching row is still marked.
      ballistic_restricted:
        found.some((row) => row.ballistic_restricted) || monthPeriod(month).to >= BALLISTIC_RESTRICTION_FROM,
      // A total over only some classes leaves out their share of jointly reported counts.
      classes_not_split: !everyClass && filters.classes.length > 0,
      alert_end_assumed: national.alert_end_assumed,
      alert_regions_excluded: national.alert_regions_excluded,
      alert_granularity_change: national.alert_granularity_change,
    });
  }
  return rows;
}
