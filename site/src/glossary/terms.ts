/**
 * Glossary definitions (plan §7) and the rules for finding their terms in text.
 *
 * Drafts for the owner's review (#24). Claims about this data come from
 * docs/data-audit.md and data/reference/README.md, and class membership from
 * data/reference/model_classes.csv. The general descriptions of each kind of
 * weapon have no cited source yet.
 *
 * No DOM or Vite imports here, so Node can test this file directly.
 */

export interface GlossaryEntry {
  /** The term as the glossary and popover headings show it. */
  term: string;
  definition: string;
  /** Finds the term in text. No "g" flag, which would make matching stateful. */
  pattern: RegExp;
}

/** In glossary order. */
export const GLOSSARY = {
  shahed_type: {
    term: "Shahed-type drone",
    definition:
      "A one-way attack drone, which flies to its target and explodes. The name comes from the Iranian-designed Shahed-136 and Shahed-131; Russia calls its own versions Geran. The source’s Shahed count is a catch-all that also includes Gerbera, imitator drones and other types, some of them jet-powered.",
    pattern: /\bShahed-type\b/i,
  },
  decoy: {
    term: "Decoy",
    definition:
      "A drone or other object meant to be taken for an attack weapon, so that defenders spend attention or interceptors on it. The source reports count imitator drones together with Shahed-type drones, so the share of decoys can’t be worked out from this data.",
    pattern: /\bdecoys?\b/i,
  },
  cruise: {
    term: "Cruise missile",
    definition:
      "A missile that flies under engine power for most of its route, much like a small uncrewed aircraft, and can change course on the way. Here the class includes Kh-101/Kh-555, Kalibr, Kh-59/Kh-69, Banderol and, despite its name, Iskander-K.",
    pattern: /\bcruise(?:[- ]missiles?)?\b/i,
  },
  ballistic: {
    term: "Ballistic missile",
    definition:
      "A missile that a rocket boosts onto a mostly arcing path. It arrives very fast, and some can maneuver on the way. Here the class includes Iskander-M, KN-23 and rows reported only as ballistic or intercontinental ballistic missiles, whose types aren’t verified.",
    // The word boundary keeps this from matching inside "aeroballistic".
    pattern: /\bballistic(?:[- ]missiles?)?\b/i,
  },
  aeroballistic_hypersonic: {
    term: "Aeroballistic and hypersonic missiles",
    definition:
      "An aeroballistic missile is launched from an aircraft and then follows a largely ballistic path. Hypersonic means faster than five times the speed of sound. Here the class holds Kinzhal and Zircon. The source’s reference file lists Zircon as a cruise missile.",
    pattern: /\baeroballistic(?: and hypersonic)?(?: missiles?)?\b/i,
  },
  antiship_other: {
    term: "Anti-ship and other missiles",
    definition:
      "A varied group: anti-ship missiles such as Kh-22/Kh-32, Oniks and Kh-35; Kh-31 variants, some made to attack radars; C-300 and C-400 surface-to-air missiles listed among attacks; and missiles of unknown type. Read its trend and intercept rate with care.",
    pattern: /\banti-ship(?: and other)?(?: missiles?)?\b/i,
  },
  mixed: {
    term: "Mixed classes",
    definition:
      "One reported count that covers weapons from two or more classes. It counts toward totals but is never split between them, so it has no class intercept rate, and a single class’s figures don’t cover every launch of that kind.",
    pattern: /\bmixed classes(?: \(not separable\))?/i,
  },
  ew: {
    term: "Electronic warfare (EW)",
    definition:
      "Using radio and other electromagnetic signals against an opponent’s equipment, for example by jamming or faking the satellite navigation a drone relies on. In the source reports, “destroyed” includes weapons lost to EW, such as drones reported as suppressed. So launched minus destroyed is not a count of hits.",
    // Case matters for the abbreviation.
    pattern: /\b[Ee]lectronic [Ww]arfare(?: \(EW\)|\b)|\bEW\b/,
  },
  salvo: {
    term: "Salvo",
    definition:
      "A group of weapons launched in one attack. The source gives totals for a reporting window, not a time for each launch, so a salvo size taken from this data is a total that may cover several waves.",
    pattern: /\bsalvos?\b/i,
  },
  reporting_window: {
    term: "Reporting window",
    definition:
      "The period that one report covers, from a start to an end. A typical Air Force morning report covers roughly 18:00 to 09:00 Kyiv time, so one night spans two calendar dates. This dashboard dates an attack night by the day it ends. There are also daytime reports, and some windows overlap.",
    pattern: /\breporting windows?\b/i,
  },
} satisfies Record<string, GlossaryEntry>;

export type TermId = keyof typeof GLOSSARY;

export const TERM_IDS = Object.keys(GLOSSARY) as TermId[];

export type Segment = string | { id: TermId; text: string };

/**
 * Splits text into plain strings and the terms found in it. Each term is marked
 * only the first time. Pass the same `seen` set to several calls to treat them
 * as one block of text.
 */
export function splitTerms(text: string, seen: Set<TermId> = new Set()): Segment[] {
  const segments: Segment[] = [];
  let rest = text;
  for (;;) {
    let next: { id: TermId; index: number; text: string } | undefined;
    for (const id of TERM_IDS) {
      if (seen.has(id)) continue;
      const match = GLOSSARY[id].pattern.exec(rest);
      if (match && (!next || match.index < next.index)) next = { id, index: match.index, text: match[0] };
    }
    if (!next) break;
    if (next.index > 0) segments.push(rest.slice(0, next.index));
    segments.push({ id: next.id, text: next.text });
    seen.add(next.id);
    rest = rest.slice(next.index + next.text.length);
  }
  if (rest) segments.push(rest);
  return segments;
}
