import { buildInfo, formatDate } from "./data.ts";
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

const links = new Map<Page, HTMLAnchorElement>();
for (const page of PAGES) {
  const link = document.createElement("a");
  link.href = `#${page.id}`;
  link.textContent = page.nav;
  const item = document.createElement("li");
  item.append(link);
  nav.append(item);
  links.set(page, link);
}

// Routes are URL hashes, so static hosting needs no rewrite rules. Following a
// hash link keeps the query string, which is free for filter state.
function currentPage(): Page {
  const id = window.location.hash.slice(1);
  return PAGES.find((page) => page.id === id) ?? PAGES[0];
}

function render(): void {
  const page = currentPage();
  for (const [other, link] of links) {
    if (other === page) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  const heading = document.createElement("h2");
  heading.textContent = page.heading;
  heading.tabIndex = -1;
  main.replaceChildren(heading);
  page.render(main);
  document.title = `${page.heading} · ${SITE_TITLE}`;
}

// A plain "#main" link would be read as a route, so move focus by hand.
element("skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});

window.addEventListener("hashchange", () => {
  render();
  // Tell keyboard and screen-reader users that the page changed.
  main.querySelector("h2")?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
});

installPatterns();
render();
