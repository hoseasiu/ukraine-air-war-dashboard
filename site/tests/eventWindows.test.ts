import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseAnnotations } from "../src/annotations/annotationData.ts";
import { chartFlags, type ColumnSpec } from "../src/chart/flags.ts";
import { parseOutcomes, parseRates, RATE_SHOWN } from "../src/defense/defenseData.ts";
import {
  eventsInWindows,
  eventWindows,
  NOT_CAUSAL,
  panelEvents,
  panelHowToRead,
  PANEL_NOTES,
  WINDOW_DAYS,
  windowRows,
} from "../src/defense/eventWindowData.ts";
import { CLASS_IDS } from "../src/theme/classStyles.ts";

const read = (path: string) => readFileSync(new URL(`../../data/${path}`, import.meta.url), "utf8");
const outcomes = parseOutcomes(JSON.parse(read("processed/nights.json")));
const rates = parseRates(JSON.parse(read("processed/monthly_by_class.json")));
const annotations = parseAnnotations(read("reference/annotations.csv"));
const events = panelEvents(annotations);

const header = "id,date,date_marks,label,description,source_url,source_url_2,verification,owner_review";
const csvRow = (id: string, verification: string, review: string) =>
  `${id},2025-03-03,Day,Label,Text,https://example.org/a,,${verification},${review}`;

test("only verified, owner-approved annotations are shown, and each has a citation", () => {
  const csv = [
    header,
    csvRow("a", "verified", "approved"),
    csvRow("b", "verified", "pending"),
    csvRow("c", "unverified", "approved"),
    csvRow("d", "verified", "rejected"),
  ].join("\n");
  assert.deepEqual(parseAnnotations(csv).map((a) => a.id), ["a"]);
  assert.throws(() => parseAnnotations(csv.replace("https://example.org/a", "")), /citation/);
  assert.ok(annotations.every((a) => a.sources.length > 0));
  assert.equal(events[0]!.id, "us-aid-pause-2025-03-03");
  // An offered event that loses its approval stops the build.
  assert.throws(() => panelEvents(annotations.filter((a) => a.id !== events[1]!.id)), /not approved/);
});

test("windows are equal, leave out the event's date and say when the data cuts one short", () => {
  const [before, after] = eventWindows(outcomes, "2025-03-03", 30);
  assert.deepEqual([before.from, before.to, before.daysCovered], ["2025-02-01", "2025-03-02", 30]);
  assert.deepEqual([after.from, after.to, after.daysCovered], ["2025-03-04", "2025-04-02", 30]);
  const [short] = eventWindows(outcomes, "2022-10-10", 90);
  assert.deepEqual([short.from, short.to, short.days, short.daysCovered], [outcomes.firstDay, "2022-10-09", 90, 12]);
});

test("window figures match the nights table, with the minimum and no zeros for gaps", () => {
  for (const event of events) {
    for (const days of WINDOW_DAYS) {
      const windows = eventWindows(outcomes, event.date, days);
      for (const found of windowRows(outcomes, rates, windows, CLASS_IDS)) {
        const own = outcomes.rows.filter((r) => r.class === found.class && r.date >= found.from && r.date <= found.to);
        const total = (key: "destroyed" | "launched_with_outcome") => own.reduce((sum, r) => sum + (r[key] ?? 0), 0);
        assert.equal(found.n_nights, own.length);
        assert.equal(found.destroyed ?? 0, total("destroyed"));
        assert.equal(found.launched_with_outcome ?? 0, total("launched_with_outcome"));
        assert.equal(found.intercept_rate !== null, found.status === RATE_SHOWN);
        assert.equal(found.intercept_rate !== null, total("launched_with_outcome") >= rates.minLaunched);
        if (!own.length) assert.deepEqual([found.destroyed, found.launched_with_outcome], [null, null]);
        assert.notEqual(found.class, "mixed");
      }
    }
  }
});

test("a window reaching August 2026 has no missile rate or counts, and keeps the flags", () => {
  const found = windowRows(outcomes, rates, eventWindows(outcomes, "2026-07-20", 30), CLASS_IDS);
  const withheld = found.filter((r) => r.side === "After" && r.class !== "shahed_drone");
  assert.ok(withheld.length > 0);
  for (const r of withheld) {
    assert.deepEqual([r.intercept_rate, r.destroyed, r.launched_with_outcome], [null, null, null]);
    assert.equal(r.status, "Gap: missile reporting restricted");
  }
  const columns: ColumnSpec[] = [{ key: "intercept_rate", label: "Rate", type: "number", measure: "intercept_rate" }];
  const flags = chartFlags({ columns, rows: found, coverage: (r) => ({ from: r.from, to: r.to }) });
  assert.ok(flags.includes("destroyed_includes_ew"));
  assert.ok(flags.includes("ballistic_restricted"));
});

test("other annotated events inside the windows are listed", () => {
  const pause = events[0]!;
  const found = eventsInWindows(annotations, pause, eventWindows(outcomes, pause.date, 30));
  assert.deepEqual(found.map((f) => [f.event.id, f.side]), [["us-aid-resumed-2025-03-11", "After"]]);
});

test("the panel wording and the offered events' text make no causal claim", () => {
  const causal =
    /\b(caus\w*|because|due to|led to|leads? to|result(ed|ing|s)?|effects?|affect\w*|impact\w*|triggered|drove|driven|thanks to|therefore)\b/i;
  const text = [
    // The one sentence that may say "caused" is the one denying it.
    panelHowToRead(rates.minLaunched).replace(NOT_CAUSAL, ""),
    ...PANEL_NOTES,
    ...events.flatMap((e) => [e.label, e.description, e.dateMarks]),
  ];
  for (const line of text) assert.doesNotMatch(line, causal);
});
