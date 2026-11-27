/** Reported intercept rate by month, one panel per weapon class (plan §2 B1). */
import * as Plot from "@observablehq/plot";
import { chartFrame, formatMonth, type Target } from "../chart/chartFrame.ts";
import { monthPeriod } from "../chart/flags.ts";
import { monthBand } from "../chart/periodBandMarks.ts";
import { RESTRICTED_BAND } from "../chart/periodBands.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { rateTable } from "../data.ts";
import {
  chartSvg,
  classLabels,
  create,
  monthAxisTicks,
  percent,
  footnote,
  strikeSource,
  svgText,
  type FixedView,
} from "../strikes/shared.ts";
import { monthsShown, type Selection } from "../strikes/strikeData.ts";
import { CLASS_IDS, CLASS_STYLES, type ClassId } from "../theme/classStyles.ts";
import { classSymbolPath, svgElement } from "../theme/marks.ts";
import { classColorScale, classSymbolScale, plotDefaults } from "../theme/plot.ts";
import { interceptHeadline } from "../summary/headlineText.ts";
import { RATE_SHOWN, rateRows, tooFewStatus, type RateChartRow } from "./defenseData.ts";
import { rateLayout } from "./ratePanels.ts";

/** Rates the eye can measure against, besides 0% and 100%. */
const REFERENCE_RATES = [0.5, 0.75, 0.9];
const REFERENCE_COLOR = "#b8b8b8";

const MARGIN_TOP = 22; // Room for the band's label.
const MARGIN_LEFT = 52;
const MARGIN_BOTTOM = 30;
/** The row under the month labels for months with too few launches for a rate. */
const LANE = 24;
/** About how tall the key to that row is, so a guided view can leave room for it. */
const KEY_HEIGHT = 30;
/** A plot shorter than this between its margins has no room to label both 90% and 100%. */
const ROOM_FOR_ALL_TICKS = 180;

/** A guided stop's projector setting draws text this large, so names there are wrapped to fit it. */
const PROJECTOR_SIZE = 16;

/** Two lines for a name too long for its panel, split near the middle. */
function nameLines(name: string, width: number, size: number): string[] {
  // A bold character is about 0.6 of the type size wide.
  const fits = Math.floor((width - 8) / (size * 0.6));
  const words = name.split(" ");
  if (name.length <= fits || words.length < 2) return [name];
  let first = words.shift()!;
  while (words.length > 1 && `${first} ${words[0]}`.length <= fits) first += ` ${words.shift()}`;
  return [first, words.join(" ")];
}

/** Month labels for a panel, thinned where even one a year would collide. */
function panelTicks(months: readonly string[], width: number) {
  const axis = monthAxisTicks(months, width);
  const every = Math.ceil((axis.ticks.length * 40) / width);
  return every > 1 ? { ...axis, ticks: axis.ticks.filter((_, index) => index % every === 0) } : axis;
}

function summary(rows: readonly RateChartRow[], id: ClassId, tooFew: string): string {
  const own = rows.filter((row) => row.class === id);
  const shown = own.filter((row) => row.intercept_rate !== null);
  const few = own.filter((row) => row.status === tooFew).length;
  const fewText = few ? ` ${few} ${few === 1 ? "month has" : "months have"} too few launches for a rate.` : "";
  if (!shown.length) return `${classLabels[id]}: no month with a rate.${fewText}`;
  const rates = shown.map((row) => row.intercept_rate!);
  return (
    `${classLabels[id]}: ${shown.length} months with a rate, from ${formatMonth(shown[0]!.month)} to ` +
    `${formatMonth(shown[shown.length - 1]!.month)}, between ${percent.format(Math.min(...rates))} and ` +
    `${percent.format(Math.max(...rates))}.${fewText}`
  );
}

/** A hollow version of the class's symbol: a month that has launches but no rate. */
function hollowSymbol(id: ClassId, area: number, transform: string): SVGPathElement {
  return svgElement("path", {
    d: classSymbolPath(id, area),
    transform,
    fill: "#ffffff",
    stroke: CLASS_STYLES[id].color,
    "stroke-width": 1.5,
  });
}

function tooFewKey(classes: readonly ClassId[], minLaunched: number): HTMLElement {
  const key = create("p", "strike-key");
  const icons = svgElement("svg", {
    width: classes.length * 14,
    height: 14,
    "aria-hidden": "true",
    focusable: "false",
  });
  classes.forEach((id, index) => icons.append(hollowSymbol(id, 55, `translate(${index * 14 + 7},7)`)));
  key.append(icons, `Hollow, in a “<${minLaunched}” row: under ${minLaunched} launches with an outcome, so no rate.`);
  return key;
}

/** `fixed` is a guided stop's view: panels sized so all of them fit the screen. */
export function interceptRateChart(selection: Selection, fixed?: FixedView): HTMLElement {
  const rows = rateRows(rateTable, selection);
  const months = monthsShown(rateTable, selection.from, selection.to);
  const classes = CLASS_IDS.filter((id) => rows.some((row) => row.class === id));
  const end = formatMonth(rateTable.missileRatesEndBefore);
  const tooFew = tooFewStatus(rateTable.minLaunched);
  const fewClasses = classes.filter((id) => rows.some((row) => row.class === id && row.status === tooFew));
  const lane = fewClasses.length ? LANE : 0;

  return chartFrame<RateChartRow>({
    title: "Reported intercept rate over time, by weapon class",
    headline: fixed ? undefined : interceptHeadline(rows, classLabels),
    subtitle: "Share of each month’s launches reported destroyed. A missing point or a break in a line is a gap, not 0%.",
    howToRead:
      "One panel for each weapon class, all from 0% to 100%: the share of each month’s launches reported destroyed, " +
      "daytime reports included. Large panels join the months with a line; the smaller ones, for rarer classes, " +
      "show each month as a dot. Thin gray lines mark 50%, 75% and 90%. A missing point or a break in a line is a " +
      `gap, not 0%: fewer than ${rateTable.minLaunched} launches with an outcome, no report, or, for missiles from ` +
      `${end}, restricted reporting. ` +
      (lane ? "Months with too few launches are marked by hollow symbols under the panel. " : "") +
      `A rate on few launches is coarse: on ${rateTable.minLaunched}, one weapon moves it ` +
      `${Math.round(100 / rateTable.minLaunched)} points. Tooltips and the table give both counts.`,
    description: classes.length
      ? `Charts of the monthly reported intercept rate, one for each weapon class, ` +
        `${formatMonth(months[0]!)} to ${formatMonth(months[months.length - 1]!)}, with gaps where there is no rate. ` +
        classes.map((id) => summary(rows, id, tooFew)).join(" ")
      : "No chart: no month or weapon class with a class rate is selected.",
    columns: [
      { key: "month", label: "Month", type: "month" },
      { key: "class", label: "Class", type: "class" },
      { key: "intercept_rate", label: "Reported intercept rate", type: "number", measure: "intercept_rate", missing: "No rate" },
      { key: "destroyed", label: "Reported destroyed", type: "number", measure: "destroyed", missing: "Not shown" },
      {
        key: "launched_with_outcome",
        label: "Launches with a usable outcome",
        type: "number",
        measure: "launched",
        missing: "Not shown",
      },
      { key: "status", label: "Rate or gap", type: "text" },
      {
        key: "n_unknown_launched",
        label: "Reports with no published launch count",
        type: "number",
        measure: "launch_derived",
        missing: "No report",
      },
    ],
    rows,
    coverage: (row) => monthPeriod(row.month),
    pointer: "xy",
    scaleKey: lane ? tooFewKey(fewClasses, rateTable.minLaunched) : undefined,
    source: strikeSource(),
    footnote: footnote(
      "Rate = reported destroyed ÷ launches in the same reports. Reports that are unpublished, blank or give more " +
        "destroyed than launched are left out of both. These are reported figures, not verified performance, and " +
        "say nothing about hits or damage.",
      "Counts reported jointly for different classes (“mixed”) have no class rate, so no panel. The first and last " +
        "months of the data are partial.",
      "The anti-ship and other group is varied, so read its changes with care: they can reflect which weapons were " +
        "reported.",
    ),
    draw(data, width) {
      // The lane is part of each panel's height, so a guided view still fits.
      const layout = rateLayout(classes, width, fixed && fixed.height - (lane ? KEY_HEIGHT : 0));
      const svg = chartSvg(width, layout.height);
      const targets: Target<RateChartRow>[] = [];

      for (const { id, large, left, top, width: panelWidth, height, titleHeight } of layout.panels) {
        const plotHeight = height - titleHeight;
        const tall = plotHeight - MARGIN_TOP - MARGIN_BOTTOM - lane >= ROOM_FOR_ALL_TICKS;
        const own = data.filter((row) => row.class === id);
        const drawn = own.filter((row) => row.status === RATE_SHOWN);
        const few = own.filter((row) => row.status === tooFew);
        const points = { x: "month", y: "intercept_rate", fill: "class", symbol: "class" } as const;
        const plot = Plot.plot({
          ...plotDefaults,
          style: { ...plotDefaults.style, fontSize: "14px" },
          width: panelWidth,
          height: plotHeight,
          marginLeft: MARGIN_LEFT,
          marginRight: 14,
          marginTop: MARGIN_TOP,
          marginBottom: MARGIN_BOTTOM + lane,
          x: { type: "point", domain: months, padding: 0.5, label: null, ...panelTicks(months, panelWidth - 66) },
          y: { label: null, domain: [0, 1], ticks: [0, ...REFERENCE_RATES, ...(tall ? [1] : [])], tickFormat: "%" },
          color: classColorScale(classLabels),
          symbol: classSymbolScale(classLabels),
          marks: [
            Plot.ruleY([...REFERENCE_RATES, 1], { stroke: REFERENCE_COLOR, strokeWidth: 1 }),
            // Rows with a null rate stay in, so the line breaks there.
            large
              ? Plot.lineY(own, {
                  x: "month",
                  y: "intercept_rate",
                  stroke: "class",
                  strokeWidth: 2,
                  strokeDasharray: CLASS_STYLES[id].dash,
                })
              : null,
            // Points keep a month with gaps on both sides visible.
            Plot.dot(drawn, { ...points, r: large ? 3 : 3.5 }),
            Plot.ruleY([0]),
          ],
        }) as SVGSVGElement & Plot.Plot;
        monthBand(plot, months, RESTRICTED_BAND);
        const panelTargets = plotTargets(plot, drawn, { x: (r) => r.month, y: (r) => r.intercept_rate });

        // The lane's markers are placed by month alone: they have no rate to give them a height.
        const laneY = plotHeight - LANE / 2;
        if (few.length) {
          const label = svgText(MARGIN_LEFT - 9, laneY + 4, `<${rateTable.minLaunched}`, {
            "text-anchor": "end",
            "font-size": 13,
          });
          plot.append(label);
          const x = plot.scale("x")!;
          for (const row of few) {
            const at = Number(x.apply(row.month));
            plot.append(hollowSymbol(id, large ? 40 : 30, `translate(${at},${laneY})`));
            panelTargets.push({ x: at, y: laneY, rows: [row] });
          }
        }
        // In month order, for the keyboard.
        panelTargets.sort((a, b) => a.x - b.x);
        for (const target of panelTargets) {
          targets.push({ ...target, x: target.x + left, y: target.y + top + titleHeight });
        }

        plot.setAttribute("x", String(left));
        plot.setAttribute("y", String(top + titleHeight));
        const size = large ? 16 : 14;
        nameLines(classLabels[id], panelWidth, fixed ? PROJECTOR_SIZE : size).forEach((line, index) => {
          svg.append(svgText(left + 4, top + 18 + index * 17, line, { "font-weight": 700, "font-size": size }));
        });
        svg.append(plot);
        if (!drawn.length) {
          svg.append(
            svgText(left + panelWidth / 2, top + titleHeight + plotHeight / 2, "No month with a rate", {
              "text-anchor": "middle",
              "font-size": 14,
            }),
          );
        }
      }
      return { element: svg, targets };
    },
  });
}
