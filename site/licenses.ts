import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

/** The notices a copy of the site has to carry, apart from the bundled libraries'. */
function siteNotices(): string {
  const boundaries = JSON.parse(read("../data/reference/ukraine_admin1.geojson"));
  if (!boundaries.attribution || !boundaries.license) {
    throw new Error("ukraine_admin1.geojson: needs attribution and license");
  }
  const sections = [
    "The Air War, in Data: licenses and credits",
    "Third-party material keeps its own terms. The libraries bundled with the site are listed in third-party-licenses.txt, next to this file.",
    "== Code ==",
    read("../LICENSE").trim(),
    "== Our writing ==",
    "Our definitions, discussion prompts, captions, event labels and explanations are licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Credit: Hosea Siu, The Air War, in Data.",
    "== Map boundaries ==",
    `${boundaries.attribution}\n${boundaries.license}\nNo endorsement by Kartographia or OCHA is implied.`,
    "== Font ==",
    read("./src/theme/fonts/OFL.txt").trim(),
    "== Weapon-class table ==",
    "The model strings on the Data & Methods page come from Massive Missile Attacks on Ukraine by Petro Ivaniuk (https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine), under CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/). We added the class assignments. The table is shared under the same license.",
    "== Weapon reference tables ==",
    "The figures on the weapon-class page are facts taken from the pages it links, which belong to their publishers. No text or images are copied from them. Our choice of figures, our notes and citations are licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). The table of weapons copies model strings from Massive Missile Attacks on Ukraine by Petro Ivaniuk (https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine), so it is shared under CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/); we added names, roles, launch platforms, speed categories, notes and citations.",
    "== Data ==",
    read("../data/processed/LICENSE.md").trim(),
  ];
  return `${sections.join("\n\n")}\n`;
}

/** Writes licenses.txt into the build, and serves it from the dev server. */
export function licenseNotices(): Plugin {
  return {
    name: "license-notices",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "licenses.txt", source: siteNotices() });
    },
    configureServer(server) {
      server.middlewares.use("/licenses.txt", (_request, response) => {
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(siteNotices());
      });
    },
  };
}
