/**
 * Where Next and Back go. A stop with a reveal takes two steps: Next shows the
 * reveal before moving on, so a presenter's clicker can do both.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
export interface Position {
  /** Counted from 1. */
  stop: number;
  /** True while the stop's reveal is showing. */
  revealed: boolean;
}

/** The position after one step forward (1) or back (-1). At either end it returns `from`. */
export function stepFrom(stops: readonly { reveal?: unknown }[], from: Position, step: 1 | -1): Position {
  if (stops[from.stop - 1]?.reveal) {
    if (step === 1 && !from.revealed) return { stop: from.stop, revealed: true };
    if (step === -1 && from.revealed) return { stop: from.stop, revealed: false };
  }
  const to = from.stop + step;
  // A stop always opens with its reveal hidden, from either side.
  return to >= 1 && to <= stops.length ? { stop: to, revealed: false } : from;
}
