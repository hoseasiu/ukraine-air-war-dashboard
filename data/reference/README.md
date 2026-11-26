# Reference tables

Hand-editable tables used by the pipeline.

Other tables here: the [oblast gazetteer and map boundaries](gazetteer.md) and the [event annotations](annotations.md).

## Weapon classes

**Status: settled Nov 25, 2026 ([#3](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/3)).** The owner delegated the open choices to the coding agent: "Make whichever decision you think serves the overall project the best and document it." The agent made the [decisions](#decisions) below; the owner hasn't reviewed them one by one. The classes start from [plan §4](../../docs/plan.md#4-data-model-after-processing).

| File | Contents |
|---|---|
| `weapon_classes.csv` | One row per class: `class` (the id), `label`, `counts_in_totals`, `own_intercept_rate`. |
| `model_classes.csv` | One row per raw `model` string: `model` (matched exactly), `class`, `components` (for combined rows, separated by `;`), `note`. |

Colors aren't here. #10 defines them once for the site.

After editing either file, or after a data refresh, run:

```powershell
uv run pipeline/audit/weapon_classes.py
```

It needs `data/raw/`. It fails if a raw string has no mapping or more than one, if a mapped string isn't in the daily file, if a class id is unknown, or if a combined row breaks the rules below. **If you change a rule, change `expected_class` in that script too.**

### Rules for combined rows

A combined row is one count for several models. It's never split.

1. If every component is in one class, the row takes that class. For example, `X-101/X-555 and Kalibr` is cruise, and `X-22 and X-32` is anti-ship and other.
2. If the components are in different classes, the row goes to `mixed`.

`launched_details` gives a per-model breakdown of `launched` for a few rows, not always a complete one, and gives no breakdown of `destroyed`. We don't use it.

### What counts

| | Classes | Totals and massive-night threshold | Intercept rates |
|---|---|---|---|
| Attack classes | Shahed-type, cruise, ballistic, aeroballistic and hypersonic, anti-ship and other | Counted | Own class rate, and any all-class rate |
| Mixed classes | `mixed` | Counted | No class rate. Included in any all-class rate. |
| Excluded | Reconnaissance, tactical and unidentified UAVs; bombs | **Not counted** | **Not included** |

Excluded rows should still be listed, with their row counts, on the Data & Methods page.

- **UAVs:** in 1,553 of the 1,561 excluded UAV rows, `destroyed` equals `launched`. That includes all 258 Lancet, Kub and Молнія rows. The pattern suggests they're logged because they were shot down, so they don't measure launches and would push intercept rates up.
- **Bombs:** the daily file has only 6 bomb rows (33 launched). We haven't checked how many glide bombs Russia uses, but these rows shouldn't be read as that figure, so they aren't shown as a class.
- **Mixed rows leave out much of some missile classes.** Rows crossing classes that contain a ballistic missile hold 725 launched, against 980 in ballistic-only rows. For anti-ship and other it's 706 against 1,046, for aeroballistic and hypersonic 87 against 299, and for cruise 176 against 5,423. The same row counts under every class it contains. So **a class's monthly launches and intercept rate don't cover all launches of that kind**, and the A and B charts need to say so.

These figures use all rows as published, from Sept 28, 2022 to Nov 21, 2026. Hidden rows' `launched` = 0 is left in, and **missile counts from August 2026 are affected by the reporting restriction**. They aren't headline numbers. Any intercept rate built from `destroyed` needs the electronic-warfare caveat.

### Effect on the massive-night threshold

Provisional: nights keyed by end date, all source accounts, no removal of repeated reports. Which rows count as attacks is still open (plan §11).

| | Nights | Median | 95th percentile | Nights with 100+ |
|---|---|---|---|---|
| Counted classes only | 1,244 | 82 | 420.2 | 528 |
| Every class | 1,302 | 80 | 442.6 | 573 |

### Decisions

Counts here are subject to the same reporting-restriction note as above. The guiding aims were: don't split or guess counts, don't let rows logged mainly as shoot-downs inflate intercept rates, and keep the list of classes short enough to teach.

1. **One `cruise` class; no `mixed_cruise`.** This departs from the original plan §4, now updated. A row naming only cruise missiles can join `cruise` without splitting anything. A separate bucket would have held 1,522 launched beside 3,901 in single-entry cruise rows, so the cruise series would have left out much of what it's meant to show. `cruise` now holds 5,423 launched.
2. **C-300 and C-400 are anti-ship and other** (surface-to-air missiles listed among attacks; 112 single-class rows, 494 launched, 2 destroyed). This keeps `ballistic` to Iskander-M, KN-23 and rows reported as ballistic. Putting them in `ballistic` would change that class's counts and intercept rate a lot. The cost: `antiship_other` is a varied group, so its trend and intercept rate need care in reading. The Data & Methods table should list what's in it.
3. **X-31, X-31P, X-31PD, X-35 and X-35Y are anti-ship and other** (104 rows, 173 launched, 9 destroyed). §4 doesn't name them, and the reference file calls them cruise missiles (some anti-radiation).
4. **`Unknown Missile` is anti-ship and other** (26 rows, 90 launched), so it counts in totals without a new class. The Methods page must say the class includes unknown types. `Ballistic Missile` and `Intercontinental Ballistic Missile` are in `ballistic` as reported; we haven't verified the ICBM identifications.
5. **`Banderol` and `Banderol/Dan-T` are cruise** (25 rows, 149 launched), as the reference file says. We haven't checked what the weapon or `Dan-T` is beyond that. Some Shahed rows also have nested Banderol counts, and [we can't tell](../../docs/data-audit.md#decoys-and-jet-shaheds-a5) whether those are already in the Shahed total.
6. **`Geran` rows are Shahed-type** (45 rows, 1,041 launched, all marked destroyed; all from the western command), as the reference file groups Geran-4 and -5. We haven't independently checked that they are. **This doesn't decide whether the rows count.** They may repeat national figures, and the shoot-down-only pattern would justify leaving them out. That's still open in plan §11, for #5 and #7.
7. **Lancet, Kub and Молнія are excluded**, with `Orion` and `Mohajer-6`, although they aren't just reconnaissance drones. Every single-model row for these five is all shoot-downs.
8. **`Shahed-136/131 and Lancet` is `mixed`** (1 row, 16 launched, 10 destroyed), so it counts. The cross-class rule applies without a special case.
9. **The label stays "Shahed-type and decoy drones."** It warns that decoys are inside the counts, although they can't be separated. The A5 question in plan §11 may reword it.

## License

The `model` strings in `model_classes.csv` are copied from Petro Ivaniuk's [Massive Missile Attacks on Ukraine](https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine) dataset, and some notes quote its reference file. We added the class assignments, components and notes. To be safe, treat that file as adapted material under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); see the [data audit](../../docs/data-audit.md#license-and-redistribution).
