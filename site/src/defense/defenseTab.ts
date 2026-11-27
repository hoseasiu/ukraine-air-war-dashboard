/** Tab B: air defense performance (plan §2 B1–B3, §6). */
import { rateTable } from "../data.ts";
import type { Filters } from "../filters/state.ts";
import { withTerms } from "../glossary/popover.ts";
import { create, strikeSource } from "../strikes/shared.ts";
import { monthsShown } from "../strikes/strikeData.ts";
import { defenseTiles } from "../summary/tileData.ts";
import { summaryTiles } from "../summary/tiles.ts";
import { eventPanels } from "./eventPanels.ts";
import type { WindowDays } from "./eventWindowData.ts";
import { interceptRateChart } from "./interceptChart.ts";
import { saturationChart } from "./saturationChart.ts";
import { sizeBinChart } from "./sizeBinChart.ts";

function paragraph(text: string): HTMLParagraphElement {
  const p = create("p");
  p.append(...withTerms(text));
  return p;
}

/** The before/after choice, kept while the filters redraw the page. It isn't a filter, so it isn't in the URL. */
let eventChoice: { event: string; days: WindowDays } | undefined;
/** The saturation chart's view, kept the same way. */
let saturationSplit = false;

export function defenseTab(filters: Filters): HTMLElement {
  const section = create("div");
  if (monthsShown(rateTable, filters.from, filters.to).length) {
    section.append(
      ...summaryTiles(defenseTiles(rateTable, filters), strikeSource()),
      interceptRateChart(filters),
      saturationChart(filters, undefined, {
        split: saturationSplit,
        onSplit: (split) => {
          saturationSplit = split;
        },
      }),
      sizeBinChart(filters),
    );
  } else {
    section.append(paragraph("The months chosen are before the strike data starts. Widen “Months shown”."));
  }
  // The windows come from the event's date, so these ignore the months chosen.
  section.append(
    eventPanels({
      ...eventChoice,
      classes: filters.classes,
      onChange: (event, days) => {
        eventChoice = { event, days };
      },
    }),
  );
  return section;
}
