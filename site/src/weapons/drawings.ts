/**
 * The primer's scale line drawings (#89): one member of each class, as a plain
 * outline beside a standing person, all at one scale.
 *
 * The outlines are our own. Each was drawn as the coordinates below after
 * looking at the pages in `basedOn`; no image was traced or copied. Only the
 * dimensions in `dimensions` are to scale, and each must match a cited row of
 * weapon_figures.csv. Everything else about a shape is approximate.
 *
 * A weapon with a cited wingspan is drawn from above. One without is drawn from
 * the side, with its length and diameter.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { wikipediaOnly, type Weapons, type WeaponSource } from "./weaponData.ts";

/** The height chosen for the figure beside each weapon. It isn't a measured value. */
export const PERSON_HEIGHT_M = 1.75;

/** Every drawing's width in meters. One width for all, shown at one width, is what makes the scale shared. */
export const DRAWING_WIDTH_M = 13;

const PADDING_M = 0.15;
/** Where the person's middle is, and where every weapon's nose is. */
const PERSON_X_M = 0.45;
const NOSE_X_M = 1.15;

export type Point = readonly [x: number, y: number];

/** Closed outlines in meters, painted in order, so a later one covers an earlier one. */
export type Outline = readonly Point[];

export type DimensionId = "length" | "wingspan" | "diameter";

interface Dimension {
  id: DimensionId;
  /** In meters, as one cited row gives it, as either end of that row. */
  meters: number;
}

export interface Reference {
  title: string;
  url: string;
  /** The terms of a picture, or empty for a page whose pictures we only looked at. */
  license: string;
}

export interface DrawingSpec {
  member: string;
  /** Which version the drawing shows. */
  variant: string;
  view: "above" | "side";
  /** The one row source for every dimension drawn, so versions aren't mixed. */
  source: string;
  dimensions: readonly Dimension[];
  /** Shown with the drawing. */
  note: string;
  /** What the shape was drawn from. */
  basedOn: readonly Reference[];
  /**
   * The outlines, with the nose at x = 0, the long axis along y = 0 and x
   * running to the tail. `size` gives each dimension in meters.
   */
  shape: (size: Record<DimensionId, number>) => Outline[];
}

/** An outline that is the same either side of the long axis, from its upper half. */
function mirrored(half: readonly Point[]): Outline {
  return [...half, ...half.map(([x, y]): Point => [x, -y]).reverse()];
}

/** A part and its twin on the other side of the long axis. */
function pair(part: Outline): Outline[] {
  return [part, part.map(([x, y]): Point => [x, -y])];
}

/** A rounded nose: half-widths from a point at x = 0 to `radius` at x = `length`. */
function nose(length: number, radius: number, power: number): Point[] {
  return Array.from({ length: 13 }, (_, step): Point => {
    const t = step / 12;
    return [t * length, radius * (1 - (1 - t) ** 2) ** power];
  });
}

/** Shahed-136: a delta wing, a nose ahead of it, a fin at each tip and a propeller at the back. */
function shahed136({ length: l, wingspan }: Record<DimensionId, number>): Outline[] {
  const tip = wingspan / 2;
  const body = 0.045 * l;
  return [
    ...pair([
      [0.22 * l, body],
      [0.74 * l, tip],
      [0.88 * l, tip],
      [0.88 * l, 0],
      [0.22 * l, 0],
    ]),
    mirrored([...nose(0.11 * l, body, 0.5), [0.91 * l, body], [0.93 * l, 0.6 * body]]),
    ...pair([
      [0.72 * l, tip - 0.04],
      [0.75 * l, tip],
      [0.95 * l, tip],
      [0.95 * l, tip - 0.04],
    ]),
    mirrored([
      [0.93 * l, 0.1],
      [0.975 * l, 0.1],
    ]),
    mirrored([
      [0.975 * l, 0.36],
      [l, 0.36],
    ]),
  ];
}

/** Kh-101: a slender body, narrow wings behind the middle and a small tailplane. */
function kh101({ length: l, wingspan, diameter }: Record<DimensionId, number>): Outline[] {
  const tip = wingspan / 2;
  const body = diameter / 2;
  return [
    ...pair([
      [0.47 * l, 0],
      [0.515 * l, tip],
      [0.56 * l, tip],
      [0.56 * l, 0],
    ]),
    ...pair([
      [0.88 * l, 0],
      [0.94 * l, 0.9],
      [0.975 * l, 0.9],
      [0.95 * l, 0],
    ]),
    mirrored([...nose(0.13 * l, body, 0.6), [0.84 * l, body], [l, 0.35 * body]]),
  ];
}

/** Iskander-M: a pointed nose on a thick body, with small fins at the back. */
function iskanderM({ length: l, diameter }: Record<DimensionId, number>): Outline[] {
  const body = diameter / 2;
  return [
    ...pair([
      [0.88 * l, 0.8 * body],
      [0.95 * l, body + 0.24],
      [0.99 * l, body + 0.24],
      [0.98 * l, 0.8 * body],
    ]),
    mirrored([...nose(0.34 * l, body, 0.8), [0.92 * l, body], [l, 0.82 * body]]),
  ];
}

/** Kinzhal without its tail fairing: a longer, finer nose than the Iskander-M's, and larger fins. */
function kinzhal({ length: l, diameter }: Record<DimensionId, number>): Outline[] {
  const body = diameter / 2;
  return [
    ...pair([
      [0.84 * l, body],
      [0.93 * l, body + 0.33],
      [0.975 * l, body + 0.33],
      [0.97 * l, 0.8 * body],
    ]),
    mirrored([...nose(0.5 * l, body, 0.85), [0.94 * l, body], [l, 0.72 * body]]),
    [
      [0.505 * l, body],
      [0.505 * l, -body],
      [0.51 * l, -body],
      [0.51 * l, body],
    ],
  ];
}

/** Kh-22: a long body with a pointed nose, a delta wing at the middle and a tailplane. */
function kh22({ length: l, wingspan, diameter }: Record<DimensionId, number>): Outline[] {
  const tip = wingspan / 2;
  const body = diameter / 2;
  return [
    ...pair([
      [0.43 * l, body],
      [0.72 * l, tip],
      [0.775 * l, tip],
      [0.775 * l, 0],
      [0.43 * l, 0],
    ]),
    ...pair([
      [0.85 * l, 0],
      [0.93 * l, 1.05],
      [0.965 * l, 1.05],
      [0.96 * l, 0],
    ]),
    mirrored([...nose(0.2 * l, body, 0.85), [0.92 * l, body], [l, 0.7 * body]]),
    [
      [0.2 * l, body],
      [0.2 * l, -body],
      [0.204 * l, -body],
      [0.204 * l, body],
    ],
  ];
}

const GUR_MODEL = "3D model on the page, War & Sanctions portal, Defence Intelligence of Ukraine";

export const DRAWING_SPECS: readonly DrawingSpec[] = [
  {
    member: "shahed_136",
    variant: "Shahed-136 (Geran-2), in the size one page gives",
    view: "above",
    source: "wp-shahed",
    dimensions: [
      { id: "length", meters: 3.5 },
      { id: "wingspan", meters: 2.5 },
    ],
    note: "",
    basedOn: [
      {
        title: "Three-view drawing of the Shahed-136 by Alexpl, Wikimedia Commons",
        url: "https://commons.wikimedia.org/wiki/File:Shahed-136-335-250draw.svg",
        license: "CC BY 4.0",
      },
    ],
    shape: shahed136,
  },
  {
    member: "kh_101",
    variant: "Kh-101; the cited page names no version",
    view: "above",
    source: "gur-kh101",
    dimensions: [
      { id: "length", meters: 7.45 },
      { id: "wingspan", meters: 4.3 },
      { id: "diameter", meters: 0.742 },
    ],
    note: "The wings are shown open. Sources disagree on the diameter; this uses the same page as the other dimensions.",
    basedOn: [
      { title: GUR_MODEL, url: "https://war-sanctions.gur.gov.ua/en/page-kh-101", license: "" },
    ],
    shape: kh101,
  },
  {
    member: "iskander_m",
    variant: "9M723 Iskander-M",
    view: "side",
    source: "gur-iskander-m",
    dimensions: [
      { id: "length", meters: 7.185 },
      { id: "diameter", meters: 0.92 },
    ],
    note: "No figure gives the size of the fins.",
    basedOn: [
      { title: GUR_MODEL, url: "https://war-sanctions.gur.gov.ua/en/ballistics/iskander", license: "" },
    ],
    shape: iskanderM,
  },
  {
    member: "kinzhal",
    variant: "Kh-47M2 Kinzhal without its tail fairing",
    view: "side",
    source: "gur-kinzhal",
    dimensions: [
      { id: "length", meters: 7.175 },
      { id: "diameter", meters: 0.92 },
    ],
    note: "The drawing leaves out the fins’ cited span, which comes from another page, so their size isn’t to scale.",
    basedOn: [
      { title: GUR_MODEL, url: "https://war-sanctions.gur.gov.ua/en/ballistics/kinzhal", license: "" },
    ],
    shape: kinzhal,
  },
  {
    member: "kh_22",
    variant: "Kh-22; the cited figures name no single version",
    view: "above",
    source: "wp-kh22",
    dimensions: [
      { id: "length", meters: 11.65 },
      { id: "wingspan", meters: 3 },
      { id: "diameter", meters: 0.92 },
    ],
    note: "This class holds very different weapons, so this one doesn’t show the size of the others.",
    basedOn: [
      {
        title: "Side-view photo of a museum Kh-22 by Антон Бородин, Wikimedia Commons",
        url: "https://commons.wikimedia.org/wiki/File:Raduga_Kh-22,_side_view.JPG",
        license: "CC BY-SA 3.0",
      },
      {
        title: "Photo of a museum Kh-22NA by George Chernilevsky, Wikimedia Commons",
        url: "https://commons.wikimedia.org/wiki/File:Kh-22NA_Kyiv_Museum_2018_G1.jpg",
        license: "CC BY 4.0",
      },
    ],
    shape: kh22,
  },
];

/** A standing person facing the reader, as outlines with the feet at y = `feet`. y runs downward. */
function person(feet: number): Outline[] {
  const at = (x: number, height: number): Point => [PERSON_X_M + x, feet - height * PERSON_HEIGHT_M];
  const head = Array.from({ length: 24 }, (_, step): Point => {
    const angle = (step / 24) * 2 * Math.PI;
    return at(0.065 * PERSON_HEIGHT_M * Math.sin(angle), 0.93 + 0.07 * Math.cos(angle));
  });
  // The right half from neck to crotch, as [meters across, share of the height].
  const right: Point[] = [
    [0.05, 0.855],
    [0.22, 0.815],
    [0.28, 0.48],
    [0.22, 0.47],
    [0.16, 0.72],
    [0.14, 0.51],
    [0.17, 0],
    [0.06, 0],
    [0, 0.45],
  ];
  const left = right
    .slice(0, -1)
    .reverse()
    .map(([x, h]): Point => [-x, h]);
  return [head, [...right, ...left].map(([x, h]) => at(x, h))];
}

export interface Drawing {
  spec: DrawingSpec;
  /** The cited page for the dimensions. */
  source: WeaponSource;
  wikipediaOnly: boolean;
  /** Such as "length 3.5 m, wingspan 2.5 m". */
  dimensionText: string;
  /** The text alternative. */
  description: string;
  /** The drawing's height in meters; its width is DRAWING_WIDTH_M. */
  height: number;
  /** The weapon's outlines, placed in the drawing. y runs downward. */
  weapon: Outline[];
  person: Outline[];
}

const meters = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

const VIEW_TEXT = { above: "seen from above", side: "seen from the side" } as const;

/**
 * The drawings by member, placed and described. Fails on a dimension that no
 * cited row of the figures table gives.
 */
export function buildDrawings(weapons: Weapons, specs: readonly DrawingSpec[] = DRAWING_SPECS): Map<string, Drawing> {
  return new Map(
    specs.map((spec) => {
      const where = `drawings.ts: ${spec.member}`;
      const member = weapons.members.find((candidate) => candidate.id === spec.member);
      if (!member) throw new Error(`${where} is not in weapon_members.csv`);
      let source: WeaponSource | undefined;
      const size = {} as Record<DimensionId, number>;
      for (const dimension of spec.dimensions) {
        const text = `${meters.format(dimension.meters)} m`;
        const cited = member.measures
          .find((measure) => measure.id === dimension.id)!
          .figures.find(
            (figure) =>
              figure.source.id === spec.source &&
              // A row's value reads "7.45 m" or, for a span, "7.175–8 m".
              figure.value.replace(/ m$/, "").split("–").map((end) => `${end} m`).includes(text),
          );
        if (!cited) throw new Error(`${where}: ${spec.source} gives no ${dimension.id} of ${text}`);
        source = cited.source;
        size[dimension.id] = dimension.meters;
      }
      if (!source) throw new Error(`${where} has no dimensions`);

      const outlines = spec.shape(size);
      const reach = Math.max(...outlines.flat().map(([, y]) => Math.abs(y)));
      const height = Math.max(2 * reach, PERSON_HEIGHT_M) + 2 * PADDING_M;
      const dimensionText = spec.dimensions.map((d) => `${d.id} ${meters.format(d.meters)} m`).join(", ");
      const only = wikipediaOnly([source]);
      const drawing: Drawing = {
        spec,
        source,
        wikipediaOnly: only,
        dimensionText,
        description:
          `Line drawing of the ${member.name}, ${VIEW_TEXT[spec.view]}, beside a standing person ` +
          `${meters.format(PERSON_HEIGHT_M)} m tall. Variant: ${spec.variant}. To scale: ${dimensionText} ` +
          `(${source.publisher}${only ? ", Wikipedia only" : ""}).`,
        height,
        weapon: outlines.map((outline) => outline.map(([x, y]): Point => [NOSE_X_M + x, height / 2 + y])),
        person: person(height - PADDING_M),
      };
      return [spec.member, drawing] as const;
    }),
  );
}

/** An SVG path for one outline. */
export function outlinePath(outline: Outline): string {
  return `${outline.map(([x, y], index) => `${index ? "L" : "M"}${+x.toFixed(3)},${+y.toFixed(3)}`).join("")}Z`;
}
