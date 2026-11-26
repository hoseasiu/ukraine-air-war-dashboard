import { alertMap } from "./alerts/alertMap.ts";
import { alertsAndLaunches } from "./alerts/alertsAndLaunches.ts";
import { assignStyles, comparisonAreas, DEFAULT_COMPARISON } from "./alerts/comparisonData.ts";
import { oblastComparison } from "./alerts/oblastComparison.ts";
import { attacksTab } from "./strikes/attacksTab.ts";
import { classKey } from "./classKey.ts";
import { alertAreas } from "./data.ts";
import { defenseTab } from "./defense/defenseTab.ts";
import type { Filters } from "./filters/state.ts";
import { glossaryList, withTerms } from "./glossary/popover.ts";
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

/** Each compared oblast's line style, kept so a line doesn't change color as others come and go. */
let comparisonStyles = new Map<string, number>();

const defaultComparisonNames = new Intl.ListFormat("en-US").format(
  DEFAULT_COMPARISON.map((id) => alertAreas.find((area) => area.id === id)!.name),
);

/** The first page is shown when the hash is empty or unknown. */
export const PAGES: [Page, ...Page[]] = [
  {
    id: "attacks",
    nav: "A. Attacks",
    heading: "Attacks: scale and rhythm",
    filters: { notes: ["Strike data starts Sept 28, 2022."] },
    render(container, filters) {
      container.append(attacksTab(filters), discussion(TAB_PROMPTS.attacks));
    },
  },
  {
    id: "defense",
    nav: "B. Defense",
    heading: "Air defense performance",
    filters: { notes: ["Strike data starts Sept 28, 2022."] },
    render(container, filters) {
      container.append(
        paragraph("In the source reports, “destroyed” includes weapons lost to electronic warfare."),
        defenseTab(filters),
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
        "Chosen oblasts are outlined on the map and drawn in the comparison. With none chosen, " +
          `the comparison shows ${defaultComparisonNames}.`,
        "Alert figures end at July 2026, whatever months are selected.",
      ],
    },
    render(container, filters) {
      const compared = comparisonAreas(filters.oblasts);
      comparisonStyles = assignStyles(compared, comparisonStyles);
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
        oblastComparison({ from: filters.from, to: filters.to, oblasts: compared, styles: comparisonStyles }),
        alertsAndLaunches({ from: filters.from, to: filters.to, classes: filters.classes }),
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
