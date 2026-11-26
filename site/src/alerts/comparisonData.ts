/**
 * The rows the oblast comparison draws (plan §2 E2).
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { Area } from "../buildData.ts";
import { ALERT_GRANULARITY_CHANGE_FROM } from "../chart/flags.ts";
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

/**
 * The months the comparison shades. Raion alerting phased in during 2025, with
 * the main step in November (data audit). Later months stay only partly
 * comparable with earlier ones.
 */
export const RAION_SWITCH = { from: ALERT_GRANULARITY_CHANGE_FROM.slice(0, 7), to: "2025-12" } as const;

/** The first and last of the shown months that fall in the switch, or undefined if none does. */
export function raionSwitchMonths(months: readonly string[]): { first: string; last: string } | undefined {
  const inside = months.filter((month) => month >= RAION_SWITCH.from && month <= RAION_SWITCH.to);
  return inside.length ? { first: inside[0]!, last: inside.at(-1)! } : undefined;
}

/** The name written at a line's end. "Kyiv" alone could be the city or the oblast, so both keep theirs. */
export function endLabel(name: string): string {
  return name === "Kyiv oblast" ? name : name.replace(/ oblast$/, "");
}

/**
 * Moves labels apart so they're at least `gap` pixels from each other and stay
 * between `top` and `bottom`, keeping them as near their lines' ends as that
 * allows. Returns positions in the order given.
 */
export function spreadLabels(wanted: readonly number[], gap: number, top: number, bottom: number): number[] {
  const order = [...wanted.keys()].sort((a, b) => wanted[a]! - wanted[b]!);
  const placed = [...wanted];
  let lowest = top - gap;
  for (const index of order) {
    lowest = placed[index] = Math.max(wanted[index]!, lowest + gap, top);
  }
  let highest = bottom + gap;
  for (const index of order.reverse()) {
    highest = placed[index] = Math.min(placed[index]!, highest - gap, bottom);
  }
  return placed;
}
