import { alertMap } from "./alerts/alertMap.ts";
import { classKey } from "./classKey.ts";
import type { Filters } from "./filters/state.ts";
import { glossaryList, withTerms } from "./glossary/popover.ts";
import type { TermId } from "./glossary/terms.ts";
import { promptList } from "./teaching/promptList.ts";
import { TAB_PROMPTS } from "./teaching/prompts.ts";

export interface Page {
  /** The URL hash, without "#". */
  id: string;
  /** Tab text. */
  nav: string;
  heading: string;
  /** The filter controls shown under the heading. Leave out for a page that takes none. */
  filters?: {
    /** Shows the oblast picker. */
    oblasts?: boolean;
    notes: string[];
  };
  /** Draws the page below the heading and filters. Called again whenever the filters change. */
  render(container: HTMLElement, filters: Filters): void;
}

function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.append(...withTerms(text));
  return p;
}

function placeholder(questions: string[], intro = "No charts yet. This page will take up these questions:"): HTMLElement {
  const section = document.createElement("div");
  const list = document.createElement("ul");
  const seen = new Set<TermId>();
  for (const question of questions) {
    const item = document.createElement("li");
    item.append(...withTerms(question, seen));
    list.append(item);
  }
  section.append(paragraph(intro), list);
  return section;
}

function heading(text: string): HTMLHeadingElement {
  const h3 = document.createElement("h3");
  h3.textContent = text;
  return h3;
}

function discussion(prompts: readonly string[]): HTMLElement {
  const section = document.createElement("div");
  section.append(heading("Questions to discuss"), promptList(prompts));
  return section;
}

/** The map's month, kept while the filters redraw the page. It isn't a filter, so it isn't in the URL. */
let mapMonth: string | undefined;

/** The first page is shown when the hash is empty or unknown. */
export const PAGES: [Page, ...Page[]] = [
  {
    id: "attacks",
    nav: "A. Attacks",
    heading: "Attacks: scale and rhythm",
    filters: { notes: ["Strike data starts Sept 28, 2022."] },
    render(container) {
      container.append(
        placeholder([
          "How has monthly launch volume changed for each weapon class?",
          "Are salvos getting bigger, or just more frequent?",
          "What does a massive combined strike consist of?",
          "Is there a rhythm to attacks?",
        ]),
        classKey(),
        discussion(TAB_PROMPTS.attacks),
      );
    },
  },
  {
    id: "defense",
    nav: "B. Defense",
    heading: "Air defense performance",
    filters: { notes: ["Strike data starts Sept 28, 2022."] },
    render(container) {
      container.append(
        placeholder([
          "How has the reported intercept rate for each weapon class changed over time?",
          "Do larger or more mixed salvos let more weapons through?",
          "How did reported intercept rates differ before and after notable events?",
        ]),
        paragraph("In the source reports, “destroyed” includes weapons lost to electronic warfare."),
        discussion(TAB_PROMPTS.defense),
      );
    },
  },
  {
    id: "alerts",
    nav: "E. Alerts",
    heading: "Civilian burden from air-raid alerts",
    filters: {
      oblasts: true,
      notes: [
        "Weapon classes apply only to launch figures, not to alert hours.",
        "Alert figures end at July 2026, whatever months are selected.",
      ],
    },
    render(container, filters) {
      container.append(
        alertMap({
          from: filters.from,
          to: filters.to,
          highlight: filters.oblasts,
          month: mapMonth,
          onMonthChange: (month) => {
            mapMonth = month;
          },
        }),
        placeholder(
          [
            "How does life under alerts differ between oblasts?",
            "How does attack intensity relate to alert burden over time?",
          ],
          "Still to come on this page:",
        ),
        discussion(TAB_PROMPTS.alerts),
      );
    },
  },
  {
    id: "methods",
    nav: "Data & Methods",
    heading: "Data and methods",
    render(container) {
      container.append(
        paragraph("Sources, licenses, definitions and known gaps will be listed here."),
        classKey(),
        heading("Glossary"),
        glossaryList(),
      );
    },
  },
];
