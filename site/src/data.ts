/** Data compiled into the bundle. Nothing is fetched at page load. */
import buildInfoJson from "../../data/processed/build_info.json";
import weaponClassesCsv from "../../data/reference/weapon_classes.csv?raw";
import { parseBuildInfo, parseWeaponClasses } from "./buildData.ts";

export const buildInfo = parseBuildInfo(buildInfoJson);
export const weaponClasses = parseWeaponClasses(weaponClassesCsv);

/** "Nov 21, 2026". Formatted in UTC so the day never shifts with the viewer's time zone. */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}
