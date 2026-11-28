/**
 * Where each figure on the site comes from, for the Data & Methods page. A new
 * chart or number needs a row here. Keep counts from the data out of the text.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */

export interface Trace {
  figure: string;
  /** Tabs and guided stops that show it. */
  shownOn: string;
  /** How it's worked out from the built file. */
  method: string;
  /** Files in data/processed/, or in data/reference/ if handCompiled. */
  tables: string[];
  /** True for figures typed by hand into reference tables, not built from the data. */
  handCompiled?: true;
  /** Files that work it out, as paths from the repo root. */
  code: string[];
}

export const TRACES: readonly Trace[] = [
  {
    figure: "Headline: weapons launched",
    shownOn: "Stop 1",
    method: "Every published launch count in the monthly table, added up.",
    tables: ["monthly_by_class.json"],
    code: ["site/src/guided/headlineData.ts"],
  },
  {
    figure: "Headline: share reported destroyed",
    shownOn: "Stop 1",
    method:
      "Reported destroyed ÷ launches with an outcome, over all counted classes through July 2026, with no minimum count.",
    tables: ["monthly_by_class.json"],
    code: ["site/src/guided/headlineData.ts"],
  },
  {
    figure: "Headline: alert hours",
    shownOn: "Stop 1",
    method: "Mean of every area’s monthly alert hours, over every month of the alert table. An average month, not a total.",
    tables: ["alert_hours_monthly.json"],
    code: ["site/src/guided/headlineData.ts"],
  },
  {
    figure: "Monthly launches by class, and each class’s share",
    shownOn: "Tab A; stops 2 and 3",
    method:
      "The month’s published launches in a class, daytime reports included. A share divides by the month’s launches in all counted classes.",
    tables: ["monthly_by_class.json"],
    code: ["site/src/strikes/strikeData.ts", "pipeline/strikes.py"],
  },
  {
    figure: "Salvo sizes by year, with each year’s median, largest night and massive bar",
    shownOn: "Tab A; stop 4",
    method: "A night’s size is its published launches in the classes shown. Nights are counted in bins of sizes.",
    tables: ["nights.json"],
    code: ["site/src/strikes/strikeData.ts", "pipeline/strikes.py"],
  },
  {
    figure: "Night calendar, day-of-week bars and gaps between massive nights",
    shownOn: "Tab A; stop 6",
    method:
      "Night sizes by date; the median size and number of massive nights for each weekday; days from one massive night to the next.",
    tables: ["nights.json"],
    code: ["site/src/strikes/strikeData.ts", "site/src/strikes/rhythm.ts"],
  },
  {
    figure: "One night by class, its launch areas and its place in the year",
    shownOn: "Tab A; stop 5",
    method:
      "That date’s rows by class. Launch areas are copied as reported, with no counts. Stop 5 picks the night with the most published launches.",
    tables: ["nights.json"],
    code: ["site/src/strikes/strikeData.ts"],
  },
  {
    figure: "Monthly intercept rate by class",
    shownOn: "Tab B; stop 7",
    method: "The pipeline’s rate, with both counts beside it. Gaps follow the intercept-rate definition below.",
    tables: ["monthly_by_class.json"],
    code: ["pipeline/strikes.py", "site/src/defense/defenseData.ts"],
  },
  {
    figure: "Saturation: night size against the number not reported destroyed",
    shownOn: "Tab B; stop 8",
    method: "Launches with an outcome minus reported destroyed, over the classes shown.",
    tables: ["nights.json"],
    code: ["site/src/defense/defenseData.ts"],
  },
  {
    figure: "Median share not reported destroyed, by size group",
    shownOn: "Tab B",
    method: "The median, over a year’s nights in a size group, of each night’s share. It stops at July 2026.",
    tables: ["nights.json"],
    code: ["site/src/defense/defenseData.ts"],
  },
  {
    figure: "Before and after an event",
    shownOn: "Tab B",
    method:
      "Reported destroyed and launches with an outcome, added up over the nights in equal windows on each side of the event’s date.",
    tables: ["nights.json"],
    code: ["site/src/defense/eventWindowData.ts"],
  },
  {
    figure: "Alert-hours map, with each area’s alert count",
    shownOn: "Tab E; stop 9",
    method: "One month of the monthly alert table.",
    tables: ["alert_hours_monthly.json"],
    code: ["pipeline/alerts.py", "site/src/alerts/alertData.ts"],
  },
  {
    figure: "National alert hours above the map’s month slider",
    shownOn: "Tab E",
    method: "For each month the slider offers, the mean of the areas’ alert hours.",
    tables: ["alert_hours_monthly.json"],
    code: ["site/src/alerts/alertData.ts", "site/src/alerts/sparklineData.ts"],
  },
  {
    figure: "Alert hours for up to three areas",
    shownOn: "Tab E; stop 10",
    method: "Those areas’ rows of the monthly alert table.",
    tables: ["alert_hours_monthly.json"],
    code: ["pipeline/alerts.py", "site/src/alerts/comparisonData.ts"],
  },
  {
    figure: "Monthly launches beside alert hours",
    shownOn: "Tab E",
    method: "Monthly launches in the classes shown, and the mean of the areas’ alert hours. No correlation or ratio.",
    tables: ["monthly_by_class.json", "alert_hours_monthly.json"],
    code: ["site/src/alerts/alertLaunchData.ts"],
  },
  {
    figure: "Attacks tab summary: weapons launched, and the median and largest night",
    shownOn: "Tab A",
    method:
      "Published launches in the months and classes shown. Launches come from the monthly table, daytime reports included; the two night figures from the nights table, without them.",
    tables: ["monthly_by_class.json", "nights.json"],
    code: ["site/src/summary/tileData.ts"],
  },
  {
    figure: "Defense tab summary: shares reported destroyed",
    shownOn: "Tab B",
    method:
      "Reported destroyed ÷ launches with an outcome over the months shown, with the monthly minimum count. The share over several classes and the missile-class shares stop at July 2026.",
    tables: ["monthly_by_class.json"],
    code: ["site/src/summary/tileData.ts"],
  },
  {
    figure: "Alerts tab summary: alert hours in an average month",
    shownOn: "Tab E",
    method: "The mean of the monthly alert table’s hours over the months shown: all areas, then each compared area.",
    tables: ["alert_hours_monthly.json"],
    code: ["site/src/summary/tileData.ts"],
  },
  {
    figure: "Weapon primer: speed categories, sizes, warheads, ranges and speeds",
    shownOn: "Weapon classes",
    method:
      "Copied by hand from the cited pages. Each figure is the widest span of the cited rows in one unit, and each row can be opened with its source. Nothing comes from the strike data except the names in each class.",
    tables: ["weapon_members.csv", "weapon_figures.csv", "weapon_sources.csv", "model_classes.csv"],
    handCompiled: true,
    code: ["site/src/weapons/weaponData.ts"],
  },
  {
    figure: "Weapon primer: scale drawings",
    shownOn: "Weapon classes",
    method:
      "Our own outlines. Each drawn dimension is one that a single cited page gives, checked against the figures table; the person’s height is chosen for comparison. Other proportions are approximate.",
    tables: ["weapon_figures.csv", "weapon_sources.csv"],
    handCompiled: true,
    code: ["site/src/weapons/drawings.ts"],
  },
  {
    figure: "Chart headlines",
    shownOn: "Tabs A, B and E",
    method:
      "Each is worked out from the rows its chart draws, so it follows the filters. The chart’s table gives those rows.",
    tables: ["monthly_by_class.json", "nights.json", "alert_hours_monthly.json"],
    code: ["site/src/summary/headlineText.ts"],
  },
];
