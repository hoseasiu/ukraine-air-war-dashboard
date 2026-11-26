/** Data compiled into the bundle. Nothing is fetched at page load. */
import alertMonthlyJson from "../../data/processed/alert_hours_monthly.json";
import buildInfoJson from "../../data/processed/build_info.json";
import monthlyByClassJson from "../../data/processed/monthly_by_class.json";
import boundariesText from "../../data/reference/ukraine_admin1.geojson?raw";
import oblastsCsv from "../../data/reference/oblasts.csv?raw";
import weaponClassesCsv from "../../data/reference/weapon_classes.csv?raw";
import { parseAlertMonthly, parseBoundaries } from "./alerts/alertData.ts";
import { parseLaunchTable } from "./alerts/alertLaunchData.ts";
import { parseAreas, parseBuildInfo, parseWeaponClasses } from "./buildData.ts";

export const buildInfo = parseBuildInfo(buildInfoJson);
export const weaponClasses = parseWeaponClasses(weaponClassesCsv);
export const alertAreas = parseAreas(oblastsCsv);
export const alertMonthly = parseAlertMonthly(alertMonthlyJson, alertAreas);
export const boundaries = parseBoundaries(boundariesText, alertAreas);
export const launchTable = parseLaunchTable(monthlyByClassJson);

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
