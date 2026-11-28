import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDrawings, DRAWING_SPECS, DRAWING_WIDTH_M, PERSON_HEIGHT_M, type Point } from "../src/weapons/drawings.ts";
import { parseWeapons, PRIMER_CLASS_IDS } from "../src/weapons/weaponData.ts";

const read = (name: string) => readFileSync(new URL(`../../data/reference/${name}`, import.meta.url), "utf8");
const weapons = parseWeapons(read("weapon_members.csv"), read("weapon_figures.csv"), read("weapon_sources.csv"));
const drawings = buildDrawings(weapons);

const extent = (points: readonly Point[], axis: 0 | 1) =>
  Math.max(...points.map((point) => point[axis])) - Math.min(...points.map((point) => point[axis]));
const near = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: ${actual}, not ${expected}`);

test("one member of each class is drawn", () => {
  const classes = [...drawings.keys()].map((id) => weapons.members.find((member) => member.id === id)!.classId);
  assert.deepEqual(classes, PRIMER_CLASS_IDS);
});

test("each outline is as long and, from above, as wide as its cited figures", () => {
  for (const { spec, weapon } of drawings.values()) {
    const size = Object.fromEntries(spec.dimensions.map((d) => [d.id, d.meters]));
    near(extent(weapon.flat(), 0), size.length!, `${spec.member} length`);
    if (spec.view === "above") near(extent(weapon.flat(), 1), size.wingspan!, `${spec.member} wingspan`);
    else assert.equal(size.wingspan, undefined, `${spec.member}: a side view has no wingspan`);
    // The body is one of the outlines, as wide as the cited diameter.
    if (size.diameter) {
      assert.ok(
        weapon.some((outline) => Math.abs(extent(outline, 1) - size.diameter!) < 1e-9),
        `${spec.member} diameter`,
      );
    }
  }
});

test("every drawing fits the shared width and its own height", () => {
  for (const drawing of drawings.values()) {
    for (const [x, y] of [...drawing.weapon, ...drawing.person].flat()) {
      assert.ok(x >= 0 && x <= DRAWING_WIDTH_M && y >= 0 && y <= drawing.height, `${drawing.spec.member} ${x},${y}`);
    }
    near(extent(drawing.person.flat(), 1), PERSON_HEIGHT_M, `${drawing.spec.member} person`);
    // The person stands clear of the weapon.
    assert.ok(
      Math.max(...drawing.person.flat().map((p) => p[0])) < Math.min(...drawing.weapon.flat().map((p) => p[0])),
      drawing.spec.member,
    );
  }
});

test("each drawing has references and a text alternative with its dimensions", () => {
  for (const drawing of drawings.values()) {
    assert.ok(drawing.spec.basedOn.length, drawing.spec.member);
    for (const reference of drawing.spec.basedOn) assert.match(reference.url, /^https:\/\//);
    assert.ok(drawing.description.includes(drawing.dimensionText), drawing.spec.member);
    assert.ok(drawing.description.includes(drawing.source.publisher), drawing.spec.member);
    assert.equal(drawing.description.includes("Wikipedia only"), drawing.wikipediaOnly, drawing.spec.member);
  }
});

test("the table in weapons.md gives the dimensions and source each drawing uses", () => {
  const lines = read("weapons.md").split("## Drawings")[1]!.split(/\r?\n/);
  for (const drawing of drawings.values()) {
    assert.ok(
      lines.some((line) => line.includes(`| ${drawing.dimensionText} | \`${drawing.source.id}\``)),
      drawing.spec.member,
    );
  }
});

test("a dimension its source doesn't give is refused", () => {
  const spec = DRAWING_SPECS[0]!;
  const wrong = (changes: object) => () => buildDrawings(weapons, [{ ...spec, ...changes }]);
  assert.throws(wrong({ dimensions: [{ id: "length", meters: 3.4 }] }), /gives no length/);
  assert.throws(wrong({ source: "gur-kh101" }), /gives no length/);
  assert.throws(wrong({ member: "shahed_999" }), /not in weapon_members/);
});
