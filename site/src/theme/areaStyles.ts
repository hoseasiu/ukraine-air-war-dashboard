/**
 * Line styles for comparing oblasts. These aren't weapon-class colors
 * (classStyles.ts), and none of them reuses one.
 *
 * Each style also has a dash and a point symbol, so the chart doesn't rely on
 * color alone. The three colors pass the dataviz skill's palette validator on a
 * white surface for all pairs. After changing one, rerun it:
 *
 *   node validate_palette.js "#d03b3b,#008f83,#7b4fd0" --mode light --surface "#ffffff" --pairs all
 */
import type { SymbolName } from "./classStyles.ts";

export interface AreaStyle {
  color: string;
  symbol: SymbolName;
  /** SVG stroke-dasharray; "none" is a solid line. */
  dash: string;
}

/** One per oblast in a comparison, so the length is the most that can be compared. */
export const AREA_STYLES: readonly [AreaStyle, AreaStyle, AreaStyle] = [
  { color: "#d03b3b", symbol: "circle", dash: "none" },
  { color: "#008f83", symbol: "square", dash: "10 4" },
  { color: "#7b4fd0", symbol: "triangle", dash: "3 3" },
];

/** Bars that add up several weapon classes, so they take none of the class colors. */
export const COMBINED_LAUNCH_FILL = "#6b6b6b";
