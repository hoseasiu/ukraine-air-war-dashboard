# The Air War, in Data

A teaching dashboard on Russia's missile and drone campaign against Ukraine, built for **Build for Ukraine 3.0** (Day 1: Wed Jan 13, 2027).

**Status:** early development. The site is a scaffold with no charts yet, and the data pipeline isn't built. To run it, see the site commands in [AGENTS.md](AGENTS.md#commands).

It will have two modes:

- **Guided mode:** a step-through lecture segment of about 20 minutes, in 12 stops, made for a projector.
- **Free exploration:** tabs for attacks, air defense and air-raid alerts, plus a Data & Methods page.

This is a retrospective teaching tool built on a frozen data snapshot. It shows no real-time data and must not be used for warning or targeting.

## Reading the data

- Reported "destroyed" counts **include weapons lost to electronic warfare**. They are reported figures, not independently verified ones.
- Some missile figures, including ballistic and cruise, are unpublished from **Aug 11, 2026** ([data audit](docs/data-audit.md#ballistic-data-after-august-2026)). An unpublished count is unknown, not zero.
- Shahed-type counts **include decoys** and other drones, which can't be separated.
- The strike file in the current snapshot starts on **Sept 28, 2022**, not at the start of the full-scale invasion.

## Data sources

| Source | Used for | License |
|---|---|---|
| [Massive Missile Attacks on Ukraine](https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine) (Petro Ivaniuk, Kaggle) | Launches and intercepts | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| [Ukrainian air raid sirens dataset](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset) (Vadimkin) | Alert hours | MIT |
| [Ukraine administrative boundaries](https://data.humdata.org/dataset/cod-ab-ukr) (State Scientific Production Enterprise "Kartographia", via OCHA) | Map outlines, simplified | [CC BY-IGO](https://creativecommons.org/licenses/by/3.0/igo/legalcode) |

Processed data derived from the Kaggle dataset may be shared only under CC BY-NC-SA 4.0: credit Petro Ivaniuk and link the dataset and license, say what was changed, keep use noncommercial and license adaptations the same way. This doesn't set a license for the code, which has none yet (#26). See the [data audit](docs/data-audit.md).

Raw files aren't committed. See [data/README.md](data/README.md) to set them up.

## Stack

- **Data pipeline:** Python (pandas and DuckDB), run offline with one command, producing small precomputed files
- **Site:** Vite and TypeScript, Observable Plot and d3-geo; static, with no backend
- **Hosting:** GitHub Pages by default

## Roadmap

| Phase | Work | Target |
|---|---|---|
| 0 | Data audit | ~Dec 12, 2026 |
| 1 | Processing pipeline | |
| 2 | Site skeleton and tab A (attacks) | |
| 3 | Tabs B (defense) and E (alerts) | |
| 4 | Guided mode | |
| 5 | Methods page, annotations, teaching layer | |
| 6 | Review, accessibility, deploy | Draft ~Dec 23, final ~Jan 8, 2027 |

Work is tracked in [GitHub issues](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues), with one milestone per phase.

## Docs

- [docs/plan.md](docs/plan.md): the full spec and decision log
- [docs/data-audit.md](docs/data-audit.md): what the data can and can't support
- [AGENTS.md](AGENTS.md): rules for coding sessions
- [DEPENDENCIES.md](DEPENDENCIES.md): how issue dependencies work, and file-overlap risks
- [Dependency graph](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/31): generated issue showing what's blocked and what's ready
