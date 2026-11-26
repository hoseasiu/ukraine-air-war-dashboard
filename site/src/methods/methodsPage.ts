/**
 * The Data & Methods page (plan §6): sources and licenses, the snapshot, how
 * each figure is traced, definitions, the weapon-class table, known gaps, how
 * to cite and a changelog.
 *
 * Figures that depend on the data are read or worked out from the built files,
 * never typed in. A figure that carries a caveat gets its badges from
 * chartFlags(), like a chart's.
 */
import { flagList, formatMonth } from "../chart/chartFrame.ts";
import {
  ALERT_GRANULARITY_CHANGE_FROM,
  BALLISTIC_RESTRICTION_FROM,
  chartFlags,
  FLAG_IDS,
  FLAG_TEXT,
  type ColumnSpec,
  type Period,
} from "../chart/flags.ts";
import { classKey } from "../classKey.ts";
import {
  alertMonthly,
  annotations,
  boundaries,
  buildInfo,
  excludedAlertAreas,
  formatDate,
  manifest,
  monthlyTable,
  nightTable,
  rateTable,
  reconciliation,
  taxonomy,
} from "../data.ts";
import { MIN_BIN_NIGHTS, SIZE_BINS } from "../defense/defenseData.ts";
import { WINDOW_DAYS } from "../defense/eventWindowData.ts";
import { glossaryList, withTerms } from "../glossary/popover.ts";
import type { TermId } from "../glossary/terms.ts";
import { headlines } from "../guided/headlineData.ts";
import { barValue, MASSIVE_DEFINITION, RESTRICTED_BAR_NOTE } from "../strikes/shared.ts";
import { barIsRestricted } from "../strikes/strikeData.ts";
import { CHANGELOG } from "./changelog.ts";
import { datesWithoutNight, type BucketId, type SourceFile } from "./methodsData.ts";
import { TRACES } from "./traces.ts";
import "./methods.css";

const REPO = "https://github.com/hoseasiu/ukraine-air-war-dashboard";
const SITE = "https://hoseasiu.github.io/ukraine-air-war-dashboard/";
const BOUNDARY_SOURCE = "https://data.humdata.org/dataset/cod-ab-ukr";
const BOUNDARY_LICENSE = "https://creativecommons.org/licenses/by/3.0/igo/legalcode";
const STRIKE_LICENSE = "https://creativecommons.org/licenses/by-nc-sa/4.0/";

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const sharePercent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const list = new Intl.ListFormat("en-US");

type Content = Node | string;

function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  ...content: Content[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...content);
  return element;
}

function link(url: string, text: string): HTMLAnchorElement {
  const a = create("a", "", text);
  a.href = url;
  return a;
}

const repoFile = (path: string, text = path) => link(`${REPO}/blob/main/${path}`, text);

/** A paragraph. Plain strings get glossary popovers, once per term in each `seen` set. */
function paragraph(seen: Set<TermId>, ...content: Content[]): HTMLParagraphElement {
  return create("p", "", ...content.flatMap((part) => (typeof part === "string" ? withTerms(part, seen) : [part])));
}

function bullets(items: Content[][]): HTMLUListElement {
  return create("ul", "", ...items.map((content) => create("li", "", ...content)));
}

const subheading = (text: string) => create("h4", "", text);

interface Cell {
  content: Content[];
  numeric?: boolean;
}

const text = (...content: Content[]): Cell => ({ content });
const num = (value: number): Cell => ({ content: [whole.format(value)], numeric: true });

/** A scrollable table. The first cell of each row heads it. */
function table(caption: string, columns: string[], rows: Cell[][]): HTMLElement {
  const wrapper = create("div", "table-scroll");
  // Focusable so keyboard users can scroll it on narrow screens.
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", caption);

  const element = create("table", "methods-table");
  element.createCaption().textContent = caption;
  const head = element.createTHead().insertRow();
  const numericColumns = new Set(rows[0]?.flatMap((cell, index) => (cell.numeric ? [index] : [])));
  columns.forEach((title, index) => {
    const th = create("th", numericColumns.has(index) ? "numeric" : "", title);
    th.scope = "col";
    head.append(th);
  });
  const body = element.createTBody();
  for (const cells of rows) {
    const row = body.insertRow();
    cells.forEach((cell, index) => {
      const element = create(index ? "td" : "th", cell.numeric ? "numeric" : "", ...cell.content);
      if (!index) (element as HTMLTableCellElement).scope = "row";
      row.append(element);
    });
  }
  wrapper.append(element);
  return wrapper;
}

/** The badges for figures outside a chart. */
function badges(columns: ColumnSpec[], rows: object[], coverage: Period): HTMLElement {
  return flagList(chartFlags({ columns, rows, coverage }));
}

const strikePeriod = (): Period => ({ from: nightTable.firstDay, to: nightTable.lastDay });

const alertMonths = () => ({ first: formatMonth(alertMonthly.months[0]!), last: formatMonth(alertMonthly.months.at(-1)!) });

function snapshotSection(): Content[] {
  const seen = new Set<TermId>();
  const { first, last } = alertMonths();
  return [
    paragraph(
      seen,
      `The data snapshot is dated ${formatDate(buildInfo.snapshotDate)}: the latest date on which a strike report ` +
        "in the file ends. Nothing is fetched when you open a page, and nothing here is real-time. This is a " +
        "retrospective teaching tool, not for warning or targeting.",
    ),
    bullets([
      [`Strike figures: ${formatDate(nightTable.firstDay)} through ${formatDate(nightTable.lastDay)}. The first and last months can be partial.`],
      [`Alert figures: ${first} through ${last}, in Kyiv time. They end earlier than the strike figures.`],
    ]),
    paragraph(
      seen,
      "The figures are what the sources report. This project has not independently verified them. A spot check of a " +
        "few strike reports against their Air Force posts found one destroyed count that differed from the current " +
        "post (",
      repoFile("docs/data-audit.md", "data audit"),
      ").",
    ),
  ];
}

function filesTable(caption: string, files: SourceFile[]): HTMLElement {
  return table(
    caption,
    ["File", "Data rows", "Size in bytes", "SHA-256"],
    files.map((file) => [text(file.name), num(file.rows), num(file.bytes), text(create("code", "hash", file.sha256))]),
  );
}

function sourcesSection(): Content[] {
  const seen = new Set<TermId>();
  const { kaggle, alerts } = manifest;
  return [
    paragraph(
      seen,
      "Third-party material keeps its own terms wherever it appears, so one license doesn’t cover this site. Full " +
        "notices are in ",
      link("./licenses.txt", "licenses and credits"),
      " and ",
      link("./third-party-licenses.txt", "library licenses"),
      "; ",
      repoFile("LICENSING.md", "LICENSING.md"),
      " says which terms cover which files. This is our reading of the licenses, not legal advice.",
    ),

    subheading("Strikes"),
    paragraph(
      seen,
      link(kaggle.url, "Massive Missile Attacks on Ukraine"),
      " by Petro Ivaniuk (Kaggle), under ",
      link(STRIKE_LICENSE, kaggle.license),
      ". Strike tables, charts and figures here are adapted from it, so treat them as noncommercial and " +
        "share-alike under the same license: credit the author, link the dataset and license, and say what you changed.",
    ),
    paragraph(
      seen,
      "What we changed: raw model names are grouped into weapon classes; only national military reports in counted " +
        "classes are used; counts are added by attack night and by month; unpublished and blank counts are treated " +
        "as unknown; destroyed counts use only reports where both counts are usable; massive-night labels, intercept " +
        "rates and data-quality flags are added; and launch areas are listed as reported, apart from one Cyrillic " +
        "letter replaced with the Latin letter it resembles.",
    ),

    subheading("Air-raid alerts"),
    paragraph(
      seen,
      link(alerts.url, "Ukrainian air raid sirens dataset"),
      ` by Vadym Klymenko (Vadimkin), ${alerts.license} license, Copyright (c) 2022 Vadym Klymenko. We use it at `,
      link(`${alerts.url}/tree/${alerts.commit}`, `commit ${alerts.commit.slice(0, 7)}`),
      ".",
    ),
    paragraph(
      seen,
      "What we changed: only the official English file is used; exact duplicate rows, hromada-level rows and the " +
        "excluded areas are left out; alerts are averaged over each oblast’s raions and totaled by Kyiv-time day and " +
        "month. The build also reads and checksums the volunteer file, but no figure uses it. The dataset is " +
        "collected from Telegram channels, and we haven’t established what terms those channels set.",
    ),

    subheading("Map boundaries"),
    paragraph(
      seen,
      `${boundaries.attribution} `,
      link(BOUNDARY_SOURCE, "Source on HDX"),
      ", under ",
      link(BOUNDARY_LICENSE, "CC BY-IGO"),
      ". No endorsement by Kartographia or OCHA is implied. The map shows administrative boundaries only, with " +
        "Crimea and Sevastopol as part of Ukraine. It has no front line or areas of control, and isn’t for measuring " +
        "areas or locating anything.",
    ),

    subheading("Event annotations"),
    paragraph(
      seen,
      "We compiled these by hand. The site uses only events that were checked against their cited pages and " +
        "approved by the project owner. The pages were checked with an automated tool that returned extracts, and " +
        "several are news or secondary reports. An event’s place in time doesn’t show that it caused any change.",
    ),
    table(
      "Approved events and their citations",
      ["Date", "What the date marks", "Event", "Sources"],
      annotations.map((event) => [
        text(formatDate(event.date)),
        text(event.dateMarks),
        text(create("strong", "", event.label), create("br"), event.description),
        text(
          ...event.sources.flatMap((url, index) => [
            ...(index ? [create("br")] : []),
            link(url, new URL(url).hostname.replace(/^www\./, "")),
          ]),
        ),
      ]),
    ),

    subheading("This project’s own work"),
    paragraph(
      seen,
      "The code is under the MIT license. Our definitions, discussion prompts, captions, event labels and " +
        "explanations are under CC BY 4.0.",
    ),
  ];
}

function headlineCounts(): Content[] {
  const { launched, destroyedShare, alertHours } = headlines(monthlyTable, rateTable, alertMonthly);
  const dates = (period: Period) => text(`${formatDate(period.from)} to ${formatDate(period.to)}`);
  const value = (shown: string): Cell => ({ content: [shown], numeric: true });
  return [
    table(
      "Guided stop 1’s three numbers",
      ["Number", "Value", "Dates", "Worked out as"],
      [
        [text("Weapons launched"), value(whole.format(launched.value)), dates(launched.period), text("Published counts, added up")],
        [
          text("Share reported destroyed"),
          value(sharePercent.format(destroyedShare.value)),
          dates(destroyedShare.period),
          text(`${whole.format(destroyedShare.destroyed)} destroyed ÷ ${whole.format(destroyedShare.launchedWithOutcome)} launches with an outcome`),
        ],
        [
          text("Alert hours in an average month"),
          value(oneDecimal.format(alertHours.value)),
          dates(alertHours.period),
          text(`Mean of ${alertHours.areas} areas over every month`),
        ],
      ],
    ),
    flagList(FLAG_IDS.filter((id) => [launched, destroyedShare, alertHours].some((h) => h.flags.includes(id)))),
  ];
}

const BUCKET_LABELS: Record<BucketId, string> = {
  in_monthly_totals: "Used in the monthly figures",
  excluded_class: "Left out: excluded weapon classes (all accounts)",
  not_a_national_account: "Left out: counted classes, but not a national military report",
  hidden: "Left out: marked “hidden” (counts not published)",
};

function rawRows(): Content[] {
  const seen = new Set<TermId>();
  const { raw, buckets, daytime, tableLaunched } = reconciliation;
  const row = (label: string, rows: number, launched: number) => [text(label), num(rows), num(launched)];
  const column: ColumnSpec = { key: "launched", label: "Launched, as published", type: "number", measure: "launched" };
  return [
    paragraph(
      seen,
      "Every row of the raw strike file falls in exactly one of the first four groups below, and the groups add up " +
        "to the whole file. The sums are as published: for rows that are left out, they can include repeats, " +
        "placeholders and shoot-down-only reports, so they’re for checking, not for counting attacks.",
    ),
    table(
      "How the raw strike rows are used",
      ["Rows", "Number of rows", "Launched, as published"],
      [
        ...(Object.keys(BUCKET_LABELS) as BucketId[]).map((id) =>
          row(BUCKET_LABELS[id], buckets[id].rows, buckets[id].launched_as_published),
        ),
        row("Whole raw file", raw.rows, raw.launched_as_published),
      ],
    ),
    badges([column], [], strikePeriod()),
    paragraph(
      seen,
      `The monthly table adds up to ${whole.format(tableLaunched.monthly)} launches. The night table adds up to ` +
        `${whole.format(tableLaunched.nights)}, because it leaves out ${whole.format(daytime.rows)} daytime reports ` +
        `with ${whole.format(daytime.launched_as_published)} launches.`,
    ),
  ];
}

function traceSection(): Content[] {
  const seen = new Set<TermId>();
  const files = (paths: string[], prefix = "") =>
    paths.flatMap((path, index) => [
      ...(index ? [create("br")] : []),
      repoFile(`${prefix}${path}`, path.split("/").at(-1)!),
    ]);
  return [
    paragraph(
      seen,
      "A number goes from a raw source file, through the Python build, into a table committed to the repository, " +
        "and from there to the page. Each chart also has a “Show as table” button with the numbers it draws. To " +
        "trace one, find its figure here, then open the built table and the code that reads it. Column meanings are " +
        "in ",
      repoFile("data/README.md", "the data notes"),
      ". The links show the latest version of each file.",
    ),
    table(
      "Where each figure comes from",
      ["Figure", "Shown on", "How it’s worked out", "Built table", "Code"],
      TRACES.map((trace) => [
        text(trace.figure),
        text(trace.shownOn),
        text(trace.method),
        text(...files(trace.tables, "data/processed/")),
        text(...files(trace.code)),
      ]),
    ),
    paragraph(
      seen,
      "Other numbers are rules rather than data, such as thresholds, window lengths and dates; they’re explained " +
        "under Definitions and Known gaps. Event dates are cited under Event annotations.",
    ),

    subheading("Headline numbers"),
    ...headlineCounts(),

    subheading("From raw rows to the strike tables"),
    ...rawRows(),

    subheading("Source files used"),
    paragraph(
      seen,
      "A checksum tells you whether your copy of a file is the one used here. The strike file needs a Kaggle login " +
        "to download, and the dataset is updated over time, so a newer download won’t match. The raw files aren’t " +
        "in the repository. With them in place, one command rebuilds the tables (",
      repoFile("data/README.md", "setup and build steps"),
      ").",
    ),
    filesTable("Strike source files (Kaggle)", manifest.kaggle.files),
    filesTable("Alert source files (sirens dataset)", manifest.alerts.files),
  ];
}

function massiveYears(): Content[] {
  const rows = nightTable.years.map((year) => ({
    ...year,
    ballistic_restricted: barIsRestricted(nightTable, year.year),
  }));
  return [
    table(
      "Each year’s massive-night bar",
      ["Year", "Massive means more than", "Nights", "First night", "Last night", "Note"],
      rows.map((year) => [
        text(String(year.year)),
        { content: [barValue.format(year.massive_above)], numeric: true },
        num(year.n_nights),
        text(formatDate(year.first_night)),
        text(formatDate(year.last_night)),
        text(year.ballistic_restricted ? FLAG_TEXT.ballistic_restricted.label : ""),
      ]),
    ),
    badges(
      [{ key: "massive_above", label: "Massive bar", type: "number", measure: "launch_derived" }],
      rows,
      strikePeriod(),
    ),
  ];
}

function definitionsSection(): Content[] {
  const seen = new Set<TermId>();
  const missileEnd = formatMonth(rateTable.missileRatesEndBefore);
  const bins = SIZE_BINS.map((bin) => bin.label);
  return [
    subheading("Which strike reports count"),
    bullets([
      ["Only national military reports: the Air Force, the Commander-in-Chief and the General Staff accounts. Regional-command reports are left out because they may repeat national figures. This doesn’t rule out all double counting: national day and night windows sometimes overlap."],
      ["Only counted weapon classes (see the table under Weapon classes)."],
      ["Unpublished and blank counts are unknown, never zero. Both counts of a “hidden” row are left out of every sum."],
    ]),

    subheading("Attack night"),
    paragraph(
      seen,
      "The reports that end on one Kyiv date, without daytime reports. A report from one evening to the next " +
        "morning belongs to the morning’s date. A daytime report here starts from 05:00 to 12:59 and ends from " +
        "15:00 the same day. Daytime reports count in monthly figures, so nights don’t add up to months. A night’s " +
        "size is the sum of its published launch counts.",
    ),

    subheading("Massive night"),
    paragraph(
      seen,
      `${MASSIVE_DEFINITION} The percentile is interpolated linearly between nights. The bar differs by year, so a ` +
        "massive night in one year can be smaller than an ordinary night in another, and massive nights per year " +
        "aren’t charted as a trend. The bar for a year that isn’t over in the data can still move. A bar always " +
        `uses all counted classes. Labels round it down, which picks out the same nights. ${RESTRICTED_BAR_NOTE}`,
    ),
    ...massiveYears(),

    subheading("Intercept rate"),
    paragraph(
      seen,
      "Reported destroyed ÷ reported launched, for one class in one month, daytime reports included. Both counts " +
        "come from the same reports: unpublished and blank counts, and reports with more destroyed than launched, " +
        `are left out. With fewer than ${rateTable.minLaunched} such launches there is a gap, not 0%. A rate on few ` +
        "launches is coarse, so tables and tooltips show both counts. Mixed rows have no class rate. Missile " +
        `classes have no rate from ${missileEnd}: the dataset says a published destroyed count is sometimes copied ` +
        "into “launched”, and the affected rows can’t be reliably identified. An all-class share also stops before " +
        `${missileEnd}.`,
    ),
    flagList(["destroyed_includes_ew"]),

    subheading("Not reported destroyed"),
    paragraph(
      seen,
      "Launches with a usable outcome, minus those reported destroyed. It is not a count of hits: it can include " +
        "decoys, weapons still flying or unresolved, and losses to other causes. A night where some published " +
        "launches have no usable outcome is in the saturation chart’s table but has no point.",
    ),
    paragraph(
      seen,
      `The summary under that chart groups nights by size (${list.format(bins)}) and shows a median only for ` +
        `groups with at least ${MIN_BIN_NIGHTS} nights. It uses only nights that have a point on the chart.`,
    ),
    flagList(["destroyed_includes_ew"]),

    subheading("Before and after an event"),
    paragraph(
      seen,
      `Windows of ${list.format(WINDOW_DAYS.map(String))} days on each side of an event’s date, with the date in ` +
        "neither. Daytime reports are left out, and the minimum count and missile-class rules above apply to each " +
        "window. No difference is calculated or tested, and a difference doesn’t show that the event caused it.",
    ),

    subheading("Alert hours"),
    paragraph(
      seen,
      "For each raion, we merge the alerts for the whole oblast with that raion’s own, then average the hours over " +
        "the oblast’s raions. Kyiv city counts as one unit. So one oblast alert-hour is an hour for the average " +
        "raion: half the raions under alert for two hours counts as one hour. It doesn’t mean that the whole " +
        "oblast, or any particular place in it, was under alert, and raions aren’t weighted by population or area. " +
        "Days and months are in Kyiv time. A national figure is a mean over areas, never a sum.",
    ),
    paragraph(
      seen,
      "An alert count is the number of alert periods that started in a month, also averaged over raions, with " +
        "overlapping or touching alerts merged. It can be a fraction.",
    ),
  ];
}

function taxonomySection(): Content[] {
  const seen = new Set<TermId>();
  const yesNo = (value: boolean) => text(value ? "Yes" : "No");
  const excluded = taxonomy.filter((entry) => !entry.counted);
  return [
    paragraph(
      seen,
      "This table is generated from the mapping files that the build uses (",
      repoFile("data/reference/weapon_classes.csv", "classes"),
      " and ",
      repoFile("data/reference/model_classes.csv", "model strings"),
      "). The model strings are written exactly as the source writes them, so they come from the strike dataset and " +
        "are under its CC BY-NC-SA 4.0 license; the class assignments are ours. A string that names several weapons " +
        "takes their class if they share one, and otherwise goes to “mixed”. A combined count is never split.",
    ),
    table(
      "Weapon classes and the source’s model strings",
      ["Class", "In totals", "Own intercept rate", "Raw model strings"],
      taxonomy.map((entry) => {
        const models = create("details", "model-strings");
        models.append(
          create("summary", "", `${entry.models.length} model strings`),
          bullets(entry.models.map((model) => [model])),
        );
        return [text(entry.label), yesNo(entry.counted), yesNo(entry.hasOwnInterceptRate), text(models)];
      }),
    ),
    table(
      "Excluded classes and their rows in the raw file",
      ["Excluded class", "Rows left out"],
      excluded.map((entry) => [text(entry.label), num(reconciliation.excludedClassRows[entry.id]!.rows)]),
    ),
    paragraph(
      seen,
      "Reconnaissance, tactical and unidentified UAVs are left out because nearly all their rows report every one " +
        "destroyed, which suggests they’re logged because they were shot down. That includes Lancet and a few other " +
        "drones that aren’t only for reconnaissance. The file has few bomb rows, and they shouldn’t be read as the " +
        "number of glide bombs used.",
    ),

    subheading("Read these classes with care"),
    bullets([
      withTerms("Shahed-type counts include Gerbera, imitator drones and other types. Decoys can’t be separated, so this dashboard shows no decoy share. The source gives a jet-powered subset consistently only for a short recent period, so it shows no jet share either."),
      withTerms("Geran rows are in the Shahed-type class, but they come from a regional command, so the report rules leave them out of figures."),
      withTerms("Anti-ship and other is a varied group: Kh-22/Kh-32, Oniks, Kh-31 variants, Kh-35, C-300 and C-400 surface-to-air missiles listed among attacks, and missiles of unknown type."),
      withTerms("Ballistic includes rows reported only as ballistic or intercontinental ballistic missiles. We haven’t verified those identifications."),
      withTerms("Banderol is in the cruise class, as the source’s reference file says. Some Shahed rows also list Banderol counts, and we can’t tell whether those are already in the Shahed total."),
      withTerms("Mixed rows hold many missiles. A single class’s monthly launches and intercept rate don’t cover every launch of that kind."),
    ]),
    classKey(),
  ];
}

/** Every data-quality note in full. Badges show only their labels until opened. */
function writtenOutFlags(): HTMLDListElement {
  const seen = new Set<TermId>();
  return create(
    "dl",
    "gap-notes",
    ...FLAG_IDS.flatMap((id) => [
      create("dt", "", FLAG_TEXT[id].label),
      create("dd", "", ...withTerms(FLAG_TEXT[id].text, seen)),
    ]),
  );
}

function gapsSection(): Content[] {
  const seen = new Set<TermId>();
  const { dates, without } = datesWithoutNight(nightTable);
  const { hidden } = reconciliation.buckets;
  const { first, last } = alertMonths();
  return [
    paragraph(seen, "These notes appear on the figures they apply to."),
    writtenOutFlags(),

    subheading("Strikes"),
    bullets([
      [`The strike file starts on ${formatDate(nightTable.firstDay)}. Strike figures are not totals for the whole full-scale invasion, and we can’t tell how much of any early growth is a change in reporting.`],
      [`${whole.format(without)} of the ${whole.format(dates)} dates from ${formatDate(nightTable.firstDay)} through ${formatDate(nightTable.lastDay)} have no night. We can’t tell whether each was quiet or unreported.`],
      ["Counts can be preliminary, and posts can be edited after the dataset records them."],
      [`From ${formatDate(BALLISTIC_RESTRICTION_FROM)}, some missile counts aren’t published, and this data can’t tell how many are missing. A fall in published missile figures after that date isn’t evidence of fewer missiles.`],
      [`${whole.format(hidden.rows)} rows are marked “hidden”. Both of their counts are left out of every sum, including the ${whole.format(hidden.destroyed_as_published)} reported destroyed (which, like other such counts, includes electronic warfare) and the ${whole.format(hidden.launched_as_published)} launched that some of them publish.`],
      [`Rows with a blank launched count: ${whole.format(reconciliation.blankLaunched)}. With a blank destroyed count: ${whole.format(reconciliation.blankDestroyed)}. Rows not marked hidden that report more destroyed than launched: ${whole.format(reconciliation.destroyedAboveLaunched)}; such a row stays in launch totals but not in destroyed figures or rates.`],
      ["A report covers a time window, not the time of each launch. A night’s total may cover several waves."],
      ["Most launches come from reports that name several launch areas, so there are no counts by area."],
      ["The data has no flight paths or impact points, and says nothing here about damage or harm to people."],
    ]),

    subheading("Alerts"),
    bullets([
      [`Alert figures run from ${first} to ${last}. The official file stops in early September 2026, and several days around the start of that month are largely missing, so August 2026 and later have no figure.`],
      [`Excluded: ${list.format(excludedAlertAreas())}. The source doesn’t list the permanent alerts for Luhansk and Crimea, and has no rows for Sevastopol. They are shown as excluded, never as zero.`],
      ["Assumed end times: the official file doesn’t mark them. Its parser gives an unfinished alert an end one hour after its start, so we flag periods that include a row lasting exactly one hour. Some of those may be real hour-long alerts. The parser can also replace an unfinished alert’s start with a later one, which can’t be flagged."],
      [`Raion alerting phased in during 2025, with the main step in November 2025. The site flags alert figures from ${formatDate(ALERT_GRANULARITY_CHANGE_FROM)}. Part of any change across 2025 can come from the practice itself, so don’t read it as a change in threat. Alert counts are especially hard to compare.`],
      ["Alerts for single hromadas (communities) are left out, because they cover only part of a raion and the file gives no way to weight them. This understates the burden where they’re common, notably in Dnipropetrovsk oblast."],
      ["Donetsk oblast’s raions include areas under occupation, and we can’t tell how those alerts relate to what residents there hear."],
      ["The data has no yellow or red alert levels and can’t separate drone alerts from missile alerts."],
      ["Gaps in a single area’s alerts can’t be detected by our checks. A zero means the file lists no alert, not that none was missed."],
    ]),

    subheading("Definitions of terms"),
    paragraph(
      seen,
      "The glossary’s general descriptions of weapons, electronic warfare and decoys don’t have cited sources. " +
        "Its statements about this data follow the data audit.",
    ),
  ];
}

function citeSection(): Content[] {
  const seen = new Set<TermId>();
  const snapshot = formatDate(buildInfo.snapshotDate);
  const { kaggle, alerts } = manifest;
  const citation = (...content: Content[]) => create("p", "citation", ...content);
  return [
    paragraph(
      seen,
      "While the note at the top of the site calls this an early preview, please don’t cite it yet. After that, cite " +
        "the dashboard with its snapshot date and the day you read it:",
    ),
    citation(`Siu, Hosea. The Air War, in Data. Data snapshot ${snapshot}. ${SITE} (accessed [date]).`),
    paragraph(seen, "Credit the data too, with the files’ own terms. For strike figures:"),
    citation(
      `Ivaniuk, Petro. Massive Missile Attacks on Ukraine. Kaggle, snapshot ${snapshot}. ${kaggle.url}. ` +
        `${kaggle.license}. Adapted by The Air War, in Data.`,
    ),
    paragraph(seen, "For alert figures:"),
    citation(
      `Klymenko, Vadym. Ukrainian air raid sirens dataset, commit ${alerts.commit.slice(0, 7)}. ${alerts.url}. ` +
        `${alerts.license} license. Adapted by The Air War, in Data.`,
    ),
    paragraph(seen, "With the map, also give its boundary credit:"),
    citation(`${boundaries.attribution} CC BY-IGO.`),
    paragraph(
      seen,
      "Reusing a strike chart, table or figure carries the strike data’s noncommercial, share-alike terms. Keep its " +
        "data-quality notes with it.",
    ),
  ];
}

function elsewhereSection(): Content[] {
  const seen = new Set<TermId>();
  return [
    paragraph(
      seen,
      "These are separate projects. Their sources, rules and dates can differ from ours, we haven’t checked our " +
        "figures against theirs, and a link isn’t an endorsement.",
    ),
    bullets([
      [
        link(
          "https://www.csis.org/programs/futures-lab/projects/russian-firepower-strike-tracker-analyzing-missile-attacks-ukraine",
          "CSIS Russian Firepower Strike Tracker",
        ),
        ": interactive launches, missile types and intercepts, using the same Kaggle dataset.",
      ],
      [
        link("https://www.kas.de/en/web/ukraine/ukraine-air-war-monitor", "KAS and Kyiv Dialogue: Monitor Air War Ukraine"),
        ": a monthly written analysis.",
      ],
      [
        link("https://www.ucsc.org.ua/duration-of-air-alarms/", "Ukrainian Council of Shopping Centers: duration of air alarms"),
        ": an interactive monthly map of alert duration by region.",
      ],
    ]),
  ];
}

function changelogSection(): Content[] {
  return [
    ...CHANGELOG.flatMap((entry) => [
      subheading(formatDate(entry.date)),
      bullets(entry.changes.map((change) => [change])),
    ]),
    create("p", "", "The full history is in the ", link(`${REPO}/commits/main`, "repository’s commit log"), "."),
  ];
}

function glossarySection(): Content[] {
  return [glossaryList()];
}

const SECTIONS: readonly { title: string; content(): Content[] }[] = [
  { title: "Snapshot", content: snapshotSection },
  { title: "Sources and licenses", content: sourcesSection },
  { title: "Tracing the numbers", content: traceSection },
  { title: "Definitions", content: definitionsSection },
  { title: "Weapon classes", content: taxonomySection },
  { title: "Known gaps", content: gapsSection },
  { title: "How to cite", content: citeSection },
  { title: "Other trackers and maps", content: elsewhereSection },
  { title: "Changelog", content: changelogSection },
  { title: "Glossary", content: glossarySection },
];

export function methodsPage(): HTMLElement {
  const page = create("div", "methods");
  const contents = create("ul");
  const nav = create("nav", "methods-contents", contents);
  nav.setAttribute("aria-label", "On this page");
  page.append(nav);

  for (const { title, content } of SECTIONS) {
    const heading = create("h3", "", title);
    heading.tabIndex = -1;
    page.append(create("section", "", heading, ...content()));
    // Buttons, because a plain in-page link would be read as a route.
    const button = create("button", "", title);
    button.type = "button";
    button.addEventListener("click", () => {
      heading.scrollIntoView();
      heading.focus({ preventScroll: true });
    });
    contents.append(create("li", "", button));
  }
  return page;
}
