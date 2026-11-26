/**
 * Numbered event markers on a chart with a band of months, and their key. The
 * markers only place events in time (AGENTS.md rule 6).
 */
import type { Plot } from "@observablehq/plot";
import { formatDate } from "../data.ts";
import { withTerms } from "../glossary/popover.ts";
import { create, svgText } from "../strikes/shared.ts";
import { svgElement } from "../theme/marks.ts";
import type { Marker } from "./markerLayout.ts";
import "./annotations.css";

/** Height of one row of markers. */
export const MARKER_ROW = 22;
const RADIUS = 10;
/** Room above the markers for the y-axis title. */
const AXIS_TITLE = 20;

/** Draws into the top margin that the chart left for the markers. */
export function drawMarkers(plot: (SVGSVGElement | HTMLElement) & Plot, markers: readonly Marker[]): void {
  if (!markers.length) return;
  const x = plot.scale("x")!;
  const baseline = Math.max(...(plot.scale("y")!.range as number[]));
  for (const marker of markers) {
    const at = Number(x.apply(marker.month)) + x.bandwidth! / 2;
    const y = AXIS_TITLE + RADIUS + 2 + marker.row * MARKER_ROW;
    plot.append(
      // Dashed and thin, so it reads as a pointer and not as data.
      svgElement("line", { x1: at, x2: at, y1: y + RADIUS, y2: baseline, class: "event-rule" }),
      svgElement("circle", { cx: at, cy: y, r: RADIUS, class: "event-dot" }),
      svgText(at, y + 4.5, String(marker.number), { "text-anchor": "middle", "font-size": 13, "font-weight": 700 }),
    );
  }
}

/** Each marker's date, label and citations. This is the markers' text alternative. */
export function eventKey(markers: readonly Marker[], firstDataDay: string): HTMLElement {
  const section = create("section", "event-key");
  section.setAttribute("aria-label", "Events marked on the chart");
  const list = create("ol");
  for (const { event } of markers) {
    const item = create("li");
    const label = create("span");
    label.append(...withTerms(event.label));
    item.append(create("strong", "", formatDate(event.date)), " ", label);
    if (event.date < firstDataDay) item.append(" (before the strike data starts)");
    const sources = create("span", "event-sources");
    event.sources.forEach((url, index) => {
      const link = create("a", "", new URL(url).hostname.replace(/^www\./, ""));
      link.href = url;
      sources.append(index ? ", " : " Source: ", link);
    });
    item.append(sources);
    list.append(item);
  }
  section.append(list);
  return section;
}
