# Data

| Folder | Contents | In git? |
|---|---|---|
| `raw/` | Source files, exactly as downloaded. Never edit them or rename their columns. | No |
| `processed/` | Pipeline outputs that the site loads. Anything derived from Kaggle is CC BY-NC-SA 4.0 (see below). | Yes, with the license notice |

## Snapshot date

`processed/build_info.json` holds `snapshot_date`, which the site shows on every page. The current value, 2026-11-21, is the date of the Kaggle files below, and was entered by hand because there's no pipeline yet (#10). Once the pipeline exists, it should write this file. The alerts data isn't fetched yet, so the date says nothing about it.

## Current raw files

### Kaggle: Massive Missile Attacks on Ukraine

Source: <https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine> (Petro Ivaniuk). Downloading needs a Kaggle login, so a person has to do it; coding sessions can't fetch it.

**License: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)**, read from the License field on that page on Nov 25, 2026. Processed data may be committed and published with credit to Petro Ivaniuk, links to the dataset and license, a note of what changed, noncommercial use only, and the same license on adapted data. Put that notice in `processed/` with the first outputs. Raw files still stay out of git. Details: [data audit](../docs/data-audit.md#license-and-redistribution).

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

Source: <https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset> (MIT license). Not downloaded yet; see #2 and #6.
