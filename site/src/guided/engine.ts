/**
 * Guided mode: steps through STOPS. The URL hash is its only lasting state;
 * whether a stop's reveal is showing is kept only while that stop is up. It
 * never reads or writes the query string, which belongs to the exploration
 * filters.
 */
import { withTerms } from "../glossary/popover.ts";
import { promptList } from "../teaching/promptList.ts";
import { stepFrom, type Position } from "./steps.ts";
import { STOPS, type Stop } from "./stops.ts";
import { renderView } from "./views.ts";
import "./guided.css";

/** Presentation clickers usually send Page Up and Page Down. */
const KEY_STEPS: Record<string, 1 | -1> = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 };

const stopHash = (number: number) => `#stop-${number}`;

/** Where the "Guided" nav link goes. */
export const FIRST_STOP_HASH = stopHash(1);

/**
 * The stop number a hash asks for, or null if it isn't a stop link. A number out
 * of range goes to the nearest stop, so an old link still lands in guided mode.
 */
export function parseStopHash(hash: string): number | null {
  const match = /^#stop-(\d+)$/.exec(hash);
  return match ? Math.min(Math.max(Number(match[1]), 1), STOPS.length) : null;
}

/** True if the focused element needs this key for itself. */
function keyBelongsToTarget(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, select, textarea, [contenteditable]:not([contenteditable='false']), [role='slider']")) {
    return true;
  }
  // Left and right scroll a wide table, but only if it has somewhere to scroll.
  const scroller = key.startsWith("Arrow") ? target.closest(".table-scroll") : null;
  return scroller !== null && scroller.scrollWidth > scroller.clientWidth;
}

function create<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = create("button", className);
  element.type = "button";
  element.textContent = text;
  element.addEventListener("click", onClick);
  return element;
}

export interface GuidedMode {
  /** Shows a stop in the container, entering guided mode if needed. Returns the document title. */
  show(number: number): string;
}

export function createGuidedMode(container: HTMLElement): GuidedMode {
  // These elements last as long as the page does. Only their contents change
  // between stops, so keyboard focus stays where it is.
  const root = create("div", "guided");
  const heading = create("h2", "stop-title");
  heading.tabIndex = -1;
  const caption = create("p", "stop-caption");
  const prompts = create("div", "stop-prompts");
  const view = create("div", "stop-view");
  // Hidden on stops with nothing to reveal.
  const revealButton = button("", "stop-button stop-reveal", () => toggleReveal());

  const back = button("Back", "stop-button", () => move(-1));
  const next = button("Next", "stop-button", () => move(1));
  const indicator = create("p", "stop-indicator");
  const controls = create("div", "stop-controls");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Guided mode controls");
  controls.append(back, indicator, next, revealButton);

  // Screen readers announce a live region only if it was on the page before its text changed.
  const announcer = create("p", "visually-hidden");
  announcer.setAttribute("role", "status");

  root.append(heading, caption, prompts, view, controls, announcer);

  /** The stop on screen, which can lag behind the URL for a moment. */
  let shownStop = 0;
  /** The stop whose reveal is showing, or about to be, or null. */
  let revealedStop: number | null = null;

  /**
   * Moves forward or back from the stop in the URL, which changes at once. The
   * page redraws a moment later, so counting from what's on screen would lose a
   * quick second press. Replaces the history entry, so the browser's Back button
   * leaves guided mode in one press.
   */
  function move(step: 1 | -1): void {
    const stop = parseStopHash(window.location.hash);
    if (stop === null) return;
    const from: Position = { stop, revealed: revealedStop === stop };
    const to = stepFrom(STOPS, from, step);
    if (to === from) return;
    revealedStop = to.revealed ? to.stop : null;
    if (to.stop !== stop) window.location.replace(stopHash(to.stop));
    // If this stop isn't drawn yet, drawing it will pick up revealedStop.
    else if (shownStop === stop) switchView();
  }

  function toggleReveal(): void {
    if (parseStopHash(window.location.hash) !== shownStop) return;
    revealedStop = revealedStop === shownStop ? null : shownStop;
    switchView();
  }

  /** Draws the stop's view, or its reveal in the view's place. */
  function drawView(stop: Stop): void {
    const revealed = revealedStop === shownStop;
    view.replaceChildren();
    renderView(view, revealed && stop.reveal ? stop.reveal.view : stop.view);
    revealButton.hidden = !stop.reveal;
    if (stop.reveal) revealButton.textContent = `Show ${revealed ? stop.reveal.hides : stop.reveal.name}`;
    // aria-disabled rather than disabled, which would drop focus at either end.
    back.setAttribute("aria-disabled", String(shownStop === 1 && !revealed));
    next.setAttribute("aria-disabled", String(shownStop === STOPS.length && (!stop.reveal || revealed)));
  }

  /** Shows or hides the reveal without leaving the stop. */
  function switchView(): void {
    const stop = STOPS[shownStop - 1]!;
    // Focus inside the old view goes away with it.
    const focusWasInView = view.contains(document.activeElement);
    drawView(stop);
    announcer.textContent = `Now showing ${revealedStop === shownStop ? stop.reveal!.name : stop.reveal!.hides}.`;
    if (focusWasInView) heading.focus({ preventScroll: true });
  }

  window.addEventListener("keydown", (event) => {
    const step = KEY_STEPS[event.key];
    if (step === undefined || !root.isConnected) return;
    // Leave shortcuts alone, such as Alt+Left for the browser's Back.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
    if (keyBelongsToTarget(event.target, event.key)) return;
    event.preventDefault();
    // A held key shouldn't race through the stops.
    if (!event.repeat) move(step);
  });

  function fill(stop: Stop, number: number): void {
    // Focus inside any of these, such as on a glossary term, goes away with the old stop.
    const focusWasReplaced =
      [caption, prompts, view].some((part) => part.contains(document.activeElement)) ||
      (!stop.reveal && document.activeElement === revealButton);
    shownStop = number;
    heading.textContent = stop.title;
    caption.replaceChildren(...withTerms(stop.caption));
    prompts.replaceChildren(...(stop.prompts ? [promptList(stop.prompts)] : []));
    drawView(stop);
    indicator.textContent = `Stop ${number} / ${STOPS.length}`;
    if (focusWasReplaced) heading.focus({ preventScroll: true });
  }

  return {
    show(number) {
      const entering = !root.isConnected;
      const stop = STOPS[number - 1]!;
      if (window.location.hash !== stopHash(number)) {
        window.history.replaceState(window.history.state, "", stopHash(number));
      }
      // Coming back to a stop starts with its reveal hidden.
      if (entering || revealedStop !== number) revealedStop = null;
      if (entering) {
        // The caller moves focus to the heading, so there's nothing to announce.
        announcer.textContent = "";
        container.replaceChildren(root);
      }
      fill(stop, number);
      const position = `Stop ${number} of ${STOPS.length}`;
      if (!entering) {
        announcer.textContent = [`${position}.`, `${stop.title}.`, stop.caption, ...(stop.prompts ?? [])].join(" ");
      }
      return `${position}: ${stop.title}`;
    },
  };
}
