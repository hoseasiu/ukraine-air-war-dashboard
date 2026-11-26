/** Night sizes by year, with each year's massive bar marked (plan §2 A2). */
import * as Plot from "@observablehq/plot";
import { chartFrame, type Target } from "../chart/chartFrame.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { formatDate, nightTable } from "../data.ts";
import { plotDefaults } from "../theme/plot.ts";
import { svgElement } from "../theme/marks.ts";
import { barValue, chartSvg, count, create, MASSIVE_DEFINITION, RESTRICTED_BAR_NOTE, NOTHING_SHOWN, strikeFootnote, svgText, type FixedView } from "./shared.ts";
import { isSubset, SIZE_BIN_WIDTH, sizeBins, type Selection, type SizeBinRow } from "./strikeData.ts";

const PANEL_HEIGHT = 150;
const TITLE_HEIGHT = 44;
const AXIS_TITLE_HEIGHT = 24;

/** "2022 (from Sep 28, 2022)" for a year the data covers only partly or the filters cut short. */
function yearLabel(row: SizeBinRow): string {
  const whole = row.from.endsWith("-01-01") && row.to.endsWith("-12-31");
  return whole ? String(row.year) : `${row.year} (nights shown: ${formatDate(row.from)} to ${formatDate(row.to)})`;
}

function barKey(): HTMLElement {
  const key = create("p", "strike-key");
  const mark = svgElement("svg", { width: 12, height: 22, "aria-hidden": "true", focusable: "false" });
  mark.append(svgElement("line", { x1: 6, x2: 6, y1: 0, y2: 22, class: "massive-rule" }));
  key.append(mark, "Dashed line: that year’s massive bar. Nights to its right were massive.");
  return key;
}

/** The same dates as yearLabel(), shorter, for a panel a third as wide. */
function shortYearLabel(row: SizeBinRow): string {
  const day = (date: string) => formatDate(date).replace(/, \d{4}$/, "");
  const whole = row.from.endsWith("-01-01") && row.to.endsWith("-12-31");
  return whole ? String(row.year) : `${row.year} (${day(row.from)} to ${day(row.to)})`;
}

/** `fixed` is a guided stop's view: panels side by side, so every year fits on a projector. */
export function salvoHistogram(selection: Selection, options: { fixed?: FixedView } = {}): HTMLElement {
  const rows = sizeBins(nightTable, selection);
  const subset = isSubset(selection.classes);
  const years = [...new Set(rows.map((row) => row.year))];
  const first = (year: number) => rows.find((row) => row.year === year)!;

  const definition =
    `${MASSIVE_DEFINITION} So the bar differs by year: a massive night in one year can be smaller than ` +
    "an ordinary night in another.";
  const classNote = subset
    ? " Some classes are off, so sizes count only the classes shown. The massive bar is defined on all counted " +
      "classes, so it isn’t drawn. Turn every class on to see it."
    : "";

  return chartFrame<SizeBinRow>({
    title: "How big is a night? Salvo sizes by year",
    howToRead:
      `Each bar counts attack nights by size, in steps of ${SIZE_BIN_WIDTH} weapons launched. All panels share both ` +
      `scales. ${definition}${classNote}`,
    description: rows.length
      ? "Histograms of weapons launched per attack night, one for each year. " +
        years
          .map((year) => {
            const row = first(year);
            const bar = row.massive_above === null ? "" : `, massive above ${barValue.format(row.massive_above)}`;
            return `${yearLabel(row)}: ${row.year_nights} nights, median size ${count.format(row.year_median)}${bar}.`;
          })
          .join(" ")
      : NOTHING_SHOWN,
    columns: [
      { key: "year", label: "Year", type: "text" },
      { key: "bin", label: "Weapons launched in the night", type: "text" },
      { key: "nights", label: "Nights", type: "number", measure: "launch_derived" },
      { key: "year_nights", label: "Nights shown in the year", type: "number", measure: "launch_derived" },
      { key: "year_median", label: "Median night that year (shown nights)", type: "number", measure: "launch_derived" },
      {
        key: "massive_above",
        label: "That year’s massive bar (massive means more)",
        type: "number",
        measure: "launch_derived",
        format: barValue.format,
        missing: "Not shown with classes off",
      },
    ],
    rows,
    coverage: (row) => ({ from: row.from, to: row.to }),
    scaleKey: subset ? undefined : barKey(),
    pointer: "xy",
    footnote: strikeFootnote(
      "A night is the reports ending on one Kyiv date, without daytime reports. A night’s size is the sum of its " +
        "published launch counts, so it can leave some out. Nights with no published count are not shown.",
      "Dates with no night are not counted as 0: they may have been quiet or unreported. A year’s bar is " +
        "calculated from all its nights, whatever months are selected. The latest year’s bar can still change.",
      RESTRICTED_BAR_NOTE,
    ),
    draw(data, width) {
      const perRow = !options.fixed ? 1 : width >= 900 ? 3 : width >= 600 ? 2 : 1;
      const panelWidth = Math.floor(width / perRow);
      // A fixed view shares its height between the rows of panels.
      const rowSpace = ((options.fixed?.height ?? 0) - AXIS_TITLE_HEIGHT) / Math.ceil(years.length / perRow);
      const panelHeight = options.fixed ? Math.max(80, Math.floor(rowSpace) - TITLE_HEIGHT) : PANEL_HEIGHT;
      const rowHeight = TITLE_HEIGHT + panelHeight;
      const height = Math.ceil(years.length / perRow) * rowHeight + AXIS_TITLE_HEIGHT;
      const svg = chartSvg(width, height);
      const targets: Target<SizeBinRow>[] = [];
      const xMax = Math.max(...data.map((row) => row.bin_to + 1), ...data.map((row) => row.massive_above ?? 0));
      const yMax = Math.max(...data.map((row) => row.nights));

      years.forEach((year, index) => {
        const left = (index % perRow) * panelWidth;
        const top = Math.floor(index / perRow) * rowHeight;
        const own = data.filter((row) => row.year === year);
        const facts = own[0]!;
        const plot = Plot.plot({
          ...plotDefaults,
          style: { ...plotDefaults.style, fontSize: "14px" },
          width: panelWidth,
          height: panelHeight,
          marginTop: 10,
          marginBottom: 28,
          x: { domain: [0, xMax], label: null, ticks: Math.min(16, Math.floor(panelWidth / 60)) },
          y: { domain: [0, yMax], label: null, ticks: 3, grid: true },
          marks: [
            Plot.rectY(own, {
              x1: "bin_from",
              x2: (row: SizeBinRow) => row.bin_to + 1,
              y: "nights",
              fill: "var(--ink-secondary)",
              insetLeft: 1,
            }),
            Plot.ruleY([0]),
          ],
        }) as SVGSVGElement & Plot.Plot;
        plot.setAttribute("x", String(left));
        plot.setAttribute("y", String(top + TITLE_HEIGHT));
        svg.append(plot);

        const bar = facts.massive_above;
        svg.append(
          svgText(left + 4, top + 18, options.fixed ? shortYearLabel(facts) : yearLabel(facts), { "font-weight": 700, "font-size": 15 }),
          svgText(
            left + 4,
            top + 36,
            `${facts.year_nights} nights · median ${count.format(facts.year_median)}` +
              (bar === null ? "" : ` · massive: more than ${barValue.format(bar)}`),
            { "font-size": 14 },
          ),
        );
        if (bar !== null) {
          const x = left + Number(plot.scale("x")!.apply(bar));
          svg.append(
            svgElement("line", {
              x1: x,
              x2: x,
              y1: top + TITLE_HEIGHT,
              y2: top + TITLE_HEIGHT + panelHeight - 28,
              class: "massive-rule",
            }),
          );
        }
        // Empty bins are in the table but have nothing to point at.
        const drawn = own.filter((row) => row.nights > 0);
        for (const target of plotTargets(plot, drawn, {
          x: (r) => (r.bin_from + r.bin_to + 1) / 2,
          y: (r) => r.nights,
        })) {
          targets.push({ ...target, x: target.x + left, y: target.y + top + TITLE_HEIGHT });
        }
      });
      svg.append(
        svgText(width / 2, height - 6, "Weapons launched in the night", { "text-anchor": "middle", "font-size": 14 }),
      );
      return { element: svg, targets };
    },
  });
}
