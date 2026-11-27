/**
 * The filter controls: a one-line bar that stays on screen and opens a panel of
 * native sliders, checkboxes and buttons, so they work from the keyboard without
 * custom key handling. They don't keep the filters: they show what they're given
 * and report each change.
 */
import { alertAreas, excludedAlertAreas, weaponClasses } from "../data.ts";
import { classKeyFill, svgElement } from "../theme/marks.ts";
import { primerHash } from "../weapons/weaponData.ts";
import { dateRange, formatRange } from "./dateRange.ts";
import { disclosure, reserveSpace } from "./disclosure.ts";
import { create, type Part } from "./dom.ts";
import { MAX_OBLASTS, type FilterBounds, type Filters } from "./state.ts";
import "./filters.css";

export interface FilterOptions {
  bounds: FilterBounds;
  /** Shows the oblast picker, which only the alerts tab uses. */
  oblasts: boolean;
  /** The filters in the URL. */
  read(): Filters;
  /** Stores new filters and redraws what depends on them. */
  write(filters: Filters): void;
  reset(): void;
}

function areaName(id: string): string {
  const area = alertAreas.find((candidate) => candidate.id === id);
  if (!area) throw new Error(`Unknown oblast: ${id}`);
  return area.name;
}

/** "Sep 2022 – Nov 2026 · 5 of 6 classes · Lviv oblast" */
export function describeFilters(filters: Filters, withOblasts: boolean): string {
  const parts = [formatRange(filters.from, filters.to)];
  const total = weaponClasses.length;
  const chosen = filters.classes.length;
  parts.push(
    chosen === total ? "all classes" : chosen ? `${chosen} of ${total} classes` : "no classes",
  );
  if (withOblasts) parts.push(filters.oblasts.map(areaName).join(", ") || "no oblasts chosen");
  return parts.join(" · ");
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
    swatch.append(svgElement("rect", { width: 24, height: 16, fill: classKeyFill(id) }));
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

  // The labels belong to the checkboxes, so the link to the primer is a line of its own.
  const primer = create("a", "filter-primer", "What each weapon class includes");
  primer.href = primerHash();
  fieldset.append(primer);

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

  const toggle = create("button", "filter-toggle");
  toggle.type = "button";
  const summary = create("span", "filter-summary");
  const action = create("span", "filter-action");
  toggle.append(summary, " ", action);

  const panel = create("div", "filter-panel");
  panel.id = "filter-panel";
  toggle.setAttribute("aria-controls", panel.id);

  // Screen readers announce a live region only if it was on the page before its text changed.
  const announcer = create("p", "visually-hidden");
  announcer.setAttribute("role", "status");
  const reset = create("button", "filter-reset", "Reset filters");
  reset.type = "button";

  const parts: Part[] = [];

  function show(announce: boolean): void {
    const filters = options.read();
    for (const part of parts) part.show(filters);
    const text = describeFilters(filters, options.oblasts);
    summary.textContent = text;
    if (announce) announcer.textContent = `Selected: ${text}`;
  }

  function commit(change: Partial<Filters>): void {
    options.write({ ...options.read(), ...change });
    show(true);
  }

  parts.push(dateRange(options.bounds, options.read, commit), classToggles(options, commit));
  if (options.oblasts) parts.push(oblastPicker(options, commit));

  reset.addEventListener("click", () => {
    options.reset();
    show(true);
  });

  panel.append(...parts.map((part) => part.element), reset);
  section.append(toggle, panel, announcer);
  disclosure(section, toggle, panel, (open) => {
    action.textContent = open ? "Close" : "Edit";
  });
  reserveSpace(toggle);

  show(false);
  return section;
}

/** What the filters do and don't cover on a tab. It shows whether or not the panel is open. */
export function filterNotes(notes: readonly string[]): HTMLElement {
  const wrapper = create("div", "filter-notes");
  for (const note of notes) wrapper.append(create("p", "", note));
  return wrapper;
}
