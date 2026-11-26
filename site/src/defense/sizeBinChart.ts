/**
 * The summary beside the saturation chart (plan §2 B2): for each year, the
 * median share not reported destroyed among nights of a similar size. One panel
 * per year, so no year depends on a color.
 */
import { chartFrame, type Target } from "../chart/chartFrame.ts";
import { formatDate, outcomeTable, rateTable } from "../data.ts";
import { chartSvg, classLabels, count, percent, strikeFootnote, svgText } from "../strikes/shared.ts";
import type { Selection } from "../strikes/strikeData.ts";
import { svgElement } from "../theme/marks.ts";
import { MIN_BIN_NIGHTS, saturationRows, SIZE_BINS, sizeBinRows, type SizeBinRow } from "./defenseData.ts";
import "./sizeBins.css";

const PANEL_TITLE = 28;
const ROW = 26;
const PANEL_GAP = 18;
const GUTTER = 24;
const LABEL = 88;
const VALUE = 104;

const nightCount = (nights: number) => `${count.format(nights)} ${nights === 1 ? "night" : "nights"}`;

export function sizeBinChart(selection: Selection): HTMLElement {
  const rows = sizeBinRows(saturationRows(outcomeTable, selection, classLabels), rateTable);
  const years = [...new Set(rows.map((row) => row.year))];
  const lastDay = new Date(Date.parse(`${rateTable.missileRatesEndBefore}-01T00:00:00Z`) - 86_400_000);
  const through = formatDate(lastDay.toISOString().slice(0, 10));
  const share = (row: SizeBinRow) =>
    row.median_not_destroyed_share === null ? "no median" : percent.format(row.median_not_destroyed_share);

  function yearSummary(year: string): string {
    const shown = rows.filter((row) => row.year === year && row.median_not_destroyed_share !== null);
    if (!shown.length) return `${year}: no size group with a median.`;
    return `${year}: ${shown.map((row) => `size ${row.bin}, ${share(row)} over ${nightCount(row.n_nights)}`).join("; ")}.`;
  }

  return chartFrame<SizeBinRow>({
    title: "Nights of similar size: median share not reported destroyed, by year",
    howToRead:
      "One panel for each year. For the nights in each size group, we take each night’s share of launches not " +
      "reported destroyed, then show the middle one (the median), with the number of nights (n). A group with " +
      `fewer than ${MIN_BIN_NIGHTS} nights has no median, which is not 0%. It stops at ${through}, as other shares ` +
      "that add classes together do. Years differ in weapons, reporting and much else, so a difference between " +
      "them doesn’t show what caused it.",
    description: rows.length
      ? "Bar charts, one for each year, of the median share of a night’s launches not reported destroyed, by night " +
        `size. ${years.map(yearSummary).join(" ")}`
      : `No chart: no night through ${through} in the months and classes shown has a size and a complete outcome.`,
    columns: [
      { key: "year", label: "Year", type: "text" },
      { key: "bin", label: "Weapons launched in the night", type: "text" },
      {
        key: "median_not_destroyed_share",
        label: "Median share not reported destroyed",
        type: "number",
        measure: "not_intercepted",
        format: (value) => percent.format(value),
        missing: "No median",
      },
      { key: "n_nights", label: "Nights in the group", type: "number", measure: "launch_derived" },
      { key: "from", label: "Year’s first night counted", type: "date" },
      { key: "to", label: "Year’s last night counted", type: "date" },
      { key: "status", label: "Median or gap", type: "text" },
    ],
    rows,
    coverage: (row) => ({ from: row.from, to: row.to }),
    pointer: "xy",
    footnote: strikeFootnote(
      "A night’s share is launched minus destroyed, divided by launched. It is not a share that hit anything: it " +
        "can include decoys, weapons still flying or unresolved, and losses to other causes. Only nights with a " +
        "point on the chart above are counted. A year can be partial: the table gives its first and last nights.",
      "Each night counts once, whatever its size, so this isn’t the share of all launches in a group. The " +
        `${MIN_BIN_NIGHTS}-night minimum is our choice. The months and weapon classes shown apply.`,
    ),
    draw(data, width) {
      const perRow = width >= 960 ? 3 : width >= 640 ? 2 : 1;
      const panelWidth = Math.floor((width - (perRow - 1) * GUTTER) / perRow);
      const panelHeight = PANEL_TITLE + SIZE_BINS.length * ROW + PANEL_GAP;
      const svg = chartSvg(width, Math.max(1, Math.ceil(years.length / perRow)) * panelHeight);
      const targets: Target<SizeBinRow>[] = [];
      const track = panelWidth - LABEL - VALUE;

      years.forEach((year, index) => {
        const left = (index % perRow) * (panelWidth + GUTTER);
        const top = Math.floor(index / perRow) * panelHeight;
        const start = left + LABEL;
        svg.append(
          svgText(left, top + 18, year, { "font-weight": 700, "font-size": 15 }),
          svgText(start, top + 18, "0%", { "font-size": 13 }),
          svgText(start + track, top + 18, "100%", { "font-size": 13, "text-anchor": "end" }),
        );
        data
          .filter((row) => row.year === year)
          .forEach((row, line) => {
            const y = top + PANEL_TITLE + line * ROW;
            const value = row.median_not_destroyed_share;
            svg.append(
              svgText(left, y + 16, row.bin, { "font-size": 13 }),
              // The full 0% to 100% track, so bars compare across years. A gap leaves it empty.
              svgElement("rect", { x: start, y: y + 3, width: track, height: 16, class: "bin-track" }),
            );
            if (value !== null) {
              svg.append(svgElement("rect", { x: start, y: y + 3, width: value * track, height: 16, class: "bin-bar" }));
            }
            const text = value === null ? `too few (n=${row.n_nights})` : `${share(row)} · n=${row.n_nights}`;
            svg.append(svgText(start + track + 8, y + 16, text, { "font-size": 13 }));
            targets.push({ x: start + (value ?? 0.5) * track, y: y + 11, rows: [row] });
          });
      });
      return { element: svg, targets };
    },
  });
}
