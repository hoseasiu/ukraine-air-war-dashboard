/**
 * Checks for the data files imported at build time. vite.config.ts uses them to
 * fail the build, and the app uses them to type what it imports.
 */
import { csvParse } from "d3-dsv";
import { CLASS_IDS, type ClassId } from "./theme/classStyles.ts";

export interface BuildInfo {
  /** ISO date, YYYY-MM-DD. */
  snapshotDate: string;
}

export interface WeaponClass {
  id: ClassId;
  label: string;
  hasOwnInterceptRate: boolean;
}

export function parseBuildInfo(json: unknown): BuildInfo {
  const date = (json as { snapshot_date?: unknown } | null)?.snapshot_date;
  // The round trip rejects dates such as 2026-02-30.
  const valid =
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().startsWith(date);
  if (!valid) {
    throw new Error(`build_info.json: snapshot_date must be a real YYYY-MM-DD date, got ${JSON.stringify(date)}`);
  }
  return { snapshotDate: date };
}

function yesNo(value: string | undefined, column: string, file = "weapon_classes.csv"): boolean {
  if (value === "yes") return true;
  if (value === "no") return false;
  throw new Error(`${file}: ${column} must be "yes" or "no", got ${JSON.stringify(value)}`);
}

export interface Area {
  /** ISO 3166-2 code. */
  id: string;
  name: string;
  /** False for areas the alert data doesn't cover. Show them as excluded, never as zero. */
  inAlertTotals: boolean;
}

export function parseAreas(csv: string): Area[] {
  const areas = csvParse(csv).map((row) => {
    const { iso_3166_2: id, name } = row;
    if (!id || !name) throw new Error(`oblasts.csv: a row has no iso_3166_2 or name: ${JSON.stringify(row)}`);
    return { id, name, inAlertTotals: yesNo(row.in_alert_totals, "in_alert_totals", "oblasts.csv") };
  });
  if (!areas.length || new Set(areas.map((area) => area.id)).size !== areas.length) {
    throw new Error("oblasts.csv: needs at least one row, and each iso_3166_2 only once");
  }
  return areas;
}

/** Returns the counted classes, in chart order, with labels from the CSV. */
export function parseWeaponClasses(csv: string): WeaponClass[] {
  const counted = csvParse(csv).filter((row) => yesNo(row.counts_in_totals, "counts_in_totals"));
  const countedIds = counted.map((row) => row.class ?? "");

  const unstyled = countedIds.filter((id) => !(CLASS_IDS as string[]).includes(id));
  const unmatched = CLASS_IDS.filter((id) => !countedIds.includes(id));
  const repeated = countedIds.filter((id, index) => countedIds.indexOf(id) !== index);
  if (unstyled.length || unmatched.length || repeated.length) {
    throw new Error(
      "weapon_classes.csv and classStyles.ts disagree. " +
        `Counted classes without a style: [${unstyled.join(", ")}]. ` +
        `Styles without a counted class: [${unmatched.join(", ")}]. ` +
        `Repeated classes: [${repeated.join(", ")}].`,
    );
  }

  return CLASS_IDS.map((id) => {
    const row = counted.find((r) => r.class === id)!;
    if (!row.label) throw new Error(`weapon_classes.csv: ${id} has no label`);
    return { id, label: row.label, hasOwnInterceptRate: yesNo(row.own_intercept_rate, "own_intercept_rate") };
  });
}
