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
10. **Don't commit anything to `data/processed/`** until the license check (#1) says redistribution is allowed, or the owner decides otherwise.
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
tests/            pipeline tests
site/             Vite + TypeScript front end
docs/             spec and data audit
```

## Commands

No build or test commands exist yet. #6 adds the pipeline commands and #10 the site commands. **Whoever adds a command records it here.**

The owner develops on Windows, where `make` isn't installed. The plan's `make data` means "one command rebuilds the data", so provide an entry point that works in PowerShell and on Linux CI. Python 3.12, `uv` and Node 22 are installed on the owner's machine.

## Data notes

These come from a quick look at the Nov 21 snapshot. They are leads for the Phase 0 audit, not audited findings.

- The reference file is `missiles_and_uavs.csv` (the plan says `missiles_and_uav.csv`).
- `missile_attacks_daily.csv` spans Sept 28, 2022 to Nov 21, 2026.
- There are 90 distinct `model` strings, and 22 aren't in the reference file. Some are in Cyrillic.
- Many rows are reconnaissance or tactical UAVs (for example Orlan-10, ZALA, Supercam, "Unknown UAV"), which the plan's class list doesn't cover.
- Some combined entries mix ballistic, cruise and other types, so a "mixed cruise" bucket alone won't hold them.
- `time_start` and `time_end` come both with and without a time of day.
- Read files as UTF-8 explicitly. Printing the Cyrillic strings fails on the Windows console default (cp1252).

## Working on issues

Several sessions may run at once from separate worktrees.

1. Check [DEPENDENCIES.md](DEPENDENCIES.md). Pick an open issue whose blockers are closed and that doesn't have `agent:in-progress`.
2. Claim it before writing code: add the `agent:in-progress` label, assign yourself, and comment with your branch name.
3. Branch from `main` as `claude/issue-<N>-<slug>`.
4. After the first real commit, push and open a draft PR with `Closes #N` in the body.
5. In the PR, say what you verified and what you didn't. Check each "Done when" item in the issue.
6. If you stop without finishing, remove the label and assignee, and comment with the reason and where the work is.

A new worktree has an empty `data/raw/`; see [data/README.md](data/README.md).

If you find new work or a new dependency, open an issue and update `DEPENDENCIES.md`.

## Quality bar

- Pipeline: tests cover reconciliation with raw totals, unmapped model strings and non-negative alert durations. Fail loudly on new, unmapped values.
- Site: WCAG 2.2 AA, full keyboard access, a table alternative for every chart, and reduced motion respected. Light theme by default, readable on a projector.
- Total data the site loads stays under 2 MB.
- Every number shown traces to a source, and every annotation has a citation.
