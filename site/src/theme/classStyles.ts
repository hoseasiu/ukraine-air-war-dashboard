/**
 * The only place weapon-class colors are defined (AGENTS.md, rule 5).
 * Import from here; don't repeat a class color anywhere else.
 *
 * Each class also has a hatch pattern (bars and areas), a symbol (points) and a
 * dash (lines), so no chart has to rely on color alone.
 *
 * The six colors pass the dataviz skill's palette validator on a white surface,
 * for all pairs as well as adjacent ones, so they hold up when filters change
 * which classes sit together. They aren't the skill's default hues. After
 * changing a color, rerun the validator with the colors in the order below,
 * with `--pairs adjacent` and with `--pairs all`:
 *
 *   node validate_palette.js "#5d97d0,#cb8321,#d0030b,#5d32a7,#08723e,#f1579d" --mode light --surface "#ffffff" --pairs all
 *
 * Excluded classes (other UAVs, bombs) aren't charted, so they have no style.
 */

export type HatchPattern = "solid" | "diagonal" | "horizontal" | "dots" | "vertical" | "crosshatch";

/** Names that Observable Plot accepts in its symbol scale. */
export type SymbolName = "circle" | "square" | "triangle" | "diamond" | "star" | "cross";

export interface ClassStyle {
  color: string;
  pattern: HatchPattern;
  symbol: SymbolName;
  /** SVG stroke-dasharray; "none" is a solid line. */
  dash: string;
}

/** Key order is the stacking and legend order. */
export const CLASS_STYLES = {
  shahed_drone: { color: "#5d97d0", pattern: "solid", symbol: "circle", dash: "none" },
  cruise: { color: "#cb8321", pattern: "diagonal", symbol: "square", dash: "10 4" },
  ballistic: { color: "#d0030b", pattern: "horizontal", symbol: "triangle", dash: "3 3" },
  aeroballistic_hypersonic: { color: "#5d32a7", pattern: "dots", symbol: "diamond", dash: "10 3 3 3" },
  antiship_other: { color: "#08723e", pattern: "vertical", symbol: "star", dash: "16 5" },
  mixed: { color: "#f1579d", pattern: "crosshatch", symbol: "cross", dash: "10 3 3 3 3 3" },
} as const satisfies Record<string, ClassStyle>;

export type ClassId = keyof typeof CLASS_STYLES;

export const CLASS_IDS = Object.keys(CLASS_STYLES) as ClassId[];
