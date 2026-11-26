/**
 * Where the sparkline's points go.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { NationalMonth } from "./alertData.ts";

/** Points as percentages of the box, x from the left and y from the top. The scale starts at zero. */
export function sparklinePoints(rows: readonly NationalMonth[]) {
  if (rows.length < 2) throw new Error("A sparkline needs at least two months");
  const figures = rows.map(({ month, hours }) => {
    // The slider offers only the alert table's months, so a gap here is a bug, not a zero.
    if (hours === null) throw new Error(`No alert figures for ${month}`);
    return { month, hours };
  });
  const peak = figures.reduce((best, row) => (row.hours > best.hours ? row : best));
  const top = peak.hours || 1;
  const points = figures.map(({ hours }, index) => ({
    x: (index / (figures.length - 1)) * 100,
    y: 100 - (hours / top) * 100,
  }));
  return { points, peak };
}
