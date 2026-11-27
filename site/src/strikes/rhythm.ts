/** The calendar of nights, day-of-week bars and gaps between massive nights (plan §2 A4). */
import * as Plot from "@observablehq/plot";
import { chartFrame, formatMonth, type Target } from "../chart/chartFrame.ts";
import { drawBand, dateBand } from "../chart/periodBandMarks.ts";
import { RESTRICTED_BAND } from "../chart/periodBands.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { nightTable } from "../data.ts";
import { svgElement } from "../theme/marks.ts";
import { NIGHT_BINS, nightBin } from "../theme/nightScale.ts";
import { plotDefaults, titledScale } from "../theme/plot.ts";
import { calendarHeadline, gapHeadline, weekdayHeadline } from "../summary/headlineText.ts";
import { barValue, chartSvg, count, create, MASSIVE_DEFINITION, RESTRICTED_BAR_NOTE, NOTHING_SHOWN, footnote, strikeSource, svgText, yearBars, type FixedView } from "./shared.ts";
import {
  allNights,
  barIsRestricted,
  isSubset,
  massiveGaps,
  monthsShown,
  nightsInRange,
  weekdayIndex,
  weekdayRows,
  WEEKDAYS,
  type GapRow,
  type Night,
  type Selection,
  type WeekdayRow,
} from "./strikeData.ts";

const DAY = 86_400_000;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface CalendarRow extends Night {
  massive: string;
  /** The bar for the night's year. */
  massive_above: number;
  classes_not_split: boolean;
}

function calendarKey(): HTMLElement {
  const key = create("div");
  const list = create("ul", "chart-legend");
  list.setAttribute("aria-label", "Key: weapons launched in the night");
  const item = (label: string, className: string, fill?: string, massive = false) => {
    const entry = create("li");
    const svg = svgElement("svg", { width: 18, height: 18, "aria-hidden": "true", focusable: "false" });
    const rect = svgElement("rect", { x: 1, y: 1, width: 16, height: 16, class: className });
    if (fill) rect.setAttribute("fill", fill);
    svg.append(rect);
    if (massive) svg.append(...massiveMark(9, 9, 16));
    entry.append(svg, label);
    list.append(entry);
  };
  for (const bin of NIGHT_BINS) item(bin.label, "calendar-night", bin.color);
  item("Massive night: dot in a ring", "calendar-night", NIGHT_BINS[NIGHT_BINS.length - 1]!.color, true);
  item("No night in the data (quiet or unreported)", "calendar-none");
  key.append(create("p", "strike-key-title", "Weapons launched in the night"), list);
  return key;
}

/** A dark ring and a white dot over a wider white ring, so it shows on every step, light or dark. */
function massiveMark(x: number, y: number, cell: number): SVGElement[] {
  const circle = (r: number, className: string) => svgElement("circle", { cx: x, cy: y, r: cell * r, class: className });
  return [circle(0.34, "massive-halo"), circle(0.34, "massive-ring"), circle(0.15, "massive-dot")];
}

/** The line left of a month's first day. It steps around the week when the month starts partway down it. */
function monthEdge(x: number, top: number, cell: number, weekday: number): SVGPathElement {
  const bottom = top + 7 * cell;
  const d = weekday ? `M${x + cell},${top}V${top + weekday * cell}H${x}V${bottom}` : `M${x},${top}V${bottom}`;
  return svgElement("path", { d, class: "calendar-month" });
}

/** `fixed` is a guided stop's view: years in two columns, so they fit on a projector. */
export function nightCalendar(selection: Selection, options: { fixed?: boolean } = {}): HTMLElement {
  const nights = nightsInRange(allNights(nightTable, selection.classes), selection);
  const rows: CalendarRow[] = nights
    .filter((night) => night.reported)
    .map((night) => ({
      ...night,
      massive: night.is_massive === null ? "Massive: unknown" : night.is_massive ? "Massive night" : "Not massive",
      massive_above: nightTable.years.find((year) => year.year === Number(night.date.slice(0, 4)))!.massive_above,
      classes_not_split: isSubset(selection.classes),
      ballistic_restricted:
        night.ballistic_restricted || barIsRestricted(nightTable, Number(night.date.slice(0, 4))),
    }));
  const months = rows.length ? monthsShown(nightTable, selection.from, selection.to) : [];
  const years = [...new Set(months.map((month) => Number(month.slice(0, 4))))];
  const subset = isSubset(selection.classes);

  return chartFrame<CalendarRow>({
    title: "Calendar of attack nights",
    headline: options.fixed ? undefined : calendarHeadline(rows, nightTable, months),
    subtitle: `A square for each date: darker means more weapons launched that night. ${yearBars(rows.map((row) => row.date))}`,
    howToRead:
      "Each square is a date, in weeks running left to right from Monday at the top, with a line between months. " +
      "Darker squares had more weapons launched in the night ending that day. An outlined empty square has no night in the data for the " +
      `classes shown, which may mean it was quiet or unreported. ${MASSIVE_DEFINITION}` +
      (subset
        ? " Shades count only the classes shown; the massive mark still comes from all counted classes."
        : ""),
    description: rows.length
      ? `Calendar heatmap of weapons launched per night, ${formatMonth(months[0]!)} to ` +
        `${formatMonth(months[months.length - 1]!)}: ${rows.length} nights, ` +
        `${rows.filter((row) => row.is_massive).length} of them massive. Each night is a row in the table; ` +
        "dates without a row have no night in the data."
      : NOTHING_SHOWN,
    columns: [
      { key: "date", label: "Night ending", type: "date" },
      {
        key: "size",
        label: subset ? "Launched, classes shown" : "Launched",
        type: "number",
        measure: "launched",
        missing: "Not published",
      },
      {
        key: "n_unknown_launched",
        label: "Reports with no published launch count",
        type: "number",
        measure: "launch_derived",
      },
      { key: "massive", label: "Massive night (all counted classes)", type: "text" },
      { key: "massive_above", label: "That year’s massive bar (massive means more)", type: "number", measure: "launch_derived", format: barValue.format },
    ],
    rows,
    coverage: (row) => ({ from: row.date, to: row.date }),
    scaleKey: calendarKey(),
    pointer: "shape",
    source: strikeSource(),
    footnote: footnote(
      "A night is the reports ending on one Kyiv date, without daytime reports. " +
        (options.fixed ? "" : "Colors mean the same whatever the filters show. ") +
        "A calendar can suggest seasons, but the data spans only about four winters, while totals and " +
        "reporting changed a great deal, so this dashboard doesn’t claim a seasonal pattern.",
      RESTRICTED_BAR_NOTE,
    ),
    draw(data, width) {
      const left = 44;
      const perRow = options.fixed && width >= 900 ? 2 : 1;
      const columnWidth = Math.floor(width / perRow);
      // The squares fill the width. A guided stop caps them, so its years stay short enough for the screen.
      const weeks = Math.max(
        ...years.map((year) => {
          const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY;
          return Math.ceil((weekdayIndex(`${year}-01-01`) + days) / 7);
        }),
      );
      const fit = (columnWidth - left - 2 - (perRow - 1) * 12) / weeks;
      const cell = Math.max(7, options.fixed ? Math.min(20, fit) : fit);
      const block = cell * 7 + 44;
      const svg = chartSvg(width, Math.ceil(years.length / perRow) * block);
      const byDate = new Map(data.map((row) => [row.date, row]));
      const targets: Target<CalendarRow>[] = [];

      years.forEach((year, index) => {
        const top = Math.floor(index / perRow) * block + 36;
        const columnLeft = (index % perRow) * columnWidth;
        const jan1 = Date.UTC(year, 0, 1);
        const offset = weekdayIndex(`${year}-01-01`);
        svg.append(svgText(columnLeft, top - 22, String(year), { "font-weight": 700, "font-size": 15 }));
        for (const day of [0, 3, 6]) {
          svg.append(svgText(columnLeft, top + cell * (day + 0.8), WEEKDAYS[day]!.slice(0, 3), { "font-size": 12 }));
        }

        const edges: SVGElement[] = [];
        // The weeks of this year's dates that fall in the restricted period, as pixels.
        let restrictedFrom: number | undefined;
        let restrictedTo = 0;
        for (let time = jan1; time < Date.UTC(year + 1, 0, 1); time += DAY) {
          const date = new Date(time).toISOString().slice(0, 10);
          const month = date.slice(0, 7);
          if (!months.includes(month) || date < nightTable.firstDay || date > nightTable.lastDay) continue;
          const position = (time - jan1) / DAY + offset;
          const x = columnLeft + left + Math.floor(position / 7) * cell;
          const y = top + (position % 7) * cell;
          if (date >= RESTRICTED_BAND.from) {
            restrictedFrom ??= x;
            restrictedTo = x + cell;
          }
          if (date.endsWith("-01")) {
            // Names sit over the week the month starts in.
            svg.append(svgText(x, top - 6, MONTH_NAMES[Number(date.slice(5, 7)) - 1]!, { "font-size": 12 }));
            if (!date.endsWith("-01-01")) edges.push(monthEdge(x, top, cell, position % 7));
          }
          const row = byDate.get(date);
          const square = svgElement("rect", { x: x + 1, y: y + 1, width: cell - 2, height: cell - 2 });
          if (!row) square.setAttribute("class", "calendar-none");
          else {
            square.setAttribute("class", row.size === null ? "calendar-unknown" : "calendar-night");
            if (row.size !== null) square.setAttribute("fill", nightBin(row.size).color);
          }
          if (!row) {
            svg.append(square);
            continue;
          }
          const shape = svgElement("g");
          shape.append(square);
          if (row.is_massive) shape.append(...massiveMark(x + cell / 2, y + cell / 2, cell));
          svg.append(shape);
          targets.push({ x: x + cell / 2, y: y + cell / 2, rows: [row], shape });
        }
        // Over the squares, in the gaps between them.
        svg.append(...edges);
        if (restrictedFrom !== undefined) {
          // Behind the squares, so it shows around the month names and below the week.
          drawBand(svg, RESTRICTED_BAND.label, {
            x0: restrictedFrom,
            x1: restrictedTo,
            top: top - 18,
            bottom: top + 7 * cell + 4,
            labelY: top - 22,
          });
        }
      });
      return { element: svg, targets };
    },
  });
}

const WEEKDAY_PANEL = 250;

export function weekdayChart(selection: Selection, options: { fixed?: FixedView } = {}): HTMLElement {
  const rows = weekdayRows(nightTable, selection);
  const subset = isSubset(selection.classes);
  const sizeLabel = subset ? "Median launched per night, classes shown" : "Median launched per night";
  return chartFrame<WeekdayRow>({
    title: "Day of the week",
    headline: options.fixed ? undefined : weekdayHeadline(rows),
    subtitle: `Nights grouped by the weekday they end on. ${yearBars(
      nightsInRange(allNights(nightTable, selection.classes), selection)
        .filter((night) => night.size !== null)
        .map((night) => night.date),
    )}`,
    howToRead:
      "Nights are grouped by the weekday of the date they end on. The first panel is the median night size, the " +
      "second how many nights were massive. These describe the months shown; they don’t show why days differ, or " +
      `that a difference would repeat. ${MASSIVE_DEFINITION}` +
      (subset ? " The massive count still comes from all counted classes." : ""),
    description: rows.length
      ? "Two bar charts by weekday of the date each night ends on. " +
        rows
          .map(
            (row) =>
              `${row.weekday}: median ${row.median_size === null ? "none" : count.format(row.median_size)}, ` +
              `${row.massive_nights} massive of ${row.nights} nights.`,
          )
          .join(" ")
      : NOTHING_SHOWN,
    columns: [
      { key: "weekday", label: "Night ends on", type: "text" },
      { key: "nights", label: "Nights", type: "number", measure: "launch_derived" },
      { key: "median_size", label: sizeLabel, type: "number", measure: "launch_derived", missing: "No nights" },
      { key: "massive_nights", label: "Massive nights", type: "number", measure: "launch_derived" },
    ],
    rows,
    coverage: (row) => ({ from: row.from, to: row.to }),
    pointer: "xy",
    source: strikeSource(),
    footnote: footnote(
      "A median over several years mixes years in which a typical night had very different sizes. " +
        (options.fixed ? "" : "Narrow the months to look at one year. ") +
        "Massive nights are marked against their own year’s bar.",
      RESTRICTED_BAR_NOTE,
    ),
    draw(data, width) {
      const perRow = width >= 700 ? 2 : 1;
      const panelWidth = Math.floor(width / perRow);
      const panels = [
        { title: sizeLabel, value: (row: WeekdayRow) => row.median_size },
        { title: "Massive nights", value: (row: WeekdayRow) => row.massive_nights },
      ];
      const panelHeight = options.fixed ? Math.max(180, options.fixed.height - 60) : WEEKDAY_PANEL;
      const height = Math.ceil(panels.length / perRow) * (panelHeight + 28);
      const svg = chartSvg(width, height);
      const targets: Target<WeekdayRow>[] = [];

      panels.forEach((panel, index) => {
        const left = (index % perRow) * panelWidth;
        const top = Math.floor(index / perRow) * (panelHeight + 28);
        const plot = Plot.plot({
          ...plotDefaults,
          style: { ...plotDefaults.style, fontSize: "14px" },
          width: panelWidth,
          height: panelHeight,
          marginLeft: 48,
          marginTop: 12,
          marginBottom: 32,
          x: {
            type: "band",
            domain: [...WEEKDAYS],
            label: null,
            tickFormat: (day: string) => day.slice(0, 3),
          },
          y: { label: null, grid: true, ticks: 5, domain: [0, Math.max(1, ...data.map((r) => panel.value(r) ?? 0))] },
          marks: [
            Plot.barY(data, { x: "weekday", y: panel.value, fill: "var(--ink-secondary)" }),
            Plot.ruleY([0]),
          ],
        }) as SVGSVGElement & Plot.Plot;
        for (const target of plotTargets(plot, data, { x: (r) => r.weekday, y: (r) => panel.value(r) ?? 0 })) {
          targets.push({ ...target, x: target.x + left, y: target.y + top + 28 });
        }
        plot.setAttribute("x", String(left));
        plot.setAttribute("y", String(top + 28));
        svg.append(svgText(left + 4, top + 20, panel.title, { "font-weight": 700, "font-size": 14 }), plot);
      });
      return { element: svg, targets };
    },
  });
}

export function massiveGapChart(selection: Pick<Selection, "from" | "to">): HTMLElement {
  const rows = massiveGaps(nightTable, selection);
  const gaps = rows.flatMap((row) => (row.gap_days === null ? [] : [row.gap_days]));
  return chartFrame<GapRow>({
    title: "Days between massive nights",
    headline: gapHeadline(rows),
    subtitle: `Days from each massive night back to the one before. ${yearBars(rows.map((row) => row.date))}`,
    howToRead:
      "Each point is a massive night, placed by its date. Its height is the number of days since the massive night " +
      `before it. ${MASSIVE_DEFINITION} Because the bar differs by year, a change in ` +
      "gaps doesn’t compare attacks of the same size. The weapon-class filter doesn’t apply here.",
    description: rows.length
      ? `Chart of the days between massive nights: ${rows.length} massive nights in the months shown` +
        (gaps.length ? `, with gaps from ${Math.min(...gaps)} to ${Math.max(...gaps)} days.` : ".")
      : "No chart: there is no massive night in the months chosen.",
    columns: [
      { key: "date", label: "Massive night ending", type: "date" },
      { key: "previous", label: "Massive night before it", type: "date", missing: "First in the data" },
      {
        key: "gap_days",
        label: "Days since the massive night before",
        type: "number",
        measure: "launch_derived",
        missing: "No earlier one",
      },
      { key: "total", label: "Launched that night, all counted classes", type: "number", measure: "launched" },
      { key: "massive_above", label: "That year’s massive bar (massive means more)", type: "number", measure: "launch_derived", format: barValue.format },
    ],
    rows,
    coverage: (row) => ({ from: row.previous ?? row.date, to: row.date }),
    pointer: "xy",
    source: strikeSource(),
    footnote: footnote(
      "A gap is counted from the massive night before, even if that night is outside the months shown. The first " +
        "massive night in the data has no gap, so it has no point; it is in the table.",
      RESTRICTED_BAR_NOTE,
    ),
    draw(data, width) {
      const drawn = data.filter((row) => row.gap_days !== null);
      const months = monthsShown(nightTable, selection.from, selection.to);
      const start = new Date(`${months[0]}-01T00:00:00Z`);
      const end = new Date(`${months[months.length - 1]}-01T00:00:00Z`);
      end.setUTCMonth(end.getUTCMonth() + 1);
      const day = (row: GapRow) => new Date(`${row.date}T00:00:00Z`);
      const plot = Plot.plot({
        ...plotDefaults,
        width,
        height: 340,
        x: { type: "utc", domain: [start, end], label: null, ticks: Math.max(2, Math.floor(width / 110)) },
        y: titledScale({ label: "Days since the massive night before", grid: true, zero: true }),
        marks: [
          Plot.ruleX(drawn, { x: day, y: "gap_days", stroke: "var(--ink-secondary)" }),
          Plot.dot(drawn, { x: day, y: "gap_days", r: 4.5, fill: "var(--ink)", stroke: "#ffffff" }),
          Plot.ruleY([0]),
        ],
      });
      dateBand(plot, RESTRICTED_BAND);
      const targets = plotTargets(plot, drawn, { x: day, y: (r) => r.gap_days });
      return { element: plot, targets };
    },
  });
}

