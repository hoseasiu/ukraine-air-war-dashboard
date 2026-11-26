import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { licenseNotices } from "./licenses.ts";
import { parseAlertMonthly, parseBoundaries } from "./src/alerts/alertData.ts";
import { parseAnnotations } from "./src/annotations/annotationData.ts";
import { parseAreas, parseBuildInfo, parseWeaponClasses } from "./src/buildData.ts";
import { parseOutcomes, parseRates } from "./src/defense/defenseData.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** Stops the build if the data files the site imports don't match what it expects. */
function checkBuildData(): Plugin {
  return {
    name: "check-build-data",
    buildStart() {
      parseBuildInfo(JSON.parse(read("../data/processed/build_info.json")));
      parseWeaponClasses(read("../data/reference/weapon_classes.csv"));
      const areas = parseAreas(read("../data/reference/oblasts.csv"));
      parseAlertMonthly(JSON.parse(read("../data/processed/alert_hours_monthly.json")), areas);
      parseBoundaries(read("../data/reference/ukraine_admin1.geojson"), areas);
      // Each also runs the tab A checks on its table.
      parseOutcomes(JSON.parse(read("../data/processed/nights.json")));
      parseRates(JSON.parse(read("../data/processed/monthly_by_class.json")));
      parseAnnotations(read("../data/reference/annotations.csv"));
    },
  };
}

export default defineConfig({
  // Relative asset URLs work under any GitHub Pages project subpath.
  // This relies on hash routing: every page is served by the one index.html.
  base: "./",
  plugins: [checkBuildData(), licenseNotices()],
  // The bundled libraries' licenses, which minifying strips from the code.
  build: { license: { fileName: "third-party-licenses.txt" } },
  server: {
    // The only folders readable by the dev server besides site/. Never data/raw/.
    fs: { allow: [".", "../data/processed", "../data/reference"] },
  },
});
