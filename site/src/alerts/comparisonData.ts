/**
 * The rows the oblast comparison draws (plan §2 E2).
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { Area } from "../buildData.ts";
import { MAX_OBLASTS } from "../filters/state.ts";
import { monthsInRange, type AlertMonth, type AlertTable } from "./alertData.ts";

/**
 * Shown when no oblast is chosen: Kharkiv oblast, Kyiv city and Lviv oblast.
 * The owner picked them for stop 10 on Nov 25, 2026 (#22; plan §11).
 */
export const DEFAULT_COMPARISON: readonly string[] = ["UA-63", "UA-30", "UA-46"];

export function comparisonAreas(chosen: readonly string[]): readonly string[] {
  return chosen.length ? chosen : DEFAULT_COMPARISON;
}

export interface ComparisonRow extends AlertMonth {
  name: string;
}

/** One row per month and area: months in order, and areas in the order given. */
export function comparisonRows(
  table: AlertTable,
  areas: readonly Area[],
  oblasts: readonly string[],
  from: string,
  to: string,
): ComparisonRow[] {
  if (oblasts.length > MAX_OBLASTS) throw new Error(`A comparison takes up to ${MAX_OBLASTS} oblasts`);
  const figures = new Map(table.rows.map((row) => [`${row.oblast} ${row.month}`, row]));
  return monthsInRange(table, from, to).flatMap((month) =>
    oblasts.map((id) => {
      const area = areas.find((candidate) => candidate.id === id);
      const row = figures.get(`${id} ${month}`);
      // Excluded areas have no rows, and must never turn into a line at zero.
      if (!area || !row) throw new Error(`No alert figures for ${id} in ${month}`);
      return { ...row, name: area.name };
    }),
  );
}

/**
 * Which line style each oblast takes. One that was already drawn keeps its
 * style when others are added or removed, so a line doesn't change color under
 * the reader. Newcomers take the free styles in order.
 */
export function assignStyles(
  oblasts: readonly string[],
  previous: ReadonlyMap<string, number> = new Map(),
): Map<string, number> {
  const kept = new Map(oblasts.flatMap((id) => (previous.has(id) ? [[id, previous.get(id)!] as const] : [])));
  const free = [...Array(MAX_OBLASTS).keys()].filter((slot) => ![...kept.values()].includes(slot));
  return new Map(oblasts.map((id) => [id, kept.get(id) ?? free.shift()!]));
}
