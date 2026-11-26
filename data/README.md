# Data

| Folder | Contents | In git? |
|---|---|---|
| `raw/` | Source files, exactly as downloaded. Never edit them or rename their columns. | No |
| `processed/` | Pipeline outputs that the site loads. Anything derived from Kaggle is CC BY-NC-SA 4.0 (see below). | Yes, with the license notice |

## Build

With the two Kaggle files in `raw/` (below), run this from the repo root. It works in PowerShell and on Linux:

```powershell
uv run python -m pipeline
```

It downloads the alert files if they're missing, checks the inputs and writes `processed/manifest.json` (snapshot date, plus each raw file's row count, size and SHA-256), `processed/build_info.json`, the two [alert tables](#alert-tables) and the [strike tables](#strike-tables). The same inputs give the same bytes, so after a rebuild `git diff data/processed` shows what changed. See [processed/LICENSE.md](processed/LICENSE.md) for the license of those files.

## Snapshot date

`processed/build_info.json` holds `snapshot_date`, which the site shows on every page. The build sets it to the **latest `time_end` date in `missile_attacks_daily.csv`** (2026-11-21 for the files below), not from file timestamps. It describes the strike data only, not the alert data.

## Alert tables

Built by [pipeline/alerts.py](../pipeline/alerts.py) from `official_data_en.csv` alone, with the [roll-up rule](../docs/data-audit.md#roll-up-rule). They cover **April 1, 2022 through July 31, 2026**, in **Kyiv time** (`Europe/Kyiv`; the source is UTC). So a day has 23 or 25 hours when the clocks change.

Both files start with the source commit, `time_zone`, `first_day`, `last_day`, the 24 `areas` and the `excluded_areas` with reasons. **Excluded areas have no figures. Show them as excluded, never as zero.** Within the window, a 0 means the file lists no alert counted by the rule. It can't show that no alert was missed.

### `alert_hours_monthly.json`

One object per area and month in `rows` (24 × 52).

| Column | Meaning |
|---|---|
| `oblast` | ISO 3166-2 code. Join to [`oblasts.csv`](reference/oblasts.csv) for names. |
| `month` | `YYYY-MM`. |
| `hours` | Alert hours, **average per raion** (Kyiv city is one unit). Not "some part of the oblast was under alert". |
| `n_alerts` | Alert periods that **started** in the month, **average per raion**, so it can be a fraction. For each raion, oblast-wide and raion rows that overlap or touch are one period. Zero-length rows aren't counted, and a period that started before April 2022 isn't counted. |
| `alert_end_assumed` | A row used here **may** have an assumed end (below). |
| `alert_regions_excluded` | Always true: the table leaves out Luhansk, Crimea and Sevastopol. |
| `alert_granularity_change` | True from January 2025, when the switch to raion alerts began phasing in (main step November 2025). |

The three flag names are the site's [chart-frame row flags](../site/src/chart/flags.ts).

**`n_alerts` is still not like-for-like across the 2025 switch.** Averaging over raions stops one oblast's raion rows from adding up, but the alerting practice changed. Don't describe a change across it as a change in threat.

**Assumed ends.** The official file doesn't mark them, and only the unused volunteer file has a `naive` column. The upstream parser gives an unfinished alert an end exactly one hour after its start, so the flag is set when a row of exactly 3,600 seconds, at oblast or raion level, touches the period. Some of those are probably real hour-long alerts, and the flag can't tell them apart. An unflagged period has no end set by that rule. The parser can also replace an unfinished alert's start with a later one, which no flag can show.

### `alert_daily.json`

For the calendar view, stored as series to keep it small. `hours` maps each area to one number per day, in order from `first_day` to `last_day` (hours, average per raion). `flags` holds `alert_regions_excluded`, `alert_granularity_change_from` (a date) and `alert_end_assumed_days` (for each area, the flagged dates). A chart that builds rows from this file should set the three row flags from these.

Hours are rounded to 0.01, so a month's daily values can differ slightly from its monthly total.

## Strike tables

Built by [pipeline/strikes.py](../pipeline/strikes.py) from `missile_attacks_daily.csv`, with the [definitions](../docs/data-audit.md#definitions) and the [weapon classes](reference/README.md#weapon-classes). Only counted classes and national military reports are in `nights` and `monthly_by_class`. All three files below are **CC BY-NC-SA 4.0** ([notice](processed/LICENSE.md)).

Each file starts with the source, `first_day` and `last_day` (the first and last report end dates in the raw file, so the first and last months can be partial) and `restriction_from`.

### `nights.json`

One object per night and class in `rows`. **A night is keyed by the Kyiv date its reports end on:** a report from the evening of March 4 to the morning of March 5 belongs to March 5. [Daytime reports](../docs/data-audit.md#which-rows-count) are left out, so nights don't add up to monthly totals. A class with no report that night has no row, and a date with no row may be quiet or unreported.

`massive.years` has each calendar year's bar (`massive_above`: a massive night had **more** weapons launched than this), `n_nights`, `n_massive`, and the first and last night used. Show the year's bar wherever "massive" appears, and don't chart massive nights per year as a trend. A night's size is the sum of its rows' known `launched`.

| Column | Meaning |
|---|---|
| `date` | The date the night's reports end, `YYYY-MM-DD`. |
| `class` | Class id from [`weapon_classes.csv`](reference/weapon_classes.csv). `mixed` rows aren't split. |
| `launched` | Sum of the published launch counts. `null` if none is known, never 0 for unknown. With `n_unknown_launched` above 0, it leaves some reports out. |
| `destroyed` | Reported destroyed, **including electronic warfare**, over the rows where both counts are usable. `null` if there are none. |
| `launched_with_outcome` | Launches in those same rows. The number not reported destroyed is `launched_with_outcome − destroyed`. **Don't use `launched − destroyed`:** `launched` can include rows with no usable destroyed count. Neither is a count of hits. |
| `n_models` | Distinct raw model strings reported, including those with unknown counts. A combined string counts once, so it isn't a count of weapon types. |
| `n_unknown_launched` | Rows whose launch count is `hidden` or blank. |
| `is_massive` | The same on every row of a date. `null` if no count that night is known; such a night isn't in the year's bar. The current snapshot has none. |
| `launch_places` | Distinct `launch_place` entries as reported. One entry can name several places. **There are no counts by place**, and counts can't be divided among them. |
| `launch_place_missing` | At least one report in the row names no place, so the list may be incomplete. |
| `destroyed_includes_ew` | True when the row has a `destroyed` figure. |
| `ballistic_restricted` | True from the night of Aug 11, 2026, **for every class**. |

For B2, a night after the restriction can be missing missiles from its size, its mix and its destroyed counts. The owner chose to keep those nights, flagged, noted and marked apart (#16, [plan §11](../docs/plan.md#11-decisions)).

### `monthly_by_class.json`

One object per month and class in `rows`, by the month each report ends in, **daytime reports included**. A class with no report in a month has no row. The columns `launched`, `destroyed`, `launched_with_outcome`, `n_models`, `n_unknown_launched` and `destroyed_includes_ew` mean what they do above. `ballistic_restricted` is true for August 2026 and later, all of August included.

| Column | Meaning |
|---|---|
| `month` | `YYYY-MM`. |
| `intercept_rate` | `destroyed ÷ launched_with_outcome`, a fraction to four decimals. `null` is a gap, never 0. **Use this column; don't divide the counts yourself**, or the suppressed months come back. Show both counts with it, and the EW caveat. |
| `intercept_rate_gap` | `null` when there's a rate. Otherwise, the first that applies: `no_class_rate` (mixed), `missile_reporting_restricted` (missile classes from August 2026) or `below_minimum` (under 10 launches with an outcome). |

The header's `intercept_rate` gives the minimum, the missile classes and the first month they have no rate.

### `strike_reconciliation.json`

Accounts for every raw row. `buckets` don't overlap and add up to `raw_daily_file`: excluded classes (listed by class in `excluded_class_rows`, over all accounts), counted classes from other accounts, `hidden` rows, and rows in monthly totals. Their `_as_published` sums include counts the tables treat as unknown, so they're for checking and for Data & Methods, **not for charting**. `within_monthly_totals` shows what nights leave out and which counts are blank or impossible. The build stops if the buckets don't add up to the raw sums, or if either table's totals differ from sums taken directly from the raw rows.

The build also stops on a model string with no class, a source account not listed in `pipeline/strikes.py`, a `hidden` row before Aug 11, 2026, an unknown `status_data` value, an unreadable time or count, or a new non-English `launch_place`.

## Current raw files

### Kaggle: Massive Missile Attacks on Ukraine

Source: <https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine> (Petro Ivaniuk). Downloading needs a Kaggle login, so a person has to do it; coding sessions can't fetch it.

**License: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)**, read from the License field on that page on Nov 25, 2026. Processed data may be committed and published with credit to Petro Ivaniuk, links to the dataset and license, a note of what changed, noncommercial use only, and the same license on adapted data. That notice is in [processed/LICENSE.md](processed/LICENSE.md). Raw files still stay out of git. Details: [data audit](../docs/data-audit.md#license-and-redistribution).

Received Nov 25, 2026 as `archive.zip`. The files inside are dated Nov 21, 2026.

| File | Data rows | SHA-256 |
|---|---|---|
| `missile_attacks_daily.csv` | 4,399 | `ac145393429c9434b9b537f3be1bd1ab715eaac807fd32dc33d1ff96a63ba116` |
| `missiles_and_uavs.csv` | 69 | `5bfe01b3c0c62f1b45a5ad105d091bad5256ff32426e49503afd853c0a1ae34c` |

**Setup on a new clone or worktree:** `raw/` starts out empty. Copy `archive.zip` from the main checkout (or ask the repo owner for it) and extract both CSVs into `data/raw/`. In PowerShell, from the repo root:

```powershell
Expand-Archive -Path archive.zip -DestinationPath data/raw
```

### Air raid sirens

Source: <https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset> (MIT license, Copyright (c) 2022 Vadym Klymenko). Keep that copyright and permission notice with processed files made from it.

Audited at commit `1a349789e45d63a19c8faf46d0e5877cbb36ac8b` (Nov 25, 2026; #2). **The official file at that commit ends Sept 7, 2026** and contains duplicate rows. Read the [alerts audit](../docs/data-audit.md#alerts-ukrainian-air-raid-sirens-dataset) before using either file.

| File | Data rows | SHA-256 |
|---|---|---|
| `official_data_en.csv` | 299,275 | `b396f87696243069eec0219880e87dcd642b20beb0a7bae0d0e1f61e1ed20ec4` |
| `volunteer_data_en.csv` | 124,468 | `c67fb71a19c69e690d4921fd5edc8338892bcf4a5a6b6a23836e600bf2a5f454` |

**Setup:** no login needed. The build downloads both files from that commit if they're missing, or fetch them alone:

```powershell
uv run python -m pipeline fetch
```

A file that doesn't match its pinned checksum stops the build and is never overwritten. To move the pin (#28), change the commit and checksums in [pipeline/sources.py](../pipeline/sources.py) and the table above.

### Boundaries

Source: [Ukraine - Subnational Administrative Boundaries](https://data.humdata.org/dataset/cod-ab-ukr) (OCHA COD-AB v05, on HDX). **License: CC BY-IGO.** Details are in the [gazetteer notes](reference/gazetteer.md#boundaries).

Only needed to rebuild `reference/ukraine_admin1.geojson`, which is committed. Downloaded Nov 25, 2026:

| File | Size | SHA-256 |
|---|---|---|
| `ukr_admin_boundaries.geojson.zip` | 83,953,609 bytes | `b8604bc983e1e54a6f7c10186a5cf8474cb8ed49eb038b4bef8091d92c286790` |

**Setup:** no login needed. In PowerShell, from the repo root:

```powershell
Invoke-WebRequest -Uri "https://data.humdata.org/dataset/d23f529f-31e4-4021-a65b-13987e5cfb42/resource/681beb86-391b-4a08-8140-ca52e80fcdce/download/ukr_admin_boundaries.geojson.zip" -OutFile "data/raw/ukr_admin_boundaries.geojson.zip"
```

HDX may replace the file at this link. The build script then stops on the hash, so review the change before updating it.
