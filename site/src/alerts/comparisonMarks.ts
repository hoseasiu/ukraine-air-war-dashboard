/**
 * What the oblast comparison adds to Plot's drawing and key: the names at the
 * lines' ends, and the choice of one line to stand out.
 */
import type { Plot } from "@observablehq/plot";
import type { AreaStyle } from "../theme/areaStyles.ts";
import { areaSymbolPath, svgElement } from "../theme/marks.ts";
import { endLabel, spreadLabels, type ComparisonRow } from "./comparisonData.ts";

/** The part of a Plot drawing these add to. */
type Drawn = SVGSVGElement & Plot;

/** The plot area's top and bottom, in pixels from the top of the drawing. */
export interface Frame {
  top: number;
  bottom: number;
}

const LABEL_GAP = 20;

/** Room to leave right of the plot for the longest name. */
export function endLabelRoom(names: readonly string[]): number {
  return 40 + 9 * Math.max(0, ...names.map((name) => endLabel(name).length));
}

/** Writes each oblast's name after its line, with its symbol, moved apart where lines end close together. */
export function endLabels(
  plot: Drawn,
  rows: readonly ComparisonRow[],
  oblasts: readonly string[],
  styleOf: (id: string) => AreaStyle,
  { top, bottom }: Frame,
): void {
  const x = plot.scale("x")!;
  const y = plot.scale("y")!;
  const last = rows.at(-1)!.month;
  const ends = oblasts.map((id) => rows.find((row) => row.month === last && row.oblast === id)!);
  const wanted = ends.map((row) => Number(y.apply(row.hours)));
  const placed = spreadLabels(wanted, LABEL_GAP, top, bottom);
  const from = Number(x.apply(last)) + x.bandwidth! / 2;
  ends.forEach((row, index) => {
    const style = styleOf(row.oblast);
    const at = placed[index]!;
    const group = svgElement("g", { class: "comparison-end", "data-oblast": row.oblast });
    // The leader and symbol tie a moved name back to its own line.
    const leader = svgElement("path", {
      d: `M${from + 6},${wanted[index]}L${from + 14},${at}`,
      stroke: style.color,
      "stroke-width": 1.5,
      fill: "none",
    });
    const symbol = svgElement("path", {
      d: areaSymbolPath(style, 80),
      transform: `translate(${from + 20},${at})`,
      fill: style.color,
    });
    const text = svgElement("text", { x: from + 29, y: at, dy: "0.35em", "text-anchor": "start", class: "comparison-end-label" });
    text.textContent = endLabel(row.name);
    group.append(leader, symbol, text);
    plot.append(group);
  });
}

/**
 * Which line stands out. Pointing at a key button picks its oblast for as long
 * as the pointer is there; pressing it holds the choice. The others are drawn
 * lighter. At rest all lines are drawn alike, so none is singled out.
 */
export function focusControl() {
  let held: string | undefined;
  let pointed: string | undefined;
  let drawing: Element | undefined;
  const buttons = new Map<string, HTMLButtonElement>();

  function apply(): void {
    const focus = pointed ?? held;
    for (const part of drawing?.querySelectorAll<SVGElement>("[data-oblast]") ?? []) {
      part.classList.toggle("comparison-lighter", focus !== undefined && part.dataset.oblast !== focus);
      part.classList.toggle("comparison-focus", part.dataset.oblast === focus);
    }
    for (const [id, button] of buttons) button.setAttribute("aria-pressed", String(id === held));
  }

  return {
    /** The button for an oblast's key item. */
    button(id: string): HTMLButtonElement {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "comparison-key-button";
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        held = held === id ? undefined : id;
        // Letting go shows every line at once, even with the pointer still on the button.
        pointed = undefined;
        apply();
      });
      button.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "touch") return;
        pointed = id;
        apply();
      });
      button.addEventListener("pointerleave", () => {
        pointed = undefined;
        apply();
      });
      buttons.set(id, button);
      return button;
    },
    /** A new drawing, after a resize, takes the same choice. */
    show(next: Element): void {
      drawing = next;
      apply();
    },
  };
}

export type FocusControl = ReturnType<typeof focusControl>;
