/**
 * The color scale for night sizes on the calendar: neutral gray, light to dark,
 * in fixed steps, so a color means the same whatever the filters show. Gray
 * keeps it apart from the weapon-class colors and from the alert-hours blues.
 * Every cell also has an outline, and its figure is in the tooltip and table.
 */
export interface NightBin {
  /** Weapons launched from which this step applies, up to the next step's. */
  from: number;
  color: string;
  label: string;
}

export const NIGHT_BINS: readonly [NightBin, ...NightBin[]] = [
  { from: 0, color: "#e4e4e4", label: "Under 25" },
  { from: 25, color: "#c6c6c6", label: "25–49" },
  { from: 50, color: "#a3a3a3", label: "50–99" },
  { from: 100, color: "#7d7d7d", label: "100–199" },
  { from: 200, color: "#555555", label: "200–399" },
  { from: 400, color: "#2b2b2b", label: "400 or more" },
];

export function nightBin(size: number): NightBin {
  return [...NIGHT_BINS].reverse().find((bin) => size >= bin.from) ?? NIGHT_BINS[0];
}
