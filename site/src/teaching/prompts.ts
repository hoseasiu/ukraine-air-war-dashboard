/**
 * Generic discussion prompts for tabs and guided stops (plan §7). They aren't
 * tied to any course challenge. Drafts for the owner's review (#24).
 */

/** The three examples in plan §7, in the plan's words. */
const WARNING_SYSTEM =
  "If you were designing a warning system, what does the alert-hours map tell you about false-alarm cost?";
const HIDDEN_DATA = "What would you need to know that this data hides?";
const MISLEADING_RATE = "Why might intercept rate be a misleading metric?";

/** Keyed by page id (pages.ts). */
export const TAB_PROMPTS = {
  attacks: [
    "To compare two months of attacks, what would you want to know besides the number of weapons launched?",
    HIDDEN_DATA,
  ],
  defense: [
    MISLEADING_RATE,
    "What would you need to measure to tell whether a larger salvo is harder to defend against than a smaller one?",
  ],
  alerts: [WARNING_SYSTEM, "Who might experience the same number of alert hours very differently, and why?"],
} satisfies Record<string, string[]>;

/**
 * For the stops in plan §5 that call for discussion: the two pauses (6 and 8)
 * and the closing stop (12). #21 and #22 attach them to the real stops.
 */
export const STOP_PROMPTS = {
  rhythm: ["Do you see a pattern? What would make you doubt it?"],
  saturation: ["Besides salvo size, what else could differ between a large night and a small one?"],
  closing: [WARNING_SYSTEM, HIDDEN_DATA, MISLEADING_RATE],
} satisfies Record<string, string[]>;
