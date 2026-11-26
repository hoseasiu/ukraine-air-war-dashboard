/**
 * The guided-mode stops (docs/plan.md §5), as data. A stop's number and its
 * #stop-N hash come from its position in STOPS.
 *
 * These are placeholders that exercise the engine. #21 and #22 replace them;
 * captions need the owner's sign-off.
 */
import { STOP_PROMPTS } from "../teaching/prompts.ts";
import type { ClassId } from "../theme/classStyles.ts";

/**
 * What a stop shows. A view is fixed: it takes all its settings from here and
 * never from the exploration filters, so a stop looks the same every time.
 * To add a chart, add a member with its settings and highlight, then handle it
 * in views.ts.
 */
export type StopView = { kind: "none" } | { kind: "class-key"; highlight?: ClassId };

export interface Stop {
  title: string;
  /** One or two sentences, shown in large type. */
  caption: string;
  view: StopView;
  /** Discussion prompts shown under the caption. They come from teaching/prompts.ts. */
  prompts?: readonly string[];
}

export const STOPS: [Stop, ...Stop[]] = [
  {
    title: "Placeholder: title stop",
    caption: "This is a placeholder caption. Use the arrow keys, Page Up and Page Down, or Next and Back to move.",
    view: { kind: "none" },
  },
  {
    title: "Placeholder: fixed view",
    caption: "This placeholder stop shows a fixed view with nothing highlighted.",
    view: { kind: "class-key" },
  },
  {
    title: "Placeholder: highlight",
    caption: "This placeholder stop shows the same view with one weapon class highlighted.",
    view: { kind: "class-key", highlight: "shahed_drone" },
    prompts: STOP_PROMPTS.closing,
  },
];
