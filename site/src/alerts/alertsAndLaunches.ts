/**
 * Monthly launches above monthly alert hours (plan §2 E3): two panels that
 * share the months, each with its own scale, rather than one chart with two
 * y-axes. It takes its settings as arguments and reads no filters.
 *
 * Nothing here relates the two series, so the wording mustn't either.
 */
import * as Plot from "@observablehq/plot";
import { chartFrame, formatMonth, type Drawing, type Target } from "../chart/chartFrame.ts";
import { BALLISTIC_RESTRICTION_FROM, monthPeriod } from "../chart/flags.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { alertMonthly, formatDate, monthlyTable, weaponClasses } from "../data.ts";
import { COMBINED_LAUNCH_FILL } from "../theme/areaStyles.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";
import { classFill } from "../theme/marks.ts";
import { plotDefaults } from "../theme/plot.ts";
import { alertLaunchRows, type AlertLaunchRow } from "./alertLaunchData.ts";
import { monthAxisTicks, strikeFootnote } from "../strikes/shared.ts";
import { alertCredit, alertRangeNote } from "./notes.ts";
import "./alertsAndLaunches.css";

export interface AlertLaunchSettings {
  /** First and last month shown, as YYYY-MM. */
  from: string;
  to: string;
  /** Which weapon classes the launch panel adds up. Alert hours don't depend on them. */
  classes: readonly ClassId[];
}

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function classNames(classes: readonly ClassId[]): string {
  return weaponClasses
    .filter((weaponClass) => classes.includes(weaponClass.id))
    .map((weaponClass) => weaponClass.label)
    .join("; ");
}

/** A short name for the chosen classes, for headings. */
function chosenText(classes: readonly ClassId[]): string {
  if (classes.length === CLASS_IDS.length) return "all counted weapon classes";
  if (classes.length === 1) return classNames(classes);
  if (!classes.length) return "no weapon classes chosen";
  return `${classes.length} of ${CLASS_IDS.length} weapon classes`;
}

/** A dashed line before a month, labeled to its left, where the room usually is. */
function marker(months: readonly string[], month: string, text: string, plotWidth: number): Plot.Markish[] {
  const index = months.indexOf(month);
  if (index < 0) return [];
  // Near the left edge there's no room on that side.
  const labelRight = (index / months.length) * plotWidth < text.length * 8;
  const step = plotWidth / months.length;
  // The line sits on the month's left edge, not through its bar.
  const dx = -step / 2;
  return [
    Plot.ruleX([month], { dx, stroke: "var(--ink)", strokeWidth: 1.5, strokeDasharray: "5 4" }),
    Plot.text([month], {
      x: (d: string) => d,
      text: () => text,
      frameAnchor: "top",
      textAnchor: labelRight ? "start" : "end",
      dx: dx + (labelRight ? 6 : -6),
      dy: -18,
      fontSize: 14,
    }),
  ];
}

/** A panel with nothing to draw says so, rather than showing a scale with no figures on it. */
function emptyPanel(values: (number | null)[], text: string): { ticks?: []; marks: Plot.Markish[] } {
  if (values.some((value) => value !== null)) return { marks: [] };
  return { ticks: [], marks: [Plot.text([text], { frameAnchor: "middle" })] };
}

function draw(rows: readonly AlertLaunchRow[], width: number, classes: readonly ClassId[]): Drawing<AlertLaunchRow> {
  const months = rows.map((row) => row.month);
  const marginLeft = plotDefaults.marginLeft;
  const marginRight = 36;
  const plotWidth = width - marginLeft - marginRight;
  // Both panels take the same x settings and margins, so a month lines up between them.
  const shared = { ...plotDefaults, width, marginRight, marginTop: 40, height: 250 };
  const x = {
    type: "band" as const,
    domain: months,
    label: null,
    padding: 0.2,
    ...monthAxisTicks(months, plotWidth),
  };
  const top = (values: (number | null)[]) => [0, Math.max(1, ...values.filter((value) => value !== null))];
  const restricted = months.find((month) => monthPeriod(month).to >= BALLISTIC_RESTRICTION_FROM);
  const lastAlert = alertMonthly.months.at(-1)!;
  const afterAlerts = months.find((month) => month > lastAlert);
  // One class keeps its own fill; a sum of several takes a color that belongs to none.
  const fill = classes.length === 1 ? classFill(classes[0]!) : COMBINED_LAUNCH_FILL;

  const noLaunches = emptyPanel(rows.map((row) => row.launched), "No published launch counts for this selection");
  const noHours = emptyPanel(rows.map((row) => row.hours), `No alert figures after ${formatMonth(lastAlert)}`);

  const launches = Plot.plot({
    ...shared,
    x: { ...x, axis: "top", tickFormat: () => "", tickSize: 0 },
    y: { label: "Reported launches", domain: top(rows.map((row) => row.launched)), nice: true, grid: true, ticks: noLaunches.ticks },
    marks: [
      Plot.barY(rows, { x: "month", y: "launched", fill }),
      Plot.ruleY([0]),
      ...noLaunches.marks,
      ...(restricted
        ? marker(months, restricted, `Missile reporting restricted from ${formatDate(BALLISTIC_RESTRICTION_FROM)}`, plotWidth)
        : []),
    ],
  });

  const hours = Plot.plot({
    ...shared,
    marginTop: 40,
    x,
    y: { label: "Alert hours, mean across areas", domain: top(rows.map((row) => row.hours)), nice: true, grid: true, ticks: noHours.ticks },
    marks: [
      Plot.ruleY([0]),
      Plot.lineY(rows, { x: "month", y: "hours", stroke: "var(--ink)", strokeWidth: 2 }),
      Plot.dot(rows, { x: "month", y: "hours", fill: "var(--ink)", r: months.length > 30 ? 3 : 4.5 }),
      ...noHours.marks,
      // The message in an empty panel already says it.
      ...(afterAlerts && !noHours.marks.length
        ? marker(months, afterAlerts, `No alert figures after ${formatMonth(lastAlert)}`, plotWidth)
        : []),
    ],
  });

  const element = document.createElement("div");
  element.className = "alert-launch-panels";
  element.style.width = `${width}px`;
  element.append(launches, hours);

  // One target per month, listing both figures, at the top of its bar. A month
  // without a bar still gets one, so its missing figure can be read.
  const targets = plotTargets(launches, rows, { x: (r) => r.month, y: (r) => r.launched ?? 0 });
  // One line down both panels marks the month in use, with a ring on its alert hours.
  // The panels are stacked blocks, so the second starts where the first ends.
  const crosshair = document.createElement("div");
  crosshair.className = "alert-launch-crosshair";
  crosshair.style.top = `${shared.marginTop}px`;
  crosshair.style.height = `${shared.height * 2 - shared.marginTop - plotDefaults.marginBottom}px`;
  crosshair.hidden = true;
  const ring = document.createElement("div");
  ring.className = "alert-launch-ring";
  ring.hidden = true;
  element.append(crosshair, ring);

  const mark = (target: Target<AlertLaunchRow> | null) => {
    const value = target?.rows[0]?.hours ?? null;
    crosshair.hidden = !target;
    // No ring without a figure: a missing month isn't zero.
    ring.hidden = value === null;
    if (!target) return;
    crosshair.style.left = `${target.x}px`;
    if (value === null) return;
    ring.style.left = `${target.x}px`;
    ring.style.top = `${shared.height + Number(hours.scale("y")!.apply(value))}px`;
  };

  return { element, targets, mark };
}

function footnote(settings: AlertLaunchSettings, hasHours: boolean): HTMLElement {
  const note = strikeFootnote(
    ...(hasHours ? [] : [alertRangeNote()]),
    `Weapon classes in the launch panel: ${classNames(settings.classes) || "none (choose one in the filters)"}. ` +
      "Daytime reports are included. Reconnaissance, tactical and unidentified UAVs and bombs are left out. " +
      "A month with no published count has no bar, which doesn’t mean zero.",
    "Alert hours are the mean of the oblasts and Kyiv city in alert totals, each counted once. The oblast " +
      "filter doesn’t change them, because the launch figures aren’t broken down by oblast.",
  );
  note.append(alertCredit());
  return note;
}

export function alertsAndLaunches(settings: AlertLaunchSettings): HTMLElement {
  const rows = alertLaunchRows(alertMonthly, monthlyTable, settings);
  const chosen = chosenText(settings.classes);
  const hasHours = rows.some((row) => row.hours !== null);

  return chartFrame<AlertLaunchRow>({
    title: `Launches and alert hours by month (launches: ${chosen})`,
    howToRead:
      "The top panel shows launches reported across the country, and the bottom panel the hours under air-raid " +
      "alert in the same month for the average area. The panels have separate scales, so compare when each " +
      "rises and falls, not their heights. Seeing the two side by side doesn’t show that one caused the other, " +
      "or how much of the alert time any launch accounts for.",
    description: rows.length
      ? `Two aligned panels by month, ${formatMonth(rows[0]!.month)} to ${formatMonth(rows.at(-1)!.month)}: a bar ` +
        `chart of reported launches (${chosen}) above a line chart of mean air-raid alert hours per area. ` +
        "The table gives each month’s figures."
      : "No chart: the chosen months have no strike or alert figures.",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "launch_note", label: "Launch data covers", type: "text" },
      {
        key: "launched",
        label: "Reported launches",
        type: "number",
        measure: "launched",
        missing: "No published count",
        format: (value) => integer.format(value),
      },
      {
        key: "hours",
        label: "Alert hours (mean across areas)",
        type: "number",
        measure: "alert_hours",
        missing: "No figures",
      },
    ],
    rows,
    coverage: (row) => monthPeriod(row.month),
    footnote: footnote(settings, hasHours || !rows.length),
    pointer: "x",
    draw: (data, width) => draw(data, width, settings.classes),
  });
}
