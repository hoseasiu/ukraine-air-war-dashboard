/**
 * Reported intercept rates before and after an annotated event, side by side
 * (plan §2 B3, §6). Takes its event, window length and classes as settings and
 * reads no filters.
 */
import type { Annotation } from "../annotations/annotationData.ts";
import { liveChartFrame, type ChartSpec, type Target } from "../chart/chartFrame.ts";
import { annotations, formatDate, outcomeTable, rateTable } from "../data.ts";
import { withTerms } from "../glossary/popover.ts";
import { chartSvg, classLabels, count, create, percent, strikeFootnote, svgText } from "../strikes/shared.ts";
import type { ClassId } from "../theme/classStyles.ts";
import { classFill, svgElement } from "../theme/marks.ts";
import "./eventPanels.css";
import {
  DEFAULT_WINDOW_DAYS,
  eventsInWindows,
  eventWindows,
  panelEvents,
  panelHowToRead,
  PANEL_NOTES,
  SIDES,
  WINDOW_DAYS,
  windowRows,
  type EventWindow,
  type WindowDays,
  type WindowRow,
} from "./eventWindowData.ts";

const HEADER = 52;
const ROW = 70;
const BAR = 18;
const GUTTER = 24;
const PANEL_GAP = 8;

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

function spec(chosen: Annotation, days: WindowDays, classes: readonly ClassId[]) {
  const windows = eventWindows(outcomeTable, chosen.date, days);
  const rows = windowRows(outcomeTable, rateTable, windows, classes);
  const present = [...new Set(rows.map((row) => row.class))];
  return {
    title: `Reported intercept rate before and after: ${chosen.label}`,
    howToRead: panelHowToRead(rateTable.minLaunched),
    description: rows.length
      ? "Two panels of bar charts, one for the window before the event’s date and one for the window after. " +
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
    pointer: "xy",
    draw(data, width) {
      const perRow = width >= 880 ? 2 : 1;
      const panelWidth = Math.floor((width - (perRow - 1) * GUTTER) / perRow);
      const panelHeight = HEADER + present.length * ROW + PANEL_GAP;
      const svg = chartSvg(width, Math.ceil(SIDES.length / perRow) * panelHeight);
      const targets: Target<WindowRow>[] = [];

      windows.forEach((window, index) => {
        const left = (index % perRow) * (panelWidth + GUTTER);
        const top = Math.floor(index / perRow) * panelHeight;
        svg.append(
          svgText(left, top + 18, `${window.side}: ${span(window)}`, { "font-weight": 700, "font-size": 15 }),
          svgText(left, top + 38, `${length(window)} · ${nightCount(window.nights)} with a report`, { "font-size": 13 }),
        );
        data
          .filter((row) => row.side === window.side)
          .forEach((row, line) => {
            const y = top + HEADER + line * ROW;
            const barTop = y + 22;
            const rate = row.intercept_rate;
            svg.append(
              svgText(left, y + 15, shortName(row.class), { "font-size": 14, "font-weight": 700 }),
              // The full 0% to 100% track, so bars compare across both panels. A gap leaves it empty.
              svgElement("rect", { x: left, y: barTop, width: panelWidth - 1, height: BAR, class: "event-track" }),
            );
            if (rate !== null) {
              svg.append(
                svgElement("rect", { x: left, y: barTop, width: rate * (panelWidth - 1), height: BAR, fill: classFill(row.class) }),
              );
            }
            svg.append(svgText(left, barTop + BAR + 17, figures(row), { "font-size": 14 }));
            targets.push({ x: left + (rate ?? 0.5) * panelWidth, y: barTop + BAR / 2, rows: [row] });
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
    footnote: strikeFootnote(...PANEL_NOTES),
  });
  let redraw = () => {};

  const { onChange } = settings;
  if (onChange) {
    const [eventLabel, eventSelect] = menu(
      "Event",
      events.map((event) => [event.id, `${formatDate(event.date)}: ${event.label}`]),
      chosen.id,
    );
    const [daysLabel, daysSelect] = menu(
      "Window length, each side",
      WINDOW_DAYS.map((value) => [String(value), `${value} days`]),
      String(days),
    );
    const changed = () => {
      chosen = events.find((event) => event.id === eventSelect.value)!;
      days = WINDOW_DAYS.find((value) => String(value) === daysSelect.value)!;
      onChange(chosen.id, days);
      redraw();
    };
    eventSelect.addEventListener("change", changed);
    daysSelect.addEventListener("change", changed);
    const menus = create("div", "event-menus");
    menus.append(eventLabel, daysLabel);
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
