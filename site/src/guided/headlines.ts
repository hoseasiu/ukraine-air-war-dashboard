/** Draws stop 1's headline numbers. They aren't a chart, but carry the same badges. */
import { flagList } from "../chart/chartFrame.ts";
import { alertMonthly, excludedAlertAreas, formatDate, monthlyTable, outcomeTable } from "../data.ts";
import { withTerms } from "../glossary/popover.ts";
import { create, percent } from "../strikes/shared.ts";
import { headlines, type Headline } from "./headlineData.ts";
import "./guided.css";

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function card(headline: Headline, value: string, label: string, note: string): HTMLLIElement {
  const item = create("li", "headline");
  item.dataset.headline = headline.id;
  const meaning = create("p", "headline-label");
  meaning.append(...withTerms(label));
  const dates = create("p", "headline-dates", `${formatDate(headline.period.from)} to ${formatDate(headline.period.to)}`);
  const detail = create("p", "headline-note");
  detail.append(...withTerms(note));
  item.append(create("p", "headline-value", value), meaning, dates);
  // The caveats come before the notes, so they're on screen with the number.
  if (headline.flags.length) item.append(flagList(headline.flags));
  item.append(detail);
  return item;
}

export function headlineView(): HTMLElement {
  const { launched, destroyedShare, alertHours } = headlines(monthlyTable, outcomeTable, alertMonthly);
  const wrapper = create("div");
  const list = create("ul", "headlines");
  list.setAttribute("aria-label", "Three headline numbers");
  list.append(
    card(
      launched,
      whole.format(launched.value),
      "weapons launched, from published counts",
      "National military reports, daytime ones included. Leaves out reconnaissance, tactical and unidentified " +
        "UAVs, bombs and unpublished counts.",
    ),
    card(
      destroyedShare,
      percent.format(destroyedShare.value),
      "of launches were reported destroyed, including by electronic warfare",
      `${whole.format(destroyedShare.destroyed)} of ${whole.format(destroyedShare.launchedWithOutcome)} launches ` +
        "in reports where both counts are usable, all counted classes. It ends where missile intercept rates end, " +
        "because missile reporting was later restricted.",
    ),
    card(
      alertHours,
      whole.format(alertHours.value),
      "hours under air-raid alert, mean per area",
      `About ${whole.format(alertHours.value / alertHours.months)} hours a month. The mean of ${alertHours.areas} ` +
        "areas (oblasts and Kyiv city), each averaged over its raions, not a national total. Leaves out " +
        `${new Intl.ListFormat("en-US").format(excludedAlertAreas())}.`,
    ),
  );
  wrapper.append(
    list,
    create(
      "p",
      "headline-credit",
      "Strikes: “Massive Missile Attacks on Ukraine” (Petro Ivaniuk, Kaggle, CC BY-NC-SA 4.0), grouped into our " +
        "weapon classes. Alerts: official file of the Ukrainian air-raid sirens dataset (Vadimkin, MIT license).",
    ),
  );
  return wrapper;
}
