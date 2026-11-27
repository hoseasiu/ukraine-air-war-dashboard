/**
 * Where the intercept-rate chart's panels go. The two classes with the longest
 * series get large panels; the rare ones share a compact row (#65). Sizes go by
 * class, not by the months shown, so filtering doesn't make a panel change kind.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import type { ClassId } from "../theme/classStyles.ts";

export const LARGE_RATE_CLASSES: readonly ClassId[] = ["shahed_drone", "cruise"];

export interface RatePanel {
  id: ClassId;
  /** A large panel draws lines and points; a compact one is a dot plot. */
  large: boolean;
  left: number;
  top: number;
  width: number;
  /** The panel's whole height, its name included. */
  height: number;
  /** The part of that height above the plot, for the name. */
  titleHeight: number;
}

export interface RateLayout {
  panels: RatePanel[];
  height: number;
}

/** Room above each plot for the class's name. */
export const RATE_PANEL_TITLE = 28;

/** Plot heights on the tab. */
const LARGE_PLOT = 290;
const COMPACT_PLOT = 200;
/** The least a plot in a guided stop's view can be and still be read. */
const MIN_LARGE_PLOT = 170;
const MIN_COMPACT_PLOT = 140;
/** In a guided view's single row, how wide a large panel is beside a compact one. */
const ONE_ROW_WEIGHT = 1.3;
/** Room for a name on two lines, which a single row's narrow panels need. */
const TWO_LINE_TITLE = 44;

/**
 * `fixedHeight` is about how tall a guided stop's drawing should be. Where two
 * rows don't fit it, a wide screen takes every panel in one, large ones wider.
 */
export function rateLayout(classes: readonly ClassId[], width: number, fixedHeight?: number): RateLayout {
  const large = classes.filter((id) => LARGE_RATE_CLASSES.includes(id));
  const compact = classes.filter((id) => !LARGE_RATE_CLASSES.includes(id));
  const mixed = large.length > 0 && compact.length > 0;

  const twoRows = 2 * RATE_PANEL_TITLE + MIN_LARGE_PLOT + MIN_COMPACT_PLOT;
  if (fixedHeight !== undefined && mixed && width >= 1100 && fixedHeight < twoRows) {
    const unit = width / (large.length * ONE_ROW_WEIGHT + compact.length);
    const height = Math.max(MIN_LARGE_PLOT, fixedHeight - TWO_LINE_TITLE) + TWO_LINE_TITLE;
    let left = 0;
    const panels = [...large, ...compact].map((id): RatePanel => {
      const isLarge = large.includes(id);
      const panelWidth = Math.floor(unit * (isLarge ? ONE_ROW_WEIGHT : 1));
      const panel = { id, large: isLarge, left, top: 0, width: panelWidth, height, titleHeight: TWO_LINE_TITLE };
      left += panel.width;
      return panel;
    });
    return { panels, height };
  }

  // A guided view's rows share its height, the large row taking more.
  const share = (part: number, least: number, most: number) => {
    const rows = (large.length ? 1 : 0) + (compact.length ? 1 : 0);
    const room = fixedHeight! - rows * RATE_PANEL_TITLE;
    return Math.min(most, Math.max(least, Math.floor(mixed ? room * part : room)));
  };
  const panels: RatePanel[] = [];
  let top = 0;
  const place = (ids: readonly ClassId[], isLarge: boolean, perRow: number, plot: number) => {
    const panelWidth = Math.floor(width / perRow);
    const height = plot + RATE_PANEL_TITLE;
    ids.forEach((id, index) => {
      panels.push({
        id,
        large: isLarge,
        left: (index % perRow) * panelWidth,
        top: top + Math.floor(index / perRow) * height,
        width: panelWidth,
        height,
        titleHeight: RATE_PANEL_TITLE,
      });
    });
    top += Math.ceil(ids.length / perRow) * height;
  };

  if (large.length) {
    // A large panel on its own takes the whole width.
    const perRow = width >= 880 ? large.length : 1;
    const plot = fixedHeight === undefined ? LARGE_PLOT : share(0.57, MIN_LARGE_PLOT, LARGE_PLOT);
    place(large, true, perRow, plot);
  }
  if (compact.length) {
    // Never wider than half the chart, so a rare class on its own doesn't look like a main one.
    const fits = width >= 720 ? 3 : width >= 480 ? 2 : 1;
    const plot = fixedHeight === undefined ? COMPACT_PLOT : share(0.43, MIN_COMPACT_PLOT, COMPACT_PLOT);
    place(compact, false, Math.max(Math.min(fits, compact.length), Math.min(fits, 2)), plot);
  }
  return { panels, height: top };
}
