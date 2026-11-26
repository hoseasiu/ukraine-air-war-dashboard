/**
 * The wrapper every chart goes through. It adds the "How to read this" note,
 * the data-quality badges, a text description, tooltips that work with a mouse,
 * touch or keyboard, and the "Show as table" toggle.
 *
 * Badges come from chartFlags(); a chart has no option to leave one out. That
 * only holds if the chart draws the figures its columns declare, so don't draw
 * a number that isn't in a column.
 */
import { formatDate, weaponClasses } from "../data.ts";
import { withTerms } from "../glossary/popover.ts";
import type { TermId } from "../glossary/terms.ts";
import { CLASS_IDS, CLASS_STYLES, type ClassId } from "../theme/classStyles.ts";
import { classFill, classSymbolPath, svgElement } from "../theme/marks.ts";
import { chartFlags, FLAG_TEXT, rowFlags, type ColumnSpec, type FlagId, type FlagInput } from "./flags.ts";
import { attachTooltips, type TooltipContent } from "./tooltips.ts";
import "./chart.css";

/** One place on the chart that has a tooltip. */
export interface Target<Row> {
  /** Pixels from the top left of the element draw() returned. */
  x: number;
  y: number;
  /** One row, or several that share a position, such as every class in a month. */
  rows: Row[];
}

export interface Drawing<Row> {
  /** An SVG exactly as wide as asked for, so target positions line up. */
  element: SVGSVGElement | HTMLElement;
  /** In keyboard order. */
  targets: Target<Row>[];
}

export interface ChartSpec<Row extends object> extends FlagInput<Row> {
  title: string;
  /** One or two sentences, always visible. */
  howToRead: string;
  /** Text alternative: what kind of chart this is and what it plots. */
  description: string;
  /** These drive both the table and the tooltips. */
  columns: readonly ColumnSpec[];
  /** Weapon-class legend, shaped like the chart's marks. Needs a "class" column. */
  legend?: "bar" | "line" | "point";
  /** How the pointer picks a target: the nearest column of the chart, or the nearest point. */
  pointer: "x" | "xy";
  draw(rows: readonly Row[], width: number): Drawing<Row>;
}

/** Charts narrower than this scroll sideways instead of shrinking. */
const MIN_WIDTH = 480;

let frameCount = 0;

function create<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  // Always textContent: labels can come from data files.
  if (text) element.textContent = text;
  return element;
}

function classLabel(value: unknown): string {
  const found = weaponClasses.find((weaponClass) => weaponClass.id === value);
  if (!found) throw new Error(`Unknown weapon class in chart data: ${JSON.stringify(value)}`);
  return found.label;
}

function formatNumber(value: number, column: Extract<ColumnSpec, { type: "number" }>): string {
  if (column.format) return column.format(value);
  if (column.measure === "intercept_rate") {
    return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${month}-01`),
  );
}

function formatValue(row: object, column: ColumnSpec): string {
  const value = (row as Record<string, unknown>)[column.key];
  if (value === null || value === undefined) return column.missing ?? "No data";
  switch (column.type) {
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Column ${column.key} needs a number or null, got ${String(value)}`);
      }
      return formatNumber(value, column);
    case "class":
      return classLabel(value);
    case "date":
      return formatDate(String(value));
    case "month":
      return formatMonth(String(value));
    case "text":
      return String(value);
  }
}

/** Columns that name something go in headings; numbers are listed with their labels. */
function tooltipContent<Row extends object>(
  rows: Row[],
  columns: readonly ColumnSpec[],
  flags: readonly FlagId[],
): TooltipContent {
  const names = columns.filter((column) => column.type !== "number");
  const numbers = columns.filter((column) => column.type === "number");
  const shared = names.filter((column) => new Set(rows.map((row) => formatValue(row, column))).size === 1);
  const own = names.filter((column) => !shared.includes(column));
  const first = rows[0];
  if (!first) throw new Error("A chart target needs at least one row");

  return {
    heading: shared.map((column) => formatValue(first, column)).join(" · "),
    groups: rows.map((row) => ({
      heading: own.map((column) => formatValue(row, column)).join(" · "),
      values: numbers.map((column) => ({
        label: column.label,
        value: formatValue(row, column),
        missing: (row as Record<string, unknown>)[column.key] == null,
      })),
    })),
    // Notes for the flags set on these particular rows, such as a restricted night.
    notes: flags.filter((id) => rows.some((row) => rowFlags(row).includes(id))).map((id) => FLAG_TEXT[id].label),
  };
}

function badges(flags: readonly FlagId[]): HTMLUListElement {
  const list = create("ul", "chart-badges");
  list.setAttribute("aria-label", "Data-quality notes");
  // Shared, so a term repeated across badges is marked once.
  const seen = new Set<TermId>();
  for (const id of flags) {
    const item = create("li");
    item.dataset.flag = id;
    item.append(create("strong", "", FLAG_TEXT[id].label), " ", ...withTerms(FLAG_TEXT[id].text, seen));
    list.append(item);
  }
  return list;
}

function legendKey(id: ClassId, mark: "bar" | "line" | "point"): SVGSVGElement {
  const { color, dash } = CLASS_STYLES[id];
  const svg = svgElement("svg", { width: 40, height: 18, "aria-hidden": "true", focusable: "false" });
  if (mark === "bar") {
    svg.append(svgElement("rect", { x: 8, y: 1, width: 24, height: 16, fill: classFill(id) }));
  } else {
    if (mark === "line") {
      svg.append(
        svgElement("line", { x1: 0, x2: 40, y1: 9, y2: 9, stroke: color, "stroke-width": 2.5, "stroke-dasharray": dash }),
      );
    }
    // Line charts mark their points too, so their keys show both.
    svg.append(svgElement("path", { d: classSymbolPath(id, 80), transform: "translate(20,9)", fill: color }));
  }
  return svg;
}

function legend<Row extends object>(spec: ChartSpec<Row>, mark: "bar" | "line" | "point"): HTMLElement | null {
  const column = spec.columns.find((c) => c.type === "class");
  if (!column) throw new Error(`${spec.title}: a class legend needs a "class" column`);
  const present = new Set(spec.rows.map((row) => (row as Record<string, unknown>)[column.key]));
  // One series needs no legend, but it still has to be named somewhere: the title.
  if (present.size < 2) return null;
  const list = create("ul", "chart-legend");
  list.setAttribute("aria-label", "Legend");
  for (const id of CLASS_IDS.filter((candidate) => present.has(candidate))) {
    const item = create("li");
    // One span, so the legend's flex gap doesn't split the label.
    const label = create("span");
    label.append(...withTerms(classLabel(id)));
    item.append(legendKey(id, mark), label);
    list.append(item);
  }
  return list;
}

function table<Row extends object>(spec: ChartSpec<Row>): HTMLTableElement {
  const element = create("table");
  element.createCaption().textContent = spec.title;
  const head = element.createTHead().insertRow();
  for (const column of spec.columns) {
    const th = create("th", column.type === "number" ? "numeric" : "", column.label);
    th.scope = "col";
    head.append(th);
  }
  const body = element.createTBody();
  for (const row of spec.rows) {
    const tr = body.insertRow();
    spec.columns.forEach((column, index) => {
      // The first column names the row.
      const cell = create(index === 0 ? "th" : "td", column.type === "number" ? "numeric" : "", formatValue(row, column));
      if (index === 0) (cell as HTMLTableCellElement).scope = "row";
      tr.append(cell);
    });
  }
  return element;
}

export function chartFrame<Row extends object>(spec: ChartSpec<Row>): HTMLElement {
  for (const field of ["title", "howToRead", "description"] as const) {
    if (!spec[field].trim()) throw new Error(`A chart needs a ${field}`);
  }
  // Worked out first, so a chart that can't be flagged correctly never renders.
  const flags = chartFlags(spec);
  const id = `chart-${++frameCount}`;

  const figure = create("figure", "chart-frame");
  figure.setAttribute("aria-labelledby", `${id}-title`);
  figure.setAttribute("aria-describedby", `${id}-description`);

  const title = create("h3", "", spec.title);
  title.id = `${id}-title`;
  const howToRead = create("p", "chart-how-to-read");
  howToRead.append(create("strong", "", "How to read this: "), ...withTerms(spec.howToRead));
  const description = create("p", "visually-hidden", spec.description);
  description.id = `${id}-description`;
  figure.append(title, howToRead, description);
  // Badges sit above both views, so the table and any screenshot carry them too.
  if (flags.length) figure.append(badges(flags));

  if (!spec.rows.length) {
    figure.append(create("p", "chart-empty", "No data for this selection."));
    return figure;
  }

  const toggle = create("button", "chart-toggle", "Show as table");
  toggle.type = "button";
  toggle.setAttribute("aria-pressed", "false");

  const chartView = create("div", "chart-view");
  const key = spec.legend ? legend(spec, spec.legend) : null;
  const scroller = create("div", "chart-scroll");
  const stage = create("div", "chart-stage");
  scroller.append(stage);
  if (key) chartView.append(key);
  chartView.append(scroller);

  const tableView = create("div", "chart-table table-scroll");
  tableView.id = `${id}-table`;
  tableView.hidden = true;
  // Focusable so keyboard users can scroll it.
  tableView.tabIndex = 0;
  tableView.setAttribute("role", "region");
  tableView.setAttribute("aria-labelledby", `${id}-title`);
  toggle.setAttribute("aria-controls", tableView.id);

  toggle.addEventListener("click", () => {
    const showTable = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(showTable));
    if (showTable && !tableView.firstChild) tableView.append(table(spec));
    tableView.hidden = !showTable;
    chartView.hidden = showTable;
  });

  figure.append(toggle, chartView, tableView);

  const tooltips = attachTooltips(stage, spec.pointer);
  let drawnWidth = 0;
  // Fires once the frame is on the page, and again whenever its width changes.
  new ResizeObserver(([entry]) => {
    const available = Math.floor(entry?.contentRect.width ?? 0);
    // Zero means hidden, for example while the table is showing.
    if (!available) return;
    const width = Math.max(available, MIN_WIDTH);
    if (width === drawnWidth) return;
    drawnWidth = width;
    const { element, targets } = spec.draw(spec.rows, width);
    // The description, the point labels and the table stand in for the drawing.
    element.setAttribute("aria-hidden", "true");
    tooltips.update(
      element,
      targets.map((target) => ({ x: target.x, y: target.y, content: tooltipContent(target.rows, spec.columns, flags) })),
    );
  }).observe(scroller);

  return figure;
}
