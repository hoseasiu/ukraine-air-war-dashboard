import { classKey } from "./classKey.ts";
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
  render(container: HTMLElement): void;
}

function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.append(...withTerms(text));
  return p;
}

function placeholder(questions: string[]): HTMLElement {
  const section = document.createElement("div");
  const list = document.createElement("ul");
  const seen = new Set<TermId>();
  for (const question of questions) {
    const item = document.createElement("li");
    item.append(...withTerms(question, seen));
    list.append(item);
  }
  section.append(paragraph("No charts yet. This page will take up these questions:"), list);
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

/** The first page is shown when the hash is empty or unknown. */
export const PAGES: [Page, ...Page[]] = [
  {
    id: "attacks",
    nav: "A. Attacks",
    heading: "Attacks: scale and rhythm",
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
    render(container) {
      container.append(
        placeholder([
          "How many hours per month is each oblast under alert?",
          "How does life under alerts differ between oblasts?",
          "How does attack intensity relate to alert burden over time?",
        ]),
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
