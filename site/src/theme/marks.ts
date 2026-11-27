/** SVG for the class patterns and symbols. */
import {
  symbol,
  symbolCircle,
  symbolCross,
  symbolDiamond,
  symbolSquare,
  symbolStar,
  symbolTriangle,
  type SymbolType,
} from "d3-shape";
import { CLASS_IDS, CLASS_STYLES, type ClassId, type HatchPattern, type SymbolName } from "./classStyles.ts";

const SYMBOLS: Record<SymbolName, SymbolType> = {
  circle: symbolCircle,
  square: symbolSquare,
  triangle: symbolTriangle,
  diamond: symbolDiamond,
  star: symbolStar,
  cross: symbolCross,
};

/** Hatch strokes, drawn in white over an 8×8 tile of the class color. */
const HATCHES: Record<HatchPattern, string> = {
  solid: "",
  diagonal: "M-2,2L2,-2M0,8L8,0M6,10L10,6",
  horizontal: "M0,4H8",
  dots: "M4,4h0.01",
  vertical: "M4,0V8",
  crosshatch: "M0,0L8,8M8,0L0,8",
};

export function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

/**
 * Hatching is faint inside bars and areas, so large fills stay easy to read, and
 * full strength in the keys, where a small swatch has to show which it is.
 */
const PATTERN_USES = {
  fill: { prefix: "class-pattern", opacity: 0.3, width: 1 },
  key: { prefix: "class-key", opacity: 1, width: 1.5 },
} as const;

const patternId = (use: keyof typeof PATTERN_USES, id: ClassId) => `${PATTERN_USES[use].prefix}-${id}`;

/** Fill for bars and areas: the class color with faint hatching. Needs installPatterns(). */
export const classFill = (id: ClassId) => `url(#${patternId("fill", id)})`;

/** Fill for a legend or key swatch: the same hatching at full strength. Needs installPatterns(). */
export const classKeyFill = (id: ClassId) => `url(#${patternId("key", id)})`;

/** The same, for an oblast line's point symbol. */
export function areaSymbolPath(style: { symbol: SymbolName }, area = 90): string {
  return symbol(SYMBOLS[style.symbol], area)() ?? "";
}

/** Adds the pattern definitions to the page once, so any chart can use classFill() and classKeyFill(). */
export function installPatterns(): void {
  // Sized to zero rather than display:none, which stops some browsers painting the patterns.
  const svg = svgElement("svg", { width: 0, height: 0, "aria-hidden": "true", focusable: "false" });
  svg.style.position = "absolute";
  const defs = svgElement("defs");

  for (const use of ["fill", "key"] as const) {
    const { opacity, width } = PATTERN_USES[use];
    for (const id of CLASS_IDS) {
      const { color, pattern } = CLASS_STYLES[id];
      const tile = svgElement("pattern", {
        id: patternId(use, id),
        width: 8,
        height: 8,
        patternUnits: "userSpaceOnUse",
      });
      tile.append(svgElement("rect", { width: 8, height: 8, fill: color }));
      if (HATCHES[pattern]) {
        tile.append(
          svgElement("path", {
            d: HATCHES[pattern],
            fill: "none",
            stroke: "#ffffff",
            "stroke-opacity": opacity,
            // Dots keep their size: a thinner one would all but disappear.
            "stroke-width": pattern === "dots" ? 3.5 : width,
            "stroke-linecap": pattern === "dots" ? "round" : "butt",
          }),
        );
      }
      defs.append(tile);
    }
  }

  svg.append(defs);
  document.body.prepend(svg);
}

/** The path for a class's point symbol, centered on 0,0. */
export function classSymbolPath(id: ClassId, area = 90): string {
  return symbol(SYMBOLS[CLASS_STYLES[id].symbol], area)() ?? "";
}
