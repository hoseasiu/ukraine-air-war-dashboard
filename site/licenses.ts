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
