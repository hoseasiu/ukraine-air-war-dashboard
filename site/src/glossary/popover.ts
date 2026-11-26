/**
 * Glossary popovers, on the browser's popover attribute. That gives opening by
 * click, tap, Enter or Space, closing by Escape or a tap outside, the button's
 * expanded state, and focus going back to the button on close.
 */
import { GLOSSARY, splitTerms, TERM_IDS, type TermId } from "./terms.ts";
import "./glossary.css";

let count = 0;

function create<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

/** Below the button, or above it if there's no room, and always inside the window. */
function place(box: HTMLElement, button: HTMLElement): void {
  const gap = 6;
  const anchor = button.getBoundingClientRect();
  const { clientWidth, clientHeight } = document.documentElement;
  const left = Math.max(gap, Math.min(anchor.left, clientWidth - box.offsetWidth - gap));
  const below = anchor.bottom + gap;
  const top = below + box.offsetHeight <= clientHeight ? below : anchor.top - gap - box.offsetHeight;
  box.style.left = `${left}px`;
  box.style.top = `${Math.max(gap, Math.min(top, clientHeight - box.offsetHeight - gap))}px`;
}

/**
 * A button reading `text`, followed by its popover. All spans and buttons, so it
 * can sit inside a paragraph.
 */
function termPopover(id: TermId, text: string): [HTMLButtonElement, HTMLSpanElement] {
  const { term, definition } = GLOSSARY[id];
  const boxId = `term-${++count}`;

  const button = create("button", "term", text);
  button.type = "button";
  button.setAttribute("popovertarget", boxId);
  button.setAttribute("aria-haspopup", "dialog");

  const box = create("span", "term-popover");
  box.id = boxId;
  box.popover = "auto";
  box.setAttribute("role", "dialog");
  // Focus moves in on opening, so a screen reader reads the name and definition.
  box.tabIndex = -1;
  box.autofocus = true;

  const name = create("span", "term-name", term);
  name.id = `${boxId}-name`;
  const body = create("span", "term-definition", definition);
  body.id = `${boxId}-definition`;
  box.setAttribute("aria-labelledby", name.id);
  box.setAttribute("aria-describedby", body.id);

  // Touch and screen-reader users have no Escape key.
  const close = create("button", "term-close", "Close");
  close.type = "button";
  close.setAttribute("popovertarget", boxId);
  close.setAttribute("popovertargetaction", "hide");
  box.append(name, body, close);

  const follow = () => {
    // The page can be redrawn while a popover is open.
    if (box.isConnected) place(box, button);
    else unfollow();
  };
  const unfollow = () => {
    window.removeEventListener("scroll", follow, true);
    window.removeEventListener("resize", follow);
  };
  box.addEventListener("toggle", (event) => {
    unfollow();
    if ((event as ToggleEvent).newState !== "open") return;
    place(box, button);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
  });

  // Tabbing away closes it, so it can't cover whatever takes focus next.
  box.addEventListener("focusout", (event) => {
    const next = event.relatedTarget as Node | null;
    if (next && next !== button && !box.contains(next)) box.hidePopover();
  });

  return [button, box];
}

/**
 * The text with each glossary term in it turned into a popover button, for use
 * in append() or replaceChildren(). A term is marked once per `seen` set.
 * Don't use it inside a link, button or heading.
 */
export function withTerms(text: string, seen?: Set<TermId>): (Node | string)[] {
  return splitTerms(text, seen).flatMap<Node | string>((segment) =>
    typeof segment === "string" ? [segment] : termPopover(segment.id, segment.text),
  );
}

/** Every definition, written out. */
export function glossaryList(): HTMLDListElement {
  const list = create("dl", "glossary");
  for (const id of TERM_IDS) {
    list.append(create("dt", "", GLOSSARY[id].term), create("dd", "", GLOSSARY[id].definition));
  }
  return list;
}
