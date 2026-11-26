import { classKey } from "../classKey.ts";
import type { StopView } from "./stops.ts";

/** Draws a stop's view into an empty container. */
export function renderView(container: HTMLElement, view: StopView): void {
  switch (view.kind) {
    case "none":
      return;
    case "class-key":
      container.append(classKey(view.highlight));
      return;
    default:
      // Fails the type check if a kind of view has no case above.
      view satisfies never;
  }
}
