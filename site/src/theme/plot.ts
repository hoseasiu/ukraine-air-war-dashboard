/** Shared Observable Plot settings. Chart code should start from these. */
import type { PlotOptions, ScaleOptions } from "@observablehq/plot";
import { CLASS_IDS, CLASS_STYLES, type ClassId } from "./classStyles.ts";
import { classFill } from "./marks.ts";

export const plotDefaults = {
  style: {
    fontFamily: "inherit",
    // Plot's own default is 10px, too small to read on a projector.
    fontSize: "16px",
    background: "transparent",
    color: "var(--ink)",
  },
  marginLeft: 64,
  // Room for the y-axis title above the top tick at this font size.
  marginTop: 36,
  marginBottom: 44,
} satisfies PlotOptions;

type Labels = Record<ClassId, string>;

function classScale(range: string[], labels: Labels): ScaleOptions {
  return { type: "ordinal", domain: CLASS_IDS, range, tickFormat: (id: ClassId) => labels[id] };
}

/** `color` scale for lines, points and strokes. Pair it with a symbol or a dash. */
export const classColorScale = (labels: Labels): ScaleOptions =>
  classScale(CLASS_IDS.map((id) => CLASS_STYLES[id].color), labels);

/** `color` scale that gives bars and areas their patterned fill. */
export const classFillScale = (labels: Labels): ScaleOptions => classScale(CLASS_IDS.map(classFill), labels);

/** `symbol` scale for points. */
export const classSymbolScale = (labels: Labels): ScaleOptions =>
  classScale(CLASS_IDS.map((id) => CLASS_STYLES[id].symbol), labels);
