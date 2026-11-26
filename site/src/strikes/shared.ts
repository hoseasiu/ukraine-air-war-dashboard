/** What the tab A charts have in common. */
import { formatMonth } from "../chart/chartFrame.ts";
import { formatDate, nightTable, weaponClasses } from "../data.ts";
import type { ClassId } from "../theme/classStyles.ts";
import { svgElement } from "../theme/marks.ts";
import "./strikes.css";

export const classLabels = Object.fromEntries(weaponClasses.map((c) => [c.id, c.label])) as Record<ClassId, string>;

export const count = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** A year's massive bar, in full. Rounding to one place would disagree with the data audit's figures. */
export const barValue = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

export function footnote(...paragraphs: string[]): HTMLElement {
  const note = create("div", "chart-footnote");
  for (const text of paragraphs) note.append(create("p", "", text));
  return note;
}

/** The source line under every strike chart, then any other notes. */
export function strikeFootnote(...notes: string[]): HTMLElement {
  return footnote(
    ...notes,
    "Strikes: national military reports in “Massive Missile Attacks on Ukraine” (Petro Ivaniuk, Kaggle, CC BY-NC-SA 4.0), " +
      `grouped into our weapon classes. Data from ${formatDate(nightTable.firstDay)} through ${formatDate(nightTable.lastDay)}.`,
  );
}

/** Plain-language definition (data audit). Show the year's bar wherever "massive" appears. */
export const MASSIVE_DEFINITION =
  "A massive night had more weapons launched than 95% of the attack nights in the same calendar year.";

/** Why figures for nights before the restriction can still carry its badge. */
export const RESTRICTED_BAR_NOTE =
  "A year’s bar uses all of that year’s nights. Where those include nights under the missile-reporting " +
  "restriction, figures that use the bar carry its note, even for earlier nights.";

/** Why there is nothing to draw: no months in range, no classes on, or neither has a report. */
export const NOTHING_SHOWN =
  "No chart: nothing is reported for the chosen months and weapon classes. Widen “Months shown” or turn on a class.";

export function svgText(
  x: number,
  y: number,
  text: string,
  attributes: Record<string, string | number> = {},
): SVGTextElement {
  const element = svgElement("text", { x, y, fill: "currentColor", ...attributes });
  element.textContent = text;
  return element;
}

/** The root of a hand-drawn or multi-panel chart, at the size chartFrame expects. */
export function chartSvg(width: number, height: number): SVGSVGElement {
  const svg = svgElement("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "strike-svg" });
  return svg;
}

/**
 * Which months get an axis label, and what it says, so labels don't collide:
 * every month over a short range, then quarters, then Januaries.
 */
export function monthAxisTicks(months: readonly string[], width: number) {
  const room = Math.max(1, Math.floor(width / 80));
  const every = [1, 3, 6, 12].find((step) => months.length / step <= room) ?? 12;
  const ticks = months.filter((month) => (Number(month.slice(5)) - 1) % every === 0);
  return {
    ticks: ticks.length ? ticks : [months[0]!],
    tickFormat: (month: string) => (every === 12 && ticks.length ? month.slice(0, 4) : formatMonth(month)),
  };
}
