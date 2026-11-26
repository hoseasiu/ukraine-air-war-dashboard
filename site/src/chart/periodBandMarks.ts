/** Draws a period's band behind a chart's marks, with its label. */
import type { Plot } from "@observablehq/plot";
import { svgElement } from "../theme/marks.ts";
import { bandMonths, type BandPeriod } from "./periodBands.ts";

/** About how wide a character of the 13px label is, to keep the label on the chart. */
const CHARACTER = 7;

export interface BandBox {
  /** Pixels across. */
  x0: number;
  x1: number;
  /** The top and bottom of the shading. */
  top: number;
  bottom: number;
  /** The label's baseline, in room the chart leaves above its marks. */
  labelY: number;
}

export function drawBand(svg: Element, label: string, { x0, x1, top, bottom, labelY }: BandBox): void {
  // The label ends at the band's right edge, unless that would run it off the left of the chart.
  const fitsLeft = x1 - label.length * CHARACTER >= 0;
  const text = svgElement("text", {
    x: fitsLeft ? x1 : x0,
    y: labelY,
    "text-anchor": fitsLeft ? "end" : "start",
    class: "period-band-label",
  });
  text.textContent = label;
  // First, so gridlines and data are drawn over the shading.
  svg.prepend(
    svgElement("rect", { x: x0, y: top, width: Math.max(1, x1 - x0), height: bottom - top, class: "period-band" }),
    // A dashed edge marks where it starts, so it doesn't depend on the shade.
    svgElement("line", { x1: x0, x2: x0, y1: top, y2: bottom, class: "period-band-edge" }),
  );
  svg.append(text);
}

type DrawnPlot = (SVGSVGElement | HTMLElement) & Plot;

/** The top and bottom of a plot's data area. */
function plotArea(plot: DrawnPlot): { top: number; bottom: number } {
  const range = plot.scale("y")!.range as number[];
  return { top: Math.min(...range), bottom: Math.max(...range) };
}

/** On a plot whose x axis is a band or point scale of months. Draws nothing if the period is off the axis. */
export function monthBand(plot: DrawnPlot, months: readonly string[], period: BandPeriod, labelY?: number): void {
  const reached = bandMonths(months, period);
  if (!reached) return;
  const x = plot.scale("x")!;
  const width = x.bandwidth ?? 0;
  // Half the space between neighbors, so the band runs from one month's edge to another's.
  const half = ((x.step ?? width) - width) / 2;
  const { top, bottom } = plotArea(plot);
  drawBand(plot, period.label, {
    x0: Number(x.apply(reached.first)) - half,
    x1: Number(x.apply(reached.last)) + width + half,
    top,
    bottom,
    labelY: labelY ?? top - 5,
  });
}

/** On a plot whose x axis is dates. It starts on the period's first day. */
export function dateBand(plot: DrawnPlot, period: BandPeriod, labelY?: number): void {
  const x = plot.scale("x")!;
  const [left, right] = x.range as [number, number];
  const at = (day: string) => Math.min(right, Math.max(left, Number(x.apply(new Date(`${day}T00:00:00Z`)))));
  const x0 = at(period.from);
  const x1 = period.to === null ? right : at(period.to);
  if (x1 <= x0) return;
  const { top, bottom } = plotArea(plot);
  drawBand(plot, period.label, { x0, x1, top, bottom, labelY: labelY ?? top - 5 });
}
