/** Monthly launches stacked by class, and the class mix as small multiples (plan §2 A1). */
import * as Plot from "@observablehq/plot";
import { chartFrame, formatMonth, type ChartSpec, type Target } from "../chart/chartFrame.ts";
import { monthPeriod, type ColumnSpec } from "../chart/flags.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { formatDate, monthlyTable } from "../data.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";
import { classFillScale, plotDefaults } from "../theme/plot.ts";
import { chartSvg, classLabels, monthAxisTicks, percent, strikeFootnote, svgText } from "./shared.ts";
import { monthRows, monthsShown, type MonthChartRow, type Selection } from "./strikeData.ts";

const BASE_COLUMNS: ColumnSpec[] = [
  { key: "month", label: "Month", type: "month" },
  { key: "class", label: "Class", type: "class" },
  { key: "launched", label: "Launched", type: "number", measure: "launched", missing: "Not published" },
];

const END_COLUMNS: ColumnSpec[] = [
  {
    key: "n_unknown_launched",
    label: "Reports with no published launch count",
    type: "number",
    measure: "launch_derived",
  },
  { key: "days", label: "Days covered", type: "text" },
];

const NOT_ZERO =
  "A month with no bar or row for a class had no report of it, or no published count. Neither means zero launches.";

function largestMonth(rows: readonly MonthChartRow[]): string {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.month, (totals.get(row.month) ?? 0) + (row.launched ?? 0));
  const [month, total] = [...totals].sort((a, b) => b[1] - a[1])[0]!;
  return `${formatMonth(month)}, with ${total.toLocaleString("en-US")}`;
}

export function monthlyLaunchChart(selection: Selection): HTMLElement {
  const rows = monthRows(monthlyTable, selection, formatDate);
  const months = monthsShown(monthlyTable, selection.from, selection.to);
  return chartFrame<MonthChartRow>({
    title: "Monthly launches by weapon class",
    howToRead:
      "Each bar is one month’s published launches, stacked by weapon class, daytime reports included. " +
      "Drones far outnumber missiles in most months; turn classes off in the filters to rescale the bars. " +
      "The first and last months of the data are partial.",
    description: rows.length
      ? `Stacked bar chart of published launches per month by weapon class, ${formatMonth(months[0]!)} to ` +
        `${formatMonth(months[months.length - 1]!)}. Most in one month: ${largestMonth(rows)} for the classes shown.`
      : "No chart: the chosen months and classes have no strike reports.",
    columns: [...BASE_COLUMNS, ...END_COLUMNS],
    rows,
    coverage: (row) => monthPeriod(row.month),
    legend: "bar",
    pointer: "x",
    footnote: strikeFootnote(NOT_ZERO),
    draw(data, width) {
      const plot = Plot.plot({
        ...plotDefaults,
        width,
        height: 420,
        x: { type: "band", domain: months, padding: 0.15, label: null, ...monthAxisTicks(months, width) },
        y: { label: "Published launches", grid: true },
        color: classFillScale(classLabels),
        marks: [
          Plot.barY(data, {
            x: "month",
            y: "launched",
            fill: "class",
            order: [...CLASS_IDS],
            // A surface-colored edge separates stacked segments.
            stroke: "#ffffff",
            strokeWidth: 1,
          }),
          Plot.ruleY([0]),
        ],
      });
      // One target per month, at the top of its bar, listing every class.
      const totals = new Map<string, number>();
      for (const row of data) totals.set(row.month, (totals.get(row.month) ?? 0) + (row.launched ?? 0));
      const targets = plotTargets(plot, data, { x: (r) => r.month, y: (r) => totals.get(r.month) });
      return { element: plot, targets };
    },
  });
}

const PANEL_HEIGHT = 190;
const PANEL_TITLE = 28;

export function classMixChart(selection: Selection): HTMLElement {
  const rows = monthRows(monthlyTable, selection, formatDate);
  const months = monthsShown(monthlyTable, selection.from, selection.to);
  const spec: ChartSpec<MonthChartRow> = {
    title: "Class mix over time",
    howToRead:
      "One panel for each weapon class: its share of each month’s published launches. " +
      "Each panel has its own vertical scale, so compare shapes across panels and read heights from each axis. " +
      "The share is out of all counted classes, including any turned off in the filters.",
    description: rows.length
      ? "Small bar charts, one per weapon class, of its share of each month’s published launches. " +
        CLASS_IDS.filter((id) => rows.some((row) => row.class === id))
          .map((id) => {
            const best = rows
              .filter((row) => row.class === id && row.share !== null)
              .sort((a, b) => b.share! - a.share!)[0];
            return best
              ? `${classLabels[id]}: highest ${percent.format(best.share!)} in ${formatMonth(best.month)}.`
              : `${classLabels[id]}: no published share.`;
          })
          .join(" ")
      : "No chart: the chosen months and classes have no strike reports.",
    columns: [
      ...BASE_COLUMNS,
      {
        key: "share",
        label: "Share of the month’s published launches",
        type: "number",
        measure: "launch_derived",
        format: (value) => percent.format(value),
        missing: "No share",
      },
      ...END_COLUMNS,
    ],
    rows,
    coverage: (row) => monthPeriod(row.month),
    pointer: "xy",
    footnote: strikeFootnote(NOT_ZERO, "Where missile counts are unpublished, the other classes’ shares are higher than they would otherwise be."),
    draw(data, width) {
      const perRow = width >= 900 ? 3 : width >= 600 ? 2 : 1;
      const panelWidth = Math.floor(width / perRow);
      const present: ClassId[] = CLASS_IDS.filter((id) => data.some((row) => row.class === id));
      const height = Math.ceil(present.length / perRow) * (PANEL_HEIGHT + PANEL_TITLE);
      const svg = chartSvg(width, height);
      const targets: Target<MonthChartRow>[] = [];

      present.forEach((id, index) => {
        const left = (index % perRow) * panelWidth;
        const top = Math.floor(index / perRow) * (PANEL_HEIGHT + PANEL_TITLE);
        const own = data.filter((row) => row.class === id);
        const most = Math.max(0, ...own.map((row) => row.share ?? 0));
        const plot = Plot.plot({
          ...plotDefaults,
          style: { ...plotDefaults.style, fontSize: "14px" },
          width: panelWidth,
          height: PANEL_HEIGHT,
          marginLeft: 52,
          marginRight: 12,
          marginTop: 12,
          marginBottom: 30,
          x: { type: "band", domain: months, padding: 0.1, label: null, ...monthAxisTicks(months, panelWidth - 64) },
          y: { label: null, domain: [0, most || 1], nice: true, ticks: 4, tickFormat: "%", grid: true },
          color: classFillScale(classLabels),
          marks: [Plot.barY(own, { x: "month", y: "share", fill: "class" }), Plot.ruleY([0])],
        }) as SVGSVGElement & Plot.Plot;
        const drawn = own.filter((row) => row.share !== null);
        for (const target of plotTargets(plot, drawn, { x: (r) => r.month, y: (r) => r.share })) {
          targets.push({ ...target, x: target.x + left, y: target.y + top + PANEL_TITLE });
        }
        plot.setAttribute("x", String(left));
        plot.setAttribute("y", String(top + PANEL_TITLE));
        // Long class names are shortened to fit narrow panels; the table and tooltips have them in full.
        const name = classLabels[id].replace(/ \(not separable\)$/, "");
        svg.append(svgText(left + 4, top + 20, name, { "font-weight": 700, "font-size": 14 }), plot);
      });
      return { element: svg, targets };
    },
  };
  return chartFrame(spec);
}
