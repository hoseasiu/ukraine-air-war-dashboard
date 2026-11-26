/** Tab A: scale and rhythm of attacks (plan §2 A1–A4, §6). */
import { monthlyTable, nightTable } from "../data.ts";
import type { Filters } from "../filters/state.ts";
import { withTerms } from "../glossary/popover.ts";
import { classMixChart, monthlyLaunchChart } from "./monthlyCharts.ts";
import { nightBreakdown } from "./nightBreakdown.ts";
import { massiveGapChart, nightCalendar, weekdayChart } from "./rhythm.ts";
import { salvoHistogram } from "./salvoHistogram.ts";
import { create } from "./shared.ts";
import { largestNight, massiveDates, monthsShown } from "./strikeData.ts";

/** The night chosen for the breakdown, kept while the filters redraw the page. It isn't a filter. */
let chosenNight: string | undefined;
/** Whether the monthly chart shows event markers, kept the same way. */
let showEvents = false;

function paragraph(text: string): HTMLParagraphElement {
  const p = create("p");
  p.append(...withTerms(text));
  return p;
}

function breakdown(filters: Filters): HTMLElement {
  const choices = massiveDates(nightTable, filters);
  if (!choices.length) {
    return paragraph(
      "What was in one night: the months chosen have no massive night to break down. Widen “Months shown”.",
    );
  }
  return nightBreakdown({
    date: chosenNight && choices.includes(chosenNight) ? chosenNight : largestNight(nightTable, choices)!,
    classes: filters.classes,
    choices,
    onDateChange: (date) => {
      chosenNight = date;
    },
  });
}

export function attacksTab(filters: Filters): HTMLElement {
  const section = create("div");
  if (!monthsShown(monthlyTable, filters.from, filters.to).length) {
    section.append(paragraph("The months chosen are before the strike data starts. Widen “Months shown”."));
    return section;
  }
  section.append(
    monthlyLaunchChart(filters, {
      events: showEvents,
      onEventsChange: (events) => {
        showEvents = events;
      },
    }),
    classMixChart(filters),
    salvoHistogram(filters),
    breakdown(filters),
    nightCalendar(filters),
    weekdayChart(filters),
    massiveGapChart(filters),
  );
  return section;
}
