/**
 * Sample charts for chart-sample.html, and a worked example of the chart frame.
 * All figures are invented.
 */
import * as Plot from "@observablehq/plot";
import { chartFrame, formatMonth } from "../chart/chartFrame.ts";
import { monthPeriod } from "../chart/flags.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { buildInfo, formatDate, weaponClasses } from "../data.ts";
import { CLASS_STYLES, type ClassId } from "../theme/classStyles.ts";
import { installPatterns } from "../theme/marks.ts";
import { classColorScale, classFillScale, classSymbolScale, plotDefaults, titledScale } from "../theme/plot.ts";
import "../styles.css";

interface SampleRow {
  month: string;
  class: ClassId;
  launched: number | null;
  destroyed: number | null;
  intercept_rate: number | null;
  /** A row flag, as the pipeline will send it. */
  ballistic_restricted: boolean;
}

const MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

/** Invented [launched, destroyed] pairs. null stands for an unpublished count. */
const INVENTED: Partial<Record<ClassId, ([number, number] | null)[]>> = {
  shahed_drone: [[400, 320], [500, 390], [450, 370], [550, 430], [600, 500], [520, 400]],
  cruise: [[60, 40], [80, 62], [40, 25], [70, 50], [50, 30], [90, 66]],
  ballistic: [[50, 12], [40, 14], [30, 6], null, [8, 2], null],
};

const rows: SampleRow[] = Object.entries(INVENTED).flatMap(([id, pairs]) =>
  pairs.map((pair, index) => {
    const [launched, destroyed] = pair ?? [null, null];
    return {
      month: MONTHS[index]!,
      class: id as ClassId,
      launched,
      destroyed,
      ballistic_restricted: pair === null,
      // The plan's gap rule: no rate for fewer than about 10 launches.
      intercept_rate: launched !== null && destroyed !== null && launched >= 10 ? destroyed / launched : null,
    };
  }),
);

const labels = Object.fromEntries(weaponClasses.map((c) => [c.id, c.label])) as Record<ClassId, string>;
const sampleClasses = Object.keys(INVENTED) as ClassId[];
const monthAxis = { label: null, tickFormat: formatMonth };

const rateChart = chartFrame<SampleRow>({
  title: "Sample: reported intercept rate by class (invented numbers)",
  subtitle: "Invented numbers, to show the chart frame.",
  source: Object.assign(document.createElement("p"), { textContent: "Invented sample figures." }),
  howToRead:
    "Each line is one weapon class: the share of its launches reported destroyed that month. A break in a line means there is no rate, not a rate of zero.",
  description: "Line chart of invented monthly intercept rates for three weapon classes, May to October 2026.",
  columns: [
    { key: "month", label: "Month", type: "month" },
    { key: "class", label: "Class", type: "class" },
    { key: "launched", label: "Launched", type: "number", measure: "launched", missing: "Not published" },
    { key: "destroyed", label: "Reported destroyed", type: "number", measure: "destroyed", missing: "Not published" },
    { key: "intercept_rate", label: "Reported intercept rate", type: "number", measure: "intercept_rate", missing: "No rate" },
  ],
  rows,
  coverage: (row) => monthPeriod(row.month),
  legend: "line",
  pointer: "xy",
  draw(data, width) {
    const plot = Plot.plot({
      ...plotDefaults,
      width,
      height: 360,
      x: { ...monthAxis, type: "point", domain: MONTHS, padding: 0.3 },
      y: titledScale({ label: "Reported intercept rate", domain: [0, 1], tickFormat: "%", grid: true }),
      color: classColorScale(labels),
      symbol: classSymbolScale(labels),
      marks: [
        // Dashes aren't a Plot scale, so there is one line mark per class.
        ...sampleClasses.map((id) =>
          Plot.lineY(
            data.filter((row) => row.class === id),
            { x: "month", y: "intercept_rate", stroke: "class", strokeWidth: 2, strokeDasharray: CLASS_STYLES[id].dash },
          ),
        ),
        Plot.dot(data, { x: "month", y: "intercept_rate", fill: "class", symbol: "class", r: 5, stroke: "#ffffff" }),
      ],
    });
    const drawn = data.filter((row) => row.intercept_rate !== null);
    return { element: plot, targets: plotTargets(plot, drawn, { x: (r) => r.month, y: (r) => r.intercept_rate }) };
  },
});

const launchChart = chartFrame<SampleRow>({
  title: "Sample: monthly launches by class (invented numbers)",
  subtitle: "Invented numbers, to show the chart frame.",
  source: Object.assign(document.createElement("p"), { textContent: "Invented sample figures." }),
  howToRead:
    "Each bar is one month’s published launches, stacked by weapon class. A class with no published count adds nothing to the bar, which doesn’t mean it launched nothing.",
  description: "Stacked bar chart of invented monthly launch counts for three weapon classes, May to October 2026.",
  columns: [
    { key: "month", label: "Month", type: "month" },
    { key: "class", label: "Class", type: "class" },
    { key: "launched", label: "Launched", type: "number", measure: "launched", missing: "Not published" },
  ],
  rows,
  coverage: (row) => monthPeriod(row.month),
  legend: "bar",
  pointer: "x",
  draw(data, width) {
    const plot = Plot.plot({
      ...plotDefaults,
      width,
      height: 360,
      x: { ...monthAxis, type: "band", domain: MONTHS, padding: 0.4 },
      y: titledScale({ label: "Published launches", grid: true }),
      color: classFillScale(labels),
      marks: [
        Plot.barY(data, {
          x: "month",
          y: "launched",
          fill: "class",
          order: sampleClasses,
          // A surface-colored edge separates stacked segments.
          stroke: "#ffffff",
          strokeWidth: 2,
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

const snapshot = document.getElementById("snapshot-date") as HTMLTimeElement;
snapshot.dateTime = buildInfo.snapshotDate;
snapshot.textContent = formatDate(buildInfo.snapshotDate);

installPatterns();
document.getElementById("main")!.append(rateChart, launchChart);
