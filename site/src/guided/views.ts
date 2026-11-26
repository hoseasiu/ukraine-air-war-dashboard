import { alertMap } from "../alerts/alertMap.ts";
import { assignStyles } from "../alerts/comparisonData.ts";
import { oblastComparison } from "../alerts/oblastComparison.ts";
import { alertMonthly, nightTable } from "../data.ts";
import { interceptRateChart } from "../defense/interceptChart.ts";
import { saturationChart } from "../defense/saturationChart.ts";
import { withTerms } from "../glossary/popover.ts";
import type { TermId } from "../glossary/terms.ts";
import { monthlyLaunchChart } from "../strikes/monthlyCharts.ts";
import { nightBreakdown } from "../strikes/nightBreakdown.ts";
import { nightCalendar, weekdayChart } from "../strikes/rhythm.ts";
import { salvoHistogram } from "../strikes/salvoHistogram.ts";
import { create } from "../strikes/shared.ts";
import { allNights, largestNight, type Selection } from "../strikes/strikeData.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";
import { headlineView } from "./headlines.ts";
import type { Point, StopView } from "./stops.ts";

/** Every month of the strike data, for the classes given. */
const allMonths = (classes: readonly ClassId[] = CLASS_IDS): Selection => ({
  from: nightTable.firstDay.slice(0, 7),
  to: nightTable.lastDay.slice(0, 7),
  classes,
});

/**
 * How tall a chart can be and still share the screen with the caption and
 * badges: what's left of the window, within limits. `reserved` is for whatever
 * else a stop puts above its drawing, such as a definition or a key.
 */
const chartHeight = (reserved = 0) => Math.min(560, Math.max(260, window.innerHeight - 580 - reserved));

/** Every month of the alert data. */
const allAlertMonths = () => ({ from: alertMonthly.months[0]!, to: alertMonthly.months.at(-1)! });

function pointList(points: readonly Point[]): HTMLElement {
  const list = create("ul", "stop-points");
  // Shared, so a term repeated across points is marked once.
  const seen = new Set<TermId>();
  for (const point of points) {
    const item = create("li");
    const text = create("p");
    text.append(...withTerms(point.text, seen));
    item.append(create("h3", "", point.heading), text);
    list.append(item);
  }
  return list;
}

/**
 * Moves each "How to read this" note below its chart. The caption makes the
 * stop's point, and the chart has to be on screen with it. The badges stay above.
 * One night's launch areas are part of its view, so the breakdown's notes go below them too.
 */
function chartsFirst(container: HTMLElement): void {
  for (const figure of container.querySelectorAll(".chart-frame")) {
    const note = figure.querySelector(".chart-how-to-read");
    const table = figure.querySelector(".chart-table");
    if (note && table) table.after(note);
  }
  const breakdown = container.querySelector(".night-breakdown .chart-frame");
  if (breakdown) {
    const notes = breakdown.querySelectorAll(".chart-how-to-read, .chart-footnote");
    container.querySelector(".night-places-block")?.after(...notes);
  }
}

/** Draws a stop's view into an empty container. */
export function renderView(container: HTMLElement, view: StopView): void {
  drawView(container, view);
  chartsFirst(container);
}

function drawView(container: HTMLElement, view: StopView): void {
  switch (view.kind) {
    case "none":
      return;
    case "headlines":
      container.append(headlineView());
      return;
    case "monthly-launches":
      container.append(monthlyLaunchChart(allMonths(view.classes), { fixed: { height: chartHeight() }, events: view.events }));
      return;
    case "night-sizes":
      container.append(salvoHistogram(allMonths(), { fixed: { height: chartHeight() } }));
      return;
    case "one-night": {
      const dates = allNights(nightTable, CLASS_IDS).map((night) => night.date);
      const date = largestNight(nightTable, dates)!;
      container.append(nightBreakdown({ date, classes: CLASS_IDS, compact: true }));
      return;
    }
    case "night-calendar":
      container.append(nightCalendar(allMonths(), { fixed: true }));
      return;
    case "weekdays":
      container.append(weekdayChart(allMonths(), { fixed: { height: chartHeight() } }));
      return;
    case "intercept-rates":
      container.append(interceptRateChart(allMonths(view.classes), { height: chartHeight(140) }));
      return;
    case "saturation":
      container.append(saturationChart(allMonths(view.classes), { height: chartHeight(180) }));
      return;
    case "alert-map": {
      const months = allAlertMonths();
      container.append(alertMap({ ...months, highlight: [], month: months.from, fixed: { height: chartHeight(100) } }));
      return;
    }
    case "oblast-comparison":
      container.append(
        oblastComparison({
          ...allAlertMonths(),
          oblasts: view.oblasts,
          styles: assignStyles(view.oblasts),
          fixed: { height: chartHeight() },
        }),
      );
      return;
    case "points":
      container.append(pointList(view.points));
      return;
    default:
      // Fails the type check if a kind of view has no case above.
      view satisfies never;
  }
}
