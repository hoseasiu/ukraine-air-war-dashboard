/**
 * Reported intercept rates before and after an annotated event (plan §2 B3,
 * §6), as a dumbbell chart: one row per class, with a dot for each window on one
 * 0% to 100% axis. Takes its event, window length and classes as settings and
 * reads no filters.
 */
import type { Annotation } from "../annotations/annotationData.ts";
import { liveChartFrame, type ChartSpec, type Target } from "../chart/chartFrame.ts";
import { annotations, formatDate, outcomeTable, rateTable } from "../data.ts";
import { withTerms } from "../glossary/popover.ts";
import { chartSvg, classLabels, count, create, percent, footnote, strikeSource, svgText } from "../strikes/shared.ts";
import { CLASS_STYLES, type ClassId } from "../theme/classStyles.ts";
import { svgElement } from "../theme/marks.ts";
import "./eventPanels.css";
import { segmented } from "./segmented.ts";
import {
  DEFAULT_WINDOW_DAYS,
  eventsInWindows,
  eventWindows,
  panelEvents,
  panelHowToRead,
  PANEL_NOTES,
  WINDOW_DAYS,
  windowRows,
  type EventWindow,
  type Side,
  type WindowDays,
  type WindowRow,
} from "./eventWindowData.ts";

const AXIS = 24;
const ROW = 62;
const STACKED_ROW = 94;
/** Widths of the class names and the counts, where they share a line with the axis. */
const NAMES = 275;
const COUNTS = 380;
/** Narrower than this, the counts go under the axis. */
const ONE_LINE = 900;
const RATE_TICKS = [0, 0.25, 0.5, 0.75, 1];
/** Dots closer than this share one tooltip target. */
const TOGETHER = 12;

export interface EventPanelSettings {
  /** An id from PANEL_EVENT_IDS. The first is used if left out or unknown. */
  event?: string;
  days?: WindowDays;
  classes: readonly ClassId[];
  /** Offers menus for the event and window length, and hears each change. Leave out for a fixed view. */
  onChange?: (event: string, days: WindowDays) => void;
}

const span = (window: EventWindow) => `${formatDate(window.from)} to ${formatDate(window.to)}`;

const length = (window: EventWindow) =>
  window.daysCovered < window.days
    ? `${window.daysCovered} of ${window.days} days (the data doesn’t cover the rest)`
    : `${window.days} days`;

const nightCount = (nights: number) => `${count.format(nights)} ${nights === 1 ? "night" : "nights"}`;

const shortName = (id: ClassId) => classLabels[id].replace(/ \(not separable\)$/, "");

function figures(row: WindowRow): string {
  if (row.intercept_rate === null) return row.status.replace(/^Gap: /, "No rate: ");
  return (
    `${percent.format(row.intercept_rate)} · ${count.format(row.destroyed!)} of ` +
    `${count.format(row.launched_with_outcome!)} launches · ${nightCount(row.n_nights)}`
  );
}

function sourceLinks(event: Annotation): (Node | string)[] {
  return event.sources.flatMap((url, index) => {
    const link = create("a", "", new URL(url).hostname.replace(/^www\./, ""));
    link.href = url;
    return [index ? ", " : " Sources: ", link];
  });
}

/** The event's account and citations, and what else is dated inside the windows. */
function eventDetails(chosen: Annotation, windows: readonly EventWindow[]): HTMLElement[] {
  const account = create("p");
  const date = create("strong", "", `${formatDate(chosen.date)} (${chosen.dateMarks}).`);
  account.append(date, " ", ...withTerms(chosen.description), ...sourceLinks(chosen));

  const others = eventsInWindows(annotations, chosen, windows);
  if (!others.length) {
    const none = "No other event on our reviewed list is dated inside these windows. The list is not complete.";
    return [account, create("p", "", none)];
  }
  const list = create("ul");
  for (const { event, side } of others) {
    const item = create("li");
    item.append(
      `${formatDate(event.date)}, in the “${side}” window: `,
      ...withTerms(event.label),
      ".",
      ...sourceLinks(event),
    );
    list.append(item);
  }
  const intro = "Other events on our reviewed list dated inside these windows (the list is not complete):";
  return [account, create("p", "", intro), list];
}

/** Before is a ring and after a filled dot, so they don't depend on color. The ring still shows around a dot on it. */
function dot(side: Side, x: number, y: number, color: string): SVGCircleElement {
  return side === "Before"
    ? svgElement("circle", { cx: x, cy: y, r: 8, fill: "var(--surface)", stroke: color, "stroke-width": 3 })
    : svgElement("circle", { cx: x, cy: y, r: 5.5, fill: color });
}

/** Which dot is which, with each window's dates and how much of it the data covers. */
function windowKey(windows: readonly EventWindow[]): HTMLElement {
  const key = create("div");
  for (const window of windows) {
    const line = create("p", "strike-key");
    const mark = svgElement("svg", { width: 24, height: 20, "aria-hidden": "true", focusable: "false" });
    mark.append(dot(window.side, 12, 10, "currentColor"));
    line.append(
      mark,
      `${window.side} (${window.side === "Before" ? "ring" : "filled dot"}): ${span(window)} · ${length(window)} · ` +
        `${nightCount(window.nights)} with a report`,
    );
    key.append(line);
  }
  return key;
}

function spec(chosen: Annotation, days: WindowDays, classes: readonly ClassId[]) {
  const windows = eventWindows(outcomeTable, chosen.date, days);
  const rows = windowRows(outcomeTable, rateTable, windows, classes);
  const present = [...new Set(rows.map((row) => row.class))];
  return {
    title: `Reported intercept rate before and after: ${chosen.label}`,
    subtitle: "Each class’s rate in equal windows before and after the event’s date. It doesn’t show a cause.",
    source: strikeSource(),
    howToRead: panelHowToRead(rateTable.minLaunched),
    description: rows.length
      ? "A dumbbell chart: one row for each weapon class, with the rate before the event’s date and the rate after " +
        "it on one scale from 0% to 100%. " +
        windows.map((w) => `${w.side}: ${span(w)}, ${length(w)}, ${nightCount(w.nights)}.`).join(" ") +
        " " +
        rows.map((row) => `${shortName(row.class)}, ${row.side.toLowerCase()}: ${figures(row)}.`).join(" ")
      : "No chart: no weapon class with a class rate is selected.",
    columns: [
      { key: "class", label: "Class", type: "class" },
      { key: "side", label: "Window", type: "text" },
      { key: "from", label: "From", type: "date" },
      { key: "to", label: "To", type: "date" },
      { key: "intercept_rate", label: "Reported intercept rate", type: "number", measure: "intercept_rate", missing: "No rate" },
      { key: "destroyed", label: "Reported destroyed", type: "number", measure: "destroyed", missing: "Not shown" },
      {
        key: "launched_with_outcome",
        label: "Launches with a usable outcome",
        type: "number",
        measure: "launched",
        missing: "Not shown",
      },
      { key: "n_nights", label: "Nights with a report for the class", type: "number", measure: "launch_derived" },
      {
        key: "n_unknown_launched",
        label: "Reports with no published launch count",
        type: "number",
        measure: "launch_derived",
        missing: "No report",
      },
      { key: "status", label: "Rate or gap", type: "text" },
    ],
    rows,
    coverage: (row) => ({ from: row.from, to: row.to }),
    scaleKey: windowKey(windows),
    pointer: "xy",
    draw(data, width) {
      const oneLine = width >= ONE_LINE;
      const rowHeight = oneLine ? ROW : STACKED_ROW;
      const bottom = AXIS + present.length * rowHeight;
      const svg = chartSvg(width, bottom + AXIS);
      const targets: Target<WindowRow>[] = [];
      // Room at both ends for a dot and its axis label.
      const start = (oneLine ? NAMES : 0) + 20;
      const end = width - (oneLine ? COUNTS : 0) - 24;
      const at = (rate: number) => start + rate * (end - start);

      for (const tick of RATE_TICKS) {
        const x = at(tick);
        const label = { "text-anchor": "middle", "font-size": 13 };
        svg.append(
          svgElement("line", { x1: x, x2: x, y1: AXIS, y2: bottom, class: "dumbbell-grid" }),
          svgText(x, 15, percent.format(tick), label),
          svgText(x, bottom + 17, percent.format(tick), label),
        );
      }

      present.forEach((id, index) => {
        const top = AXIS + index * rowHeight;
        const own = data.filter((row) => row.class === id);
        const y = oneLine ? top + rowHeight / 2 : top + 36;
        svg.append(
          svgElement("line", { x1: 0, x2: width, y1: top, y2: top, class: "dumbbell-rule" }),
          svgText(0, oneLine ? y + 5 : top + 19, shortName(id), { "font-size": 14, "font-weight": 700 }),
          svgElement("line", { x1: start, x2: end, y1: y, y2: y, class: "dumbbell-grid" }),
        );
        const [first, second] = own.flatMap((row) => (row.intercept_rate === null ? [] : [row.intercept_rate]));
        if (first !== undefined && second !== undefined) {
          const color = CLASS_STYLES[id].color;
          svg.append(
            svgElement("line", { x1: at(first), x2: at(second), y1: y, y2: y, stroke: color, class: "dumbbell-bar" }),
          );
        }
        let previous: Target<WindowRow> | undefined;
        // Rows come Before first, so the after dot is drawn on top.
        own.forEach((row, line) => {
          const textX = oneLine ? width - COUNTS : 20;
          const textY = oneLine ? y - 5 + line * 20 : top + 63 + line * 20;
          svg.append(svgText(textX, textY, `${row.side}: ${figures(row)}`, { "font-size": 14 }));
          if (row.intercept_rate === null) {
            // A gap has no dot, so its target sits by its words.
            targets.push({ x: textX - 12, y: textY - 5, rows: [row] });
            return;
          }
          const x = at(row.intercept_rate);
          svg.append(dot(row.side, x, y, CLASS_STYLES[id].color));
          if (previous && Math.abs(previous.x - x) < TOGETHER) previous.rows.push(row);
          else targets.push((previous = { x, y, rows: [row] }));
        });
      });
      return { element: svg, targets };
    },
  } satisfies ChartSpec<WindowRow>;
}

function menu(label: string, options: readonly [string, string][], value: string): [HTMLLabelElement, HTMLSelectElement] {
  const wrapper = create("label");
  const select = create("select");
  for (const [optionValue, text] of options) select.add(new Option(text, optionValue));
  select.value = value;
  wrapper.append(label, " ", select);
  return [wrapper, select];
}

export function eventPanels(settings: EventPanelSettings): HTMLElement {
  const events = panelEvents(annotations);
  let chosen = events.find((event) => event.id === settings.event) ?? events[0]!;
  let days = settings.days ?? DEFAULT_WINDOW_DAYS;

  const controls = create("div", "event-controls");
  const details = create("div", "event-details");
  // Read out when a menu changes the event or its windows.
  details.setAttribute("aria-live", "polite");
  const drawDetails = () => details.replaceChildren(...eventDetails(chosen, eventWindows(outcomeTable, chosen.date, days)));
  const full = (): ChartSpec<WindowRow> => ({
    ...spec(chosen, days, settings.classes),
    controls,
    footnote: footnote(...PANEL_NOTES),
  });
  let redraw = () => {};

  const { onChange } = settings;
  if (onChange) {
    const [eventLabel, eventSelect] = menu(
      "Event",
      events.map((event) => [event.id, `${formatDate(event.date)}: ${event.label}`]),
      chosen.id,
    );
    const changed = () => {
      onChange(chosen.id, days);
      redraw();
    };
    eventSelect.addEventListener("change", () => {
      chosen = events.find((event) => event.id === eventSelect.value)!;
      changed();
    });
    const lengths = segmented(
      "Window length, each side",
      WINDOW_DAYS.map((value) => [String(value), `${value} days`] as const),
      String(days),
      (value) => {
        days = WINDOW_DAYS.find((option) => String(option) === value)!;
        changed();
      },
    );
    const menus = create("div", "event-menus");
    menus.append(eventLabel, lengths);
    controls.append(menus);
  }
  controls.append(details);
  drawDetails();

  const chart = liveChartFrame(full());
  redraw = () => {
    drawDetails();
    chart.update(full());
  };
  return chart.element;
}
