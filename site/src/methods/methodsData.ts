/**
 * What the Data & Methods page reads that no chart does: the full weapon-class
 * table, the source files the build used, and how it used the raw strike rows.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */
import { csvParse } from "d3-dsv";
import type { NightTable } from "../strikes/strikeData.ts";

export interface TaxonomyClass {
  id: string;
  label: string;
  counted: boolean;
  hasOwnInterceptRate: boolean;
  /** The raw model strings in this class, exactly as the source writes them, sorted. */
  models: string[];
}

/** Every class in weapon_classes.csv, excluded ones too, each with its raw model strings. */
export function parseTaxonomy(classesCsv: string, modelsCsv: string): TaxonomyClass[] {
  const classes = csvParse(classesCsv).map((row): TaxonomyClass => {
    const { class: id, label, counts_in_totals: counted, own_intercept_rate: rate } = row;
    if (!id || !label) throw new Error(`weapon_classes.csv: a row has no class or label: ${JSON.stringify(row)}`);
    for (const value of [counted, rate]) {
      if (value !== "yes" && value !== "no") throw new Error(`weapon_classes.csv: ${id} needs "yes" or "no"`);
    }
    return { id, label, counted: counted === "yes", hasOwnInterceptRate: rate === "yes", models: [] };
  });
  const byId = new Map(classes.map((entry) => [entry.id, entry]));
  if (!classes.length || byId.size !== classes.length) {
    throw new Error("weapon_classes.csv: needs at least one row, and each class only once");
  }

  const seen = new Set<string>();
  for (const { model, class: id } of csvParse(modelsCsv)) {
    // Model strings are matched exactly, so they aren't trimmed.
    if (!model || seen.has(model)) throw new Error(`model_classes.csv: blank or repeated model ${JSON.stringify(model)}`);
    seen.add(model);
    const found = byId.get(id ?? "");
    if (!found) throw new Error(`model_classes.csv: ${model} has an unknown class ${JSON.stringify(id)}`);
    found.models.push(model);
  }
  for (const entry of classes) {
    if (!entry.models.length) throw new Error(`model_classes.csv: no model string is in ${entry.id}`);
    entry.models.sort((a, b) => a.localeCompare(b, "en"));
  }
  return classes;
}

export interface SourceFile {
  name: string;
  rows: number;
  bytes: number;
  sha256: string;
}

export interface Manifest {
  kaggle: { url: string; license: string; files: SourceFile[] };
  alerts: { url: string; license: string; commit: string; files: SourceFile[] };
}

const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;

const isHttps = (value: unknown) => typeof value === "string" && value.startsWith("https://");

/** manifest.json: the raw files the committed tables were built from. */
export function parseManifest(json: unknown): Manifest {
  const sources = (json as { sources?: Manifest } | null)?.sources;
  for (const name of ["kaggle", "alerts"] as const) {
    const source = sources?.[name];
    const fail = (what: string) => {
      throw new Error(`manifest.json: sources.${name} ${what}`);
    };
    if (!source || !isHttps(source.url) || !source.license) fail("needs an https url and a license");
    if (!Array.isArray(source!.files) || !source!.files.length) fail("needs files");
    for (const file of source!.files) {
      if (!file.name || !isCount(file.rows) || !isCount(file.bytes) || !/^[0-9a-f]{64}$/.test(file.sha256)) {
        fail(`has a file without a name, row count, size or SHA-256: ${JSON.stringify(file)}`);
      }
    }
  }
  if (!/^[0-9a-f]{40}$/.test(sources!.alerts.commit)) throw new Error("manifest.json: needs the pinned alerts commit");
  return sources!;
}

export interface RowCount {
  rows: number;
  launched_as_published: number;
  destroyed_as_published: number;
}

/** The buckets that account for every raw strike row, in the page's order. */
export const BUCKET_IDS = ["in_monthly_totals", "excluded_class", "not_a_national_account", "hidden"] as const;
export type BucketId = (typeof BUCKET_IDS)[number];

export interface Reconciliation {
  raw: RowCount;
  buckets: Record<BucketId, RowCount>;
  excludedClassRows: Record<string, RowCount>;
  daytime: RowCount;
  blankLaunched: number;
  blankDestroyed: number;
  destroyedAboveLaunched: number;
  /** Launches in each built strike table. */
  tableLaunched: { nights: number; monthly: number };
}

/** strike_reconciliation.json. Fails if the buckets don't add up to the raw file. */
export function parseReconciliation(json: unknown, taxonomy: readonly TaxonomyClass[]): Reconciliation {
  const table = json as {
    raw_daily_file: RowCount;
    buckets: Record<string, RowCount>;
    excluded_class_rows: Record<string, RowCount>;
    within_monthly_totals: {
      daytime_reports_not_in_nights: RowCount;
      rows_with_blank_launched: number;
      rows_with_blank_destroyed: number;
      rows_with_destroyed_above_launched: number;
    };
    table_totals: { nights: { launched: number }; monthly_by_class: { launched: number } };
  };
  const fail = (what: string): never => {
    throw new Error(`strike_reconciliation.json: ${what}`);
  };
  const checked = (row: RowCount | undefined, where: string): RowCount => {
    const keys = ["rows", "launched_as_published", "destroyed_as_published"] as const;
    if (!row || !keys.every((key) => isCount(row[key]))) fail(`${where} needs three counts`);
    return row!;
  };

  const raw = checked(table?.raw_daily_file, "raw_daily_file");
  // A bucket the page doesn't list would drop rows from it without any sign.
  const found = Object.keys(table.buckets ?? {}).sort();
  if (found.join() !== [...BUCKET_IDS].sort().join()) fail(`expected buckets ${BUCKET_IDS.join(", ")}`);
  const buckets = Object.fromEntries(
    BUCKET_IDS.map((id) => [id, checked(table.buckets[id], `buckets.${id}`)]),
  ) as Record<BucketId, RowCount>;
  for (const key of ["rows", "launched_as_published"] as const) {
    const total = BUCKET_IDS.reduce((sum, id) => sum + buckets[id][key], 0);
    if (total !== raw[key]) fail(`the buckets' ${key} don't add up to the raw file's`);
  }

  const excluded = taxonomy.filter((entry) => !entry.counted).map((entry) => entry.id);
  const listed = Object.keys(table.excluded_class_rows ?? {});
  if ([...listed].sort().join() !== [...excluded].sort().join()) {
    fail(`excluded_class_rows must list the excluded classes (${excluded.join(", ")}), got ${listed.join(", ")}`);
  }
  for (const id of listed) checked(table.excluded_class_rows[id], `excluded_class_rows.${id}`);

  const within = table.within_monthly_totals;
  const numbers = [
    within?.rows_with_blank_launched,
    within?.rows_with_blank_destroyed,
    within?.rows_with_destroyed_above_launched,
    table.table_totals?.nights?.launched,
    table.table_totals?.monthly_by_class?.launched,
  ];
  if (!numbers.every(isCount)) fail("needs the within_monthly_totals counts and table_totals launches");

  return {
    raw,
    buckets,
    excludedClassRows: table.excluded_class_rows,
    daytime: checked(within.daytime_reports_not_in_nights, "daytime_reports_not_in_nights"),
    blankLaunched: within.rows_with_blank_launched,
    blankDestroyed: within.rows_with_blank_destroyed,
    destroyedAboveLaunched: within.rows_with_destroyed_above_launched,
    tableLaunched: {
      nights: table.table_totals.nights.launched,
      monthly: table.table_totals.monthly_by_class.launched,
    },
  };
}

/** How many dates the strike data spans, and how many of them have no night: quiet or unreported. */
export function datesWithoutNight(table: NightTable): { dates: number; without: number } {
  const dates = (Date.parse(table.lastDay) - Date.parse(table.firstDay)) / 86_400_000 + 1;
  return { dates, without: dates - new Set(table.rows.map((row) => row.date)).size };
}
