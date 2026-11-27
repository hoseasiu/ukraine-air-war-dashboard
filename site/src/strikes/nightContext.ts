/** One night set among all the nights of its year, for the one-night breakdown (plan §2 A3). */
import * as Plot from "@observablehq/plot";
import { liveChartFrame, type ChartSpec } from "../chart/chartFrame.ts";
import { dateBand } from "../chart/periodBandMarks.ts";
import { RESTRICTED_BAND } from "../chart/periodBands.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { formatDate, nightTable } from "../data.ts";
import { plotDefaults } from "../theme/plot.ts";
import { nightContextHeadline } from "../summary/headlineText.ts";
import { barText, barValue, count, MASSIVE_DEFINITION, RESTRICTED_BAR_NOTE, footnote, strikeSource } from "./shared.ts";
import { yearNightRows, type YearNightRow } from "./strikeData.ts";

const HEIGHT = 164;

const day = (date: string) => new Date(`${date}T00:00:00Z`);

function spec(date: string, headline: boolean): ChartSpec<YearNightRow> {
  const rows = yearNightRows(nightTable, date);
  const year = date.slice(0, 4);
  const chosen = rows.find((row) => row.date === date);
  if (!chosen) throw new Error(`No published launch count for the night ending ${date}`);
  const bar = barText(chosen.massive_above);
  return {
    title: `That night among ${year}’s nights`,
    headline: headline ? nightContextHeadline(rows, date) : undefined,
    subtitle: `The thick bar is the chosen night. The dashed line is ${year}’s massive bar: more than ${bar}.`,
    howToRead:
      `Each thin bar is a night in ${year}, placed by its date; its height is the weapons launched. The thick black ` +
      `bar under the triangle is the night ending ${formatDate(date)}. The dashed line is ${year}’s massive bar: ` +
      `massive nights had more than ${bar}. This strip counts all counted classes, whatever classes are shown. ` +
      MASSIVE_DEFINITION,
    description:
      `Chart of weapons launched on each of ${rows.length} nights in ${year}. The night ending ${formatDate(date)} ` +
      `had ${count.format(chosen.total)}; the year’s massive bar is ${bar}.`,
    columns: [
      { key: "date", label: "Night ending", type: "date" },
      { key: "total", label: "Launched, all counted classes", type: "number", measure: "launched" },
      { key: "massive", label: "Massive night", type: "text" },
      {
        key: "massive_above",
        label: "That year’s massive bar (massive means more)",
        type: "number",
        measure: "launch_derived",
        format: barValue.format,
      },
      { key: "shown", label: "In the breakdown", type: "text" },
    ],
    rows,
    coverage: (row) => ({ from: row.date, to: row.date }),
    pointer: "x",
    source: strikeSource(),
    footnote: footnote(
      "A night’s size is the sum of its published launch counts, so it can leave some out. A date with no bar has " +
        "no night with a published count: it may have been quiet or unreported. A year’s bar uses all its nights, " +
        "and the latest year’s can still change.",
      RESTRICTED_BAR_NOTE,
    ),
    draw(data, width) {
      const picked = data.filter((row) => row.date === date);
      const start = day(`${year}-01-01`);
      const end = day(`${Number(year) + 1}-01-01`);
      const barSize = chosen.massive_above;
      const top = Math.max(barSize, ...data.map((row) => row.total)) * 1.2;
      // The chosen night's label turns inward near either end of the year.
      const along = (day(date).getTime() - start.getTime()) / (end.getTime() - start.getTime());
      const anchor = along > 0.75 ? "end" : along < 0.25 ? "start" : "middle";
      const x = (row: YearNightRow) => day(row.date);
      const plot = Plot.plot({
        ...plotDefaults,
        style: { ...plotDefaults.style, fontSize: "13px" },
        width,
        height: HEIGHT,
        marginLeft: 48,
        // At least half a tooltip button, so one on Dec 31 doesn't make the chart scroll.
        marginRight: 14,
        // Room for the band's label above the chosen night's.
        marginTop: 36,
        marginBottom: 26,
        x: { type: "utc", domain: [start, end], label: null, ticks: width >= 700 ? 12 : 4, tickFormat: "%b" },
        y: { domain: [0, top], label: null, ticks: 3, grid: true },
        marks: [
          Plot.ruleX(data, { x, y: "total", stroke: "#767676", strokeWidth: 1.5 }),
          Plot.ruleX(picked, { x, y: "total", stroke: "var(--ink)", strokeWidth: 4 }),
          Plot.ruleY([barSize], { stroke: "var(--ink)", strokeWidth: 1.5, strokeDasharray: "6 3" }),
          Plot.dot(picked, { x, y: "total", symbol: "triangle", r: 5, dy: -7, rotate: 180, fill: "var(--ink)" }),
          Plot.text(picked, {
            x,
            y: "total",
            text: (row: YearNightRow) => `${formatDate(row.date)}: ${count.format(row.total)}`,
            textAnchor: anchor,
            dy: -18,
            fontWeight: 700,
            fill: "var(--ink)",
            stroke: "#ffffff",
            strokeWidth: 4,
            paintOrder: "stroke",
          }),
          Plot.ruleY([0]),
        ],
      });
      dateBand(plot, RESTRICTED_BAND, 12);
      const targets = plotTargets(plot, data, { x, y: (row) => row.total });
      return { element: plot, targets };
    },
  };
}

export function nightContext(date: string, headline: boolean): { element: HTMLElement; update(date: string): void } {
  const chart = liveChartFrame(spec(date, headline));
  return { element: chart.element, update: (next) => chart.update(spec(next, headline)) };
}
