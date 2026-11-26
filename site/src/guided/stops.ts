/**
 * The guided-mode stops (docs/plan.md §5), as data. A stop's number and its
 * #stop-N hash come from its position in STOPS.
 *
 * The owner approved the titles and captions of stops 1–6 on Nov 25, 2026
 * (#21); a change to one needs their review again. Stops 7–12 (#22), with stop
 * 7's definition and stop 11's points, are drafts the owner hasn't reviewed.
 * Leave counts out of all of them, so a data refresh can't make them wrong.
 */
import { DEFAULT_COMPARISON } from "../alerts/comparisonData.ts";
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
  | { kind: "weekdays" }
  | { kind: "intercept-rates"; classes: readonly ClassId[] }
  | { kind: "saturation"; classes: readonly ClassId[] }
  /** Every month of the alert data, opening on the first, so that playing runs through them all. */
  | { kind: "alert-map" }
  /** Monthly alert hours for up to three areas, as ISO 3166-2 codes. */
  | { kind: "oblast-comparison"; oblasts: readonly string[] }
  /** A short list in large type, in place of a chart. */
  | { kind: "points"; points: readonly Point[] };

export interface Point {
  heading: string;
  text: string;
}

export interface Stop {
  title: string;
  /** One or two sentences, shown in large type. */
  caption: string;
  /** A term the stop turns on, defined in large type above its view. */
  definition?: Point;
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
  {
    title: "How well do defenses hold?",
    caption:
      "Each panel shows the share of one class’s launches reported destroyed, month by month. A break in a line is " +
      "a gap with no rate, not 0%.",
    definition: {
      heading: "What “destroyed” means here",
      text:
        "Reported shot down or suppressed. It includes weapons lost to electronic warfare (EW), so launched minus " +
        "destroyed is not a count of hits. These are figures from military reports, not verified performance.",
    },
    view: { kind: "intercept-rates", classes: CLASS_IDS },
  },
  {
    title: "Saturation",
    caption:
      "Each point is one night: weapons launched, against the number not reported destroyed. That number tends to " +
      "grow with size even if the share destroyed doesn’t change, and the chart can’t show what caused a pattern.",
    view: { kind: "saturation", classes: CLASS_IDS },
    prompts: STOP_PROMPTS.saturation,
  },
  {
    title: "The civilian clock",
    caption:
      "Hours under air-raid alert in a month, averaged over each oblast’s raions (districts). The colors stay the " +
      "same, but months before and after the 2025 move to raion alerts are only partly comparable.",
    view: { kind: "alert-map" },
  },
  {
    title: "Three cities",
    caption:
      "Monthly alert hours in a frontline oblast, Kyiv city and a western oblast, on one scale. Hours under alert " +
      "don’t show how much danger or damage there was.",
    view: { kind: "oblast-comparison", oblasts: DEFAULT_COMPARISON },
  },
  {
    title: "What this data can’t tell you",
    caption: "Every chart is limited by how its figures were reported. Here are four limits to keep in mind.",
    view: {
      kind: "points",
      points: [
        {
          heading: "Reporting windows",
          text:
            "A strike count covers a reporting window, not the time of each launch. A night’s total may cover " +
            "several waves, and some windows overlap.",
        },
        {
          heading: "Electronic warfare",
          text:
            "“Destroyed” includes weapons lost to electronic warfare (EW). These are reported figures, and what " +
            "isn’t reported destroyed isn’t a count of hits.",
        },
        {
          heading: "Withheld figures",
          text:
            "From Aug 11, 2026, some missile counts have not been published. They are unknown, not zero, and this " +
            "data can’t tell how many are missing.",
        },
        {
          heading: "No trajectories or impact points",
          text:
            "This dashboard has no flight paths and doesn’t place where weapons came down. It can’t show approach " +
            "routes, damage or harm to people.",
        },
      ],
    },
  },
  {
    title: "Over to you",
    caption: "Three questions to carry into your own projects.",
    view: { kind: "none" },
    prompts: STOP_PROMPTS.closing,
  },
];
