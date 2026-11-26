# Data audit

Phase 0 findings. The Kaggle section is from [#1](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/1). The alerts section comes with #2, and #5 condenses both into the one-page note.

## Kaggle: Massive Missile Attacks on Ukraine

Audited Nov 25, 2026. Dataset by Petro Ivaniuk: <https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine> (version 220, "updated 4 days ago" on the audit date; the page's total size matches our two files byte for byte to the precision it shows). The files inside the download are dated Nov 21, 2026, and the last report ends Nov 21 at 08:00. The page says updates are weekly.

Rerun the figures with:

```powershell
uv run pipeline/audit/kaggle.py
```

The exceptions are the license, the dataset's own column definitions (both read from the Kaggle page) and the [spot checks](#spot-checks-against-air-force-posts) (read by hand). Where this section says **national rows**, it means source account `kpszsu` (the Air Force) with `target` = `Ukraine`. That and the reconnaissance filter are audit shortcuts, not decisions about what the dashboard counts.

### Short answers

| Question | Answer |
|---|---|
| May processed data go in a public repo? | **Yes, with conditions** (CC BY-NC-SA 4.0). |
| Are decoys separated? | **No.** Decoys sit inside the `Shahed-136/131` counts. |
| Are jet drones separated? | **Partly:** a subset of those counts in `destroyed_types`, usable from about Aug 28, 2026. |
| How much ballistic data is missing after August 2026? | **The number of missiles can't be told.** 26 of 46 ballistic-capable rows from Aug 11 are `hidden`. |
| Can A3 (launch areas) be supported? | **Only as a list of areas**, not counts per area. |
| Can B2 (salvo mix) be supported? | **Yes, after rules are set** for grouping, overlaps and hidden or preliminary counts. |

### License and redistribution

The Kaggle page's License field reads **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)** (read on the page Nov 25, 2026, without signing in; the repo owner gave the same link on #1).

The license allows sharing the data and adaptations of it, so **processed data may go in a public repo** if:

- **Attribution:** name Petro Ivaniuk and the dataset, link to it and to the license, and say that we changed it.
- **NonCommercial:** the use isn't primarily for commercial advantage or payment. Free class use fits as planned. Revisit if that changes.
- **ShareAlike:** adapted material we share is also under CC BY-NC-SA 4.0. This should be treated as covering every processed file derived from Kaggle, including tables that join it with the MIT-licensed alerts data (keep the MIT notice too).
- No added legal or technical restrictions on those files.

This also applies to a deployed site, which distributes the processed data. It doesn't decide the code license, which is separate, or whether to make the repo public (both #26). Raw files stay uncommitted under the repo's own rules, although the license wouldn't forbid sharing them. This is a reading of the license terms, not legal advice.

### Schema

`missile_attacks_daily.csv`: 4,399 rows, 23 columns. A row is roughly one report × model × target.

| Column | Blank rows | Notes. "Page" means the definition on the Kaggle page, summarized. |
|---|---|---|
| `time_start`, `time_end` | 0, 0 | Attack window. See [dates](#dates-and-coverage). |
| `model` | 0 | 90 distinct strings. |
| `launch_place` | 2,049 | Page: city or region of launch. |
| `target` | 0 | City, oblast, direction (`south`) or `Ukraine`. 106 values. |
| `target_main` | 4,198 | No definition on the page. |
| `status_data` | 4,364 | The only value is `hidden` (35 rows). |
| `launched`, `destroyed` | 3, 6 | Page: blank means unknown. But see `hidden`. |
| `not_reach_goal` | 3,483 | Page: since July 2024; didn't reach the target, for mixed reasons (lost on radar, imitators, EW, faults, fuel). |
| `still_attacking` | 4,001 | Page: still attacking when results were published. |
| `under_review` | 4,394 | **No definition on the page.** |
| `num_hit_location`, `num_fall_fragment_location` | 3,848, 3,865 | Locations with hits, or with falling debris. |
| `is_shahed` | 4,160 | **No definition on the page.** See below. |
| `border_crossing` | 0 | A dict as text; `{}` in 98.5% of rows. |
| `carrier` | 4,078 | Launch platform. Free text, including both `Navy` and `Navi`. |
| `affected region` | 4,182 | A list as text. The page calls it `affected_region`. |
| `destroyed_types` | 4,294 | **No definition on the page.** A dict as text. See below. |
| `destroyed_details` | 3,355 | A dict as text. The page describes it as detail about the target. |
| `launched_details`, `launch_place_details` | 4,392, 4,392 | Per-weapon split for 7 combined rows only. |
| `source` | 0 | Mostly a partial Facebook post path; a few full Telegram links. |

The dict-like columns are Python-style text containing bare `NaN`, so they aren't valid JSON.

`missiles_and_uavs.csv`: 69 rows, 12 columns (`model`, `category`, `national_origin`, `type`, `launch_platform`, `name`, `name_NATO`, `in_sevice` [sic], `designer`, `manufacturer`, `guidance_system`, `unit_cost`). Only `model`, `category` and `national_origin` are complete or nearly so. `category` isn't a usable taxonomy: for example, it files Kinzhal as ballistic but the combined string `X-47 Kinzhal and Iskander-M/KN-23` as a cruise missile.

### Dates and coverage

- Rows run from **Sept 28, 2022** (`time_start`) to **Nov 21, 2026** (`time_end`). Nothing covers Feb 24 to Sept 27, 2022. "Since 2022" and "full period" figures must therefore say **since Sept 28, 2022**. They aren't totals for the full-scale invasion. The page's own description says "since October 2022".
- Both time columns come as `YYYY-MM-DD` and `YYYY-MM-DD HH:MM`, a few with a one-digit hour or a trailing space. 779 rows have a time on only one side. No window ends before it starts; 6 timed windows exceed 24 hours.
- 214 of 1,516 end dates (14.1%) have no row, most of them before 2024; the latest is Apr 12, 2026. **Can't tell** whether these were quiet days or missing reports.
- Rows per year grow from 528 (2023) to 1,348 (2024). Early coverage is thinner, and **we can't tell** how much of early growth is reporting practice.
- 3,086 rows start and end on one calendar date and 1,313 span two. Keying a night by its end date works for overnight rows.

### Model strings

- 90 distinct strings; **22 aren't in the reference file**; 5 contain Cyrillic. One reference entry (`X-32`) is never used alone.
- 39 strings combine weapons with "and" or a slash. Several mix ballistic, cruise, anti-ship or surface-to-air types (for example `C-400 and Iskander-M/KN-23 and 3M22 Zircon and P-800 Oniks`), so a mixed-cruise bucket can't hold them all. `Shahed-136/131 and Lancet` mixes drone types. Counts in a combined row **can't be split**, except for the 7 rows with `launched_details`. This is input for #3.
- **Reconnaissance, tactical and unknown UAVs** (Orlan-10, ZALA, Supercam, `Unknown UAV` and others) are 1,294 rows (29.4%) with 16,137 launched. In 1,286 of them (99.4%) `destroyed` equals `launched`. That pattern suggests they're logged because they were shot down. **They aren't a measure of launches**, and including them would inflate intercept rates. The plan's class list doesn't cover them.
- Across all rows, as published and unfiltered: 160,663 launched and 126,867 destroyed. Don't use these as headline numbers; see the overlaps, hidden rows and shoot-down-only rows below.

### Decoys and jet Shaheds (A5)

**`Shahed-136/131` is a catch-all.** The Air Force posts we checked count "Shahed-type strike UAVs, Gerbera, imitator drones" and other types as one figure, and that figure is `launched`. There's no decoy model string, column or key. **Decoy share can't be computed.**

- **`is_shahed`** (239 national Shahed rows, July 15, 2025 to May 3, 2026) is never above `launched`, and 237 of 239 values are multiples of 5. In two posts we checked, it equals an approximate "about N of them" figure: one says Shaheds, the other says strike UAVs. So it looks like **a rounded estimate of how many of the launched drones were Shahed or strike types**. The dataset doesn't define it. The remainder is **not** a decoy count: it can hold Gerbera, other types and decoys. Coverage is nearly complete only from October 2025 through April 2026 (September 2025 is 21 of 31 rows). The median ratio to `launched` is 0.625.
- **`destroyed_types`** appears only on `Shahed-136/131` rows. Its keys are `Turbojet` (82 rows), `Banderol` (22) and `Banderol/Dan-T` (9).
  - **`Turbojet`** is the jet-powered subset. The launched and destroyed values matched the posts' "N of them jet-powered" figures in all 12 reports checked. The subset never exceeds the row's `launched`. 63 rows also give jet `destroyed`; one has more destroyed than launched (Nov 5, 2026: 48 of 34).
  - A few rows appear in 2025 and January 2026. Regular reporting starts about Aug 28, 2026. National Shahed rows with a jet figure: September 16 of 36, October 33 of 34, November 26 of 26. Within rows that report it, jet drones are 35%, 42% and 42% of launched. **A blank is unknown, not zero.** Jet drones also include decoys or not: **can't tell.**
  - **`Banderol`** keys appear on 31 rows from Sept 28, 2025 to Oct 4, 2026, and 25 rows use Banderol as their own `model`. No window has both. **Can't tell** whether the nested Banderol counts are part of the Shahed `launched` or in addition to it. The page doesn't say what Banderol is counted under; the reference file calls it a cruise missile.
- **`not_reach_goal`** mixes several causes, including imitators. It isn't a decoy count.
- **`Geran-2/4/5`** rows are separate western-region reports (see [overlaps](#nights-repeats-and-overlaps)), not a national jet count.

**For A5:** a decoy share is not supported. A jet share is supported only as a short series from September 2026, with its coverage shown.

### Ballistic data after August 2026

What the dataset says: the page states that the Air Force **stopped reporting some missile counts since Aug 10, 2026**. It says `hidden` means launched and destroyed weren't published, and that if only `destroyed` was published, it's copied into `launched` as a minimum.

What the file does:

- 35 rows are `hidden`, on 26 end dates. The first ends **Aug 11, 2026** and the last Nov 20.
- **34 of them have `launched` = 0.** This is a placeholder, not zero launches. The pipeline must not sum it. These 34 are the only zeros in the column.
- 14 hidden rows have `destroyed` > 0 (55 in total). In those rows `launched` was **not** raised to match, contrary to the page.
- The remaining hidden row (Kalibr, Sept 17) has `launched` = 4. **Can't tell** whether that is a published figure.
- The restriction isn't only ballistic: hidden rows include Kalibr, Iskander-K, X-59/X-69, X-22/X-32 and Oniks.

| Rows ending Aug 11, 2026 or later | All rows: total / hidden / launched in other rows | National rows: total / hidden / launched in other rows |
|---|---|---|
| Ballistic-capable (Iskander-M, KN-23, Kinzhal, Zircon, C-300, C-400, "Ballistic") | 46 / 26 / 71 | 19 / 10 / 52 |
| Any missile | 118 / 35 / 547 | 52 / 16 / 451 |

Published launches in ballistic-capable rows averaged about 90 a month from August 2025 through July 2026 (range 33 to 153). They were 13 in September 2026, 47 in October and 5 in November 1–21. **This difference is not an estimate of what's missing,** because attack levels may have changed too. The audit filter includes combined rows that also hold non-ballistic weapons. Some missiles may have no row at all, and numbered rows after the restriction may be incomplete. **Can't tell.**

**Consequence:** the flag required by `AGENTS.md` rule 3 says "after Aug 12, 2026". Hidden rows already exist on Aug 11 and 12, and the dataset page says Aug 10. The right start date is an open question in [plan §11](plan.md#11-decisions).

### Counts: blank and inconsistent

- Blank `launched`: 3 rows (February 2024). Blank `destroyed`: 6 rows (February 2025).
- All values are non-negative whole numbers.
- `destroyed` > `launched` in 15 rows. 14 are hidden rows. The other is `Shahed-136/131` ending Nov 3, 2026 19:00, with 81 launched and 139 destroyed. Its jet figures are 62 launched and 56 destroyed. **Can't tell** which figure is wrong without its source post.
- One checked report disagrees with its current post: see Nov 12 in the spot checks.
- **Counts can be preliminary.** The Nov 17 post gave results as of 12:00 and said cruise-missile and 60 drone outcomes were still being clarified. **Can't tell** which rows were later revised.
- "Destroyed" includes drones **suppressed**, meaning lost to electronic warfare (the posts say "shot down/suppressed"). So `launched − destroyed` is not a count of hits.

### Nights, repeats and overlaps

Source accounts: `kpszsu` (Air Force) 2,510 rows; `PvKPivden` (Air Command South) 1,629; `pvkshid` (East) 174; `PvkZahid` (West) 55; others 31. National rows are 1,854 rows (42.1%) with **85.0%** of all launched.

- **No exact duplicate rows.** 106 rows share start, end and model, mostly with different targets. 14 also share `launch_place` and `target`. These are small Orlan-10, ZALA, Supercam and Iskander-M counts. **Can't tell** whether they're repeats.
- **Regional reports may repeat national counts.** All 45 `Geran` rows come from the western command (target `west`, from Sept 30, 2026), and 40 have exactly the same window as a national Shahed row. They add 1,041 launched, all marked destroyed. Likewise, 10 of the 21 southern-command Shahed rows share an end date with a national Shahed row. **Can't tell** from the file whether these drones are already in the national figures. It seems likely for same-window rows, so adding them risks double counting and raises intercept rates.
- **More than one national report per date.** 107 end dates have two or more distinct national windows, and 33 have two or more national Shahed rows. The Air Force also publishes daytime reports (about 06:30–19:00), in late 2026 sometimes several days running: 30 windows match the audit's daytime filter, 5 of them in November 2026. Keying only by end date would merge a daytime attack with the night before it.
- **National windows overlap.** 37 pairs of same-model national windows overlap, usually a daytime window against the night before or after, by an hour or two. The Nov 10 posts state these windows themselves. **Can't tell** whether any drone is counted twice.
- A row's date alone can't identify one "report": `source` has 2,306 distinct values, and combining by window needs the rules above.

**Sensitivity for #5** (provisional: nights keyed by end date, reconnaissance and unknown UAVs removed, hidden zeros left in, combined rows counted once):

| | All remaining rows | National rows only |
|---|---|---|
| Nights with rows | 1,267 | 1,059 |
| Median / 95th percentile launched | 80 / 421 | 98 / 450 |
| Nights with 100+ launched | 537 | 522 |
| of which 2024 / 2025 / 2026 | 29 / 220 / 284 | 26 / 214 / 279 |
| 95th percentile in 2023 / 2024 / 2025 / 2026 | 51 / 116 / 503 / 552 | 49 / 132 / 508 / 546 |

A fixed threshold of 100 would mark most 2026 nights as "massive". One all-period percentile would select almost only 2025–26 nights. #5 should weigh this.

### A3: launch areas

- `launch_place` is filled in 53.4% of all rows, covering 83.3% of launched. For national rows it's 88.6% of rows. For 2026 national rows it covers 91.8% of launched.
- But **rows listing several places hold 78.7% of all launched** (90.7% for 2026 national rows). Their counts can't be divided among the places. `launch_place_details` splits only 7 rows.
- There are 71 distinct place tokens after splitting on " and ", mixing cities, oblasts, seas and directions. Splitting on " and " is itself only a heuristic.
- `carrier` is filled in 7.3% of rows.

**Supported:** listing the launch areas reported for a night or a row. **Not supported:** launches by area, or area shares. The same limit applies to A3's breakdown by class for combined rows.

### B2: salvo size and mix

Possible from `launched` and `destroyed` by night and model, if the pipeline first settles: which source accounts count, how to treat reconnaissance rows, daytime windows and combined rows, and hidden zeros. From Aug 11, 2026, a night's total and mix **omit restricted missiles**, so saturation points after that date need the flag and may not be comparable.

### Preliminary notes in `AGENTS.md`

| Note | Result |
|---|---|
| Reference file is `missiles_and_uavs.csv` | Confirmed. |
| Spans Sept 28, 2022 to Nov 21, 2026 | Confirmed. |
| 90 model strings, 22 not in the reference, some Cyrillic | Confirmed (5 contain Cyrillic). |
| Many reconnaissance or tactical UAV rows | Confirmed: 29.4% of rows. |
| Combined entries mix types | Confirmed. |
| Times with and without time of day | Confirmed. |
| Read as UTF-8 | Needed. The audit script sets it for input and output. |

### Spot checks against Air Force posts

Read by hand on Nov 25, 2026 from the Air Force's public Telegram channel. This is a small sample, mostly November 2026, and checks the dataset against its source, not whether the source is right. Posts can be edited after the dataset records them.

**Jet subset and totals** (`launched` / jet launched; `destroyed` / jet destroyed):

| Report (2026) | Post | Result |
|---|---|---|
| Night to Nov 8 | [94139](https://t.me/kpszsu/94139) | Match |
| Night to Nov 9 | [94425](https://t.me/kpszsu/94425) | Match |
| Night to Nov 10 | [94783](https://t.me/kpszsu/94783) | Match |
| Day, Nov 10 | [94898](https://t.me/kpszsu/94898) | Match |
| Night to Nov 11 | [95044](https://t.me/kpszsu/95044) | Match |
| Night to Nov 12 | [95391](https://t.me/kpszsu/95391) | Launched and both jet figures match. **`destroyed` is 73 in the file; the post, marked edited, says 89.** |
| Day, Nov 12 | [95558](https://t.me/kpszsu/95558) | Match |
| Night to Nov 13 | [95714](https://t.me/kpszsu/95714) | Match |
| Night to Nov 14 | [95898](https://t.me/kpszsu/95898) | Match |
| Night to Nov 15 | [96207](https://t.me/kpszsu/96207) | Match |
| Night to Nov 16 | [96507](https://t.me/kpszsu/96507) | Match |
| Night to Nov 17 | [96916](https://t.me/kpszsu/96916) | Match (preliminary as of 12:00) |

The Nov 12 night post also names ballistic missiles without giving a count, and the file has a `hidden` row with 0 for that night.

**`is_shahed`:** [60825](https://t.me/kpszsu/60825) (night to Apr 27, 2026): 94 launched, "about 60 of them Shaheds"; the file has 94 and 60. [44624](https://t.me/kpszsu/44624) (night to Oct 13, 2025): 82 launched, "about 50 of them strike UAVs"; the file has 82 and 50.

### Not checked

- The page's Discussion tab and the linked data overview and notebooks.
- Any Facebook source link, or any regional-command post.
- Whether totals agree with CSIS or MDAA.
- Whether the Air Force's figures are accurate. They're reported figures, not independently verified.
