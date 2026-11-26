/**
 * Month labels for a band axis, thinned so they stay readable.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { monthNumber } from "../filters/state.ts";

/** Which months get a label: all of a short range, then quarters, then Januaries and, if there's room, Julys. */
export function monthTicks(months: readonly string[], width: number): string[] {
  // A "Jul 2024" label needs about this many pixels.
  const room = Math.max(1, Math.floor(width / 90));
  for (const step of [1, 3, 6, 12]) {
    const ticks = months.filter((month) => monthNumber(month) % step === 0);
    if (ticks.length && ticks.length <= room) return ticks;
  }
  const januaries = months.filter((month) => month.endsWith("-01"));
  return januaries.length ? januaries : months.slice(0, 1);
}
