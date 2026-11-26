/**
 * Which month each event marker sits over, and in which row, so markers that
 * are close together don't overlap.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { Annotation } from "./annotationData.ts";

export interface Marker {
  /** Its number in the key, from 1 in date order. */
  number: number;
  month: string;
  /** 0 is the top row. */
  row: number;
  event: Annotation;
}

/** Markers closer than this many months go in different rows. */
const CLEARANCE = 2;

/** Events outside the months shown get no marker. `events` must be in date order. */
export function placeMarkers(events: readonly Annotation[], months: readonly string[]): Marker[] {
  /** The month index of the last marker in each row. */
  const lastInRow: number[] = [];
  return events
    .filter((event) => months.includes(event.date.slice(0, 7)))
    .map((event, index) => {
      const month = event.date.slice(0, 7);
      const at = months.indexOf(month);
      let row = lastInRow.findIndex((last) => at - last >= CLEARANCE);
      if (row < 0) row = lastInRow.length;
      lastInRow[row] = at;
      return { number: index + 1, month, row, event };
    });
}
