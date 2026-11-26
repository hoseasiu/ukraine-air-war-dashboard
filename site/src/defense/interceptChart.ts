/** Reported intercept rate by month, one panel per weapon class (plan §2 B1). */
import * as Plot from "@observablehq/plot";
import { chartFrame, formatMonth, type Target } from "../chart/chartFrame.ts";
import { monthPeriod } from "../chart/flags.ts";
import { monthBand } from "../chart/periodBandMarks.ts";
import { RESTRICTED_BAND } from "../chart/periodBands.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { rateTable } from "../data.ts";
import { chartSvg, classLabels, monthAxisTicks, percent, footnote, strikeSource, svgText, type FixedView } from "../strikes/shared.ts";
import { monthsShown, type Selection } from "../strikes/strikeData.ts";
import { CLASS_IDS, CLASS_STYLES, type ClassId } from "../theme/classStyles.ts";
import { classColorScale, classSymbolScale, plotDefaults } from "../theme/plot.ts";
import { RATE_SHOWN, rateRows, type RateChartRow } from "./defenseData.ts";

const PANEL_HEIGHT = 200;
const PANEL_TITLE = 28;

function summary(rows: readonly RateChartRow[], id: ClassId): string {
  const shown = rows.filter((row) => row.class === id && row.intercept_rate !== null);
  if (!shown.length) return `${classLabels[id]}: no month with a rate.`;
  const rates = shown.map((row) => row.intercept_rate!);
  return (
    `${classLabels[id]}: ${shown.length} months with a rate, from ${formatMonth(shown[0]!.month)} to ` +
    `${formatMonth(shown[shown.length - 1]!.month)}, between ${percent.format(Math.min(...rates))} and ` +
    `${percent.format(Math.max(...rates))}.`
  );
}

/** `fixed` is a guided stop's view: panels sized so all of them fit the screen. */
export function interceptRateChart(selection: Selection, fixed?: FixedView): HTMLElement {
  const rows = rateRows(rateTable, selection);
  const months = monthsShown(rateTable, selection.from, selection.to);
  const classes = CLASS_IDS.filter((id) => rows.some((row) => row.class === id));
  const end = formatMonth(rateTable.missileRatesEndBefore);

  return chartFrame<RateChartRow>({
    title: "Reported intercept rate over time, by weapon class",
    subtitle: "Share of each month’s launches reported destroyed. A break in a line is a gap, not 0%.",
    howToRead:
      "One panel for each weapon class, all from 0% to 100%: the share of each month’s launches reported destroyed, " +
      "daytime reports included. A break in a line is a gap, not 0%: " +
      `fewer than ${rateTable.minLaunched} launches with an outcome, no report, or, for missiles from ${end}, ` +
      `restricted reporting. A rate on few launches is coarse: on ${rateTable.minLaunched}, one weapon moves it ` +
      `${Math.round(100 / rateTable.minLaunched)} points. Tooltips and the table give both counts.`,
    description: classes.length
      ? `Line charts of the monthly reported intercept rate, one for each weapon class, ` +
        `${formatMonth(months[0]!)} to ${formatMonth(months[months.length - 1]!)}, with breaks where there is no rate. ` +
        classes.map((id) => summary(rows, id)).join(" ")
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
      // A fixed view takes three panels to a row, so five panels need only two rows.
      // Where two rows don't fit its height, a wide screen takes them all in one.
      const oneRow = fixed && width >= 1100 && fixed.height < 2 * (150 + PANEL_TITLE);
      const perRow = oneRow ? classes.length : fixed && width >= 900 ? 3 : width >= (fixed ? 640 : 880) ? 2 : 1;
      const panelWidth = Math.floor(width / perRow);
      const rowCount = Math.ceil(classes.length / perRow);
      const panelHeight = fixed
        ? Math.min(240, Math.max(150, Math.floor(fixed.height / rowCount) - PANEL_TITLE))
        : PANEL_HEIGHT;
      const panel = panelHeight + PANEL_TITLE;
      const svg = chartSvg(width, rowCount * panel);
      const targets: Target<RateChartRow>[] = [];

      classes.forEach((id, index) => {
        const left = (index % perRow) * panelWidth;
        const top = Math.floor(index / perRow) * panel;
        const own = data.filter((row) => row.class === id);
        const drawn = own.filter((row) => row.status === RATE_SHOWN);
        const plot = Plot.plot({
          ...plotDefaults,
          style: { ...plotDefaults.style, fontSize: "14px" },
          width: panelWidth,
          height: panelHeight,
          marginLeft: oneRow ? 44 : 52,
          marginRight: 12,
          // Room for the band's label.
          marginTop: 22,
          marginBottom: 30,
          x: { type: "point", domain: months, padding: 0.5, label: null, ...monthAxisTicks(months, panelWidth - 64) },
          y: { label: null, domain: [0, 1], ticks: 5, tickFormat: "%", grid: true },
          color: classColorScale(classLabels),
          symbol: classSymbolScale(classLabels),
          marks: [
            // Rows with a null rate stay in, so the line breaks there.
            Plot.lineY(own, {
              x: "month",
              y: "intercept_rate",
              stroke: "class",
              strokeWidth: 2,
              strokeDasharray: CLASS_STYLES[id].dash,
            }),
            // Points keep a month with gaps on both sides visible.
            Plot.dot(drawn, { x: "month", y: "intercept_rate", fill: "class", symbol: "class", r: 3 }),
            Plot.ruleY([0]),
          ],
        }) as SVGSVGElement & Plot.Plot;
        monthBand(plot, months, RESTRICTED_BAND);
        for (const target of plotTargets(plot, drawn, { x: (r) => r.month, y: (r) => r.intercept_rate })) {
          targets.push({ ...target, x: target.x + left, y: target.y + top + PANEL_TITLE });
        }
        plot.setAttribute("x", String(left));
        plot.setAttribute("y", String(top + PANEL_TITLE));
        const name = classLabels[id].replace(/ \(not separable\)$/, "");
        svg.append(svgText(left + 4, top + 20, name, { "font-weight": 700, "font-size": 14 }), plot);
        if (!drawn.length) {
          svg.append(
            svgText(left + panelWidth / 2, top + PANEL_TITLE + panelHeight / 2, "No month with a rate", {
              "text-anchor": "middle",
              "font-size": 14,
            }),
          );
        }
      });
      return { element: svg, targets };
    },
  });
}
