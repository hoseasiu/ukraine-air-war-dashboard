import { dataNotes } from "./chart/dataNotes.ts";
import { alertAreas, buildInfo, formatDate } from "./data.ts";
import { filterControls, filterNotes } from "./filters/controls.ts";
import {
  defaultFilters,
  filterSearch,
  FIRST_MONTH,
  parseFilters,
  type FilterBounds,
  type Filters,
} from "./filters/state.ts";
import { createGuidedMode, FIRST_STOP_HASH, parseStopHash } from "./guided/engine.ts";
import { PAGES, type Page } from "./pages.ts";
import { installPatterns } from "./theme/marks.ts";
import "./styles.css";

const SITE_TITLE = "The Air War, in Data";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`index.html has no #${id}`);
  return found as T;
}

const nav = element("nav-list");
const main = element("main");

const snapshot = element<HTMLTimeElement>("snapshot-date");
snapshot.dateTime = buildInfo.snapshotDate;
snapshot.textContent = formatDate(buildInfo.snapshotDate);

function navLink(hash: string, text: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = hash;
  link.textContent = text;
  const item = document.createElement("li");
  item.append(link);
  nav.append(item);
  return link;
}

const links = new Map<Page, HTMLAnchorElement>(PAGES.map((page) => [page, navLink(`#${page.id}`, page.nav)]));
const guidedLink = navLink(FIRST_STOP_HASH, "Guided mode");
const guided = createGuidedMode(main);

const filterBounds: FilterBounds = {
  firstMonth: FIRST_MONTH,
  lastMonth: buildInfo.snapshotDate.slice(0, 7),
  oblastIds: alertAreas.filter((area) => area.inAlertTotals).map((area) => area.id),
};

const readFilters = () => parseFilters(window.location.search, filterBounds);

/** Replaces the history entry, so Back doesn't step through every filter change. */
function writeFilters(filters: Filters): void {
  const { pathname, search, hash } = window.location;
  window.history.replaceState(window.history.state, "", pathname + filterSearch(filters, filterBounds, search) + hash);
}

// Routes are URL hashes, so static hosting needs no rewrite rules. Following a
// hash link keeps the query string, which holds the filters.
function currentPage(): Page {
  const id = window.location.hash.slice(1);
  return PAGES.find((page) => page.id === id) ?? PAGES[0];
}

function markCurrent(current: HTMLAnchorElement): void {
  for (const link of [...links.values(), guidedLink]) {
    if (link === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function render(): void {
  const stop = parseStopHash(window.location.hash);
  if (stop !== null) {
    markCurrent(guidedLink);
    document.title = `${guided.show(stop)} · ${SITE_TITLE}`;
    return;
  }

  const page = currentPage();
  markCurrent(links.get(page)!);
  const heading = document.createElement("h2");
  heading.textContent = page.heading;
  heading.tabIndex = -1;
  main.replaceChildren(heading);

  const content = document.createElement("div");
  const notes = dataNotes(content);
  const draw = () => {
    content.replaceChildren();
    page.render(content, readFilters());
    notes.refresh();
  };
  if (page.filters) {
    // Only the content is redrawn on a change, so focus stays on the control.
    const update = (filters: Filters) => {
      writeFilters(filters);
      draw();
    };
    main.append(
      filterControls({
        bounds: filterBounds,
        oblasts: page.filters.oblasts ?? false,
        read: readFilters,
        write: update,
        reset: () => update(defaultFilters(filterBounds)),
      }),
      filterNotes(page.filters.notes),
    );
  }
  // Only the chart tabs, which take filters, get the strip. Data & Methods writes the notes out itself.
  if (page.filters) main.append(notes.element);
  main.append(content);
  draw();
  document.title = `${page.heading} · ${SITE_TITLE}`;
}

// A plain "#main" link would be read as a route, so move focus by hand.
element("skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});

window.addEventListener("hashchange", () => {
  const wasGuided = main.querySelector(".guided") !== null;
  render();
  // Tell keyboard and screen-reader users that the page changed. Between stops,
  // focus stays put and guided mode announces the new stop itself.
  if (!wasGuided || parseStopHash(window.location.hash) === null) {
    main.querySelector("h2")?.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
});

installPatterns();
render();
