/**
 * The filter controls: native sliders, checkboxes and buttons, so they work
 * from the keyboard without custom key handling. They keep no state of their
 * own: they show what they're given and report each change.
 */
import { formatMonth } from "../chart/chartFrame.ts";
import { alertAreas, excludedAlertAreas, weaponClasses } from "../data.ts";
import { classFill, svgElement } from "../theme/marks.ts";
import { MAX_OBLASTS, monthFromNumber, monthNumber, type FilterBounds, type Filters } from "./state.ts";
import "./filters.css";

export interface FilterOptions {
  bounds: FilterBounds;
  /** Shows the oblast picker, which only the alerts tab uses. */
  oblasts: boolean;
  /** Sentences about what the filters do and don't cover on this tab. */
  notes: readonly string[];
  /** The filters in the URL. */
  read(): Filters;
  /** Stores new filters and redraws what depends on them. */
  write(filters: Filters): void;
  reset(): void;
}

function create<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function areaName(id: string): string {
  const area = alertAreas.find((candidate) => candidate.id === id);
  if (!area) throw new Error(`Unknown oblast: ${id}`);
  return area.name;
}

/** "Sep 2022 to Nov 2026 · 5 of 6 weapon classes · Lviv oblast" */
export function describeFilters(filters: Filters, withOblasts: boolean): string {
  const parts = [`${formatMonth(filters.from)} to ${formatMonth(filters.to)}`];
  const total = weaponClasses.length;
  const chosen = filters.classes.length;
  parts.push(
    chosen === total ? "all weapon classes" : chosen ? `${chosen} of ${total} weapon classes` : "no weapon classes",
  );
  if (withOblasts) parts.push(filters.oblasts.map(areaName).join(", ") || "no oblasts chosen");
  return parts.join(" · ");
}

interface Part {
  element: HTMLElement;
  show(filters: Filters): void;
}

function dateRange(options: FilterOptions, commit: (change: Partial<Filters>) => void): Part {
  const fieldset = create("fieldset", "filter-dates");
  fieldset.append(create("legend", "", "Months shown"));

  function slider(end: "from" | "to", text: string) {
    const row = create("div", "filter-slider");
    const label = create("label", "", text);
    const input = create("input");
    input.type = "range";
    input.id = `filter-${end}`;
    input.min = String(monthNumber(options.bounds.firstMonth));
    input.max = String(monthNumber(options.bounds.lastMonth));
    input.step = "1";
    label.htmlFor = input.id;
    // The slider announces the same text itself, so hide the copy from screen readers.
    const value = create("span", "filter-value");
    value.setAttribute("aria-hidden", "true");
    row.append(label, input, value);
    fieldset.append(row);

    const showMonth = (month: string) => {
      value.textContent = formatMonth(month);
      input.setAttribute("aria-valuetext", formatMonth(month));
    };
    return { input, showMonth };
  }

  const from = slider("from", "From");
  const to = slider("to", "To");

  for (const [end, other, mine] of [
    ["from", to, from],
    ["to", from, to],
  ] as const) {
    /** One slider stops where it meets the other. */
    const clamped = () => {
      const value = Number(mine.input.value);
      const limit = Number(other.input.value);
      const allowed = end === "from" ? Math.min(value, limit) : Math.max(value, limit);
      mine.input.value = String(allowed);
      return monthFromNumber(allowed);
    };
    // "input" fires all through a drag, so the URL and the page wait for "change".
    mine.input.addEventListener("input", () => mine.showMonth(clamped()));
    mine.input.addEventListener("change", () => commit({ [end]: clamped() }));
  }

  return {
    element: fieldset,
    show(filters) {
      for (const [slide, month] of [
        [from, filters.from],
        [to, filters.to],
      ] as const) {
        slide.input.value = String(monthNumber(month));
        slide.showMonth(month);
      }
    },
  };
}

function checkbox(text: string): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = create("label", "filter-check");
  const input = create("input");
  input.type = "checkbox";
  label.append(input, text);
  return { label, input };
}

function classToggles(options: FilterOptions, commit: (change: Partial<Filters>) => void): Part {
  const fieldset = create("fieldset", "filter-classes");
  fieldset.append(create("legend", "", "Weapon classes"));
  const boxes = weaponClasses.map(({ id, label: name }) => {
    const { label, input } = checkbox(name);
    const swatch = svgElement("svg", { width: 24, height: 16, "aria-hidden": "true", focusable: "false" });
    swatch.append(svgElement("rect", { width: 24, height: 16, fill: classFill(id) }));
    input.after(swatch);
    fieldset.append(label);
    input.addEventListener("change", () => {
      const chosen = new Set(options.read().classes);
      if (input.checked) chosen.add(id);
      else chosen.delete(id);
      commit({ classes: weaponClasses.map((c) => c.id).filter((candidate) => chosen.has(candidate)) });
    });
    return { id, input };
  });

  return {
    element: fieldset,
    show(filters) {
      for (const { id, input } of boxes) input.checked = filters.classes.includes(id);
    },
  };
}

function oblastPicker(options: FilterOptions, commit: (change: Partial<Filters>) => void): Part {
  const details = create("details", "filter-oblasts");
  const summary = create("summary");

  const fieldset = create("fieldset");
  fieldset.append(create("legend", "visually-hidden", `Oblasts to compare, up to ${MAX_OBLASTS}`));
  const limit = create("p", "filter-limit");
  limit.id = "filter-oblast-limit";
  const list = create("div", "filter-oblast-list");
  const boxes = [...alertAreas]
    .filter((area) => area.inAlertTotals)
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map(({ id, name }) => {
      const { label, input } = checkbox(name);
      list.append(label);
      // aria-disabled rather than disabled, so the box stays reachable and says why.
      input.addEventListener("click", (event) => {
        if (input.getAttribute("aria-disabled") === "true") event.preventDefault();
      });
      input.addEventListener("change", () => {
        const others = options.read().oblasts.filter((chosen) => chosen !== id);
        commit({ oblasts: input.checked ? [...others, id] : others });
      });
      return { id, label, input };
    });

  // Excluded areas are named with the reason, so their absence doesn't read as zero.
  const excluded = create("p", "filter-excluded");
  excluded.textContent =
    `Not available, because the alert data doesn’t cover them: ${excludedAlertAreas().join(", ")}. ` +
    "This doesn’t mean they had no alerts.";
  fieldset.append(limit, list, excluded);
  details.append(summary, fieldset);

  return {
    element: details,
    show(filters) {
      const full = filters.oblasts.length >= MAX_OBLASTS;
      summary.textContent = `Oblasts to compare (${filters.oblasts.length} of ${MAX_OBLASTS}): ${
        filters.oblasts.map(areaName).join(", ") || "none chosen"
      }`;
      limit.textContent = full
        ? `You’ve chosen ${MAX_OBLASTS}. Clear one to choose another.`
        : `Choose up to ${MAX_OBLASTS}.`;
      for (const { id, label, input } of boxes) {
        const checked = filters.oblasts.includes(id);
        input.checked = checked;
        const blocked = full && !checked;
        label.classList.toggle("unavailable", blocked);
        if (blocked) {
          input.setAttribute("aria-disabled", "true");
          input.setAttribute("aria-describedby", limit.id);
        } else {
          input.removeAttribute("aria-disabled");
          input.removeAttribute("aria-describedby");
        }
      }
    },
  };
}

export function filterControls(options: FilterOptions): HTMLElement {
  const section = create("section", "filters");
  section.setAttribute("aria-label", "Filters");

  const parts: Part[] = [];
  const summary = create("p", "filter-summary");
  // Screen readers announce a live region only if it was on the page before its text changed.
  const announcer = create("p", "visually-hidden");
  announcer.setAttribute("role", "status");
  const reset = create("button", "filter-reset", "Reset filters");
  reset.type = "button";

  function show(announce: boolean): void {
    const filters = options.read();
    for (const part of parts) part.show(filters);
    const text = describeFilters(filters, options.oblasts);
    summary.textContent = `Selected: ${text}`;
    if (announce) announcer.textContent = summary.textContent;
  }

  function commit(change: Partial<Filters>): void {
    options.write({ ...options.read(), ...change });
    show(true);
  }

  parts.push(dateRange(options, commit), classToggles(options, commit));
  if (options.oblasts) parts.push(oblastPicker(options, commit));

  reset.addEventListener("click", () => {
    options.reset();
    show(true);
  });

  section.append(...parts.map((part) => part.element));
  for (const note of options.notes) section.append(create("p", "filter-note", note));
  const footer = create("div", "filter-footer");
  footer.append(summary, reset);
  section.append(footer, announcer);

  show(false);
  return section;
}
