/**
 * The exploration filters and how they are written in the URL's query string.
 * The query string is their only store, so a reload or a shared link restores
 * them. Guided mode never reads or writes it.
 *
 *   ?from=2023-01&to=2024-12&classes=cruise,ballistic&oblasts=UA-63,UA-30
 *
 * A filter at its default isn't written. A link without "to" therefore runs to
 * the latest month, even after the data is refreshed.
 */
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";

/** The alert comparison takes up to this many oblasts. */
export const MAX_OBLASTS = 3;

/**
 * The first month the date filter offers: the official alert file starts
 * Mar 15, 2022. Strike data starts later, on Sept 28, 2022.
 */
export const FIRST_MONTH = "2022-03";

export interface Filters {
  /** First and last month shown, both included, as YYYY-MM. */
  from: string;
  to: string;
  /** In chart order. Can be empty. */
  classes: ClassId[];
  /** ISO 3166-2 codes in the order chosen, at most MAX_OBLASTS. */
  oblasts: string[];
}

export interface FilterBounds {
  firstMonth: string;
  lastMonth: string;
  /** The ISO 3166-2 codes that can be chosen. */
  oblastIds: readonly string[];
}

/** Written when every class is off, to tell it apart from the default. */
const NO_CLASSES = "none";

export function defaultFilters(bounds: FilterBounds): Filters {
  return { from: bounds.firstMonth, to: bounds.lastMonth, classes: [...CLASS_IDS], oblasts: [] };
}

/** Months as consecutive integers, for the date range. */
export function monthNumber(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

export function monthFromNumber(value: number): string {
  return `${Math.floor(value / 12)}-${String((value % 12) + 1).padStart(2, "0")}`;
}

export interface DatePreset {
  label: string;
  from: string;
  to: string;
}

/**
 * The date ranges offered as one-press choices: every month, each calendar year
 * that the filter covers from January to December, and the latest 12 months
 * (counting the last one, which can be partial).
 */
export function datePresets({ firstMonth, lastMonth }: FilterBounds): DatePreset[] {
  const years: DatePreset[] = [];
  const firstJanuary = monthNumber(`${firstMonth.slice(0, 4)}-01`);
  for (let january = firstJanuary; january + 11 <= monthNumber(lastMonth); january += 12) {
    if (january < monthNumber(firstMonth)) continue;
    const from = monthFromNumber(january);
    years.push({ label: from.slice(0, 4), from, to: monthFromNumber(january + 11) });
  }
  const latest = Math.max(monthNumber(lastMonth) - 11, monthNumber(firstMonth));
  return [
    { label: "All", from: firstMonth, to: lastMonth },
    ...years,
    { label: "Last 12 months", from: monthFromNumber(latest), to: lastMonth },
  ];
}

/** YYYY-MM strings sort in date order, so they compare as text. */
function readMonth(value: string | null, fallback: string, bounds: FilterBounds): string {
  if (value === null || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return fallback;
  if (value < bounds.firstMonth) return bounds.firstMonth;
  return value > bounds.lastMonth ? bounds.lastMonth : value;
}

function readClasses(value: string | null): ClassId[] {
  if (value === NO_CLASSES) return [];
  const asked = value?.split(",") ?? [];
  const found = CLASS_IDS.filter((id) => asked.includes(id));
  // Nothing recognizable means a damaged link, not a request to hide everything.
  return found.length ? found : [...CLASS_IDS];
}

function readOblasts(value: string | null, bounds: FilterBounds): string[] {
  const known = (value?.split(",") ?? []).filter((id) => bounds.oblastIds.includes(id));
  return [...new Set(known)].slice(0, MAX_OBLASTS);
}

/** Never throws: anything unusable in a link falls back to the default or the nearest allowed value. */
export function parseFilters(search: string, bounds: FilterBounds): Filters {
  const params = new URLSearchParams(search);
  const from = readMonth(params.get("from"), bounds.firstMonth, bounds);
  const to = readMonth(params.get("to"), bounds.lastMonth, bounds);
  return {
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    classes: readClasses(params.get("classes")),
    oblasts: readOblasts(params.get("oblasts"), bounds),
  };
}

/**
 * The query string for these filters, with its "?", or "" if there's nothing to
 * write. Parameters in `search` that aren't filters are kept.
 */
export function filterSearch(filters: Filters, bounds: FilterBounds, search = ""): string {
  const params = new URLSearchParams(search);
  const classes = CLASS_IDS.filter((id) => filters.classes.includes(id));
  const values: Record<keyof Filters, string | null> = {
    from: filters.from === bounds.firstMonth ? null : filters.from,
    to: filters.to === bounds.lastMonth ? null : filters.to,
    classes: classes.length === CLASS_IDS.length ? null : classes.join(",") || NO_CLASSES,
    oblasts: filters.oblasts.join(",") || null,
  };
  for (const [name, value] of Object.entries(values)) {
    if (value === null) params.delete(name);
    else params.set(name, value);
  }
  // Commas are allowed in a query string, and links read better with them.
  const query = params.toString().replaceAll("%2C", ",");
  return query ? `?${query}` : "";
}
