/**
 * Salvo size against the number not reported destroyed, one point per night
 * (plan §2 B2). Panels separate nights by how many classes were reported, and
 * each point takes the color and symbol of the class with the most launches.
 */
import * as Plot from "@observablehq/plot";
import { chartFrame, type Target } from "../chart/chartFrame.ts";
import { BALLISTIC_RESTRICTION_FROM } from "../chart/flags.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { formatDate, outcomeTable } from "../data.ts";
import {
  chartSvg,
  classLabels,
  count,
  create,
  NOTHING_SHOWN,
  strikeFootnote,
  svgText,
  type FixedView,
} from "../strikes/shared.ts";
import type { Selection } from "../strikes/strikeData.ts";
import { CLASS_IDS } from "../theme/classStyles.ts";
import { svgElement } from "../theme/marks.ts";
import { classColorScale, classSymbolScale, plotDefaults } from "../theme/plot.ts";
import { MIX_GROUPS, saturationRows, type SaturationRow } from "./defenseData.ts";

const PANEL_HEIGHT = 320;
const PANEL_TITLE = 44;
const AXIS_TITLE = 24;

const from = formatDate(BALLISTIC_RESTRICTION_FROM);

/** Why later nights are marked apart. The owner kept them in the chart on #16. */
const AFTER_NOTE =
  `Nights from ${from} are drawn hollow. Missile counts may be missing from their size, mix and destroyed counts. ` +
  "The dataset page also says that where only a destroyed count is published, it is copied into launched. That would " +
  "make the number not reported destroyed too low, and we can’t tell which counts are copies.";

function hollowKey(): HTMLElement {
  const key = create("p", "strike-key");
  const mark = svgElement("svg", { width: 40, height: 18, "aria-hidden": "true", focusable: "false" });
  mark.append(
    svgElement("circle", { cx: 10, cy: 9, r: 5, fill: "currentColor" }),
    svgElement("circle", { cx: 30, cy: 9, r: 5, fill: "none", stroke: "currentColor", "stroke-width": 1.5 }),
  );
  key.append(mark, `Filled: night before ${from}. Hollow: from ${from}, under restricted missile reporting.`);
  return key;
}

/** `fixed` is a guided stop's view: no wording about filters, and a height that fits the screen. */
export function saturationChart(selection: Selection, fixed?: FixedView): HTMLElement {
  const rows = saturationRows(outcomeTable, selection, classLabels);
  const drawable = rows.filter((row) => row.not_intercepted !== null);
  const groups = MIX_GROUPS.filter((group) => drawable.some((row) => row.mix === group));
  const restricted = drawable.some((row) => row.ballistic_restricted);

  return chartFrame<SaturationRow>({
    title: "Salvo size and weapons not reported destroyed, night by night",
    howToRead:
      "Each point is one attack night: weapons launched across, and the number not reported destroyed up. That " +
      "number isn’t a count of hits. It tends to be higher on larger nights even if the share reported destroyed " +
      "stays the same, so compare it with the size. Panels split nights by how many classes were reported, and a " +
      "point’s color and symbol show the class with the most launches. The pattern doesn’t show that size or mix " +
      "caused anything: both changed over the years, along with much else.",
    description: drawable.length
      ? "Scatter plots of weapons launched per night against the number not reported destroyed. " +
        groups
          .map((group) => {
            const own = drawable.filter((row) => row.mix === group);
            return (
              `${group}: ${own.length} nights, sizes up to ${count.format(Math.max(...own.map((r) => r.size)))}, ` +
              `up to ${count.format(Math.max(...own.map((r) => r.not_intercepted!)))} not reported destroyed.`
            );
          })
          .join(" ")
      : rows.length
        ? "No points: no night shown has an outcome for every published launch. The table lists the nights."
        : NOTHING_SHOWN,
    columns: [
      { key: "date", label: "Night ending", type: "date" },
      { key: "class", label: "Class with the most published launches", type: "class" },
      { key: "mix", label: "Mix", type: "text" },
      { key: "composition", label: "Published launches by class", type: "text" },
      { key: "size", label: "Weapons launched", type: "number", measure: "launch_derived" },
      {
        key: "not_intercepted",
        label: "Not reported destroyed",
        type: "number",
        measure: "not_intercepted",
        missing: "No figure",
      },
      { key: "destroyed", label: "Reported destroyed", type: "number", measure: "destroyed", missing: "No figure" },
      {
        key: "launched_with_outcome",
        label: "Launches with a usable outcome",
        type: "number",
        measure: "launched",
        missing: "None",
      },
      {
        key: "n_unknown_launched",
        label: "Reports with no published launch count",
        type: "number",
        measure: "launch_derived",
      },
    ],
    rows,
    coverage: (row) => ({ from: row.date, to: row.date }),
    legend: "point",
    scaleKey: restricted ? hollowKey() : undefined,
    pointer: "xy",
    footnote: strikeFootnote(
      ...(restricted ? [AFTER_NOTE] : []),
      "A night is the reports ending on one Kyiv date, without daytime reports. Its size is the sum of published " +
        "launch counts, so it can leave some out. A night with no published count is not shown. A night where " +
        "some published launches have no usable destroyed count is in the table but has no point.",
      "Not reported destroyed is launched minus destroyed in the same reports. It can include decoys, weapons " +
        "still flying or unresolved, and losses to other causes.",
      "“Mixed” counts as one class in the panels, although it covers more than one." +
        (fixed ? "" : " With classes turned off, size, mix and the number not reported destroyed count only the classes shown."),
      "Points can lie on top of each other. The arrow keys and the table reach every night.",
    ),
    draw(data, width) {
      const shown = data.filter((row) => row.not_intercepted !== null);
      const perRow = width >= 960 ? 3 : width >= 640 ? 2 : 1;
      const panelWidth = Math.floor(width / perRow);
      const panelHeight = fixed
        ? Math.min(440, Math.max(240, fixed.height - PANEL_TITLE - AXIS_TITLE))
        : PANEL_HEIGHT;
      const panel = PANEL_TITLE + panelHeight;
      const height = Math.max(1, Math.ceil(groups.length / perRow)) * panel + AXIS_TITLE;
      const svg = chartSvg(width, height);
      const targets: Target<SaturationRow>[] = [];
      // Every panel shares both scales, so they can be compared directly.
      const xMax = Math.max(1, ...shown.map((row) => row.size));
      const yMax = Math.max(1, ...shown.map((row) => row.not_intercepted!));

      groups.forEach((group, index) => {
        const left = (index % perRow) * panelWidth;
        const top = Math.floor(index / perRow) * panel;
        // Drawn in reverse class order, so the many drone-led nights don't cover the others.
        const own = shown
          .filter((row) => row.mix === group)
          .sort((a, b) => CLASS_IDS.indexOf(a.class) - CLASS_IDS.indexOf(b.class));
        const filled = own.filter((row) => !row.ballistic_restricted);
        const hollow = own.filter((row) => row.ballistic_restricted);
        const position = { x: "size", y: "not_intercepted", symbol: "class", r: 3.5 } as const;
        const plot = Plot.plot({
          ...plotDefaults,
          style: { ...plotDefaults.style, fontSize: "14px" },
          width: panelWidth,
          height: panelHeight,
          marginLeft: 48,
          marginRight: 14,
          marginTop: 10,
          marginBottom: 28,
          x: { domain: [0, xMax], nice: true, label: null, ticks: Math.max(3, Math.floor(panelWidth / 70)) },
          y: { domain: [0, yMax], nice: true, label: null, ticks: 5, grid: true },
          color: classColorScale(classLabels),
          symbol: classSymbolScale(classLabels),
          marks: [
            Plot.dot(filled, { ...position, fill: "class", fillOpacity: 0.7 }),
            Plot.dot(hollow, { ...position, stroke: "class", strokeWidth: 1.5, fill: "none" }),
            Plot.ruleY([0]),
          ],
        }) as SVGSVGElement & Plot.Plot;
        plot.setAttribute("x", String(left));
        plot.setAttribute("y", String(top + PANEL_TITLE));
        svg.append(
          svgText(left + 4, top + 18, group, { "font-weight": 700, "font-size": 14 }),
          svgText(left + 4, top + 36, `${count.format(own.length)} nights · up: not reported destroyed`, {
            "font-size": 13,
          }),
          plot,
        );
        // One target per night, so a tooltip never stacks up many nights that share a spot.
        const byDate = [...own].sort((a, b) => a.date.localeCompare(b.date));
        for (const row of byDate) {
          const [target] = plotTargets(plot, [row], { x: (r) => r.size, y: (r) => r.not_intercepted });
          targets.push({ ...target!, x: target!.x + left, y: target!.y + top + PANEL_TITLE });
        }
      });
      svg.append(
        svgText(width / 2, height - 6, "Weapons launched in the night", { "text-anchor": "middle", "font-size": 14 }),
      );
      return { element: svg, targets };
    },
  });
}
