/**
 * The weapon reference tables (data/reference/weapons.md), checked and joined
 * for the weapon primer and Data & Methods. Spans and the Wikipedia-only mark
 * follow pipeline/reference/weapon_summary.py.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { csvParse } from "d3-dsv";
import { CLASS_IDS, type ClassId } from "../theme/classStyles.ts";

/** The classes with a card. Mixed is a way of reporting, so it has a note instead. */
export type PrimerClassId = Exclude<ClassId, "mixed">;

export const PRIMER_CLASS_IDS = CLASS_IDS.filter((id): id is PrimerClassId => id !== "mixed");

export const SOURCE_KINDS = {
  research: "Research organization",
  ukrainian_official: "Ukrainian official",
  news: "News report",
  encyclopedia: "Encyclopedia",
} as const;

export type SourceKind = keyof typeof SOURCE_KINDS;

export interface WeaponSource {
  id: string;
  publisher: string;
  title: string;
  kind: SourceKind;
  url: string;
  /** The page's own date, or null if none was read. */
  pageDate: string | null;
  checkedOn: string;
}

export const MEASURES = [
  { id: "length", label: "Length", units: ["m"] },
  { id: "wingspan", label: "Wingspan", units: ["m"] },
  { id: "diameter", label: "Diameter", units: ["m"] },
  { id: "warhead", label: "Warhead or payload", units: ["kg"] },
  { id: "range", label: "Range", units: ["km"] },
  { id: "speed", label: "Speed", units: ["km/h", "m/s", "Mach"] },
] as const;

export type MeasureId = (typeof MEASURES)[number]["id"];

/** A statement and the pages behind it. An unknown one cites none. */
export interface Cited {
  text: string;
  sources: WeaponSource[];
}

/** One source's figure for one measure. */
export interface SourceFigure {
  source: WeaponSource;
  value: string;
  note: string;
}

export interface Measure {
  id: MeasureId;
  label: string;
  /** The span of every cited row, with its unit, or null if unknown. */
  value: string | null;
  /** Empty if unknown. */
  figures: SourceFigure[];
  /** The pages behind the value, each once. */
  sources: WeaponSource[];
  /** Why it's unknown, or empty if it isn't. */
  unknownReason: string;
}

export interface Member {
  id: string;
  classId: PrimerClassId;
  name: string;
  /** The raw model strings, or parts of combined ones, that name it. */
  models: string[];
  role: Cited;
  platform: Cited;
  speedCategory: Cited;
  note: string;
  measures: Measure[];
}

export interface Weapons {
  /** In class order, then table order. */
  members: Member[];
  /** In table order. */
  sources: WeaponSource[];
}

/** True if only encyclopedia pages, all of them Wikipedia's, support it. */
export function wikipediaOnly(sources: readonly WeaponSource[]): boolean {
  return sources.length > 0 && sources.every((source) => source.kind === "encyclopedia");
}

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

interface Raw {
  low: number;
  high: number;
  unit: string;
}

function span(rows: readonly Raw[]): string {
  const low = Math.min(...rows.map((row) => row.low));
  const high = Math.max(...rows.map((row) => row.high));
  return low === high ? number.format(low) : `${number.format(low)}–${number.format(high)}`;
}

/** The widest span of the rows in each unit, in the order the units first appear. */
function spanText(rows: readonly Raw[]): string {
  return [...new Set(rows.map((row) => row.unit))]
    .map((unit) => {
      const text = span(rows.filter((row) => row.unit === unit));
      return unit === "Mach" ? `Mach ${text}` : `${text} ${unit}`;
    })
    .join("; ");
}

function parseSources(csv: string): WeaponSource[] {
  const sources = csvParse(csv).map((row): WeaponSource => {
    const { source: id, publisher, title, kind, url, page_date: pageDate, checked_on: checkedOn } = row;
    if (!id || !publisher || !title || !checkedOn) {
      throw new Error(`weapon_sources.csv: a row lacks an id, publisher, title or check date: ${JSON.stringify(row)}`);
    }
    if (!kind || !(kind in SOURCE_KINDS)) throw new Error(`weapon_sources.csv: ${id} has an unknown kind`);
    // The page calls every encyclopedia source Wikipedia, so another one needs new wording.
    if (kind === "encyclopedia" && publisher !== "Wikipedia") {
      throw new Error(`weapon_sources.csv: ${id} is an encyclopedia other than Wikipedia`);
    }
    if (!url?.startsWith("https://")) throw new Error(`weapon_sources.csv: ${id} needs an https url`);
    return { id, publisher, title, kind: kind as SourceKind, url, pageDate: pageDate || null, checkedOn };
  });
  if (!sources.length || new Set(sources.map((source) => source.id)).size !== sources.length) {
    throw new Error("weapon_sources.csv: needs at least one row, and each source only once");
  }
  return sources;
}

const split = (value: string | undefined) => (value ?? "").split(";").filter(Boolean);

/** Joins the three tables. Fails on a figure or statement that is neither cited nor marked unknown. */
export function parseWeapons(membersCsv: string, figuresCsv: string, sourcesCsv: string): Weapons {
  const sources = parseSources(sourcesCsv);
  const byId = new Map(sources.map((source) => [source.id, source]));
  const find = (id: string, where: string) => {
    const source = byId.get(id);
    if (!source) throw new Error(`${where} cites an unknown source ${JSON.stringify(id)}`);
    return source;
  };

  const figureRows = csvParse(figuresCsv);
  const used = new Set<(typeof figureRows)[number]>();

  const measure = (member: string, { id, label, units }: (typeof MEASURES)[number]): Measure => {
    const where = `weapon_figures.csv: ${member} ${id}`;
    const rows = figureRows.filter((row) => row.member === member && row.measure === id);
    if (!rows.length) throw new Error(`${where} has no row`);
    const known: (Raw & { source: WeaponSource; note: string })[] = [];
    for (const row of rows) {
      used.add(row);
      if (!row.low && !row.high) {
        if (rows.length > 1 || row.unit || row.source || !row.note) {
          throw new Error(`${where}: an unknown figure is one row, with a reason and no unit or source`);
        }
        return { id, label, value: null, figures: [], sources: [], unknownReason: row.note };
      }
      const low = Number(row.low);
      const high = Number(row.high);
      if (!row.low || !row.high || !(low > 0) || !(high >= low)) throw new Error(`${where} needs a low and a high`);
      if (!(units as readonly string[]).includes(row.unit ?? "")) throw new Error(`${where} has a wrong unit`);
      known.push({ low, high, unit: row.unit!, source: find(row.source ?? "", where), note: row.note ?? "" });
    }
    return {
      id,
      label,
      value: spanText(known),
      figures: known.map((row) => ({ source: row.source, value: spanText([row]), note: row.note })),
      sources: [...new Set(known.map((row) => row.source))],
      unknownReason: "",
    };
  };

  const members = csvParse(membersCsv).map((row): Member => {
    const id = row.member;
    if (!id || !row.name) throw new Error(`weapon_members.csv: a row has no member or name: ${JSON.stringify(row)}`);
    const where = `weapon_members.csv: ${id}`;
    const classId = PRIMER_CLASS_IDS.find((candidate) => candidate === row.class);
    if (!classId) throw new Error(`${where} has no class with a card: ${JSON.stringify(row.class)}`);
    const cited = (text: string | undefined, citations: string | undefined): Cited => {
      const found = split(citations).map((source) => find(source, where));
      if (!text || (text === "unknown") === found.length > 0) {
        throw new Error(`${where}: ${JSON.stringify(text)} must be cited, or "unknown" with no source`);
      }
      return { text, sources: found };
    };
    const models = split(row.model_strings);
    if (!models.length) throw new Error(`${where} names no model string`);
    return {
      id,
      classId,
      name: row.name,
      models,
      role: cited(row.role, row.role_sources),
      platform: cited(row.launch_platform, row.platform_sources),
      speedCategory: cited(row.speed_category, row.speed_sources),
      note: row.note ?? "",
      measures: MEASURES.map((entry) => measure(id, entry)),
    };
  });

  if (new Set(members.map((member) => member.id)).size !== members.length) {
    throw new Error("weapon_members.csv: each member only once");
  }
  for (const classId of PRIMER_CLASS_IDS) {
    if (!members.some((member) => member.classId === classId)) throw new Error(`weapon_members.csv: none in ${classId}`);
  }
  // A row for a misspelled member or measure would drop out of the page without any sign.
  const stray = figureRows.find((row) => !used.has(row));
  if (stray) throw new Error(`weapon_figures.csv: ${stray.member} ${stray.measure} matches no member and measure`);

  members.sort((a, b) => PRIMER_CLASS_IDS.indexOf(a.classId) - PRIMER_CLASS_IDS.indexOf(b.classId));
  return { members, sources };
}

/** True if nothing about the member is cited, so its card says so in one line. */
export function allUnknown(member: Member): boolean {
  return (
    [member.role, member.platform, member.speedCategory].every((field) => !field.sources.length) &&
    member.measures.every((measure) => measure.value === null)
  );
}

const PAGE = "weapons";

/** The hash route for the primer, or for one class's card on it. */
export const primerHash = (classId?: ClassId) =>
  !classId || classId === "mixed" ? `#${PAGE}` : `#${PAGE}-${classId}`;

/** The class whose card a hash asks for, or null. */
export function primerCard(hash: string): ClassId | null {
  return PRIMER_CLASS_IDS.find((id) => primerHash(id) === hash) ?? null;
}

/**
 * The query string for a chart link from a card: only this class, with the other
 * parameters kept. filters/state.ts reads it.
 */
export function classOnlySearch(search: string, classId: ClassId): string {
  const params = new URLSearchParams(search);
  params.set("classes", classId);
  return `?${params.toString().replaceAll("%2C", ",")}`;
}
