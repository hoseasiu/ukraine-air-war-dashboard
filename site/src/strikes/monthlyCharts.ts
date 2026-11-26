/** Monthly launches stacked by class, and the class mix as small multiples (plan §2 A1). */
import * as Plot from "@observablehq/plot";
import { chartFrame, formatMonth, liveChartFrame, type ChartSpec, type Target } from "../chart/chartFrame.ts";
import { monthPeriod, type ColumnSpec } from "../chart/flags.ts";
import { monthBand } from "../chart/periodBandMarks.ts";
import { RESTRICTED_BAND } from "../chart/periodBands.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { drawMarkerRules, drawMarkers, eventKey, MARKER_ROW } from "../annotations/eventMarkers.ts";
import { placeMarkers } from "../annotations/markerLayout.ts";
import { annotations, formatDate, monthlyTable } from "../data.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";
import { classFillScale, plotDefaults } from "../theme/plot.ts";
import { chartSvg, classLabels, create, monthAxisTicks, percent, footnote, strikeSource, svgText, type FixedView } from "./shared.ts";
import { launchPanels, monthRows, monthsShown, type MonthChartRow, type Selection } from "./strikeData.ts";

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

function monthTotals(rows: readonly MonthChartRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.month, (totals.get(row.month) ?? 0) + (row.launched ?? 0));
  return totals;
}

function largestMonth(rows: readonly MonthChartRow[]): string {
  const [month, total] = [...monthTotals(rows)].sort((a, b) => b[1] - a[1])[0]!;
  return `${formatMonth(month)}, with ${total.toLocaleString("en-US")}`;
}

interface BarsOptions {
  months: readonly string[];
  width: number;
  height: number;
  marginTop: number;
  /** Month labels under the axis. A panel above another one leaves them to it. */
  monthLabels: boolean;
}

/** One plot of stacked monthly bars. */
function monthBars(data: readonly MonthChartRow[], { months, width, height, marginTop, monthLabels }: BarsOptions) {
  const ticks = monthAxisTicks(months, width);
  return Plot.plot({
    ...plotDefaults,
    width,
    height,
    marginTop,
    marginBottom: monthLabels ? 32 : 8,
    x: { type: "band", domain: months, padding: 0.15, label: null, ...ticks, ...(monthLabels ? {} : { axis: null }) },
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
  }) as SVGSVGElement & Plot.Plot;
}

/** The two panels' heights between their margins, and the room for each panel's name. */
const SPLIT_PLOT = { drones: 250, missiles: 220 } as const;
const SPLIT_TITLE = 24;

export interface MonthlyChartOptions {
  /** A guided stop's view: one stacked chart sized to the screen, with no wording about filters. */
  fixed?: FixedView;
  /** Numbered markers for the cited events, with their dates and citations under the chart. */
  events?: boolean;
  /** Offers a checkbox that turns the markers on and off, and is told each change. */
  onEventsChange?: (events: boolean) => void;
}

/**
 * Monthly launches by class. The tab shows drones and the other classes in two
 * panels, each on its own scale. A guided stop's view stacks every class in one
 * chart, as approved for the stops (#21).
 */
export function monthlyLaunchChart(selection: Selection, options: MonthlyChartOptions = {}): HTMLElement {
  const rows = monthRows(monthlyTable, selection, formatDate);
  const months = monthsShown(monthlyTable, selection.from, selection.to);
  // One class has no legend, so the title has to name it.
  const only = selection.classes.length === 1 ? classLabels[selection.classes[0]!] : null;
  const panels = options.fixed ? [] : launchPanels(rows);
  const split = panels.length > 1;
  const placed = placeMarkers(annotations, months);
  let events = options.events ?? false;

  function describe(): string {
    if (!rows.length) return "No chart: the chosen months and classes have no strike reports.";
    const span = `${formatMonth(months[0]!)} to ${formatMonth(months[months.length - 1]!)}`;
    if (!split) {
      return (
        `Stacked bar chart of published launches per month by weapon class, ${span}. ` +
        `Most in one month: ${largestMonth(rows)} for the classes shown.`
      );
    }
    return (
      `Two bar charts of published launches per month, ${span}, one above the other, each on its own scale. ` +
      panels.map((panel) => `${panel.title}: most in one month, ${largestMonth(panel.rows)}.`).join(" ")
    );
  }

  function spec(): ChartSpec<MonthChartRow> {
    const markers = events ? placed : [];
    const markerSpace = markers.length ? (Math.max(...markers.map((marker) => marker.row)) + 1) * MARKER_ROW : 0;
    return {
      title: only ? `Monthly launches: ${only}` : "Monthly launches by weapon class",
      subtitle: split
        ? "Published launches in each month: drones above, missile and mixed classes below. Each panel has its own scale."
        : only
          ? "Published launches in this class, month by month."
          : "Published launches in each month, stacked by weapon class.",
      howToRead:
        (only
          ? "Each bar is one month’s published launches in this class, daytime reports included. "
          : "Each bar is one month’s published launches, stacked by weapon class, daytime reports included. ") +
        (split
          ? "The two panels share the months but not the vertical scale, because drones far outnumber missiles in " +
            "most months. Read each height from its own panel’s axis. "
          : "") +
        (markers.length ? "Each numbered marker sits over the month of an event listed under the chart. " : "") +
        "The first and last months of the data are partial.",
      description: describe(),
      columns: [...BASE_COLUMNS, ...END_COLUMNS],
      rows,
      coverage: (row) => monthPeriod(row.month),
      legend: "bar",
      pointer: "x",
      source: strikeSource(),
      footnote: footnote(NOT_ZERO),
      draw(data, width) {
        const top = plotDefaults.marginTop + markerSpace;
        // With markers, the band's label goes above them, on the axis title's line.
        const labelY = markers.length ? 14 : undefined;
        if (!split) {
          const height = options.fixed?.height ?? 420 + markerSpace;
          const plot = monthBars(data, { months, width, height, marginTop: top, monthLabels: true });
          // One target per month, at the top of its bar, listing every class.
          const totals = monthTotals(data);
          const targets = plotTargets(plot, data, { x: (r) => r.month, y: (r) => totals.get(r.month) });
          monthBand(plot, months, RESTRICTED_BAND, labelY);
          drawMarkers(plot, markers);
          return { element: plot, targets };
        }

        const layout = launchPanels(data).map((panel, index, all) => {
          const monthLabels = index === all.length - 1;
          const marginTop = index === 0 ? top : plotDefaults.marginTop;
          const height = marginTop + SPLIT_PLOT[panel.id] + (monthLabels ? 32 : 8);
          return { panel, monthLabels, marginTop, height };
        });
        const svg = chartSvg(width, layout.reduce((sum, part) => sum + SPLIT_TITLE + part.height, 0));
        // One target per month, listing every class in both panels, on the first panel that has the month.
        const targets = new Map<string, Target<MonthChartRow>>();
        let offset = 0;
        layout.forEach(({ panel, monthLabels, marginTop, height }, index) => {
          const plot = monthBars(panel.rows, { months, width, height, marginTop, monthLabels });
          const totals = monthTotals(panel.rows);
          const plotTop = offset + SPLIT_TITLE;
          for (const target of plotTargets(plot, panel.rows, { x: (r) => r.month, y: (r) => totals.get(r.month) })) {
            const month = target.rows[0]!.month;
            if (!targets.has(month)) {
              targets.set(month, { x: target.x, y: target.y + plotTop, rows: data.filter((r) => r.month === month) });
            }
          }
          monthBand(plot, months, RESTRICTED_BAND, index === 0 ? labelY : undefined);
          if (index === 0) drawMarkers(plot, markers);
          else drawMarkerRules(plot, markers);
          plot.setAttribute("x", "0");
          plot.setAttribute("y", String(plotTop));
          svg.append(svgText(4, offset + 18, panel.title, { "font-weight": 700, "font-size": 16 }), plot);
          offset = plotTop + height;
        });
        // In month order, for the keyboard.
        return { element: svg, targets: months.flatMap((month) => targets.get(month) ?? []) };
      },
    };
  }

  const toggle = options.onEventsChange && rows.length ? eventToggle() : null;
  const live = liveChartFrame<MonthChartRow>({ ...spec(), controls: toggle?.element });
  if (!toggle && !(events && placed.length)) return live.element;

  const wrapper = create("div", "event-chart");
  wrapper.append(live.element);
  let key: HTMLElement | null = null;
  function showKey(): void {
    key?.remove();
    key = events && placed.length ? eventKey(placed, monthlyTable.firstDay) : null;
    if (key) wrapper.append(key);
  }
  toggle?.input.addEventListener("change", () => {
    events = toggle.input.checked;
    options.onEventsChange!(events);
    live.update(spec());
    showKey();
  });
  showKey();
  return wrapper;

  function eventToggle(): { element: HTMLElement; input: HTMLInputElement } {
    const element = create("div", "chart-option");
    const label = create("label");
    const input = create("input");
    input.type = "checkbox";
    input.checked = events && placed.length > 0;
    input.disabled = !placed.length;
    label.append(input, " Show event markers");
    const note = placed.length
      ? "They show when cited events happened, not what caused any change."
      : "No cited event falls in the months shown.";
    element.append(label, create("span", "chart-option-note", note));
    return { element, input };
  }
}

const MIX_PLOT_HEIGHT = 150;
/** Room above each small panel for its class's name, on up to two lines, and its highest share. */
const MIX_LABEL_HEIGHT = 58;
const MIX_LABEL_LINE = 17;
/** At this panel width or wider, all six fit in one row. */
const MIX_MIN_PANEL = 180;

/** Breaks a class name into at most two lines, the first of about `length` characters. */
function twoLines(name: string, length: number): string[] {
  if (name.length <= length) return [name];
  const words = name.split(" ");
  let first = words.shift()!;
  while (words.length > 1 && `${first} ${words[0]}`.length <= length) first += ` ${words.shift()}`;
  return [first, words.join(" ")];
}

/** The row with the highest share among a class's rows, or undefined if none has one. */
function highestShare(rows: readonly MonthChartRow[]): MonthChartRow | undefined {
  return rows.filter((row) => row.share !== null).sort((a, b) => b.share! - a.share!)[0];
}

export function classMixChart(selection: Selection): HTMLElement {
  const rows = monthRows(monthlyTable, selection, formatDate);
  const months = monthsShown(monthlyTable, selection.from, selection.to);
  const spec: ChartSpec<MonthChartRow> = {
    title: "Class mix over time",
    subtitle: "Each class’s share of the month’s published launches. Each panel has its own scale.",
    howToRead:
      "One small panel for each weapon class, all over the same months: its share of each month’s published launches. " +
      "Each panel has its own vertical scale, so compare timing and shape across panels, not bar heights. " +
      "Under each name are the highest share in the months shown, and its month. " +
      "The share is out of all counted classes, including any turned off in the filters.",
    description: rows.length
      ? "Small bar charts, one per weapon class, of its share of each month’s published launches. " +
        CLASS_IDS.filter((id) => rows.some((row) => row.class === id))
          .map((id) => {
            const best = highestShare(rows.filter((row) => row.class === id));
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
    source: strikeSource(),
    footnote: footnote(NOT_ZERO, "Where missile counts are unpublished, the other classes’ shares are higher than they would otherwise be."),
    draw(data, width) {
      const present: ClassId[] = CLASS_IDS.filter((id) => data.some((row) => row.class === id));
      const fits = width >= 6 * MIX_MIN_PANEL ? 6 : width >= 3 * MIX_MIN_PANEL ? 3 : 2;
      const perRow = Math.min(present.length, fits);
      // A panel on its own doesn't stretch across the page.
      const panelWidth = Math.floor(width / Math.max(perRow, 2));
      const rowHeight = MIX_LABEL_HEIGHT + MIX_PLOT_HEIGHT;
      const svg = chartSvg(width, Math.ceil(present.length / perRow) * rowHeight);
      const targets: Target<MonthChartRow>[] = [];

      present.forEach((id, index) => {
        const left = (index % perRow) * panelWidth;
        const top = Math.floor(index / perRow) * rowHeight;
        const own = data.filter((row) => row.class === id);
        const best = highestShare(own);
        const plot = Plot.plot({
          ...plotDefaults,
          style: { ...plotDefaults.style, fontSize: "13px" },
          width: panelWidth,
          height: MIX_PLOT_HEIGHT,
          marginLeft: 40,
          // Wide enough that the last point's target stays inside the chart.
          marginRight: 14,
          // Room for the band's label.
          marginTop: 20,
          marginBottom: 26,
          x: { type: "band", domain: months, padding: 0.1, label: null, ...monthAxisTicks(months, panelWidth - 54) },
          y: { label: null, domain: [0, best?.share || 1], nice: true, ticks: 2, tickFormat: "%", grid: true },
          color: classFillScale(classLabels),
          marks: [Plot.barY(own, { x: "month", y: "share", fill: "class" }), Plot.ruleY([0])],
        }) as SVGSVGElement & Plot.Plot;
        monthBand(plot, months, RESTRICTED_BAND);
        const drawn = own.filter((row) => row.share !== null);
        for (const target of plotTargets(plot, drawn, { x: (r) => r.month, y: (r) => r.share })) {
          targets.push({ ...target, x: target.x + left, y: target.y + top + MIX_LABEL_HEIGHT });
        }
        plot.setAttribute("x", String(left));
        plot.setAttribute("y", String(top + MIX_LABEL_HEIGHT));
        // Long class names are shortened to fit narrow panels; the table and tooltips have them in full.
        const name = classLabels[id].replace(/ \(not separable\)$/, "");
        const lines = twoLines(name, Math.floor(panelWidth / 9));
        lines.forEach((line, at) => {
          svg.append(svgText(left + 4, top + 16 + at * MIX_LABEL_LINE, line, { "font-weight": 700, "font-size": 14 }));
        });
        const highest = best
          ? `Highest ${percent.format(best.share!)}, ${formatMonth(best.month)}`
          : "No published share";
        svg.append(svgText(left + 4, top + 16 + lines.length * MIX_LABEL_LINE, highest, { "font-size": 13 }), plot);
      });
      return { element: svg, targets };
    },
  };
  return chartFrame(spec);
}
