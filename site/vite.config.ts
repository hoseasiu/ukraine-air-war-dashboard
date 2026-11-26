import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { parseBuildInfo, parseWeaponClasses } from "./src/buildData.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** Stops the build if the data files the site imports don't match what it expects. */
function checkBuildData(): Plugin {
  return {
    name: "check-build-data",
    buildStart() {
      parseBuildInfo(JSON.parse(read("../data/processed/build_info.json")));
      parseWeaponClasses(read("../data/reference/weapon_classes.csv"));
    },
  };
}

export default defineConfig({
  // Relative asset URLs work under any GitHub Pages project subpath.
  // This relies on hash routing: every page is served by the one index.html.
  base: "./",
  plugins: [checkBuildData()],
  server: {
    // The only folders readable by the dev server besides site/. Never data/raw/.
    fs: { allow: [".", "../data/processed", "../data/reference"] },
  },
});
