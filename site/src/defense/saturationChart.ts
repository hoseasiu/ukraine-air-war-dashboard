/**
 * Salvo size against the number not reported destroyed, one point per night
 * (plan §2 B2). One panel shows every night, styled by whether it is before or
 * from the missile-reporting restriction. The other view splits nights into
 * panels by how many classes were reported, and each point takes the color and
 * symbol of the class with the most launches. Both axes are stretched near zero.
 */
import * as Plot from "@observablehq/plot";
import { liveChartFrame, type ChartSpec, type Target } from "../chart/chartFrame.ts";
import { BALLISTIC_RESTRICTION_FROM } from "../chart/flags.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { formatDate, outcomeTable } from "../data.ts";
import {
  chartSvg,
  classLabels,
  count,
  create,
  NOTHING_SHOWN,
  footnote,
  strikeSource,
  svgText,
  type FixedView,
} from "../strikes/shared.ts";
import type { Selection } from "../strikes/strikeData.ts";
import { saturationHeadline } from "../summary/headlineText.ts";
import { CLASS_IDS } from "../theme/classStyles.ts";
import { svgElement } from "../theme/marks.ts";
import { PERIOD_STYLES } from "../theme/periodStyles.ts";
import { classColorScale, classSymbolScale, plotDefaults } from "../theme/plot.ts";
import { MIX_GROUPS, saturationRows, type SaturationRow } from "./defenseData.ts";
import { segmented } from "./segmented.ts";
import "./saturation.css";

const PANEL_HEIGHT = 320;
const SINGLE_HEIGHT = 480;
const PANEL_TITLE = 44;
const AXIS_TITLES = 44;

/** Where gridlines go on the stretched axes. */
const TICKS = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

const from = formatDate(BALLISTIC_RESTRICTION_FROM);

/** Why later nights are marked apart. The owner kept them in the chart on #16. */
const AFTER_NOTE =
  `Nights from ${from} are drawn hollow. Missile counts may be missing from their size, mix and destroyed counts. ` +
  "The dataset page also says that where only a destroyed count is published, it is copied into launched. That would " +
  "make the number not reported destroyed too low, and we can’t tell which counts are copies.";

function keyLine(text: string, ...marks: SVGElement[]): HTMLElement {
  const line = create("p", "strike-key");
  const picture = svgElement("svg", { width: 40, height: 18, "aria-hidden": "true", focusable: "false" });
  picture.append(...marks);
  line.append(picture, text);
  return line;
}

/** The split view's key. Its class colors and symbols are in the legend. */
function hollowKey(): HTMLElement {
  return keyLine(
    `Filled: night before ${from}. Hollow: from ${from}, under restricted missile reporting.`,
    svgElement("circle", { cx: 10, cy: 9, r: 5, fill: "currentColor" }),
    svgElement("circle", { cx: 30, cy: 9, r: 5, fill: "none", stroke: "currentColor", "stroke-width": 1.5 }),
  );
}

/** The one-panel view's key, with only the periods that are drawn. */
function periodKey(hasBefore: boolean, hasAfter: boolean): HTMLElement {
  const key = create("div", "period-key");
  const { before, from: after } = PERIOD_STYLES;
  if (hasBefore) {
    key.append(
      keyLine(
        `Filled circle: night before ${from}. Darker where nights overlap.`,
        svgElement("circle", { cx: 20, cy: 9, r: 5, fill: before.color, "fill-opacity": 0.7 }),
      ),
    );
  }
  if (hasAfter) {
    key.append(
      keyLine(
        `Hollow square: night from ${from}, under restricted missile reporting.`,
        svgElement("rect", {
          x: 15,
          y: 4,
          width: 10,
          height: 10,
          fill: "none",
          stroke: after.color,
          "stroke-width": after.strokeWidth,
        }),
      ),
    );
  }
  return key;
}

export interface SaturationView {
  /** Panels split by the number of classes reported, instead of one panel. */
  split?: boolean;
  /** Offers the choice of view and hears each change. Leave out for a fixed view. */
  onSplit?: (split: boolean) => void;
}

/** `fixed` is a guided stop's view: no wording about filters, and a height that fits the screen. */
export function saturationChart(selection: Selection, fixed?: FixedView, view: SaturationView = {}): HTMLElement {
  const rows = saturationRows(outcomeTable, selection, classLabels);
  const drawable = rows.filter((row) => row.not_intercepted !== null);
  const groups = MIX_GROUPS.filter((group) => drawable.some((row) => row.mix === group));
  const earlier = drawable.filter((row) => !row.ballistic_restricted);
  const later = drawable.filter((row) => row.ballistic_restricted);

  const summary = (name: string, own: readonly SaturationRow[]) =>
    `${name}: ${own.length} nights, sizes up to ${count.format(Math.max(...own.map((r) => r.size)))}, ` +
    `up to ${count.format(Math.max(...own.map((r) => r.not_intercepted!)))} not reported destroyed.`;

  function description(split: boolean): string {
    if (!drawable.length) {
      return rows.length
        ? "No points: no night shown has an outcome for every published launch. The table lists the nights."
        : NOTHING_SHOWN;
    }
    const sets: [string, SaturationRow[]][] = split
      ? groups.map((group) => [group, drawable.filter((row) => row.mix === group)])
      : [
          [`Nights before ${from}`, earlier],
          [`Nights from ${from}`, later],
        ];
    return (
      `${split ? "Scatter plots" : "A scatter plot"} of weapons launched per night against the number not reported ` +
      "destroyed, on axes stretched near zero. " +
      sets
        .filter(([, own]) => own.length)
        .map(([name, own]) => summary(name, own))
        .join(" ")
    );
  }

  const spec = (split: boolean): ChartSpec<SaturationRow> => ({
    title: "Salvo size and weapons not reported destroyed, night by night",
    headline: fixed ? undefined : saturationHeadline(rows),
    subtitle: "A point for each night: weapons launched, against those not reported destroyed (not a count of hits).",
    howToRead:
      "Each point is one attack night: weapons launched across, and the number not reported destroyed up. That " +
      "number isn’t a count of hits. It tends to be higher on larger nights even if the share reported destroyed " +
      "stays the same, so compare it with the size. Both axes are stretched near zero, where many nights are: " +
      "10 to 20 takes much more room than 410 to 420, so equal distances aren’t equal counts. " +
      (split
        ? "Panels split nights by how many classes were reported, and a point’s color and symbol show the class " +
          "with the most launches. The pattern doesn’t show that size or mix caused anything: both changed over " +
          "the years, along with much else."
        : "The pattern doesn’t show that size caused anything: sizes changed over the years, along with much else."),
    description: description(split),
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
    legend: split ? "point" : undefined,
    scaleKey: split
      ? later.length
        ? hollowKey()
        : undefined
      : drawable.length
        ? periodKey(earlier.length > 0, later.length > 0)
        : undefined,
    pointer: "xy",
    source: strikeSource(),
    footnote: footnote(
      ...(later.length ? [AFTER_NOTE] : []),
      "A night is the reports ending on one Kyiv date, without daytime reports. Its size is the sum of published " +
        "launch counts, so it can leave some out. A night with no published count is not shown. A night where " +
        "some published launches have no usable destroyed count is in the table but has no point.",
      "Not reported destroyed is launched minus destroyed in the same reports. It can include decoys, weapons " +
        "still flying or unresolved, and losses to other causes.",
      ...(fixed
        ? []
        : [
            "In the split view, “mixed” counts as one class, although it covers more than one. With classes turned " +
              "off, size, mix and the number not reported destroyed count only the classes shown.",
          ]),
      "Points can lie on top of each other. The arrow keys and the table reach every night.",
    ),
    draw(data, width) {
      const shown = data.filter((row) => row.not_intercepted !== null);
      const panels: [string, SaturationRow[]][] = split
        ? groups.map((group) => [group, shown.filter((row) => row.mix === group)])
        : [["All nights shown", [...shown]]];
      const perRow = !split ? 1 : width >= 960 ? 3 : width >= 640 ? 2 : 1;
      const panelWidth = Math.floor(width / perRow);
      const panelHeight = fixed
        ? Math.min(split ? 440 : 520, Math.max(240, fixed.height - PANEL_TITLE - AXIS_TITLES))
        : split
          ? PANEL_HEIGHT
          : SINGLE_HEIGHT;
      const panel = PANEL_TITLE + panelHeight;
      const height = Math.max(1, Math.ceil(panels.length / perRow)) * panel + AXIS_TITLES;
      const svg = chartSvg(width, height);
      const targets: Target<SaturationRow>[] = [];
      // Every panel shares both scales, so they can be compared directly.
      const xMax = Math.max(1, ...shown.map((row) => row.size));
      const yMax = Math.max(1, ...shown.map((row) => row.not_intercepted!));
      // A symlog scale spreads out the crowded low values and still has a place for zero.
      const axis = (max: number) => ({
        type: "symlog" as const,
        domain: [0, max * 1.08],
        ticks: TICKS.filter((tick) => tick <= max * 1.08),
        tickFormat: (tick: number) => count.format(tick),
        label: null,
        grid: true,
        // Keeps points at zero clear of the other axis.
        inset: 6,
      });

      panels.forEach(([title, members], index) => {
        const left = (index % perRow) * panelWidth;
        const top = Math.floor(index / perRow) * panel;
        // Drawn in reverse class order, so the many drone-led nights don't cover the others.
        const own = [...members].sort((a, b) => CLASS_IDS.indexOf(a.class) - CLASS_IDS.indexOf(b.class));
        const filled = own.filter((row) => !row.ballistic_restricted);
        const hollow = own.filter((row) => row.ballistic_restricted);
        const position = { x: "size", y: "not_intercepted", r: 3.5 } as const;
        const { before, from: after } = PERIOD_STYLES;
        const dots = split
          ? [
              Plot.dot(filled, { ...position, symbol: "class", fill: "class", fillOpacity: 0.7 }),
              Plot.dot(hollow, { ...position, symbol: "class", stroke: "class", strokeWidth: 1.5, fill: "none" }),
            ]
          : [
              Plot.dot(filled, { ...position, fill: before.color, fillOpacity: before.fillOpacity }),
              Plot.dot(hollow, {
                ...position,
                symbol: "square",
                stroke: after.color,
                strokeWidth: after.strokeWidth,
                fill: "none",
              }),
            ];
        const plot = Plot.plot({
          ...plotDefaults,
          style: { ...plotDefaults.style, fontSize: "14px" },
          width: panelWidth,
          height: panelHeight,
          marginLeft: 48,
          marginRight: 14,
          marginTop: 10,
          marginBottom: 28,
          x: axis(xMax),
          y: axis(yMax),
          ...(split ? { color: classColorScale(classLabels), symbol: classSymbolScale(classLabels) } : {}),
          marks: [...dots, Plot.ruleY([0])],
        }) as SVGSVGElement & Plot.Plot;
        plot.setAttribute("x", String(left));
        plot.setAttribute("y", String(top + PANEL_TITLE));
        svg.append(
          svgText(left + 4, top + 18, title, { "font-weight": 700, "font-size": 14 }),
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
      const across = { "text-anchor": "middle", "font-size": 14 };
      svg.append(
        svgText(width / 2, height - 24, "Weapons launched in the night", across),
        // On the drawing too, so a projected view carries it.
        svgText(width / 2, height - 6, "Both axes are stretched near zero: gridlines aren’t equal steps", across),
      );
      return { element: svg, targets };
    },
  });

  let split = view.split ?? false;
  const { onSplit } = view;
  let controls: HTMLElement | undefined;
  let redraw = () => {};
  if (onSplit) {
    controls = create("div", "saturation-controls");
    controls.append(
      segmented(
        "View",
        [
          ["one", "All nights in one panel"],
          ["split", "Split by classes reported"],
        ],
        split ? "split" : "one",
        (value) => {
          split = value === "split";
          onSplit(split);
          redraw();
        },
      ),
    );
  }
  const full = (): ChartSpec<SaturationRow> => ({ ...spec(split), controls });
  const chart = liveChartFrame(full());
  redraw = () => chart.update(full());
  return chart.element;
}
