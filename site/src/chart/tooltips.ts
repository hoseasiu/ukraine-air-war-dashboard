/**
 * Tooltips for pointer, touch and keyboard.
 *
 * Each target gets a button laid over the chart. Together they're one tab stop:
 * arrow keys, Home and End move between them, and each button's name holds the
 * same text as its tooltip. The pointer doesn't need to hit a button; the
 * nearest target wins. Escape dismisses, and the pointer can rest on the
 * tooltip without it going away (WCAG 1.4.13).
 *
 * Arrow, Home, End and Escape key presses used here are stopped and marked
 * handled, so page-level shortcuts (such as guided-mode stepping) can ignore them.
 */

export interface TooltipContent {
  heading: string;
  groups: { heading: string; values: { label: string; value: string; missing: boolean }[] }[];
  notes: string[];
}

export interface PlacedTooltip {
  x: number;
  y: number;
  /** For "shape" pointing: the part of the drawing that picks this target. */
  shape?: Element;
  content: TooltipContent;
}

/** How far from a point the pointer still picks it, in "xy" mode. */
const REACH = 40;

function spoken({ heading, groups, notes }: TooltipContent): string {
  const parts = groups.map((group) =>
    [group.heading, ...group.values.map(({ label, value }) => `${label}: ${value}`)].filter(Boolean).join(", "),
  );
  return [heading, ...parts, ...notes].filter(Boolean).join(". ");
}

function line(className: string, text: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  return div;
}

function fill(box: HTMLElement, { heading, groups, notes }: TooltipContent): void {
  box.replaceChildren();
  if (heading) box.append(line("tooltip-heading", heading));
  for (const group of groups) {
    if (group.heading) box.append(line("tooltip-group", group.heading));
    for (const { label, value, missing } of group.values) {
      // The value leads and its label follows, except where there is no value.
      const row = line("tooltip-value", "");
      const strong = document.createElement("strong");
      strong.textContent = value;
      if (missing) row.append(`${label}: `, strong);
      else row.append(strong, ` ${label}`);
      box.append(row);
    }
  }
  for (const note of notes) box.append(line("tooltip-note", `Note: ${note}`));
}

export function attachTooltips(stage: HTMLElement, pointer: "x" | "xy" | "shape") {
  let targets: PlacedTooltip[] = [];
  let buttons: HTMLButtonElement[] = [];
  let tabStop = 0;
  let shown = -1;
  let mark: ((index: number | null) => void) | undefined;

  const box = document.createElement("div");
  box.className = "chart-tooltip";
  // The focused button's name already says this.
  box.setAttribute("aria-hidden", "true");
  box.hidden = true;

  const points = document.createElement("div");
  points.className = "chart-points";
  points.setAttribute("role", "group");

  function hide(): void {
    box.hidden = true;
    mark?.(null);
    buttons[shown]?.classList.remove("active");
    shown = -1;
  }

  function show(index: number): void {
    const target = targets[index];
    if (!target) return hide();
    if (index === shown) return;
    hide();
    shown = index;
    buttons[index]!.classList.add("active");
    mark?.(index);
    fill(box, target.content);
    box.hidden = false;
    // Beside the point, flipped or clamped to stay on the chart.
    const gap = 12;
    const right = target.x + gap + box.offsetWidth <= stage.clientWidth;
    box.style.left = `${Math.max(0, right ? target.x + gap : target.x - gap - box.offsetWidth)}px`;
    box.style.top = `${Math.max(0, Math.min(target.y - box.offsetHeight / 2, stage.clientHeight - box.offsetHeight))}px`;
  }

  function nearest(x: number, y: number): number {
    let best = -1;
    let bestDistance = Infinity;
    targets.forEach((target, index) => {
      const distance = pointer === "x" ? Math.abs(target.x - x) : Math.hypot(target.x - x, target.y - y);
      if (distance < bestDistance) [best, bestDistance] = [index, distance];
    });
    return pointer === "xy" && bestDistance > REACH ? -1 : best;
  }

  function focusedIndex(): number {
    return buttons.indexOf(document.activeElement as HTMLButtonElement);
  }

  function track(event: PointerEvent): void {
    if (box.contains(event.target as Node)) return;
    const bounds = stage.getBoundingClientRect();
    const index =
      pointer === "shape"
        ? targets.findIndex((target) => target.shape?.contains(event.target as Node))
        : nearest(event.clientX - bounds.left, event.clientY - bounds.top);
    if (index < 0) hide();
    else show(index);
  }

  stage.addEventListener("pointermove", track);
  stage.addEventListener("pointerdown", track);
  stage.addEventListener("pointerleave", (event) => {
    // A finger lifting also "leaves"; the tapped tooltip should stay.
    if (event.pointerType === "touch") return;
    const focused = focusedIndex();
    if (focused >= 0) show(focused);
    else hide();
  });

  // Escape also has to dismiss a tooltip opened by the pointer, with focus elsewhere.
  // The listener only lives while the pointer is over the chart.
  const escape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || box.hidden) return;
    hide();
    event.preventDefault();
    event.stopPropagation();
  };
  stage.addEventListener("pointerenter", () => document.addEventListener("keydown", escape, true));
  stage.addEventListener("pointerleave", () => document.removeEventListener("keydown", escape, true));

  points.addEventListener("keydown", (event) => {
    const index = focusedIndex();
    if (index < 0) return;
    if (event.key === "Escape") {
      if (box.hidden) return;
      hide();
    } else {
      const next = {
        ArrowRight: index + 1,
        ArrowDown: index + 1,
        ArrowLeft: index - 1,
        ArrowUp: index - 1,
        Home: 0,
        End: buttons.length - 1,
      }[event.key];
      if (next === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
      buttons[Math.max(0, Math.min(next, buttons.length - 1))]!.focus();
    }
    event.preventDefault();
    event.stopPropagation();
  });

  points.addEventListener("focusin", () => {
    const index = focusedIndex();
    if (index < 0) return;
    buttons[tabStop]!.tabIndex = -1;
    tabStop = index;
    buttons[tabStop]!.tabIndex = 0;
    // Redraw even if the pointer already opened this one, then keep it on screen.
    hide();
    show(index);
  });
  points.addEventListener("focusout", (event) => {
    if (!points.contains(event.relatedTarget as Node | null)) hide();
  });
  // Enter or Space brings back a tooltip dismissed with Escape.
  points.addEventListener("click", () => {
    const index = focusedIndex();
    if (index >= 0) show(index);
  });

  return {
    /** Replaces the drawing and its targets, keeping keyboard focus where it was. */
    update(drawing: Element, next: PlacedTooltip[], onShow?: (index: number | null) => void): void {
      const refocus = focusedIndex() >= 0;
      hide();
      mark = onShow;
      targets = next;
      tabStop = Math.min(tabStop, Math.max(0, targets.length - 1));
      buttons = targets.map((target, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chart-point";
        button.style.left = `${target.x}px`;
        button.style.top = `${target.y}px`;
        button.tabIndex = index === tabStop ? 0 : -1;
        button.setAttribute("aria-label", spoken(target.content));
        return button;
      });
      points.setAttribute("aria-label", `${targets.length} data points. Use the arrow keys to move between them.`);
      points.replaceChildren(...buttons);
      stage.replaceChildren(drawing, points, box);
      if (refocus) buttons[tabStop]?.focus();
    },
  };
}
