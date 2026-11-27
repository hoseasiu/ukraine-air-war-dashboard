/**
 * The changelog on Data & Methods, newest first. Add an entry when the data,
 * a definition or what a figure shows changes. Layout and styling changes don't
 * need one. Keep counts out, so a data refresh can't make an entry wrong.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
export interface ChangelogEntry {
  /** YYYY-MM-DD. */
  date: string;
  changes: string[];
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: "2026-11-26",
    changes: [
      "Attacks, defense and alerts tabs: each starts with a few summary figures, with their dates and data-quality badges. Charts are headed by a line worked out from the figures they draw, with the chart’s name under it.",
      "Defense tab: the intercept-rate chart has large panels for drones and cruise missiles and dot plots for rarer classes, with reference lines. Months with too few launches for a rate now show as hollow markers under each panel; they still have no rate.",
      "Attacks tab: monthly launches show drones and the other classes in two panels, each on its own scale, with optional event markers; the class-mix panels are now one compact row, each labeled with its highest share.",
      "Added this Data & Methods page: sources, the weapon-class table, definitions, known gaps, how figures are traced and how to cite.",
      "Time charts shade the missile-reporting restriction, and alert-hour line charts shade the move to raion alerts. Data-quality badges now open their full text, and each chart tab lists its notes at the top.",
      "Attacks tab: salvo sizes for all years in one chart; new calendar colors; the one-night breakdown now shows the night among all of its year’s nights.",
      "Defense tab: the saturation chart shows all nights in one panel, with a summary by size group; the before/after panels became one chart with a row for each class.",
      "Alerts tab: mean alert hours by month now show above the map’s month slider.",
    ],
  },
  {
    date: "2026-11-25",
    changes: [
      "First version. Strike data from the Kaggle files dated Nov 21, 2026; alert data from a fixed commit of the sirens dataset, with alert figures ending at July 2026.",
      "Definitions settled: weapon classes, which reports count, massive nights, intercept rates, the missile-reporting restriction from Aug 11, 2026, and the alert-hours roll-up.",
      "Attacks, defense and alerts charts, guided mode, cited event annotations, glossary and discussion questions.",
      "Published as an early preview.",
    ],
  },
];
