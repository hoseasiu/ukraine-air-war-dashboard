/** Data compiled into the bundle. Nothing is fetched at page load. */
import annotationsCsv from "../../data/reference/annotations.csv?raw";
import alertMonthlyJson from "../../data/processed/alert_hours_monthly.json";
import buildInfoJson from "../../data/processed/build_info.json";
import manifestJson from "../../data/processed/manifest.json";
import monthlyByClassJson from "../../data/processed/monthly_by_class.json";
import nightsJson from "../../data/processed/nights.json";
import reconciliationJson from "../../data/processed/strike_reconciliation.json";
import modelClassesCsv from "../../data/reference/model_classes.csv?raw";
import boundariesText from "../../data/reference/ukraine_admin1.geojson?raw";
import oblastsCsv from "../../data/reference/oblasts.csv?raw";
import weaponClassesCsv from "../../data/reference/weapon_classes.csv?raw";
import weaponFiguresCsv from "../../data/reference/weapon_figures.csv?raw";
import weaponMembersCsv from "../../data/reference/weapon_members.csv?raw";
import weaponSourcesCsv from "../../data/reference/weapon_sources.csv?raw";
import { parseAlertMonthly, parseBoundaries } from "./alerts/alertData.ts";
import { parseAnnotations } from "./annotations/annotationData.ts";
import { parseAreas, parseBuildInfo, parseWeaponClasses } from "./buildData.ts";
import { parseOutcomes, parseRates } from "./defense/defenseData.ts";
import { parseManifest, parseReconciliation, parseTaxonomy } from "./methods/methodsData.ts";
import { parseMonthly, parseNights } from "./strikes/strikeData.ts";
import { buildDrawings } from "./weapons/drawings.ts";
import { parseWeapons } from "./weapons/weaponData.ts";

export const buildInfo = parseBuildInfo(buildInfoJson);
export const weaponClasses = parseWeaponClasses(weaponClassesCsv);
export const alertAreas = parseAreas(oblastsCsv);
export const alertMonthly = parseAlertMonthly(alertMonthlyJson, alertAreas);
export const boundaries = parseBoundaries(boundariesText, alertAreas);
export const nightTable = parseNights(nightsJson);
export const monthlyTable = parseMonthly(monthlyByClassJson);
export const annotations = parseAnnotations(annotationsCsv);
// Tab B's copies, which keep destroyed counts and rates.
export const outcomeTable = parseOutcomes(nightsJson);
export const rateTable = parseRates(monthlyByClassJson);
// The weapon reference tables, for the primer and Data & Methods.
export const weapons = parseWeapons(weaponMembersCsv, weaponFiguresCsv, weaponSourcesCsv);
export const drawings = buildDrawings(weapons);
// For Data & Methods.
export const taxonomy = parseTaxonomy(weaponClassesCsv, modelClassesCsv);
export const manifest = parseManifest(manifestJson);
export const reconciliation = parseReconciliation(reconciliationJson, taxonomy);

/** Names of the areas left out of every alert figure. */
export function excludedAlertAreas(): string[] {
  return alertAreas.filter((area) => !area.inAlertTotals).map((area) => area.name);
}

/** "Nov 21, 2026". Formatted in UTC so the day never shifts with the viewer's time zone. */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}
