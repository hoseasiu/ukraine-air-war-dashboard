import type { Plot } from "@observablehq/plot";
import type { Target } from "./chartFrame.ts";

/**
 * Tooltip targets for an unfaceted Observable Plot chart. Rows sharing an x
 * and y position become one target. `x` and `y` return data values, which the
 * plot's own scales turn into pixels.
 */
export function plotTargets<Row>(
  plot: (SVGSVGElement | HTMLElement) & Plot,
  rows: readonly Row[],
  position: { x: (row: Row) => unknown; y: (row: Row) => unknown },
): Target<Row>[] {
  const pixels = (name: "x" | "y", value: unknown): number => {
    const scale = plot.scale(name);
    if (!scale) throw new Error(`The plot has no ${name} scale`);
    // For band scales, aim at the middle of the band.
    const pixel = Number(scale.apply(value)) + (scale.bandwidth ?? 0) / 2;
    if (!Number.isFinite(pixel)) throw new Error(`The ${name} scale can't place ${String(value)}`);
    return pixel;
  };

  const targets = new Map<string, Target<Row>>();
  for (const row of rows) {
    const x = pixels("x", position.x(row));
    const y = pixels("y", position.y(row));
    const key = `${x},${y}`;
    const found = targets.get(key);
    if (found) found.rows.push(row);
    else targets.set(key, { x, y, rows: [row] });
  }
  return [...targets.values()];
}
