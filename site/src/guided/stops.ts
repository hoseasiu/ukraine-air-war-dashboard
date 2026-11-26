/**
 * The guided-mode stops (docs/plan.md §5), as data. A stop's number and its
 * #stop-N hash come from its position in STOPS.
 *
 * Stops 1–6 are here (#21); #22 adds 7–12. The captions and titles are drafts
 * for the owner to edit and haven't been approved. Leave counts out of them, so
 * a data refresh can't make them wrong.
 */
import { STOP_PROMPTS } from "../teaching/prompts.ts";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";

/**
 * What a stop shows. A view is fixed: it takes all its settings from here and
 * never from the exploration filters, so a stop looks the same every time. Each
 * chart covers every month of the strike data. To add a chart, add a member
 * with its settings, then handle it in views.ts.
 */
export type StopView =
  | { kind: "none" }
  | { kind: "headlines" }
  | { kind: "monthly-launches"; classes: readonly ClassId[]; events: boolean }
  | { kind: "night-sizes" }
  /** "largest" is the night with the most published launches in the data. */
  | { kind: "one-night"; night: "largest" }
  | { kind: "night-calendar" }
  | { kind: "weekdays" };

export interface Stop {
  title: string;
  /** One or two sentences, shown in large type. */
  caption: string;
  view: StopView;
  /** A second view that takes the first one's place, so the room can be asked before it's shown. */
  reveal?: {
    view: StopView;
    /** Names the second view, as in "Show the day-of-week chart". */
    name: string;
    /** Names the first view, for the button that goes back to it. */
    hides: string;
  };
  /** Discussion prompts shown under the caption. They come from teaching/prompts.ts. */
  prompts?: readonly string[];
}

export const STOPS: [Stop, ...Stop[]] = [
  {
    title: "Every night, an air war",
    caption:
      "Three numbers on Russia’s missile and drone campaign against Ukraine. Each comes from public reports, covers " +
      "its own dates and leaves something out.",
    view: { kind: "headlines" },
  },
  {
    title: "The long view",
    caption:
      "Weapons launched each month, by class. The numbered markers show when cited events happened, not what caused " +
      "any change.",
    view: { kind: "monthly-launches", classes: CLASS_IDS, events: true },
  },
  {
    title: "Drones changed the game",
    caption:
      "Here are the Shahed-type launches on their own. The source counts decoys along with attack drones, and they " +
      "can’t be separated.",
    view: { kind: "monthly-launches", classes: ["shahed_drone"], events: false },
  },
  {
    title: "Ordinary and massive nights",
    caption:
      "A massive night had more weapons launched than 95% of the attack nights in the same calendar year. So the bar " +
      "moves: a massive night in one year can be smaller than an ordinary night in another.",
    view: { kind: "night-sizes" },
  },
  {
    title: "Inside one massive night",
    caption:
      "This is the night with the most published launches in the data. Launch areas are listed as its reports name " +
      "them, with no count for each area.",
    view: { kind: "one-night", night: "largest" },
  },
  {
    title: "Is there a rhythm?",
    caption:
      "Each square is a date, and darker squares had more weapons launched in the night ending that day. Look first; " +
      "then we’ll group the nights by day of the week.",
    view: { kind: "night-calendar" },
    reveal: { view: { kind: "weekdays" }, name: "the day-of-week chart", hides: "the calendar" },
    prompts: STOP_PROMPTS.rhythm,
  },
];
