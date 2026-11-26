/**
 * The national alert hours for each month the map's slider offers, drawn above
 * it so the slider shows where the high months are. Its colors and inset are in
 * alertMap.css.
 *
 * Its badges come from the map's frame (ChartSpec.alsoDraws). The same figures
 * are in the table under "Launches and alert hours by month", on the same tab.
 */
import { formatMonth } from "../chart/chartFrame.ts";
import { svgElement } from "../theme/marks.ts";
import type { NationalMonth } from "./alertData.ts";
import { sparklinePoints } from "./sparklineData.ts";

const hoursText = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function create(tag: "div" | "p" | "span", className: string, text = ""): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

/** `rows` need at least two months, each with a figure, in the slider's order. */
export function monthSparkline(rows: readonly NationalMonth[]): { element: HTMLElement; mark(index: number): void } {
  const { points, peak } = sparklinePoints(rows);

  const element = create("div", "month-sparkline");
  const caption = create(
    "p",
    "month-sparkline-caption",
    `Mean alert hours across areas, ${formatMonth(rows[0]!.month)} to ${formatMonth(rows.at(-1)!.month)}, from zero. ` +
      `Highest: ${formatMonth(peak.month)}, ${hoursText.format(peak.hours)} hours. ` +
      "Monthly figures are in the table of “Launches and alert hours by month” below.",
  );

  const plot = create("div", "month-sparkline-plot");
  // The same inset as the slider's thumb, so a month sits over its slider position.
  const track = create("div", "month-sparkline-track");
  // Stretched to the track's width; the stroke keeps its own thickness.
  const svg = svgElement("svg", {
    viewBox: "0 0 100 100",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    focusable: "false",
  });
  const line = points.map(({ x, y }) => `${x},${y}`).join(" ");
  svg.append(
    svgElement("polygon", { points: `0,100 ${line} 100,100`, class: "month-sparkline-area" }),
    svgElement("polyline", { points: line, class: "month-sparkline-line" }),
  );
  const rule = create("span", "month-sparkline-rule");
  const dot = create("span", "month-sparkline-dot");
  for (const marker of [rule, dot]) marker.setAttribute("aria-hidden", "true");
  track.append(svg, rule, dot);
  plot.append(track);
  element.append(caption, plot);

  return {
    element,
    mark(index) {
      const { x, y } = points[index]!;
      rule.style.left = dot.style.left = `${x}%`;
      dot.style.top = `${y}%`;
    },
  };
}
