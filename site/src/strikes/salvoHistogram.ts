/**
 * Night sizes by year, one row for each, with its median and massive bar marked
 * (plan §2 A2). The rows share both scales.
 */
import { chartFrame, type Target } from "../chart/chartFrame.ts";
import { formatDate, nightTable } from "../data.ts";
import { svgElement } from "../theme/marks.ts";
import { barText, barValue, chartSvg, count, MASSIVE_DEFINITION, RESTRICTED_BAR_NOTE, NOTHING_SHOWN, create, strikeFootnote, svgText, type FixedView } from "./shared.ts";
import { isSubset, SIZE_BIN_WIDTH, sizeBins, sizeCap, type Selection, type SizeBinRow } from "./strikeData.ts";

const ROW_HEIGHT = 56;
/** Room for the two lines of text a guided stop's row has. */
const MIN_ROW_HEIGHT = 40;
const AXIS_HEIGHT = 44;
/** The column of year labels, left of the rows. A guided stop's is wider, for two longer lines. */
const LABEL_WIDTH = 190;
const FIXED_LABEL_WIDTH = 250;
/** The overflow bin sits apart from the axis, after a gap. */
const OVERFLOW_GAP = 20;
const OVERFLOW_WIDTH = 40;
/** A bin with any night is drawn at least this tall, so one night doesn't vanish. */
const MIN_BAR = 2;

/** "2022 (from Sep 28, 2022)" for a year the data covers only partly or the filters cut short. */
function yearLabel(row: SizeBinRow): string {
  const whole = row.from.endsWith("-01-01") && row.to.endsWith("-12-31");
  return whole ? String(row.year) : `${row.year} (nights shown: ${formatDate(row.from)} to ${formatDate(row.to)})`;
}

/** The same dates as yearLabel(), shorter, for the column of labels. */
function shortYearLabel(row: SizeBinRow): string {
  const day = (date: string) => formatDate(date).replace(/, \d{4}$/, "");
  const whole = row.from.endsWith("-01-01") && row.to.endsWith("-12-31");
  return whole ? String(row.year) : `${row.year} (${day(row.from)} to ${day(row.to)})`;
}

/** A line down a row: dashed for the massive bar, solid with a triangle on top for the median. */
function marker(x: number, top: number, bottom: number, kind: "massive" | "median"): SVGElement[] {
  const line = svgElement("line", { x1: x, x2: x, y1: top, y2: bottom, class: `${kind}-rule` });
  if (kind === "massive") return [line];
  return [line, svgElement("path", { d: `M${x - 5},${top}h10l-5,7z`, class: "median-head" })];
}

function sizeKey(massive: boolean): HTMLElement {
  const key = create("ul", "chart-legend");
  key.setAttribute("aria-label", "Key");
  const item = (kind: "massive" | "median", label: string) => {
    const entry = create("li");
    const svg = svgElement("svg", { width: 12, height: 22, "aria-hidden": "true", focusable: "false" });
    svg.append(...marker(6, 0, 22, kind));
    entry.append(svg, label);
    key.append(entry);
  };
  item("median", "Solid line with a triangle: that year’s median night");
  if (massive) item("massive", "Dashed line: that year’s massive bar");
  return key;
}

/** `fixed` is a guided stop's view: rows share the height it gives, so every year fits on a projector. */
export function salvoHistogram(selection: Selection, options: { fixed?: FixedView } = {}): HTMLElement {
  const rows = sizeBins(nightTable, selection);
  const subset = isSubset(selection.classes);
  const years = [...new Set(rows.map((row) => row.year))];
  const first = (year: number) => rows.find((row) => row.year === year)!;
  const cap = sizeCap(nightTable);

  const classNote = subset
    ? " Some classes are off, so sizes count only the classes shown. The massive bar is defined on all counted " +
      "classes, so it isn’t drawn. Turn every class on to see it."
    : " Nights right of the dashed line were massive.";

  return chartFrame<SizeBinRow>({
    title: "How big is a night? Salvo sizes by year",
    howToRead:
      `Each row’s bars count one year’s nights by weapons launched, in steps of ${SIZE_BIN_WIDTH}; nights of ${cap} ` +
      `or more share the last bar. All rows share both scales. ${MASSIVE_DEFINITION} So the bar differs by ` +
      `year.${classNote}`,
    description: rows.length
      ? "Histograms of weapons launched per attack night, one row for each year. " +
        years
          .map((year) => {
            const row = first(year);
            const bar = row.massive_above === null ? "" : `, massive above ${barText(row.massive_above)}`;
            return (
              `${yearLabel(row)}: ${row.year_nights} nights, median size ${count.format(row.year_median)}, ` +
              `largest ${count.format(row.year_max)}${bar}.`
            );
          })
          .join(" ")
      : NOTHING_SHOWN,
    columns: [
      { key: "year", label: "Year", type: "text" },
      { key: "bin", label: "Weapons launched in the night", type: "text" },
      { key: "nights", label: "Nights", type: "number", measure: "launch_derived" },
      { key: "year_nights", label: "Nights shown in the year", type: "number", measure: "launch_derived" },
      { key: "year_median", label: "Median night that year (shown nights)", type: "number", measure: "launch_derived" },
      { key: "year_max", label: "Largest night shown that year", type: "number", measure: "launch_derived" },
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
    scaleKey: sizeKey(!subset),
    pointer: "shape",
    footnote: strikeFootnote(
      "A night is the reports ending on one Kyiv date, without daytime reports. A night’s size is the sum of its " +
        "published launch counts, so it can leave some out. Nights with no published count are not shown.",
      "Dates with no night are not counted as 0: they may have been quiet or unreported. A year’s bar is " +
        "calculated from all its nights, whatever months are selected. The latest year’s bar can still change.",
      `The number over a row’s tallest bar, and over its “${cap} or more” bar, counts nights. A bar with any night ` +
        "is drawn tall enough to see, so the shortest bars look a little larger than they are. Labels round a " +
        "massive bar down to a whole number, which marks the same nights; the table has it in full.",
      RESTRICTED_BAR_NOTE,
    ),
    draw(data, width) {
      const rowHeight = options.fixed
        ? Math.max(MIN_ROW_HEIGHT, Math.floor((options.fixed.height - AXIS_HEIGHT) / years.length))
        : ROW_HEIGHT;
      const svg = chartSvg(width, years.length * rowHeight + AXIS_HEIGHT);
      const targets: Target<SizeBinRow>[] = [];
      const overflowLeft = width - OVERFLOW_WIDTH - 4;
      const axisRight = overflowLeft - OVERFLOW_GAP;
      const labelWidth = options.fixed ? FIXED_LABEL_WIDTH : LABEL_WIDTH;
      const x = (size: number) => labelWidth + (size / cap) * (axisRight - labelWidth);
      const yMax = Math.max(...data.map((row) => row.nights));
      const rule = (x1: number, x2: number, y: number) =>
        svgElement("line", { x1, x2, y1: y, y2: y, class: "size-base" });

      years.forEach((year, index) => {
        const top = index * rowHeight;
        const base = top + rowHeight - 3;
        // Leaves room above the tallest bar for its count.
        const barSpace = rowHeight - 20;
        const own = data.filter((row) => row.year === year);
        const facts = own[0]!;
        const tallest = own.reduce((best, row) => (row.nights > best.nights ? row : best));

        const nights = `${facts.year_nights} nights`;
        const middle = `median ${count.format(facts.year_median)}`;
        const massive = facts.massive_above === null ? [] : [`massive: more than ${barText(facts.massive_above)}`];
        // A guided stop's rows are short, so its label takes two lines instead of three.
        const lines = options.fixed
          ? [`${shortYearLabel(facts)} · ${nights}`, [middle, ...massive].join(" · ")]
          : [shortYearLabel(facts), `${nights} · ${middle}`, ...massive];
        lines.forEach((line, n) => {
          const style: Record<string, string | number> = n === 0 ? { "font-weight": 700, "font-size": 14 } : { "font-size": 13 };
          svg.append(svgText(0, top + (options.fixed ? 17 : 18) + n * 16, line, style));
        });

        const counts: SVGElement[] = [];
        for (const row of own) {
          // Empty bins are in the table but have nothing to draw or point at.
          if (!row.nights) continue;
          const left = row.bin_to === null ? overflowLeft : x(row.bin_from);
          const barWidth = row.bin_to === null ? OVERFLOW_WIDTH : x(row.bin_from + SIZE_BIN_WIDTH) - left;
          const tall = Math.max(MIN_BAR, (row.nights / yMax) * barSpace);
          const shape = svgElement("g");
          shape.append(
            svgElement("rect", { x: left + 0.5, y: base - tall, width: barWidth - 1, height: tall, class: "size-bar" }),
            // The whole height of the row picks the bin, so a short bar is as easy to point at as a tall one.
            svgElement("rect", { x: left, y: top, width: barWidth, height: rowHeight, fill: "transparent" }),
          );
          svg.append(shape);
          targets.push({ x: left + barWidth / 2, y: base - tall, rows: [row], shape });
          if (row === tallest || row.bin_to === null) {
            counts.push(
              svgText(left + barWidth / 2, base - tall - 3, count.format(row.nights), {
                "text-anchor": "middle",
                "font-size": 12,
                class: "size-count",
              }),
            );
          }
        }

        svg.append(rule(x(0), axisRight, base), rule(overflowLeft, overflowLeft + OVERFLOW_WIDTH, base));
        svg.append(...marker(x(facts.year_median), top + 6, base, "median"));
        if (facts.massive_above !== null) svg.append(...marker(x(facts.massive_above), top + 6, base, "massive"));
        // Counts go on top of the lines.
        svg.append(...counts);
      });

      const axisY = years.length * rowHeight;
      const step = axisRight - labelWidth >= 420 ? 100 : 200;
      const label = (at: number, y: number, text: string, size = 13) =>
        svgText(at, y, text, { "text-anchor": "middle", "font-size": size });
      for (let size = 0; size <= cap; size += step) {
        svg.append(svgElement("line", { x1: x(size), x2: x(size), y1: axisY, y2: axisY + 5, class: "size-base" }));
        svg.append(label(x(size), axisY + 20, count.format(size)));
      }
      svg.append(
        label(overflowLeft + OVERFLOW_WIDTH / 2, axisY + 20, `${cap}+`),
        label((labelWidth + axisRight) / 2, axisY + 40, "Weapons launched in the night", 14),
      );
      return { element: svg, targets };
    },
  });
}
