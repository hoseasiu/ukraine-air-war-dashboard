# Licensing

This repo mixes our own work with material from three data sources, so one license doesn't cover everything. **Third-party material keeps its own terms wherever it appears.** This is a reading of the license terms, not legal advice.

## Our work

| What | License |
|---|---|
| Code: `pipeline/`, `tests/`, `site/` and `.github/` | [MIT](LICENSE) |
| Our writing: the Markdown docs, and the on-screen teaching text (definitions, discussion prompts, captions and explanations), including where it sits in code files | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit "Hosea Siu, The Air War, in Data", link to this repo and say what you changed. |
| `data/reference/annotations.csv`: our event labels, descriptions and notes | CC BY 4.0. The linked sources belong to their publishers. |
| `data/reference/weapon_classes.csv` | CC BY 4.0 |

## Data from other sources

| Files | Terms |
|---|---|
| Files in `data/processed/` derived from the strike data | **CC BY-NC-SA 4.0** (noncommercial, share-alike). Adapted from [Massive Missile Attacks on Ukraine](https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine) by Petro Ivaniuk. See [data/processed/LICENSE.md](data/processed/LICENSE.md). |
| `data/reference/model_classes.csv` | **CC BY-NC-SA 4.0**, from the same dataset: its `model` strings and quotes from its reference file, with our class assignments, components and notes added. |
| `data/processed/alert_hours_monthly.json`, `alert_daily.json` | **MIT, Copyright (c) 2022 Vadym Klymenko.** Made from the [Ukrainian air-raid sirens dataset](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset). The full notice and our changes are in [data/processed/LICENSE.md](data/processed/LICENSE.md). |
| `data/reference/ukraine_admin1.geojson` | **[CC BY-IGO](https://creativecommons.org/licenses/by/3.0/igo/legalcode).** State Scientific Production Enterprise "Kartographia", via OCHA (COD-AB Ukraine v05, HDX). Simplified, with other properties dropped and rings rewound ([details](data/reference/gazetteer.md#processing)). No endorsement by either is implied. |
| `data/reference/oblasts.csv`, `oblast_aliases.csv`, `raions.csv` | Our tables, which include place names, spellings or codes from the sources above: the alert files (MIT notice above), the boundary source (CC BY-IGO, credit above) and the strike dataset. Our additions are CC BY 4.0. To be safe, treat rows of `oblast_aliases.csv` seen only in the strike dataset (`seen_in` is `kaggle_affected_region`) as CC BY-NC-SA 4.0. |

Figures and quotations from these sources that appear in the docs, code or issues also stay under the sources' terms. Treat anything adapted from the strike data, including a chart or table on the built site, as noncommercial and share-alike.

## The built site

`npm run build` puts two files next to the site, linked from the footer:

- `licenses.txt`: the MIT license for our code, the terms for our writing, the map credit and the data notices ([how it's built](site/licenses.ts)).
- `third-party-licenses.txt`: the licenses of the JavaScript libraries, generated from what's actually bundled.

A new data source needs a row here and a notice in `licenses.txt`. Raw source files aren't in the repo ([setup](data/README.md)).
