/** Draws a tab's summary tiles. They aren't a chart, but carry the same badges. */
import { flagList } from "../chart/chartFrame.ts";
import { withTerms } from "../glossary/popover.ts";
import { create } from "../strikes/shared.ts";
import { day } from "./format.ts";
import type { Tile } from "./tileData.ts";
import "./tiles.css";

function card(tile: Tile): HTMLLIElement {
  const item = create("li", "tile");
  item.dataset.tile = tile.id;
  const label = create("p", "tile-label");
  label.append(...withTerms(tile.label));
  const note = create("p", "tile-note");
  note.append(...withTerms(tile.note));
  item.append(create("p", "tile-value", tile.value), label);
  if (tile.period) item.append(create("p", "tile-dates", `${day(tile.period.from)} to ${day(tile.period.to)}`));
  // The caveats come before the notes, so they're on screen with the number.
  if (tile.flags.length) item.append(flagList(tile.flags));
  item.append(note);
  return item;
}

/** The row of tiles and their source, or nothing when there are none to show. */
export function summaryTiles(tiles: readonly Tile[], source: HTMLElement): HTMLElement[] {
  if (!tiles.length) return [];
  const wrapper = create("div", "summary-tiles");
  const heading = create("h3", "visually-hidden", "Summary of the months shown");
  const list = create("ul", "tiles");
  list.append(...tiles.map(card));
  source.classList.add("tile-source");
  wrapper.append(heading, list, source);
  return [wrapper];
}
