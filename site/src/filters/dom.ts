import type { Filters } from "./state.ts";

/** One group of filter controls. */
export interface Part {
  element: HTMLElement;
  show(filters: Filters): void;
}

export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
