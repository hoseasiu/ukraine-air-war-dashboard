# The Air War, in Data

A teaching dashboard on Russia's missile and drone campaign against Ukraine, built for **Build for Ukraine 3.0** (Day 1: Wed Jan 13, 2027).

**Status:** planning and repo setup. There is no application code yet.

It will have two modes:

- **Guided mode:** a step-through lecture segment of about 20 minutes, in 12 stops, made for a projector.
- **Free exploration:** tabs for attacks, air defense and air-raid alerts, plus a Data & Methods page.

This is a retrospective teaching tool built on a frozen data snapshot. It shows no real-time data and must not be used for warning or targeting.

## Reading the data

- Reported "destroyed" counts **include weapons lost to electronic warfare**. They are reported figures, not independently verified ones.
- Ballistic-missile figures have been restricted since **Aug 12, 2026**.
- The strike file in the current snapshot starts on **Sept 28, 2022**, not at the start of the full-scale invasion.

## Data sources

| Source | Used for | License |
|---|---|---|
| [Massive Missile Attacks on Ukraine](https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine) (Petro Ivaniuk, Kaggle) | Launches and intercepts | Not yet verified (#1) |
| [Ukrainian air raid sirens dataset](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset) (Vadimkin) | Alert hours | MIT |

Raw files aren't committed. See [data/README.md](data/README.md) to set them up.

## Planned stack

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
- [AGENTS.md](AGENTS.md): rules for coding sessions
- [DEPENDENCIES.md](DEPENDENCIES.md): issue order and file-overlap risks
