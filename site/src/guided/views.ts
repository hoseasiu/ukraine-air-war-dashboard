import { nightTable } from "../data.ts";
import { monthlyLaunchChart } from "../strikes/monthlyCharts.ts";
import { nightBreakdown } from "../strikes/nightBreakdown.ts";
import { nightCalendar, weekdayChart } from "../strikes/rhythm.ts";
import { salvoHistogram } from "../strikes/salvoHistogram.ts";
import { allNights, largestNight, type Selection } from "../strikes/strikeData.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";
import { headlineView } from "./headlines.ts";
import type { StopView } from "./stops.ts";

/** Every month of the strike data, for the classes given. */
const allMonths = (classes: readonly ClassId[] = CLASS_IDS): Selection => ({
  from: nightTable.firstDay.slice(0, 7),
  to: nightTable.lastDay.slice(0, 7),
  classes,
});

/**
 * How tall a chart can be and still share the screen with the caption and
 * badges: what's left of the window, within limits.
 */
const chartHeight = () => Math.min(560, Math.max(260, window.innerHeight - 580));

/**
 * Moves each "How to read this" note below its chart. The caption makes the
 * stop's point, and the chart has to be on screen with it. The badges stay above.
 * One night's launch areas are part of its view, so its notes go below them too.
 */
function chartsFirst(container: HTMLElement): void {
  for (const figure of container.querySelectorAll(".chart-frame")) {
    const note = figure.querySelector(".chart-how-to-read");
    const table = figure.querySelector(".chart-table");
    if (note && table) table.after(note);
  }
  const night = container.querySelector(".night-breakdown");
  if (night) night.append(...night.querySelectorAll(".chart-how-to-read, .chart-footnote"));
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
    default:
      // Fails the type check if a kind of view has no case above.
      view satisfies never;
  }
}
