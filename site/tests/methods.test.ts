import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { CHANGELOG } from "../src/methods/changelog.ts";
import { datesWithoutNight, parseManifest, parseReconciliation, parseTaxonomy } from "../src/methods/methodsData.ts";
import { TRACES } from "../src/methods/traces.ts";
import { parseNights } from "../src/strikes/strikeData.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const json = (name: string) => JSON.parse(read(`../../data/processed/${name}`));

const classesCsv = read("../../data/reference/weapon_classes.csv");
const modelsCsv = read("../../data/reference/model_classes.csv");
const taxonomy = parseTaxonomy(classesCsv, modelsCsv);

test("the taxonomy lists every class and every model string once", () => {
  assert.equal(taxonomy.length, classesCsv.trim().split("\n").length - 1);
  const models = taxonomy.flatMap((entry) => entry.models);
  assert.equal(models.length, modelsCsv.trim().split("\n").length - 1);
  assert.equal(new Set(models).size, models.length);
  assert.ok(taxonomy.some((entry) => !entry.counted), "excluded classes are listed too");
});

const CLASSES = "class,label,counts_in_totals,own_intercept_rate\na,A,yes,yes\nb,B,no,no\n";

test("the taxonomy rejects an unknown class, a repeated string and an empty class", () => {
  assert.throws(() => parseTaxonomy(CLASSES, "model,class\nx,a\ny,zzz\n"), /unknown class/);
  assert.throws(() => parseTaxonomy(CLASSES, "model,class\nx,a\nx,b\n"), /repeated/);
  assert.throws(() => parseTaxonomy(CLASSES, "model,class\nx,a\n"), /no model string is in b/);
});

test("the manifest gives each source file's checksum", () => {
  const manifest = parseManifest(json("manifest.json"));
  assert.ok(manifest.kaggle.files.some((file) => file.name === "missile_attacks_daily.csv"));
  assert.ok(manifest.alerts.files.some((file) => file.name === "official_data_en.csv"));
  const broken = json("manifest.json");
  broken.sources.kaggle.files[0].sha256 = "abc";
  assert.throws(() => parseManifest(broken), /SHA-256/);
});

test("the reconciliation accounts for every raw row and matches the strike tables", () => {
  const reconciliation = parseReconciliation(json("strike_reconciliation.json"), taxonomy);
  const sum = (name: string) =>
    json(name).rows.reduce((total: number, row: { launched: number | null }) => total + (row.launched ?? 0), 0);
  assert.equal(reconciliation.tableLaunched.monthly, sum("monthly_by_class.json"));
  assert.equal(reconciliation.tableLaunched.nights, sum("nights.json"));
});

test("a reconciliation that doesn't add up, or hides a bucket, is rejected", () => {
  const short = json("strike_reconciliation.json");
  short.buckets.hidden.rows -= 1;
  assert.throws(() => parseReconciliation(short, taxonomy), /don't add up/);
  const extra = json("strike_reconciliation.json");
  extra.buckets.other = { rows: 0, launched_as_published: 0, destroyed_as_published: 0 };
  assert.throws(() => parseReconciliation(extra, taxonomy), /expected buckets/);
  const missing = json("strike_reconciliation.json");
  delete missing.excluded_class_rows.guided_bomb;
  assert.throws(() => parseReconciliation(missing, taxonomy), /excluded classes/);
});

test("dates without a night are counted over the whole strike span", () => {
  const nights = parseNights(json("nights.json"));
  const { dates, without } = datesWithoutNight(nights);
  const withNight = new Set(nights.rows.map((row) => row.date)).size;
  assert.equal(dates - without, withNight);
  assert.ok(without >= 0);
});

test("every trace names built tables and code that exist", () => {
  for (const trace of TRACES) {
    assert.ok(trace.tables.length && trace.code.length, trace.figure);
    for (const table of trace.tables) assert.ok(existsSync(new URL(`../../data/processed/${table}`, import.meta.url)), table);
    for (const path of trace.code) assert.ok(existsSync(new URL(`../../${path}`, import.meta.url)), path);
  }
});

test("the changelog is dated and newest first", () => {
  const dates = CHANGELOG.map((entry) => entry.date);
  for (const date of dates) assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(dates, [...dates].sort().reverse());
});
