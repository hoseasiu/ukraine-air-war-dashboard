# Reference tables

Hand-editable tables used by the pipeline.

## Weapon classes (draft, not signed off)

**Status: draft for the owner's sign-off on [#3](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/3).** The classes start from [plan §4](../../docs/plan.md#4-data-model-after-processing).

| File | Contents |
|---|---|
| `weapon_classes.csv` | One row per class: `class` (the id), `label`, `counts_in_totals`, `own_intercept_rate`. |
| `model_classes.csv` | One row per raw `model` string: `model` (matched exactly), `class`, `components` (for combined rows, separated by `;`), `note`. |

Colors aren't here. #10 defines them once for the site.

After editing either file, or after a data refresh, run:

```powershell
uv run pipeline/audit/weapon_classes.py
```

It needs `data/raw/`. It fails if a raw string has no mapping or more than one, if a mapped string isn't in the daily file, if a class id is unknown, or if a combined row breaks the rules below. **If the owner changes a rule, change `expected_class` in that script too.**

### Rules for combined rows

A combined row is one count for several models. It's never split.

1. If every component is in one class, the row takes that class. For example, `X-22 and X-32` is anti-ship and other.
2. Except cruise: a row naming several cruise missiles goes to `mixed_cruise`, as plan §4 says. `X-101/X-555` and `X-59/X-69` stay in `cruise`, because §4 lists each pair as a cruise entry.
3. If the components are in different classes, the row goes to `mixed`.

`launched_details` gives a per-model breakdown of `launched` for a few rows, not always a complete one, and gives no breakdown of `destroyed`. The draft doesn't use it.

### What counts

| | Classes | Totals and massive-night threshold | Intercept rates |
|---|---|---|---|
| Attack classes | Shahed-type, cruise, mixed cruise, ballistic, aeroballistic and hypersonic, anti-ship and other | Counted | Own class rate, and any all-class rate |
| Mixed classes | `mixed` | Counted | No class rate. Included in any all-class rate. |
| Excluded | Reconnaissance, tactical and unidentified UAVs; bombs | **Not counted** | **Not included** |

Excluded rows should still be listed, with their row counts, on the Data & Methods page.

- **UAVs:** in 1,553 of the 1,561 excluded UAV rows, `destroyed` equals `launched`. That includes all 258 Lancet, Kub and Молнія rows. The pattern suggests they're logged because they were shot down, so they don't measure launches and would push intercept rates up.
- **Bombs:** the daily file has only 6 bomb rows (33 launched). We haven't checked how many glide bombs Russia uses, but these rows shouldn't be read as that figure, so the draft doesn't show them as a class.
- **Mixed rows leave out much of some missile classes.** Rows crossing classes that contain a ballistic missile hold 725 launched, against 980 in ballistic-only rows. For anti-ship and other it's 706 against 1,046, for aeroballistic and hypersonic 87 against 299, and for cruise 176 against 3,901. The same row counts under every class it contains. So **a class's monthly launches and intercept rate don't cover all launches of that kind**, and the A and B charts need to say so.

These figures use all rows as published, from Sept 28, 2022 to Nov 21, 2026. Hidden rows' `launched` = 0 is left in, and **missile counts from August 2026 are affected by the reporting restriction**. They aren't headline numbers. Any intercept rate built from `destroyed` needs the electronic-warfare caveat.

### Effect on the massive-night threshold

Provisional: nights keyed by end date, all source accounts, no removal of repeated reports. Which rows count as attacks is still open (plan §11).

| | Nights | Median | 95th percentile | Nights with 100+ |
|---|---|---|---|---|
| Counted classes only (draft) | 1,244 | 82 | 420.2 | 528 |
| Every class | 1,302 | 80 | 442.6 | 573 |

### Open choices

Each has a draft answer already applied in the CSVs.

1. **Keep `mixed_cruise` apart from `cruise`?** Draft: yes, following plan §4. It holds 1,522 launched, against 3,901 in `cruise`. Every component is a cruise missile, so merging the two would split nothing and would give a more complete cruise series. We suggest considering the merge.
2. **C-300 and C-400** (surface-to-air missiles listed among attacks; 112 single-class rows, 494 launched, 2 destroyed). Draft: anti-ship and other, which keeps `ballistic` to the missiles §4 names. The alternative is `ballistic`; rows that combine them with Iskander-M would then move from `mixed` to `ballistic` too. It would change the ballistic counts and intercept rate a lot.
3. **X-31, X-31P, X-31PD, X-35, X-35Y** (104 rows, 173 launched, 9 destroyed). §4 doesn't name them, and the reference file calls them cruise missiles (some anti-radiation). Draft: anti-ship and other.
4. **`Unknown Missile`** (26 rows, 90 launched). Draft: anti-ship and other, so it counts in totals without a new class. The label then has to be read as including unknown types. `Ballistic Missile` and `Intercontinental Ballistic Missile` are in `ballistic` as reported; we haven't verified the ICBM identifications.
5. **`Banderol` and `Banderol/Dan-T`** (25 rows, 149 launched). Draft: cruise, as the reference file says. We haven't checked what the weapon or `Dan-T` is beyond that. Some Shahed rows also have nested Banderol counts, and [we can't tell](../../docs/data-audit.md#decoys-and-jet-shaheds-a5) whether those are already in the Shahed total.
6. **`Geran` rows** (45 rows, 1,041 launched, all marked destroyed; all from the western command). Draft: Shahed-type, as the reference file groups Geran-4 and -5. We haven't independently checked that Geran-4 and -5 are Shahed-type. Their class is separate from whether the rows should count at all, since they may repeat national figures (open in plan §11, for #5 and #7). **The shoot-down-only pattern would justify leaving them out.**
7. **Lancet, Kub and Молнія** are attack drones, not reconnaissance. Draft: excluded with the other UAVs because of the shoot-down-only pattern. `Orion` and `Mohajer-6` follow the same rule.
8. **`Shahed-136/131 and Lancet`** (1 row, 16 launched, 10 destroyed) crosses a counted and an excluded class. Draft: `mixed`, so it counts.
9. **Class label for decoys.** The label keeps §4's "Shahed-type and decoy drones". Decoys are inside the counts but can't be separated; whether to reword it goes with the A5 question in plan §11.

## License

The `model` strings in `model_classes.csv` are copied from Petro Ivaniuk's [Massive Missile Attacks on Ukraine](https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine) dataset, and some notes quote its reference file. We added the class assignments, components and notes. To be safe, treat that file as adapted material under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); see the [data audit](../../docs/data-audit.md#license-and-redistribution).
