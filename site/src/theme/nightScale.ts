/**
 * The color scale for night sizes on the calendar: one hue, light to dark, in
 * fixed steps, so a color means the same whatever the filters show. It's the
 * blue sequential family the alert map uses (alertScale.ts), so darker means
 * more on both. The calendar's steps start darker than the map's, because its
 * small squares sit among empty white ones. Every cell also has an outline, and
 * its figure is in the tooltip and table.
 *
 * This isn't a weapon-class color, and the calendar shows no weapon classes.
 * After changing a step, rerun the dataviz ordinal validator; CI doesn't:
 * node validate_palette.js "#86b6ef,#5598e7,#2a78d6,#1c5cab,#104281,#082650"
 *   --mode light --surface "#ffffff" --ordinal
 */
export interface NightBin {
  /** Weapons launched from which this step applies, up to the next step's. */
  from: number;
  color: string;
  label: string;
}

export const NIGHT_BINS: readonly [NightBin, ...NightBin[]] = [
  { from: 0, color: "#86b6ef", label: "Under 25" },
  { from: 25, color: "#5598e7", label: "25–49" },
  { from: 50, color: "#2a78d6", label: "50–99" },
  { from: 100, color: "#1c5cab", label: "100–199" },
  { from: 200, color: "#104281", label: "200–399" },
  { from: 400, color: "#082650", label: "400 or more" },
];

export function nightBin(size: number): NightBin {
  return [...NIGHT_BINS].reverse().find((bin) => size >= bin.from) ?? NIGHT_BINS[0];
}
