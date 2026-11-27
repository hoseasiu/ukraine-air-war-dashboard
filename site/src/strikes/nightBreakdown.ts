/**
 * One night by weapon class, with the launch areas its reports name (plan §2 A3).
 *
 * It takes its night and classes as settings and reads no filters itself, so a
 * fixed view, such as guided stop 5, can use it too.
 *
 * Launch areas are listed, never counted: most launches come from reports that
 * name several places, so counts can't be divided among them.
 */
import * as Plot from "@observablehq/plot";
import { liveChartFrame, type ChartSpec } from "../chart/chartFrame.ts";
import { plotTargets } from "../chart/plotTargets.ts";
import { formatDate, nightTable } from "../data.ts";
import { withTerms } from "../glossary/popover.ts";
import type { ClassId } from "../theme/classStyles.ts";
import { classFillScale, plotDefaults, titledScale } from "../theme/plot.ts";
import { nightContext } from "./nightContext.ts";
import { barText, barValue, classLabels, count, create, MASSIVE_DEFINITION, RESTRICTED_BAR_NOTE, footnote, strikeSource } from "./shared.ts";
import { barIsRestricted, breakdownRows, type BreakdownRow } from "./strikeData.ts";

export interface NightBreakdownSettings {
  /** The night to open on, YYYY-MM-DD: the date its reports end on. */
  date: string;
  classes: readonly ClassId[];
  /** Dates the reader can switch between. Leave out, or give one, for a fixed night. */
  choices?: readonly string[];
  onDateChange?(date: string): void;
  /** Shorter bar rows, so a guided stop's launch areas are on screen too. */
  compact?: boolean;
}

const ROW_HEIGHT = 52;
const COMPACT_ROW_HEIGHT = 36;

/** What the whole night's reports say, whatever classes are shown. */
function nightSentence(date: string): string {
  const rows = nightTable.rows.filter((row) => row.date === date);
  if (!rows.length) throw new Error(`No night on ${date}`);
  const { night_total: total, massive_above: bar } = breakdownRows(
    nightTable,
    date,
    rows.map((row) => row.class),
  )[0]!;
  const year = date.slice(0, 4);
  if (total === null) return `No launch count is published for this night.`;
  const verdict = rows[0]!.is_massive
    ? `so it counts as massive: more than ${year}’s bar of ${barText(bar)}.`
    : `so it doesn’t count as massive: not more than ${year}’s bar of ${barText(bar)}.`;
  return `${count.format(total)} weapons with published counts were launched, in all counted classes, ${verdict}`;
}

function spec(
  { date, classes, compact }: Pick<NightBreakdownSettings, "date" | "classes" | "compact">,
  controls?: HTMLElement,
): ChartSpec<BreakdownRow> {
  const rows = breakdownRows(nightTable, date, classes);
  const sentence = nightSentence(date);
  const year = Number(date.slice(0, 4));
  return {
    controls,
    title: `What was in one night: ${formatDate(date)}`,
    subtitle: sentence,
    howToRead:
      `Each bar is the published launches in one weapon class for the night ending ${formatDate(date)}. ` +
      MASSIVE_DEFINITION,
    description:
      `Bar chart of launches by weapon class for the night ending ${formatDate(date)}. ${sentence} ` +
      (rows.length
        ? rows
            .map((row) => `${classLabels[row.class]}: ${row.launched === null ? "not published" : count.format(row.launched)}.`)
            .join(" ")
        : "The classes shown have no report this night."),
    columns: [
      { key: "date", label: "Night ending", type: "date" },
      { key: "class", label: "Class", type: "class" },
      { key: "launched", label: "Launched", type: "number", measure: "launched", missing: "Not published" },
      {
        key: "n_unknown_launched",
        label: "Reports with no published launch count",
        type: "number",
        measure: "launch_derived",
      },
      { key: "places", label: "Launch areas named (not counted by area)", type: "text" },
      {
        key: "night_total",
        label: "Night total launched, all counted classes",
        type: "number",
        measure: "launched",
        missing: "Not published",
      },
      { key: "massive_above", label: "That year’s massive bar (massive means more)", type: "number", measure: "launch_derived", format: barValue.format },
      { key: "massive", label: "Massive night", type: "text" },
    ],
    rows,
    coverage: { from: date, to: barIsRestricted(nightTable, year) ? nightTable.lastDay : date },
    pointer: "shape",
    source: strikeSource(),
    footnote: footnote(
      "A night is the reports ending on one Kyiv date, without daytime reports. A class with no bar or row had no " +
        "report this night. Launches reported jointly for different classes are in “mixed” and aren’t split.",
      RESTRICTED_BAR_NOTE,
    ),
    draw(data, width) {
      const margin = 300;
      const plot = Plot.plot({
        ...plotDefaults,
        width,
        height: data.length * (compact ? COMPACT_ROW_HEIGHT : ROW_HEIGHT) + 50,
        marginTop: 6,
        marginLeft: margin,
        marginRight: 64,
        x: titledScale({
          label: "Published launches",
          grid: true,
          domain: [0, Math.max(1, ...data.map((r) => r.launched ?? 0))],
        }),
        y: {
          type: "band",
          domain: data.map((row) => row.class),
          label: null,
          padding: 0.25,
          tickFormat: (id: ClassId) => classLabels[id].replace(/ \(.*\)$/, ""),
        },
        color: classFillScale(classLabels),
        marks: [
          Plot.barX(data, { x: "launched", y: "class", fill: "class" }),
          // The number sits past the bar, so small classes stay readable beside large ones.
          Plot.text(data, {
            x: (row: BreakdownRow) => row.launched ?? 0,
            y: "class",
            text: (row: BreakdownRow) => (row.launched === null ? "Not published" : count.format(row.launched)),
            textAnchor: "start",
            dx: 6,
          }),
          Plot.ruleX([0]),
        ],
      });
      // One target per row of the chart, so a very short bar is as easy to pick as a long one.
      const targets = plotTargets(plot, data, { x: (r) => r.launched ?? 0, y: (r) => r.class });
      for (const target of targets) {
        const band = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const height = plot.scale("y")!.bandwidth!;
        band.setAttribute("x", "0");
        band.setAttribute("y", String(target.y - height / 2));
        band.setAttribute("width", String(width));
        band.setAttribute("height", String(height));
        band.setAttribute("fill", "transparent");
        plot.append(band);
        target.shape = band;
      }
      return { element: plot, targets };
    },
  };
}

/** The launch areas, always on screen: they are text, so they don't belong in the drawing. */
function placeList(date: string, classes: readonly ClassId[]): HTMLElement[] {
  const rows = breakdownRows(nightTable, date, classes);
  if (!rows.length) return [];
  const heading = create("h4", "", "Launch areas named in this night’s reports");
  heading.id = "night-places-title";
  const note = create(
    "p",
    "",
    "These are lists, not counts. One report can name several areas, and its launches can’t be divided among them. " +
      "A semicolon separates what different reports list.",
  );
  const table = create("table", "night-places");
  table.setAttribute("aria-labelledby", heading.id);
  const head = table.createTHead().insertRow();
  for (const label of ["Class", "Launch areas named"]) {
    const cell = create("th", "", label);
    cell.scope = "col";
    head.append(cell);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const name = create("th");
    name.scope = "row";
    name.append(...withTerms(classLabels[row.class]));
    body.insertRow().append(name, create("td", "", row.places));
  }
  return [heading, note, table];
}

export function nightBreakdown(settings: NightBreakdownSettings): HTMLElement {
  const wrapper = create("div", "night-breakdown");
  const choices = settings.choices ?? [];
  let controls: HTMLElement | undefined;
  let select: HTMLSelectElement | undefined;

  if (choices.length > 1) {
    controls = create("div", "night-controls");
    const label = create("label", "", "Massive night to show");
    select = create("select");
    select.id = "night-breakdown-date";
    label.htmlFor = select.id;
    for (const date of choices) select.add(new Option(formatDate(date), date));
    select.value = settings.date;
    controls.append(label, select);
  }

  const chart = liveChartFrame(spec(settings, controls));
  const places = create("div", "night-places-block");
  places.append(...placeList(settings.date, settings.classes));
  const context = nightContext(settings.date);
  // A guided stop shows what its caption describes first, so the year strip goes last there.
  wrapper.append(chart.element, ...(settings.compact ? [places, context.element] : [context.element, places]));

  select?.addEventListener("change", () => {
    const date = select.value;
    chart.update(spec({ ...settings, date }, controls));
    context.update(date);
    places.replaceChildren(...placeList(date, settings.classes));
    settings.onDateChange?.(date);
  });
  return wrapper;
}
