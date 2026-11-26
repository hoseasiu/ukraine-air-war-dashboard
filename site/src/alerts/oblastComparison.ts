/**
 * Monthly alert hours for up to three oblasts, as lines on one scale (plan §2 E2).
 *
 * Like the map, it takes its months and oblasts as settings and reads no
 * filters, so a fixed view can use it too.
 */
import * as Plot from "@observablehq/plot";
import { chartFrame, formatMonth, type Drawing } from "../chart/chartFrame.ts";
import { monthPeriod } from "../chart/flags.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { alertAreas, alertMonthly, excludedAlertAreas } from "../data.ts";
import { AREA_STYLES } from "../theme/areaStyles.ts";
import { areaSymbolPath, svgElement } from "../theme/marks.ts";
import { plotDefaults } from "../theme/plot.ts";
import { assignStyles, comparisonRows, raionSwitchMonths, type ComparisonRow } from "./comparisonData.ts";
import { endLabelRoom, endLabels, focusControl, switchBand, type FocusControl } from "./comparisonMarks.ts";
import { monthAxisTicks, type FixedView } from "../strikes/shared.ts";
import { alertCredit, alertRangeNote, paragraph } from "./notes.ts";
import "./oblastComparison.css";

export interface ComparisonSettings {
  /** First and last month shown, as YYYY-MM. */
  from: string;
  to: string;
  /** One to three ISO 3166-2 codes of areas in alert totals, in legend order. */
  oblasts: readonly string[];
  /** Each oblast's line style, from assignStyles(). Without it, they follow the order given. */
  styles?: ReadonlyMap<string, number>;
  /** A guided stop's view: a height that fits the screen. */
  fixed?: FixedView;
}

/** Room above the plot for the y-axis title and, under it, the shaded band's name. */
const MARGIN_TOP = 58;

function areaName(id: string): string {
  const area = alertAreas.find((candidate) => candidate.id === id);
  if (!area) throw new Error(`Unknown oblast: ${id}`);
  return area.name;
}

function styleOf(styles: ReadonlyMap<string, number>, id: string) {
  const style = AREA_STYLES[styles.get(id) ?? -1];
  if (!style) throw new Error(`No line style for ${id}`);
  return style;
}

function key(oblasts: readonly string[], styles: ReadonlyMap<string, number>, focus?: FocusControl): HTMLElement {
  const list = document.createElement("ul");
  list.className = "chart-legend";
  list.setAttribute("aria-label", focus ? "Legend. Press an oblast to draw the other lines lighter." : "Legend");
  for (const id of oblasts) {
    const style = styleOf(styles, id);
    const svg = svgElement("svg", { width: 40, height: 18, "aria-hidden": "true", focusable: "false" });
    svg.append(
      svgElement("line", { x1: 0, x2: 40, y1: 9, y2: 9, stroke: style.color, "stroke-width": 2.5, "stroke-dasharray": style.dash }),
      svgElement("path", { d: areaSymbolPath(style, 80), transform: "translate(20,9)", fill: style.color }),
    );
    const item = document.createElement("li");
    // With a choice to make, the key's contents sit in the oblast's button.
    const holder = focus ? item.appendChild(focus.button(id)) : item;
    holder.append(svg, areaName(id));
    list.append(item);
  }
  return list;
}

function draw(
  rows: readonly ComparisonRow[],
  width: number,
  oblasts: readonly string[],
  styles: ReadonlyMap<string, number>,
  height: number,
): Drawing<ComparisonRow> {
  const months = [...new Set(rows.map((row) => row.month))];
  const marginLeft = plotDefaults.marginLeft;
  const marginRight = endLabelRoom(rows.map((row) => row.name));
  const plot = Plot.plot({
    ...plotDefaults,
    width,
    height,
    marginRight,
    marginTop: MARGIN_TOP,
    x: {
      type: "band",
      domain: months,
      label: null,
      ...monthAxisTicks(months, width - marginLeft - marginRight),
    },
    // Starts at zero, so the lines' heights compare fairly.
    y: { label: "Alert hours in the month, average per raion", domain: [0, Math.max(1, ...rows.map((row) => row.hours))], nice: true, grid: true },
    symbol: { type: "identity" },
    marks: [
      Plot.ruleY([0]),
      // Dashes aren't a Plot scale, so there is one line mark per oblast.
      ...oblasts.map((id) => {
        const style = styleOf(styles, id);
        return Plot.lineY(
          rows.filter((row) => row.oblast === id),
          { x: "month", y: "hours", stroke: style.color, strokeWidth: 2, strokeDasharray: style.dash },
        );
      }),
      ...oblasts.map((id) => {
        const style = styleOf(styles, id);
        return Plot.dot(
          rows.filter((row) => row.oblast === id),
          // A long range puts months close together, so the points shrink to leave the lines visible.
          { x: "month", y: "hours", fill: style.color, symbol: () => style.symbol, r: months.length > 30 ? 3 : 4.5 },
        );
      }),
    ],
  });

  // Plot draws one group for each line mark and each dot mark, in the oblasts' order.
  for (const kind of ["line", "dot"]) {
    plot.querySelectorAll<SVGElement>(`g[aria-label="${kind}"]`).forEach((group, index) => {
      group.dataset.oblast = oblasts[index]!;
    });
  }
  if (rows.length) {
    const frame = { top: MARGIN_TOP, bottom: height - plotDefaults.marginBottom };
    const drawn = plot as SVGSVGElement & Plot.Plot;
    switchBand(drawn, months, width, frame);
    endLabels(drawn, rows, oblasts, (id) => styleOf(styles, id), frame);
  }

  // One target per month, at its highest line, listing every oblast.
  const highest = new Map<string, number>();
  for (const row of rows) highest.set(row.month, Math.max(highest.get(row.month) ?? 0, row.hours));
  return { element: plot, targets: plotTargets(plot, rows, { x: (r) => r.month, y: (r) => highest.get(r.month) }) };
}

export function oblastComparison(settings: ComparisonSettings): HTMLElement {
  const { oblasts } = settings;
  const styles = settings.styles ?? assignStyles(oblasts);
  const rows = comparisonRows(alertMonthly, alertAreas, oblasts, settings.from, settings.to);
  const list = new Intl.ListFormat("en-US");
  const names = list.format(oblasts.map(areaName));

  const footnote = document.createElement("div");
  footnote.className = "chart-footnote";
  if (!rows.length) footnote.append(paragraph(alertRangeNote()));
  footnote.append(
    paragraph(
      `A 0 means the file lists no alert counted for that month. ${list.format(excludedAlertAreas())} are excluded ` +
        "and can’t be compared, which doesn’t mean they had no alerts.",
    ),
    alertCredit(),
  );

  // A guided stop draws its lines alike and has no controls of its own. One line needs none.
  const focus = !settings.fixed && oblasts.length > 1 ? focusControl() : undefined;

  return chartFrame<ComparisonRow>({
    title: `Alert hours by month: ${names}`,
    howToRead:
      "Each line is one oblast’s hours under air-raid alert in each month, on a shared scale. For an oblast, " +
      "the figure is the average over its raions, so it isn’t the time that any part of it was under alert. " +
      "Kyiv city is a single unit." +
      (raionSwitchMonths(rows.map((row) => row.month))
        ? " The shaded band is 2025, when alerting moved from whole oblasts to raions; months after the switch " +
          "are only partly comparable with earlier ones."
        : "") +
      (focus ? " To pick out one line, point at or press its name in the legend." : ""),
    description: rows.length
      ? `Line chart of monthly air-raid alert hours for ${names}, ${formatMonth(rows[0]!.month)} to ` +
        `${formatMonth(rows.at(-1)!.month)}. The table gives each month’s figures.`
      : "No chart: the chosen months have no alert figures.",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "name", label: "Oblast", type: "text" },
      { key: "hours", label: "Alert hours (average per raion)", type: "number", measure: "alert_hours" },
      { key: "n_alerts", label: "Alerts started (average per raion)", type: "number", measure: "alert_count" },
    ],
    rows,
    coverage: (row) => monthPeriod(row.month),
    scaleKey: key(oblasts, styles, focus),
    footnote,
    pointer: "x",
    draw: (data, width) => {
      const drawing = draw(data, width, oblasts, styles, settings.fixed?.height ?? 400);
      focus?.show(drawing.element);
      return drawing;
    },
  });
}
