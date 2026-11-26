/**
 * Point styles for nights before and from the missile-reporting restriction, on
 * the saturation chart's one-panel view. They differ in shape and fill as well
 * as color. Neither color is a weapon-class color (classStyles.ts).
 */
export const PERIOD_STYLES = {
  /** Faint filled circles, so places where many nights overlap show darker. */
  before: { color: "#3d3d3d", fillOpacity: 0.3 },
  /** Hollow squares, drawn on top. */
  from: { color: "#b34700", strokeWidth: 1.6 },
} as const;
