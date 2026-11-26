/** Data compiled into the bundle. Nothing is fetched at page load. */
import buildInfoJson from "../../data/processed/build_info.json";
import oblastsCsv from "../../data/reference/oblasts.csv?raw";
import weaponClassesCsv from "../../data/reference/weapon_classes.csv?raw";
import { parseAreas, parseBuildInfo, parseWeaponClasses } from "./buildData.ts";

export const buildInfo = parseBuildInfo(buildInfoJson);
export const weaponClasses = parseWeaponClasses(weaponClassesCsv);
export const alertAreas = parseAreas(oblastsCsv);

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
