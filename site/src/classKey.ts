import { weaponClasses } from "./data.ts";
import { withTerms } from "./glossary/popover.ts";
import { CLASS_STYLES } from "./theme/classStyles.ts";
import { classKeyFill, classSymbolPath, svgElement } from "./theme/marks.ts";

/** A table of each class with its bar fill, point symbol and line style. */
export function classKey(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "table-scroll";
  // Focusable so keyboard users can scroll it on narrow screens.
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", "Weapon class key");

  const table = document.createElement("table");
  table.className = "class-key";
  table.createCaption().textContent = "Weapon classes and how charts mark them";

  const head = table.createTHead().insertRow();
  for (const title of ["Class", "Bars", "Points", "Lines", "Own intercept rate"]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = title;
    head.append(th);
  }

  const body = table.createTBody();
  for (const { id, label, hasOwnInterceptRate } of weaponClasses) {
    const { color, pattern, symbol, dash } = CLASS_STYLES[id];
    const row = body.insertRow();
    const th = document.createElement("th");
    th.scope = "row";
    th.append(...withTerms(label));
    row.append(th);
    row.insertCell().append(
      swatch(`${pattern} fill`, svgElement("rect", { x: 4, y: 2, width: 40, height: 20, fill: classKeyFill(id) })),
    );
    row.insertCell().append(
      swatch(
        `${symbol} symbol`,
        svgElement("path", { d: classSymbolPath(id, 120), transform: "translate(24,12)", fill: color }),
      ),
    );
    row.insertCell().append(
      swatch(
        dash === "none" ? "solid line" : `line dashed ${dash}`,
        svgElement("line", { x1: 2, x2: 62, y1: 12, y2: 12, stroke: color, "stroke-width": 3, "stroke-dasharray": dash }),
        64,
      ),
    );
    row.insertCell().textContent = hasOwnInterceptRate ? "Yes" : "No";
  }

  wrapper.append(table);
  return wrapper;
}

function swatch(description: string, mark: SVGElement, width = 48): SVGSVGElement {
  const svg = svgElement("svg", { width, height: 24, role: "img", "aria-label": description });
  svg.append(mark);
  return svg;
}
