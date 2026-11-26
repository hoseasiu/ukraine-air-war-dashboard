# AGENTS.md

Instructions for coding agents working in this repo.

## What this is

A static teaching dashboard on Russia's missile and drone campaign against Ukraine, for a lecture on Jan 13, 2027. [docs/plan.md](docs/plan.md) is the spec: questions (§2), sources (§3), data model (§4), guided mode (§5), exploration mode (§6), teaching layer (§7), design and accessibility (§8), phases (§9) and decisions (§11). Read the sections your issue cites before writing code.

## Hard rules

1. **No fetching data at page load.** Everything is precomputed and versioned with the snapshot date. The snapshot date appears on every page.
2. **Never show a reported intercept rate without the EW caveat** ("destroyed" includes weapons lost to electronic warfare).
3. **Never show a launch count after Aug 12, 2026 without the ballistic-restriction flag.**
4. **Keep raw source column names in `data/raw/`.** All renaming happens in one mapping module.
5. **Define weapon-class colors once** and import them everywhere. Don't rely on color alone.
6. **Describe changes around annotated events neutrally.** No causal language unless an analysis supports it.
7. **No real-time data, and nothing that could work as live targeting or warning information.** This is a retrospective tool.
8. **Don't guess.** If something is ambiguous, add the question under "Open" in [docs/plan.md](docs/plan.md) §11 and raise it on the issue.
9. **Never commit `archive.zip`, any other archive, or anything in `data/raw/`** (except `.gitkeep`). Don't force-add ignored files.
10. **Kaggle-derived files in `data/processed/` stay CC BY-NC-SA 4.0.** Redistribution is allowed (#1), with attribution, a note of changes, noncommercial use and the same license on adapted data. Ship that notice with the first processed files. See [docs/data-audit.md](docs/data-audit.md#license-and-redistribution).
11. **Don't change the repo's visibility or deploy publicly** without the owner's explicit go-ahead (#26, #27).

Tone is factual and sober: counts, not spectacle. No weapon imagery and no Russian-source propaganda imagery. English only in v1.

## Needs the owner

Issues labeled `needs:owner` need a decision, sign-off or manual step from the repo owner. Do the preparatory work, put the specific question on the issue, and leave it open. Don't record a sign-off that hasn't happened. This covers the weapon-class taxonomy, the "massive" definition, the three comparison oblasts, guided-stop captions, the annotation list, the code license, going public, the snapshot cutoff and the rehearsal.

## Layout

Planned. Create folders as the work needs them, and update this section if you choose differently.

```
data/raw/         source files (gitignored; setup in data/README.md)
data/reference/   hand-editable tables: weapon-class mapping, oblast gazetteer, annotations
data/processed/   pipeline outputs
pipeline/         Python data build
pipeline/audit/   rerunnable audit scripts (read raw data, write nothing)
tests/            pipeline tests
site/             Vite + TypeScript front end
docs/             spec and data audit
```

## Commands

| Command | What it does |
|---|---|
| `uv run pipeline/audit/kaggle.py` | Prints the Kaggle audit figures quoted in `docs/data-audit.md`. Needs `data/raw/`. |
| `python .github/scripts/dependency_graph.py --dry-run` | Prints the body of the generated dependency issue (#31). Without `--dry-run`, updates it. Needs `gh`. |
| `python -m unittest discover -s .github/scripts` | Tests the dependency-graph script. |

No pipeline or site build or test commands exist yet. #6 adds the pipeline commands and #10 the site commands. **Whoever adds a command records it here.**

The owner develops on Windows, where `make` isn't installed. The plan's `make data` means "one command rebuilds the data", so provide an entry point that works in PowerShell and on Linux CI. Python 3.12, `uv` and Node 22 are installed on the owner's machine.

## Data notes

From the audit of the Nov 21 snapshot (#1). Read [docs/data-audit.md](docs/data-audit.md) before using the strike data.

- The reference file is `missiles_and_uavs.csv` (the plan says `missiles_and_uav.csv`). There are 90 distinct `model` strings; 22 aren't in the reference file.
- Rows span Sept 28, 2022 to Nov 21, 2026.
- `status_data = hidden` rows mostly have `launched` = 0. That means unpublished, not zero.
- `Shahed-136/131` counts include Gerbera, decoys and other types. Decoys can't be separated.
- Don't sum all rows as attacks: regional reports may repeat national figures, reconnaissance rows are almost all shoot-downs, and daytime and night windows overlap.
- `time_start` and `time_end` come both with and without a time of day, sometimes with trailing spaces.
- Read files as UTF-8 explicitly. Printing the Cyrillic strings fails on the Windows console default (cp1252).

## Working on issues

Several sessions may run at once from separate worktrees.

1. Pick an issue under "Ready to start" in [#31](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/31), the generated dependency list: open, all blockers closed, and no `agent:in-progress`. It can lag behind, so confirm on the issue itself. Check the file-overlap risks in [DEPENDENCIES.md](DEPENDENCIES.md).
2. Claim it before writing code: add the `agent:in-progress` label, assign yourself, and comment with your branch name.
3. Branch from `main` as `claude/issue-<N>-<slug>`.
4. After the first real commit, push and open a draft PR with `Closes #N` in the body.
5. In the PR, say what you verified and what you didn't. Check each "Done when" item in the issue.
6. If you stop without finishing, remove the label and assignee, and comment with the reason and where the work is.

A new worktree has an empty `data/raw/`; see [data/README.md](data/README.md).

If you find new work, open an issue. Record each dependency as a GitHub "blocked by" link ([how](DEPENDENCIES.md#changing-a-dependency)), not in issue text or a doc. Don't edit #31.

## Quality bar

- Pipeline: tests cover reconciliation with raw totals, unmapped model strings and non-negative alert durations. Fail loudly on new, unmapped values.
- Site: WCAG 2.2 AA, full keyboard access, a table alternative for every chart, and reduced motion respected. Light theme by default, readable on a projector.
- Total data the site loads stays under 2 MB.
- Every number shown traces to a source, and every annotation has a citation.
