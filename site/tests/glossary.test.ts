import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseWeaponClasses } from "../src/buildData.ts";
import { FLAG_TEXT } from "../src/chart/flags.ts";
import { GLOSSARY, splitTerms, TERM_IDS, type TermId } from "../src/glossary/terms.ts";
import { STOP_PROMPTS, TAB_PROMPTS } from "../src/teaching/prompts.ts";

const found = (text: string) =>
  splitTerms(text).flatMap((segment) => (typeof segment === "string" ? [] : [[segment.id, segment.text]]));

const joined = (text: string) =>
  splitTerms(text)
    .map((segment) => (typeof segment === "string" ? segment : segment.text))
    .join("");

test("every term issue #24 names is defined", () => {
  for (const id of ["cruise", "ballistic", "shahed_type", "decoy", "ew", "salvo", "reporting_window"]) {
    assert.ok(TERM_IDS.includes(id as TermId), id);
  }
});

test("each entry's own name is found as that term", () => {
  for (const id of TERM_IDS) assert.equal(found(GLOSSARY[id].term)[0]?.[0], id, GLOSSARY[id].term);
});

test("aeroballistic is not read as ballistic", () => {
  assert.deepEqual(found("Aeroballistic and hypersonic missiles"), [
    ["aeroballistic_hypersonic", "Aeroballistic and hypersonic missiles"],
  ]);
});

test("matches take in the whole phrase", () => {
  assert.deepEqual(found("lost to electronic warfare (EW)."), [["ew", "electronic warfare (EW)"]]);
  assert.deepEqual(found("lost to electronic warfare."), [["ew", "electronic warfare"]]);
  assert.deepEqual(found("some ballistic-missile figures"), [["ballistic", "ballistic-missile"]]);
  assert.deepEqual(found("Shahed-type and decoy drones"), [
    ["shahed_type", "Shahed-type"],
    ["decoy", "decoy"],
  ]);
});

test("ordinary words are left alone", () => {
  assert.deepEqual(found("a few new, mixed results from the cruiser"), []);
});

test("a term is marked once per block of text", () => {
  assert.deepEqual(found("A salvo and two more salvos"), [["salvo", "salvo"]]);
  const seen = new Set<TermId>();
  splitTerms("EW", seen);
  assert.deepEqual(splitTerms("More EW", seen), ["More EW"]);
});

test("splitting never changes the text", () => {
  const texts = [
    ...Object.values(FLAG_TEXT).map((flag) => flag.text),
    ...Object.values(TAB_PROMPTS).flat(),
    ...Object.values(STOP_PROMPTS).flat(),
    "",
  ];
  for (const text of texts) assert.equal(joined(text), text);
});

test("the EW badge links to the EW definition", () => {
  assert.ok(found(FLAG_TEXT.destroyed_includes_ew.text).some(([id]) => id === "ew"));
});

test("every counted weapon class label has a definition", () => {
  const csv = readFileSync(new URL("../../data/reference/weapon_classes.csv", import.meta.url), "utf8");
  for (const { label } of parseWeaponClasses(csv)) assert.ok(found(label).length, label);
});
