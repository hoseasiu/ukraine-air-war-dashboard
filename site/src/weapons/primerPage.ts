/**
 * The weapon-class primer (#87): one card for each of the five classes, from the
 * weapon reference tables, with notes on mixed counts and excluded types.
 *
 * The figures are published claims about types of weapon, not counts from the
 * data, so they aren't charts and take no data-quality badges. Leave out
 * anything about cost, interception, launch areas or particular launches.
 * One member of each class has a scale line drawing (drawings.ts, #89).
 *
 * The owner approved the "About the figures", "Mixed", "Decoys" and "Left out"
 * paragraphs and the wording in the tables (#86), then the rest (#87). Changing
 * any of it needs their review again.
 */
import { drawings, taxonomy, weaponClasses, weapons } from "../data.ts";
import { withTerms } from "../glossary/popover.ts";
import type { TermId } from "../glossary/terms.ts";
import { CLASS_STYLES, type ClassId } from "../theme/classStyles.ts";
import { classKeyFill, classSymbolPath, svgElement } from "../theme/marks.ts";
import { DRAWING_WIDTH_M, outlinePath, PERSON_HEIGHT_M, type Drawing, type Outline } from "./drawings.ts";
import {
  allUnknown,
  classOnlySearch,
  PRIMER_CLASS_IDS,
  primerHash,
  wikipediaOnly,
  type Cited,
  type Measure,
  type Member,
  type WeaponSource,
} from "./weaponData.ts";
import "./primer.css";

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

function link(url: string, ...content: Content[]): HTMLAnchorElement {
  const a = create("a", "", ...content);
  a.href = url;
  return a;
}

const paragraph = (text: string, seen: Set<TermId>, className = "") => create("p", className, ...withTerms(text, seen));

const hidden = (text: string) => create("span", "visually-hidden", text);

const classLabel = (id: ClassId) => weaponClasses.find((entry) => entry.id === id)!.label;

/** The class's bar fill and point symbol. The label beside it names the class. */
function classMark(id: ClassId): SVGSVGElement {
  const svg = svgElement("svg", { width: 52, height: 18, "aria-hidden": "true", focusable: "false" });
  svg.classList.add("class-mark");
  svg.append(
    svgElement("rect", { x: 0, y: 1, width: 24, height: 16, fill: classKeyFill(id) }),
    svgElement("path", { d: classSymbolPath(id, 120), transform: "translate(40,9)", fill: CLASS_STYLES[id].color }),
  );
  return svg;
}

/**
 * Links to the cited pages, named by publisher. The page's title follows for
 * screen readers, and on screen where one publisher is cited twice.
 */
function citations(sources: readonly WeaponSource[]): HTMLElement {
  const shortName = (source: WeaponSource) => source.publisher.split(",")[0]!;
  const names = sources.map(shortName);
  return create(
    "span",
    "citations",
    ...sources.flatMap((source, index) => {
      const name = shortName(source);
      const repeated = names.indexOf(name) !== names.lastIndexOf(name);
      const title = repeated ? `: ${source.title}` : hidden(`: ${source.title}`);
      return [...(index ? [", "] : []), link(source.url, name, title)];
    }),
  );
}

/** Said in words, so it doesn't rest on a symbol (owner, #86). */
function mark(sources: readonly WeaponSource[]): Content[] {
  return wikipediaOnly(sources) ? [" ", create("span", "wikipedia-only", "Wikipedia only")] : [];
}

function fact(name: string, field: Cited, seen: Set<TermId>): Content[] {
  return [
    create("dt", "", name),
    create(
      "dd",
      "",
      ...(field.sources.length
        ? [...withTerms(field.text, seen), ...mark(field.sources), " ", create("span", "cited-from", "Source: ", citations(field.sources))]
        : [create("span", "unknown", "Unknown")]),
    ),
  ];
}

function figureRow(measure: Measure): HTMLTableRowElement {
  const row = create("tr");
  const heading = create("th", "", measure.label);
  heading.scope = "row";
  if (measure.value === null) {
    row.append(heading, create("td", "", create("span", "unknown", "Unknown"), `. ${measure.unknownReason}`));
    row.lastElementChild!.setAttribute("colspan", "2");
  } else {
    row.append(
      heading,
      create("td", "", measure.value, ...mark(measure.sources)),
      create("td", "", citations(measure.sources)),
    );
  }
  return row;
}

/** Each source's own figure, with the note on it, such as an upper limit. */
function bySource(member: Member): HTMLDetailsElement {
  const known = member.measures.filter((measure) => measure.value !== null);
  return create(
    "details",
    "by-source",
    create("summary", "", "What each source gives, with notes", hidden(`: ${member.name}`)),
    create(
      "dl",
      "",
      ...known.flatMap((measure) => [
        create("dt", "", measure.label),
        ...measure.figures.map((figure) =>
          create("dd", "", citations([figure.source]), `: ${figure.value}.`, figure.note ? ` ${figure.note}` : ""),
        ),
      ]),
    ),
  );
}

function figures(member: Member): Content[] {
  if (member.measures.every((measure) => measure.value === null)) {
    const reasons = [...new Set(member.measures.map((measure) => measure.unknownReason))].join(" ");
    return [
      create(
        "p",
        "",
        create("span", "unknown", "Unknown"),
        `: length, wingspan, diameter, warhead or payload, range and speed. ${reasons}`,
      ),
    ];
  }
  const table = create("table", "figures");
  table.createCaption().textContent = `Published figures: ${member.name}`;
  const head = table.createTHead().insertRow();
  for (const title of ["Measure", "Published figure", "Cited from"]) {
    const th = create("th", "", title);
    th.scope = "col";
    head.append(th);
  }
  table.createTBody().append(...member.measures.map(figureRow));
  const scroller = create("div", "table-scroll", table);
  // Focusable so keyboard users can scroll it on narrow screens.
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", `Published figures: ${member.name}`);
  return [scroller, bySource(member)];
}

/** The outline drawing, its dimensions and source, and what the shape was drawn from. */
function drawingFigure(member: Member, drawing: Drawing): HTMLElement {
  const svg = svgElement("svg", {
    viewBox: `0 0 ${DRAWING_WIDTH_M} ${+drawing.height.toFixed(3)}`,
    role: "img",
    "aria-label": drawing.description,
    focusable: "false",
  });
  const paths = (className: string, outlines: Outline[]) =>
    outlines.map((outline) => svgElement("path", { class: className, d: outlinePath(outline) }));
  svg.append(...paths("outline-person", drawing.person), ...paths("outline-weapon", drawing.weapon));
  const { spec, source } = drawing;
  return create(
    "figure",
    "drawing",
    svg,
    create(
      "figcaption",
      "",
      create(
        "p",
        "",
        `${spec.variant}, seen ${spec.view === "above" ? "from above" : "from the side"}. To scale: ` +
          `${drawing.dimensionText}.`,
        ...mark([source]),
        " ",
        create("span", "cited-from", "Dimensions from: ", citations([source])),
      ),
      ...(spec.note ? [create("p", "", spec.note)] : []),
      create(
        "details",
        "based-on",
        create("summary", "", "What the shape is based on", hidden(`: ${member.name}`)),
        create(
          "ul",
          "",
          ...spec.basedOn.map((reference) =>
            create("li", "", link(reference.url, reference.title), reference.license ? ` (${reference.license})` : ""),
          ),
        ),
      ),
    ),
  );
}

function memberBlock(member: Member, seen: Set<TermId>): HTMLElement {
  const block = create("article", "member", create("h4", "", member.name));
  block.append(
    create(
      "p",
      "member-models",
      "Names in the strike data: ",
      ...member.models.flatMap((model, index) => [...(index ? [", "] : []), create("code", "", model)]),
    ),
  );
  if (member.note) block.append(paragraph(member.note, seen));
  const drawing = drawings.get(member.id);
  if (drawing) block.append(drawingFigure(member, drawing));
  if (allUnknown(member)) {
    const reasons = [...new Set(member.measures.map((measure) => measure.unknownReason))].join(" ");
    block.append(
      create("p", "", create("span", "unknown", "Unknown"), `: role, launch platform, speed and every figure. ${reasons}`),
    );
    return block;
  }
  block.append(
    create(
      "dl",
      "member-facts",
      ...fact("Role", member.role, seen),
      ...fact("Launch platform", member.platform, seen),
      ...fact("Speed category", member.speedCategory, seen),
    ),
    ...figures(member),
  );
  return block;
}

/** The chart tabs, showing this class only. The other filters stay as they are. */
function chartLinks(id: ClassId): HTMLElement {
  const search = classOnlySearch(window.location.search, id);
  const tabs = [
    ["#attacks", "Attacks charts"],
    ["#defense", "Defense charts"],
  ] as const;
  // The mixed class has no intercept rate of its own, but its launches still show on both tabs.
  return create(
    "p",
    "chart-links",
    "Show only this class in the ",
    ...tabs.flatMap(([hash, text], index) => [
      ...(index ? [" or the "] : []),
      link(`${search}${hash}`, text, hidden(`: ${classLabel(id)}`)),
    ]),
    ".",
  );
}

/** A section with a heading that the contents buttons and class routes can move to. */
function section(className: string, title: Content[], ...content: Content[]): [HTMLElement, HTMLHeadingElement] {
  const heading = create("h3", "", ...title);
  heading.tabIndex = -1;
  return [create("section", className, heading, ...content), heading];
}

function card(id: ClassId): [HTMLElement, HTMLHeadingElement] {
  const seen = new Set<TermId>();
  const members = weapons.members.filter((member) => member.classId === id);
  const [element, heading] = section(
    "primer-card",
    [classMark(id), " ", classLabel(id)],
    chartLinks(id),
  );
  heading.dataset.route = primerHash(id);
  element.style.borderTopColor = CLASS_STYLES[id].color;
  if (id === "shahed_drone") {
    element.append(
      paragraph(
        "The source counts decoy and imitator drones together with Shahed-type drones. This data can’t separate " +
          "them, so it can’t show how many of the drones counted were decoys.",
        seen,
      ),
    );
  }
  element.append(
    create(
      "p",
      "drawing-note",
      `Drawn: ${members.filter((member) => drawings.has(member.id)).map((member) => member.name).join(", ")}. ` +
        "The other weapons in this class have no drawing.",
    ),
    create("div", "members", ...members.map((member) => memberBlock(member, seen))),
  );
  return [element, heading];
}

function mixedNote(): [HTMLElement, HTMLHeadingElement] {
  const seen = new Set<TermId>();
  const { models } = taxonomy.find((entry) => entry.id === "mixed")!;
  const strings = create(
    "details",
    "mixed-models",
    create("summary", "", `Names in the strike data that are mixed (${models.length})`),
    create("ul", "", ...models.map((model) => create("li", "", create("code", "", model)))),
  );
  return section(
    "primer-note",
    [classMark("mixed"), " Mixed counts"],
    paragraph(
      "“Mixed” is a way of reporting, not a type of weapon. It’s one count that covers weapons from two or more " +
        "classes. It counts toward totals and is never split between classes.",
      seen,
    ),
    strings,
    chartLinks("mixed"),
  );
}

function leftOutNote(): [HTMLElement, HTMLHeadingElement] {
  const seen = new Set<TermId>();
  return section(
    "primer-note",
    ["What’s left out"],
    paragraph(
      "Reconnaissance, tactical and unidentified drones, including Lancet, and bombs aren’t in totals, massive " +
        "nights or intercept rates.",
      seen,
    ),
    create(
      "p",
      "",
      "The weapon-class table on ",
      link("#methods", "Data & Methods"),
      " lists every name in each class, including these.",
    ),
  );
}

function aboutFigures(): HTMLElement {
  const seen = new Set<TermId>();
  const checked = [...new Set(weapons.sources.map((source) => source.checkedOn))].sort();
  const date = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  const items = [
    "These are published estimates and claims, not measurements. A span covers different versions, or sources that " +
      "disagree. “Unknown” means we found no figure we could cite.",
    "A span isn’t a likely range. “Unknown” doesn’t mean that nothing is published, and it never means zero.",
    "“Wikipedia only” marks a statement or figure that only Wikipedia pages support. These are the weakest here.",
    "The War & Sanctions portal belongs to Ukraine’s Defence Intelligence. Its figures haven’t been independently " +
      "checked.",
    "Range is a nominal published figure, which can depend on version, payload and flight path. Length and diameter " +
      "may or may not include boosters or fairings. Where a source gives payload rather than warhead, its note says so.",
    "Speed stays in each source’s units and mixes cruise, maximum and brief peak speeds. The speed category is our " +
      "sorting of the fastest cited speed: subsonic is below Mach 1, supersonic Mach 1 to 5 and hypersonic above " +
      "Mach 5, converted at sea level. Hypersonic means at some point in the flight, not all of it. For " +
      "surface-to-air missiles, the speeds are published for air defense.",
    `A coding agent compiled the figures and read the pages, on ${checked.map((day) => date.format(new Date(day))).join(" and ")}, ` +
      "with an automated tool that returns extracts. Most figures haven’t been re-read against their pages. Check the " +
      "linked page before relying on one.",
    "The drawings are our own plain outlines, one for each class, all at one scale, beside a person " +
      `${PERSON_HEIGHT_M} m tall, a height we chose for comparison. Only the dimensions listed under a drawing are ` +
      "to scale. Everything else, such as the shape and position of wings and fins, is approximate.",
  ];
  const [element] = section(
    "primer-about",
    ["About the figures"],
    create("ul", "", ...items.map((text) => create("li", "", ...withTerms(text, seen)))),
  );
  return element;
}

export function primerPage(): HTMLElement {
  const page = create("div", "primer");
  const contents = create("ul");
  const nav = create("nav", "primer-contents", contents);
  nav.setAttribute("aria-label", "On this page");

  const entries = [
    ...PRIMER_CLASS_IDS.map((id) => ({ part: card(id), title: classLabel(id), mark: id as ClassId | null })),
    { part: mixedNote(), title: "Mixed counts", mark: "mixed" as const },
    { part: leftOutNote(), title: "What’s left out", mark: null },
  ];

  for (const { part, title, mark: id } of entries) {
    const heading = part[1];
    // Buttons, because a plain in-page link would be read as a route.
    const button = create("button", "", ...(id ? [classMark(id)] : []), title);
    button.type = "button";
    button.addEventListener("click", () => {
      heading.scrollIntoView();
      heading.focus({ preventScroll: true });
    });
    contents.append(create("li", "", button));
  }

  page.append(
    paragraph(
      "What each weapon class in the charts includes. These are general, published facts about types of weapon. " +
        "Nothing here is about a particular launch, place or time.",
      new Set(),
    ),
    nav,
    aboutFigures(),
    ...entries.map((entry) => entry.part[0]),
  );
  return page;
}
