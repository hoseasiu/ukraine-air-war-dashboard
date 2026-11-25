# Data

| Folder | Contents | In git? |
|---|---|---|
| `raw/` | Source files, exactly as downloaded. Never edit them or rename their columns. | No |
| `processed/` | Pipeline outputs that the site loads. Don't commit any until the license check in issue #1 is done. | Yes, after that check |

## Current raw files

### Kaggle: Massive Missile Attacks on Ukraine

Source: <https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine> (Petro Ivaniuk). Downloading needs a Kaggle login, so a person has to do it; coding sessions can't fetch it. **License: not yet verified** (#1).

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
