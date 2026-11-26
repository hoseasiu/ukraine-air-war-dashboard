/**
 * The map of alert hours by oblast, one month at a time (plan §2 E1).
 *
 * It takes its months and highlighted oblasts as settings and reads no filters
 * itself, so a fixed view can use it too.
 */
import { geoConicEqualArea, geoPath } from "d3-geo";
import { formatMonth, liveChartFrame, type ChartSpec, type Drawing } from "../chart/chartFrame.ts";
import { monthPeriod } from "../chart/flags.ts";
import { alertAreas, alertMonthly, boundaries, excludedAlertAreas } from "../data.ts";
import { ALERT_BINS, alertBin } from "../theme/alertScale.ts";
import { svgElement } from "../theme/marks.ts";
import { mapRows, monthsInRange, nearestMonth, type Boundary, type MapRow } from "./alertData.ts";
import "./alertMap.css";

const TITLE = "Alert hours by oblast";
/** How long each month stays up while the months play. */
const STEP_MS = 1200;
const EXCLUDED_PATTERN = "alert-excluded-pattern";
/** The city is too small to label in place, so its number sits in a box north of the border, with a line to it. */
const KYIV_CITY = "UA-30";
/** Its own center falls on the city, so its number goes further south. */
const KYIV_OBLAST = "UA-32";
/** Too small for a label. The hatching, key and table still show that it's excluded. */
const UNLABELLED = new Set(["UA-40"]);

export interface AlertMapSettings {
  /** First and last month offered, as YYYY-MM. */
  from: string;
  to: string;
  /** ISO 3166-2 codes to outline. */
  highlight: readonly string[];
  /** The month to open on. Without one, the latest offered. */
  month?: string;
  onMonthChange?(month: string): void;
}

const hoursText = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const tooltipHours = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function create<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

/** Gray diagonal hatching, which reads as "no figures" rather than as a low value. */
function excludedPattern(id: string): SVGPatternElement {
  const pattern = svgElement("pattern", { id, width: 8, height: 8, patternUnits: "userSpaceOnUse" });
  pattern.append(
    svgElement("rect", { width: 8, height: 8, fill: "#ffffff" }),
    svgElement("path", { d: "M-2,2L2,-2M0,8L8,0M6,10L10,6", stroke: "#595959", "stroke-width": 1.75 }),
  );
  return pattern;
}

function swatch(fill: string, pattern?: SVGPatternElement): SVGSVGElement {
  const svg = svgElement("svg", { width: 28, height: 18, "aria-hidden": "true", focusable: "false" });
  if (pattern) {
    const defs = svgElement("defs");
    defs.append(pattern);
    svg.append(defs);
  }
  svg.append(svgElement("rect", { x: 0.5, y: 0.5, width: 27, height: 17, fill, class: "alert-swatch" }));
  return svg;
}

function scaleKey(): HTMLElement {
  const key = create("div", "alert-key");
  const list = create("ul", "chart-legend");
  list.setAttribute("aria-label", "Key: alert hours in the month, and excluded areas");
  for (const bin of ALERT_BINS) {
    const item = create("li");
    item.append(swatch(bin.color), bin.label);
    list.append(item);
  }
  const excluded = create("li");
  // Its own id: the map's copy of the pattern is hidden along with the map when the table shows.
  const id = `${EXCLUDED_PATTERN}-key`;
  excluded.append(swatch(`url(#${id})`, excludedPattern(id)), "Excluded: no figures (not zero)");
  list.append(excluded);
  key.append(create("p", "alert-key-title", "Alert hours in the month, average per raion"), list);
  return key;
}

function footnote(): HTMLElement {
  const note = create("div", "chart-footnote");
  const reasons = alertAreas.filter((area) => !area.inAlertTotals).map((area) => area.name);
  note.append(
    create(
      "p",
      "",
      "A 0 means the file lists no alert counted for that month. It can’t show that no alert was missed.",
    ),
    create(
      "p",
      "",
      `Without figures: ${reasons.join(", ")}. The alert data doesn’t list the permanent alerts in Luhansk ` +
        "and Crimea, and has no rows for Sevastopol.",
    ),
    create(
      "p",
      "",
      "The map shows administrative boundaries only. It shows no front line, occupied areas or who controls a place.",
    ),
  );
  const source = create("p", "", "Alerts: official file of the Ukrainian air-raid sirens dataset (Vadimkin, MIT license). ");
  const license = create("a", "", "CC BY-IGO");
  license.href = boundaries.license.slice(boundaries.license.indexOf("https://"));
  // The credit comes from the boundary file, so it changes when the file does.
  source.append(`${boundaries.attribution} License: `, license, ".");
  note.append(source);
  return note;
}

function label(x: number, y: number, text: string): SVGTextElement {
  const element = svgElement("text", { x, y, class: "alert-map-label", "text-anchor": "middle", dy: "0.35em" });
  element.textContent = text;
  return element;
}

function drawMap(rows: readonly MapRow[], width: number, highlight: readonly string[]): Drawing<MapRow> {
  // Capped so the whole map fits on a projected screen; a wider frame centers it.
  const height = Math.round(Math.min(width * 0.68, 600));
  const projection = geoConicEqualArea()
    .parallels([46, 51])
    .rotate([-31, 0])
    .fitExtent(
      [
        [4, 4],
        [width - 4, height - 4],
      ],
      boundaries,
    );
  const path = geoPath(projection);

  const svg = svgElement("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "alert-map" });
  const defs = svgElement("defs");
  defs.append(excludedPattern(EXCLUDED_PATTERN));
  const areas = svgElement("g");
  const outlines = svgElement("g", { class: "alert-map-highlights" });
  const labels = svgElement("g");
  svg.append(defs, areas, outlines, labels);

  const targets = rows.map((row) => {
    const feature: Boundary | undefined = boundaries.features.find((f) => f.properties.iso_3166_2 === row.oblast);
    const d = feature && path(feature);
    if (!feature || !d) throw new Error(`Nothing to draw for ${row.oblast}`);
    const [x, y] = path.centroid(feature);

    const shape = svgElement("g");
    const fill = row.hours === null ? `url(#${EXCLUDED_PATTERN})` : alertBin(row.hours).color;
    shape.append(svgElement("path", { d, fill, class: "alert-map-area", "data-oblast": row.oblast }));
    // The city is drawn last, so Kyiv oblast around it can't cover it.
    if (row.oblast === KYIV_CITY) areas.append(shape);
    else areas.prepend(shape);

    if (highlight.includes(row.oblast)) {
      // A white line inside a dark one stands out on every step of the scale.
      outlines.append(
        svgElement("path", { d, class: "alert-map-highlight-outer" }),
        svgElement("path", { d, class: "alert-map-highlight-inner" }),
      );
    }

    // A small amount mustn't read as none.
    const value =
      row.hours === null ? "Excluded" : row.hours > 0 && row.hours < 0.5 ? "<1" : hoursText.format(row.hours);
    if (row.oblast === KYIV_CITY) {
      const boxX = x - width * 0.12;
      const boxY = Math.max(14, y - height * 0.22);
      const text = `Kyiv city ${value}`;
      const boxWidth = text.length * 8 + 12;
      const box = svgElement("g");
      box.append(
        svgElement("line", { x1: x, y1: y, x2: boxX, y2: boxY, class: "alert-map-leader" }),
        svgElement("rect", {
          x: boxX - boxWidth / 2,
          y: boxY - 12,
          width: boxWidth,
          height: 24,
          class: "alert-map-callout",
        }),
        label(boxX, boxY, text),
      );
      labels.append(box);
    } else if (!UNLABELLED.has(row.oblast)) {
      labels.append(label(x, row.oblast === KYIV_OBLAST ? y + height * 0.055 : y, value));
    }
    return { x, y, rows: [row], shape };
  });

  return { element: svg, targets };
}

function describe(rows: readonly MapRow[], month: string): string {
  const figures = rows.flatMap((row) => (row.hours === null ? [] : [{ name: row.name, hours: row.hours }]));
  const ranked = [...figures].sort((a, b) => b.hours - a.hours);
  const [most, least] = [ranked[0]!, ranked[ranked.length - 1]!];
  const named = (area: { name: string; hours: number }) => `${area.name}, ${tooltipHours.format(area.hours)}`;
  return (
    `Map of Ukraine by oblast, shaded by air-raid alert hours in ${formatMonth(month)}, averaged per raion. ` +
    `${figures.length} areas have figures. Most hours: ${named(most)}. Fewest: ${named(least)}. ` +
    `${excludedAlertAreas().join(", ")} are excluded and have no figures.`
  );
}

function spec(
  month: string,
  rows: MapRow[],
  highlight: readonly string[],
  parts: Pick<ChartSpec<MapRow>, "controls" | "scaleKey" | "footnote">,
): ChartSpec<MapRow> {
  const outlined = highlight.length ? " Oblasts chosen in the filters have a double outline." : "";
  return {
    ...parts,
    title: rows.length ? `${TITLE}, ${formatMonth(month)}` : TITLE,
    howToRead:
      "Darker areas had more hours under air-raid alert in the month, averaged over the oblast’s raions, so it " +
      "isn’t the time that any part of the oblast was under alert. The colors mean the same in every month. " +
      `Hatched areas have no figures, which doesn’t mean no alerts.${outlined}`,
    description: rows.length ? describe(rows, month) : "No map: the chosen months have no alert figures.",
    columns: [
      { key: "name", label: "Oblast", type: "text" },
      { key: "month", label: "Month", type: "month" },
      {
        key: "hours",
        label: "Alert hours (average per raion)",
        type: "number",
        measure: "alert_hours",
        missing: "Excluded: no figures",
      },
      {
        key: "n_alerts",
        label: "Alerts started (average per raion)",
        type: "number",
        measure: "alert_count",
        missing: "Excluded: no figures",
      },
    ],
    rows,
    coverage: monthPeriod(month),
    pointer: "shape",
    draw: (data, width) => drawMap(data, width, highlight),
  };
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
/** The map on the page now. One listener serves every map, so redraws don't pile them up. */
let onMotionChange: () => void = () => {};
reducedMotion.addEventListener("change", () => onMotionChange());

export function alertMap(settings: AlertMapSettings): HTMLElement {
  const months = monthsInRange(alertMonthly, settings.from, settings.to);
  if (!months.length) {
    const first = alertMonthly.months[0]!;
    const last = alertMonthly.months[alertMonthly.months.length - 1]!;
    const note = create(
      "p",
      "chart-footnote",
      `Alert figures run from ${formatMonth(first)} to ${formatMonth(last)}. Widen “Months shown” to include some of them.`,
    );
    return liveChartFrame(spec(last, [], settings.highlight, { footnote: note })).element;
  }
  const offered = months as [string, ...string[]];
  let index = offered.indexOf(nearestMonth(offered, settings.month));
  let timer: number | undefined;

  const controls = create("div", "month-controls");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Month shown on the map");

  const row = create("div", "month-slider");
  const sliderLabel = create("label", "", "Map month");
  const slider = create("input");
  slider.type = "range";
  slider.id = "alert-map-month";
  slider.min = "0";
  slider.max = String(offered.length - 1);
  slider.step = "1";
  sliderLabel.htmlFor = slider.id;
  // The slider announces the same text itself, so hide the copy from screen readers.
  const value = create("output", "month-value");
  value.setAttribute("aria-hidden", "true");
  row.append(sliderLabel, slider, value);

  const buttons = create("div", "month-buttons");
  function button(text: string, action: () => void): HTMLButtonElement {
    const element = create("button", "month-button", text);
    element.type = "button";
    element.addEventListener("click", action);
    buttons.append(element);
    return element;
  }
  const previous = button("Previous month", () => step(-1));
  const next = button("Next month", () => step(1));
  const play = button("Play months", () => (timer === undefined ? start() : stop(true)));
  const motionNote = create(
    "p",
    "month-motion-note",
    "Animation is off because your device asks for reduced motion. Use the slider or the month buttons.",
  );
  // Screen readers announce a live region only if it was on the page before its text changed.
  const announcer = create("p", "visually-hidden");
  announcer.setAttribute("role", "status");
  controls.append(row, buttons, motionNote, announcer);

  const current = () => offered[index]!;
  const currentSpec = () =>
    spec(current(), mapRows(alertMonthly, alertAreas, current()), settings.highlight, parts);
  const parts = { controls, scaleKey: scaleKey(), footnote: footnote() };

  function syncControls(): void {
    const text = formatMonth(current());
    slider.value = String(index);
    slider.setAttribute("aria-valuetext", text);
    value.textContent = text;
    // aria-disabled rather than disabled, which would drop focus at either end.
    previous.setAttribute("aria-disabled", String(index === 0));
    next.setAttribute("aria-disabled", String(index === offered.length - 1));
    play.hidden = reducedMotion.matches || offered.length < 2;
    play.textContent = timer === undefined ? "Play months" : "Pause";
    motionNote.hidden = !reducedMotion.matches;
  }

  syncControls();
  const chart = liveChartFrame(currentSpec());

  function show(to: number): void {
    index = to;
    syncControls();
    chart.update(currentSpec());
    settings.onMonthChange?.(current());
  }

  /** Nothing is announced while the months play; stopping says where they stopped. */
  function stop(announce: boolean): void {
    if (timer === undefined) return;
    window.clearInterval(timer);
    timer = undefined;
    syncControls();
    if (announce) announcer.textContent = `Stopped at ${formatMonth(current())}.`;
  }

  function start(): void {
    if (reducedMotion.matches) return;
    announcer.textContent = "Playing months.";
    show(index === offered.length - 1 ? 0 : index);
    timer = window.setInterval(() => {
      // The page was redrawn or left, so this map is gone.
      if (!chart.element.isConnected) return stop(false);
      show(index + 1);
      if (index === offered.length - 1) stop(true);
    }, STEP_MS);
    syncControls();
  }

  function step(by: number): void {
    stop(false);
    const to = index + by;
    if (to < 0 || to >= offered.length) return;
    show(to);
    announcer.textContent = `Map shows ${formatMonth(current())}.`;
  }

  slider.addEventListener("input", () => {
    stop(false);
    announcer.textContent = "";
    show(Number(slider.value));
  });

  onMotionChange = () => {
    if (reducedMotion.matches) stop(true);
    syncControls();
  };

  return chart.element;
}
