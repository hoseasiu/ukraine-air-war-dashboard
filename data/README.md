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

It downloads the alert files if they're missing, checks the inputs and writes `processed/manifest.json` (snapshot date, plus each raw file's row count, size and SHA-256) and `processed/build_info.json`. It builds no tables yet (#7, #8). The same inputs give the same bytes, so after a rebuild `git diff data/processed` shows what changed. See [processed/LICENSE.md](processed/LICENSE.md) for the license of those files.

## Snapshot date

`processed/build_info.json` holds `snapshot_date`, which the site shows on every page. The build sets it to the **latest `time_end` date in `missile_attacks_daily.csv`** (2026-11-21 for the files below), not from file timestamps. It describes the strike data only, not the alert data.

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
