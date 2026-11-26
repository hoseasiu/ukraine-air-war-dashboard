/** Tab B: air defense performance (plan §2 B1–B2, §6). Before/after panels (B3) are #17. */
import { rateTable } from "../data.ts";
import type { Filters } from "../filters/state.ts";
import { withTerms } from "../glossary/popover.ts";
import { create } from "../strikes/shared.ts";
import { monthsShown } from "../strikes/strikeData.ts";
import { interceptRateChart } from "./interceptChart.ts";
import { saturationChart } from "./saturationChart.ts";

function paragraph(text: string): HTMLParagraphElement {
  const p = create("p");
  p.append(...withTerms(text));
  return p;
}

export function defenseTab(filters: Filters): HTMLElement {
  const section = create("div");
  if (!monthsShown(rateTable, filters.from, filters.to).length) {
    section.append(paragraph("The months chosen are before the strike data starts. Widen “Months shown”."));
    return section;
  }
  section.append(interceptRateChart(filters), saturationChart(filters));
  return section;
}
