/**
 * The strip at the top of a tab: each data-quality flag its charts show, listed
 * once, with the full text behind a disclosure. It reads the badges on the page,
 * so it can't list a different set from the charts.
 */
import { withTerms } from "../glossary/popover.ts";
import type { TermId } from "../glossary/terms.ts";
import { FLAG_TEXT, notesFlags } from "./flags.ts";
import "./chart.css";

function create<K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
}

/** The strip for a tab whose charts are drawn in `content`. It follows them as they change. */
export function dataNotes(content: HTMLElement): { element: HTMLElement; refresh(): void } {
  const details = create("details");
  details.className = "data-notes";
  const summary = create("summary");
  const list = create("dl");
  details.append(summary, list);

  let listed: string | undefined;
  function refresh(): void {
    const badges = content.querySelectorAll<HTMLElement>(".chart-badges [data-flag]");
    const flags = notesFlags(Array.from(badges, (badge) => badge.dataset.flag!));
    details.hidden = !flags.length;
    // Left alone when nothing changed, such as while the map's months play.
    if (flags.join() === listed) return;
    listed = flags.join();
    summary.replaceChildren(
      create("strong", "Data notes on this tab: "),
      flags.map((id) => FLAG_TEXT[id].label).join(" · "),
    );
    const seen = new Set<TermId>();
    list.replaceChildren(
      ...flags.flatMap((id) => {
        const text = create("dd");
        text.append(...withTerms(FLAG_TEXT[id].text, seen));
        return [create("dt", FLAG_TEXT[id].label), text];
      }),
    );
  }

  content.addEventListener("chart-flags", refresh);
  return { element: details, refresh };
}
