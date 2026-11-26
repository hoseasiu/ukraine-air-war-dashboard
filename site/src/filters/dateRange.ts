/**
 * The month filter: two native sliders drawn on one track, one thumb each, and
 * preset buttons. The keyboard uses the sliders as they are. Their own pointer
 * handling is off (see filters.css), because the one on top would take every
 * press, so this file moves the thumbs for a mouse, pen or finger.
 */
import { formatMonth } from "../chart/chartFrame.ts";
import { create, type Part } from "./dom.ts";
import { datePresets, monthFromNumber, monthNumber, type FilterBounds, type Filters } from "./state.ts";

/** "Jan 2024 – Dec 2024", or just the month if both ends are the same. */
export function formatRange(from: string, to: string): string {
  return from === to ? formatMonth(from) : `${formatMonth(from)} – ${formatMonth(to)}`;
}

type End = "from" | "to";

export function dateRange(
  bounds: FilterBounds,
  read: () => Filters,
  commit: (change: Partial<Filters>) => void,
): Part {
  const first = monthNumber(bounds.firstMonth);
  const last = monthNumber(bounds.lastMonth);

  const fieldset = create("fieldset", "filter-dates");
  fieldset.append(create("legend", "", "Months shown"));

  const track = create("div", "filter-range");
  const rail = create("div", "filter-rail");
  rail.append(create("div", "filter-rail-fill"));
  track.append(rail);

  function slider(name: string): HTMLInputElement {
    const input = create("input");
    input.type = "range";
    input.min = String(first);
    input.max = String(last);
    input.step = "1";
    input.setAttribute("aria-label", name);
    track.append(input);
    return input;
  }
  const inputs: Record<End, HTMLInputElement> = { from: slider("First month"), to: slider("Last month") };

  // Each slider announces its own month, so hide this copy from screen readers.
  const value = create("span", "filter-value");
  value.setAttribute("aria-hidden", "true");

  const monthOf = (end: End) => monthFromNumber(Number(inputs[end].value));

  /** Redraws the fill and the text from the two sliders. */
  function draw(): void {
    for (const end of ["from", "to"] as const) {
      inputs[end].setAttribute("aria-valuetext", formatMonth(monthOf(end)));
      const share = (Number(inputs[end].value) - first) / Math.max(1, last - first);
      track.style.setProperty(`--range-${end}`, String(share));
    }
    value.textContent = formatRange(monthOf("from"), monthOf("to"));
  }

  /** Moves one thumb, which stops where it meets the other. */
  function place(end: End, month: number): void {
    const within = Math.min(Math.max(month, first), last);
    const limit = Number(inputs[end === "from" ? "to" : "from"].value);
    inputs[end].value = String(end === "from" ? Math.min(within, limit) : Math.max(within, limit));
    draw();
  }

  for (const end of ["from", "to"] as const) {
    // "input" fires all through a held key, so the URL and the page wait for "change".
    inputs[end].addEventListener("input", () => place(end, Number(inputs[end].value)));
    inputs[end].addEventListener("change", () => commit({ [end]: monthOf(end) }));
  }

  /** The month under the pointer. A thumb's center stops half a thumb from each end. */
  function monthAt(clientX: number): number {
    const box = rail.getBoundingClientRect();
    return Math.round(first + ((clientX - box.left) / box.width) * (last - first));
  }

  /** The drag under way. `end` is null while both thumbs are under the pointer. */
  let drag: { pointer: number; end: End | null } | null = null;

  function follow(clientX: number): void {
    if (!drag) return;
    const month = monthAt(clientX);
    if (!drag.end) {
      // Both thumbs are on one month, so the first move away from it picks one.
      const shared = Number(inputs.from.value);
      if (month === shared) return;
      drag.end = month < shared ? "from" : "to";
      inputs[drag.end].focus({ preventScroll: true });
    }
    place(drag.end, month);
  }

  track.addEventListener("pointerdown", (event) => {
    if (drag || event.button !== 0) return;
    event.preventDefault();
    track.setPointerCapture(event.pointerId);
    const month = monthAt(event.clientX);
    const from = Number(inputs.from.value);
    const to = Number(inputs.to.value);
    let end: End | null = null;
    if (from !== to) end = Math.abs(month - from) <= Math.abs(month - to) ? "from" : "to";
    else if (month !== from) end = month < from ? "from" : "to";
    drag = { pointer: event.pointerId, end };
    inputs[end ?? "to"].focus({ preventScroll: true });
    follow(event.clientX);
  });
  track.addEventListener("pointermove", (event) => {
    if (drag?.pointer === event.pointerId) follow(event.clientX);
  });
  track.addEventListener("pointerup", (event) => {
    if (drag?.pointer !== event.pointerId) return;
    drag = null;
    const filters = read();
    if (monthOf("from") !== filters.from || monthOf("to") !== filters.to) {
      commit({ from: monthOf("from"), to: monthOf("to") });
    }
  });
  // A touch that turns into a scroll is cancelled, so the thumbs go back.
  track.addEventListener("pointercancel", (event) => {
    if (drag?.pointer !== event.pointerId) return;
    drag = null;
    show(read());
  });

  const presetRow = create("div", "filter-presets");
  presetRow.setAttribute("role", "group");
  presetRow.setAttribute("aria-label", "Date presets");
  const presets = datePresets(bounds).map((preset) => {
    const button = create("button", "filter-preset", preset.label);
    button.type = "button";
    button.addEventListener("click", () => commit({ from: preset.from, to: preset.to }));
    presetRow.append(button);
    return { ...preset, button };
  });

  function show(filters: Filters): void {
    // Set both values before drawing, with no clamping between the two sliders.
    inputs.from.value = String(monthNumber(filters.from));
    inputs.to.value = String(monthNumber(filters.to));
    draw();
    for (const { button, from, to } of presets) {
      button.setAttribute("aria-pressed", String(from === filters.from && to === filters.to));
    }
  }

  const row = create("div", "filter-range-row");
  row.append(track, value);
  fieldset.append(row, presetRow);
  return { element: fieldset, show };
}
