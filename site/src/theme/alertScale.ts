/**
 * The color scale for alert hours: one hue, light to dark, in fixed steps. The
 * steps are the same for every month, so months can be compared and stepping
 * through them doesn't rescale the colors.
 *
 * These are the dataviz skill's sequential blue steps. Its ordinal validator
 * passes lightness order, step spacing and single hue, and fails only the
 * lightest step's contrast with white, which the skill allows on a choropleth.
 * Every area also has an outline and, on the map, its number.
 *
 * This isn't a weapon-class color, and the map shows no weapon classes.
 */
export interface AlertBin {
  /** Hours from which this step applies, up to the next step's. */
  from: number;
  color: string;
  label: string;
}

export const ALERT_BINS: readonly [AlertBin, ...AlertBin[]] = [
  { from: 0, color: "#cde2fb", label: "Under 25" },
  { from: 25, color: "#9ec5f4", label: "25 to under 50" },
  { from: 50, color: "#6da7ec", label: "50 to under 100" },
  { from: 100, color: "#3987e5", label: "100 to under 200" },
  { from: 200, color: "#256abf", label: "200 to under 400" },
  { from: 400, color: "#104281", label: "400 or more" },
];

export function alertBin(hours: number): AlertBin {
  return [...ALERT_BINS].reverse().find((bin) => hours >= bin.from) ?? ALERT_BINS[0];
}
