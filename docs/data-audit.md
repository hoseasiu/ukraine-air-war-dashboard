# Data audit

What the data can and can't support, and the definitions the dashboard uses. This closes Phase 0 ([#5](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/5)). The summary comes first; the [appendix](#appendix) has the evidence.

**On Nov 25, 2026 the owner chose the definitions below and signed off on the [weapon classes](../data/reference/README.md#weapon-classes).** The verdicts, and the details marked *agent's detail*, are the coding agent's.

## Sources at a glance

| | Strikes: [Kaggle](#kaggle-massive-missile-attacks-on-ukraine) | Alerts: [air-raid sirens](#alerts-ukrainian-air-raid-sirens-dataset) |
|---|---|---|
| Used for | A, B, E3 | E |
| Covers | Sept 28, 2022 to Nov 21, 2026. Say **"since Sept 28, 2022"**, not "since 2022" or "full period". | April 2022 to July 2026. The official file stops Sept 7, 2026. |
| License | CC BY-NC-SA 4.0 | MIT |
| Biggest limits | Reported, unverified figures. "Destroyed" **includes drones lost to electronic warfare**. Shahed-type counts include decoys. Some missile counts are unpublished from Aug 11, 2026. | Raion alerting phased in during 2025, so later months are only partly comparable. Luhansk and Crimea are excluded. No yellow or red levels. |

## What each question can support

**Yes** means answerable with the stated caveats. **Partly** means only a narrower version is. Every launch figure from Aug 11, 2026 needs the restriction flag, and every intercept figure the EW caveat.

| Question | Verdict | It can show | It can't show |
|---|---|---|---|
| **A1** Monthly launches by class | **Yes** | Reported launches by class by month since Sept 28, 2022. | Anything earlier. All launches of a kind: [mixed rows](../data/reference/README.md#what-counts) hold many missiles. How much early growth is [reporting practice](#dates-and-coverage). Complete missile counts after the restriction. |
| **A2** Bigger or more frequent salvos; massive nights | **Yes** | Night sizes and how many nights have reports, by year. The median night was 20 weapons in 2023, 30 in 2024, 112 in 2025 and 149 in 2026 to Nov 21. | Individual waves: a size is a total for a reporting window. A trend in *how often* massive nights happen, since the definition marks about 5% of every year. |
| **A3** What a massive strike consists of | **Partly** | A night's launches by class, with a "mixed" part (11.5% of non-Shahed launches on massive nights). A list of reported launch areas. | Counts [by launch area](#a3-launch-areas). Models or classes inside mixed rows. Decoys. |
| **A4** Rhythm | **Partly** | Day of week (by the night's end date), gaps between massive nights, and a calendar view. Descriptive only. | Whether a date with no night was quiet or unreported (323 of 1,516 dates, 313 of them before 2025). A firm seasonal pattern from about four winters. Gaps aren't comparable between years as a measure of size. |
| **A5** Decoy and jet-drone share | **No. Dropped from v1.** | Nothing charted. Data & Methods can say why. | A decoy share at all. A jet share before late Aug 2026, and since then only where [reports give it](#decoys-and-jet-shaheds-a5) (16 of 36 national Shahed rows in September). |
| **B1** Intercept rate over time | **Yes, with gaps** | Monthly reported rates for Shahed-type through the snapshot, and for missile classes through July 2026. Months with at least 10 eligible launches: cruise 46, anti-ship and other 29, ballistic 27, aeroballistic 13. | Hits or damage. Rates for mixed rows. Missile rates from Aug 2026. Verified performance. |
| **B2** Saturation | **Partly** | Night size against the number *not reported destroyed*, and the class mix, as a pattern. | That size or mix *caused* anything. That the remainder got through: it can include decoys, still-flying or unresolved weapons, and losses to other causes. Complete mixes after the restriction. |
| **B3** Around notable events | **Partly** | Reported rates before and after an [annotated event](../data/reference/annotations.md), described neutrally. | Cause. The March 2025 aid pause lasted about eight days, which monthly rates can't isolate. Aeroballistic rates around it: none from January to May 2025 reaches the minimum. |
| **E1** Alert hours by oblast and month | **Yes** | Hours for the average raion, 24 areas, April 2022 to July 2026. | Later months. Luhansk and Crimea. That the whole oblast was under alert. Like-for-like change [across 2025](#roll-up-rule). Drone and missile alerts apart. |
| **E2** Three oblasts side by side | **Yes** | The same monthly and daily series for any three of the 24 areas. | What residents heard or did. Which three to compare is still [open](plan.md#11-decisions). |
| **E3** Launches against alert hours | **Partly** | Both series over 46 shared full months, Oct 2022 to July 2026. | An effect of launches on alert hours: alerting practice changed in 2025, strike figures are national, and alerts have causes this data doesn't separate. |

## Definitions

### Which rows count

- **Classes:** Shahed-type and decoy, cruise, ballistic, aeroballistic and hypersonic, anti-ship and other, and mixed. Reconnaissance, tactical and unidentified UAVs and bombs are excluded ([rules](../data/reference/README.md#what-counts)).
- **Reports:** only national military ones. *Agent's detail:* the source accounts `kpszsu` (Air Force), `CinCAFU` and `GeneralStaff.ua`, with any `target`. Regional-command and other rows are left out because they may repeat national figures. This leaves out 1,954 launches, 1,041 of them in `Geran` rows.
- **Attack night:** the reports ending on one Kyiv date, **without daytime reports**. Daytime reports count in monthly totals but not in a night's size or the massive test, so nights don't add up to monthly totals. *Agent's detail:* a daytime report starts from 05:00 to 12:59 and ends from 15:00 the same day. There are 50 such rows, with 6,804 launches, 6,583 of them in 2026.
- **Unpublished and blank counts are unknown, never zero.** *Agent's detail:* both counts of a `hidden` row are left out of every sum, including the 55 "destroyed" that 14 of them publish and the one nonzero `launched`. Data & Methods should say so. The one other row with `destroyed` above `launched` keeps its launches in totals and is left out of destroyed sums and rates.
- **Restriction flag:** every night, month or total that reaches **Aug 11, 2026** or later. It's a *missile*-reporting restriction: it covers ballistic, cruise and anti-ship missiles.

### Massive night

> **A massive night had more weapons launched than 95% of the attack nights in the same calendar year.**

| Year | 2022 (from Sept 28) | 2023 | 2024 | 2025 | 2026 (to Nov 21) |
|---|---|---|---|---|---|
| Massive means more than | 97 | 52.1 | 127.5 | 506.1 | 446.7 |
| Massive nights | 2 | 10 | 15 | 18 | 17 |

*Agent's detail:* "more than" the year's 95th percentile of night totals, with linear interpolation. The pipeline computes it; these numbers aren't to be typed into the site.

Wherever it's shown, say that **the bar differs by year** and give that year's bar. "Massive" in 2023 can be far smaller than an ordinary night in 2026. **Don't chart massive nights per year as a trend.** The 2026 bar can still move at the final refresh (#28). Why this definition, and what the others select, is in [Appendix C](#massive-night-options).

### Intercept rate

> **Reported destroyed ÷ reported launched, for one class in one month.**

- Add up both counts, then divide. Use every counted national report, daytime ones included.
- Leave out rows that are `hidden`, have a blank count, or report more destroyed than launched.
- **Fewer than 10 eligible launches** in a class-month: show a gap, not zero.
- **No missile-class rate from August 2026 on** (cruise, ballistic, aeroballistic and hypersonic, anti-ship and other). The whole of August is a gap. [Why](#intercept-rate-evidence).
- No class rate for mixed rows. Excluded classes are in no rate.
- Every chart that uses it carries the EW caveat.

The owner later chose to compute any **all-class** share through July 31, 2026 and say so (#9), and to keep later nights in B2, flagged, noted and marked apart (#16; [plan §11](plan.md#11-decisions)).

### Other decisions

- Guided stop 1 shows alert hours as a **mean per area** (23 oblasts and Kyiv city), not a national sum.
- Alert figures use the [roll-up rule](#roll-up-rule) and end at July 2026.

## Appendix

- **A.** [Kaggle strike data](#kaggle-massive-missile-attacks-on-ukraine) (#1)
- **B.** [Alerts data](#alerts-ukrainian-air-raid-sirens-dataset) (#2)
- **C.** [Definitions evidence](#definitions-evidence) (#5)

Appendices A and B are the audits as run, before the definitions were chosen, so their own filters and counts can differ from the rules above.

### Kaggle: Massive Missile Attacks on Ukraine

Audited Nov 25, 2026. Dataset by Petro Ivaniuk: <https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine> (version 220, "updated 4 days ago" on the audit date; the page's total size matches our two files byte for byte to the precision it shows). The files inside the download are dated Nov 21, 2026, and the last report ends Nov 21 at 08:00. The page says updates are weekly.

Rerun the figures with:

```powershell
uv run pipeline/audit/kaggle.py
```

The exceptions are the license, the dataset's own column definitions (both read from the Kaggle page) and the [spot checks](#spot-checks-against-air-force-posts) (read by hand). Where this section says **national rows**, it means source account `kpszsu` (the Air Force) with `target` = `Ukraine`. That and the reconnaissance filter are audit shortcuts, not decisions about what the dashboard counts.

#### Short answers

| Question | Answer |
|---|---|
| May processed data go in a public repo? | **Yes, with conditions** (CC BY-NC-SA 4.0). |
| Are decoys separated? | **No.** Decoys sit inside the `Shahed-136/131` counts. |
| Are jet drones separated? | **Partly:** a subset of those counts in `destroyed_types`, usable from about Aug 28, 2026. |
| How much ballistic data is missing after August 2026? | **The number of missiles can't be told.** 26 of 46 ballistic-capable rows from Aug 11 are `hidden`. |
| Can A3 (launch areas) be supported? | **Only as a list of areas**, not counts per area. |
| Can B2 (salvo mix) be supported? | **Yes, after rules are set** for grouping, overlaps and hidden or preliminary counts. |

#### License and redistribution

The Kaggle page's License field reads **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)** (read on the page Nov 25, 2026, without signing in; the repo owner gave the same link on #1).

The license allows sharing the data and adaptations of it, so **processed data may go in a public repo** if:

- **Attribution:** name Petro Ivaniuk and the dataset, link to it and to the license, and say that we changed it.
- **NonCommercial:** the use isn't primarily for commercial advantage or payment. Free class use fits as planned. Revisit if that changes.
- **ShareAlike:** adapted material we share is also under CC BY-NC-SA 4.0. This should be treated as covering every processed file derived from Kaggle, including tables that join it with the MIT-licensed alerts data (keep the MIT notice too).
- No added legal or technical restrictions on those files.

This also applies to a deployed site, which distributes the processed data. It doesn't decide the code license, which is separate, or whether to make the repo public (both #26). Raw files stay uncommitted under the repo's own rules, although the license wouldn't forbid sharing them. This is a reading of the license terms, not legal advice.

#### Schema

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

#### Dates and coverage

- Rows run from **Sept 28, 2022** (`time_start`) to **Nov 21, 2026** (`time_end`). Nothing covers Feb 24 to Sept 27, 2022. "Since 2022" and "full period" figures must therefore say **since Sept 28, 2022**. They aren't totals for the full-scale invasion. The page's own description says "since October 2022".
- Both time columns come as `YYYY-MM-DD` and `YYYY-MM-DD HH:MM`, a few with a one-digit hour or a trailing space. 779 rows have a time on only one side. No window ends before it starts; 6 timed windows exceed 24 hours.
- 214 of 1,516 end dates (14.1%) have no row, most of them before 2024; the latest is Apr 12, 2026. **Can't tell** whether these were quiet days or missing reports.
- Rows per year grow from 528 (2023) to 1,348 (2024). Early coverage is thinner, and **we can't tell** how much of early growth is reporting practice.
- 3,086 rows start and end on one calendar date and 1,313 span two. Keying a night by its end date works for overnight rows.

#### Model strings

- 90 distinct strings; **22 aren't in the reference file**; 5 contain Cyrillic. One reference entry (`X-32`) is never used alone.
- 39 strings combine weapons with "and" or a slash. Several mix ballistic, cruise, anti-ship or surface-to-air types (for example `C-400 and Iskander-M/KN-23 and 3M22 Zircon and P-800 Oniks`), so a mixed-cruise bucket can't hold them all. `Shahed-136/131 and Lancet` mixes drone types. Counts in a combined row **can't be split**, except for the 7 rows with `launched_details`. This is input for #3.
- **Reconnaissance, tactical and unknown UAVs** (Orlan-10, ZALA, Supercam, `Unknown UAV` and others) are 1,294 rows (29.4%) with 16,137 launched. In 1,286 of them (99.4%) `destroyed` equals `launched`. That pattern suggests they're logged because they were shot down. **They aren't a measure of launches**, and including them would inflate intercept rates. The plan's class list doesn't cover them.
- Across all rows, as published and unfiltered: 160,663 launched and 126,867 destroyed. Don't use these as headline numbers; see the overlaps, hidden rows and shoot-down-only rows below.

#### Decoys and jet Shaheds (A5)

**`Shahed-136/131` is a catch-all.** The Air Force posts we checked count "Shahed-type strike UAVs, Gerbera, imitator drones" and other types as one figure, and that figure is `launched`. There's no decoy model string, column or key. **Decoy share can't be computed.**

- **`is_shahed`** (239 national Shahed rows, July 15, 2025 to May 3, 2026) is never above `launched`, and 237 of 239 values are multiples of 5. In two posts we checked, it equals an approximate "about N of them" figure: one says Shaheds, the other says strike UAVs. So it looks like **a rounded estimate of how many of the launched drones were Shahed or strike types**. The dataset doesn't define it. The remainder is **not** a decoy count: it can hold Gerbera, other types and decoys. Coverage is nearly complete only from October 2025 through April 2026 (September 2025 is 21 of 31 rows). The median ratio to `launched` is 0.625.
- **`destroyed_types`** appears only on `Shahed-136/131` rows. Its keys are `Turbojet` (82 rows), `Banderol` (22) and `Banderol/Dan-T` (9).
  - **`Turbojet`** is the jet-powered subset. The launched and destroyed values matched the posts' "N of them jet-powered" figures in all 12 reports checked. The subset never exceeds the row's `launched`. 63 rows also give jet `destroyed`; one has more destroyed than launched (Nov 5, 2026: 48 of 34).
  - A few rows appear in 2025 and January 2026. Regular reporting starts about Aug 28, 2026. National Shahed rows with a jet figure: September 16 of 36, October 33 of 34, November 26 of 26. Within rows that report it, jet drones are 35%, 42% and 42% of launched. **A blank is unknown, not zero.** Jet drones also include decoys or not: **can't tell.**
  - **`Banderol`** keys appear on 31 rows from Sept 28, 2025 to Oct 4, 2026, and 25 rows use Banderol as their own `model`. No window has both. **Can't tell** whether the nested Banderol counts are part of the Shahed `launched` or in addition to it. The page doesn't say what Banderol is counted under; the reference file calls it a cruise missile.
- **`not_reach_goal`** mixes several causes, including imitators. It isn't a decoy count.
- **`Geran-2/4/5`** rows are separate western-region reports (see [overlaps](#nights-repeats-and-overlaps)), not a national jet count.

**For A5:** a decoy share is not supported. A jet share is supported only as a short series from September 2026, with its coverage shown. The owner [dropped A5 from v1](#what-each-question-can-support).

#### Ballistic data after August 2026

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

**Consequence:** the flag required by `AGENTS.md` rule 3 says "after Aug 12, 2026". Hidden rows already exist on Aug 11 and 12, and the dataset page says Aug 10. The owner later chose to flag from Aug 11 ([restriction flag](#which-rows-count)).

#### Counts: blank and inconsistent

- Blank `launched`: 3 rows (February 2024). Blank `destroyed`: 6 rows (February 2025).
- All values are non-negative whole numbers.
- `destroyed` > `launched` in 15 rows. 14 are hidden rows. The other is `Shahed-136/131` ending Nov 3, 2026 19:00, with 81 launched and 139 destroyed. Its jet figures are 62 launched and 56 destroyed. **Can't tell** which figure is wrong without its source post.
- One checked report disagrees with its current post: see Nov 12 in the spot checks.
- **Counts can be preliminary.** The Nov 17 post gave results as of 12:00 and said cruise-missile and 60 drone outcomes were still being clarified. **Can't tell** which rows were later revised.
- "Destroyed" includes drones **suppressed**, meaning lost to electronic warfare (the posts say "shot down/suppressed"). So `launched − destroyed` is not a count of hits.

#### Nights, repeats and overlaps

Source accounts: `kpszsu` (Air Force) 2,510 rows; `PvKPivden` (Air Command South) 1,629; `pvkshid` (East) 174; `PvkZahid` (West) 55; others 31. National rows are 1,854 rows (42.1%) with **85.0%** of all launched.

- **No exact duplicate rows.** 106 rows share start, end and model, mostly with different targets. 14 also share `launch_place` and `target`. These are small Orlan-10, ZALA, Supercam and Iskander-M counts. **Can't tell** whether they're repeats.
- **Regional reports may repeat national counts.** All 45 `Geran` rows come from the western command (target `west`, from Sept 30, 2026), and 40 have exactly the same window as a national Shahed row. They add 1,041 launched, all marked destroyed. Likewise, 10 of the 21 southern-command Shahed rows share an end date with a national Shahed row. **Can't tell** from the file whether these drones are already in the national figures. It seems likely for same-window rows, so adding them risks double counting and raises intercept rates.
- **More than one national report per date.** 107 end dates have two or more distinct national windows, and 33 have two or more national Shahed rows. The Air Force also publishes daytime reports (about 06:30–19:00), in late 2026 sometimes several days running: 30 windows match the audit's daytime filter, 5 of them in November 2026. Keying only by end date would merge a daytime attack with the night before it.
- **National windows overlap.** 37 pairs of same-model national windows overlap, usually a daytime window against the night before or after, by an hour or two. The Nov 10 posts state these windows themselves. **Can't tell** whether any drone is counted twice.
- A row's date alone can't identify one "report": `source` has 2,306 distinct values, and combining by window needs the rules above.

**Early sensitivity check** (provisional: nights keyed by end date, reconnaissance and unknown UAVs removed, hidden zeros left in, combined rows counted once):

| | All remaining rows | National rows only |
|---|---|---|
| Nights with rows | 1,267 | 1,059 |
| Median / 95th percentile launched | 80 / 421 | 98 / 450 |
| Nights with 100+ launched | 537 | 522 |
| of which 2024 / 2025 / 2026 | 29 / 220 / 284 | 26 / 214 / 279 |
| 95th percentile in 2023 / 2024 / 2025 / 2026 | 51 / 116 / 503 / 552 | 49 / 132 / 508 / 546 |

A fixed threshold of 100 would mark most 2026 nights as "massive". One all-period percentile would select almost only 2025–26 nights. [Appendix C](#massive-night-options) weighs this.

#### A3: launch areas

- `launch_place` is filled in 53.4% of all rows, covering 83.3% of launched. For national rows it's 88.6% of rows. For 2026 national rows it covers 91.8% of launched.
- But **rows listing several places hold 78.7% of all launched** (90.7% for 2026 national rows). Their counts can't be divided among the places. `launch_place_details` splits only 7 rows.
- There are 71 distinct place tokens after splitting on " and ", mixing cities, oblasts, seas and directions. Splitting on " and " is itself only a heuristic.
- `carrier` is filled in 7.3% of rows.

**Supported:** listing the launch areas reported for a night or a row. **Not supported:** launches by area, or area shares. The same limit applies to A3's breakdown by class for combined rows.

#### B2: salvo size and mix

Possible from `launched` and `destroyed` by night and model, given [rules](#which-rows-count) for: which source accounts count, how to treat reconnaissance rows, daytime windows and combined rows, and hidden zeros. From Aug 11, 2026, a night's total and mix **omit restricted missiles**, so saturation points after that date need the flag and may not be comparable.

#### Preliminary notes in `AGENTS.md`

| Note | Result |
|---|---|
| Reference file is `missiles_and_uavs.csv` | Confirmed. |
| Spans Sept 28, 2022 to Nov 21, 2026 | Confirmed. |
| 90 model strings, 22 not in the reference, some Cyrillic | Confirmed (5 contain Cyrillic). |
| Many reconnaissance or tactical UAV rows | Confirmed: 29.4% of rows. |
| Combined entries mix types | Confirmed. |
| Times with and without time of day | Confirmed. |
| Read as UTF-8 | Needed. The audit script sets it for input and output. |

#### Spot checks against Air Force posts

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

#### Not checked

- The page's Discussion tab and the linked data overview and notebooks.
- Any Facebook source link, or any regional-command post.
- Whether totals agree with CSIS or MDAA.
- Whether the Air Force's figures are accurate. They're reported figures, not independently verified.

### Alerts: Ukrainian air-raid sirens dataset

Audited Nov 25, 2026. Dataset by Vadym Klymenko: <https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset>, at commit [`1a349789e45d63a19c8faf46d0e5877cbb36ac8b`](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset/commit/1a349789e45d63a19c8faf46d0e5877cbb36ac8b) (committed 2026-11-25 07:40 UTC). File hashes and download commands are in [data/README.md](../data/README.md#air-raid-sirens).

Rerun the figures with:

```powershell
uv run pipeline/audit/alerts.py
```

The script doesn't cover the license, the upstream code and documentation, the upstream issues, the channel page or the reports on alert levels. Those were read by hand. Months are Kyiv-time calendar months. Unless stated otherwise, a **national** figure is the **unweighted mean over 24 areas** (23 oblasts and Kyiv city, without Luhansk and Crimea), in **hours per area per month**.

#### Short answers

| Question | Answer |
|---|---|
| License | **MIT** for the repository. |
| Timestamps | **UTC.** |
| Does the official file reach the present? | **No.** Its last alert starts **Sept 7, 2026**. It also has a hole from Aug 29 to Sept 2. |
| Anything else wrong with the official file? | **113,845 exact duplicate rows**, all starting before Jan 26, 2026. |
| How should raion alerts roll up? | **Average the raions** ([rule](#roll-up-rule), accepted by the owner). It changes nothing in 2023–24, but months after the switch still aren't like-for-like. |
| Which file for which period? | Alert figures **end at July 2026** (owner's decision). Proposed: **official file from April 2022**. Don't splice the volunteer file onto it ([source choice](#proposed-source-choice)). |
| How much is `naive=True`? | **5.1% of volunteer rows**, and 1.1–4.7% of volunteer hours by year. |
| Permanent alerts | **Confirmed not listed** for Crimea or Luhansk. |
| Yellow and red levels | **Not in the data.** |

#### Alerts license

The repository's `LICENSE` is MIT, "Copyright (c) 2022 Vadym Klymenko". Processed files made from it need that copyright and permission notice. Files that also use Kaggle data are covered by [CC BY-NC-SA 4.0](#license-and-redistribution) as well.

The upstream code reads the official file from the channel `air_alert_ua` and the volunteer file from `UkraineAlarmSignal`. The upstream README credits eTryvoga for the volunteer data. **Can't tell** what terms those sources set; the MIT file doesn't mention them. This is a note for #26, not legal advice.

#### Files and coverage

| | `official_data_en.csv` | `volunteer_data_en.csv` |
|---|---|---|
| Columns | `oblast`, `raion`, `hromada`, `level`, `started_at`, `finished_at`, `source` | `region`, `started_at`, `finished_at`, `naive` |
| Rows | 299,275 (185,430 distinct) | 124,468 |
| First start (UTC) | 2022-03-15 16:10 | 2022-02-25 16:36 |
| Last start (UTC) | **2026-09-07 05:28** | 2026-11-25 07:04 |
| Spatial level | `oblast`, `raion` or `hromada` | Oblast and Kyiv city only |
| Areas named | 25 (24 plus Luhansk) | 25 (24 plus Luhansk) |

- `raion` and `hromada` are blank where the level doesn't need them. `source` is always `official`. `level` is the **administrative level**, not a threat level.
- **UTC:** every timestamp carries `+00:00`, and the upstream README says UTC. Matching each official oblast-level start to the nearest volunteer start in the same area, the median difference is 27 s in November–March and 22 s in April–October, so the files agree across the clock change. About 77–81% of matches are within 5 minutes.
- No negative durations. 4 official rows (before removing copies) and 8 volunteer rows last zero seconds.
- Neither file is sorted by start time.
- Partial months: March 2022 (official), February 2022 and November 2026 (volunteer).

##### Duplicate rows

113,845 official rows appear **exactly twice**. Every row starting from March 2022 through December 2024 has a copy, nearly every row in 2025 does, and the last copied row starts **Jan 25, 2026**. **Can't tell** why. The upstream code appends to the existing file, so a repeated run is one possible cause.

The pipeline must drop exact duplicates before counting or adding durations. A union of intervals isn't affected, but row counts and summed hours are. After removing them, no two rows for the same oblast, raion, hromada and level overlap. The volunteer file has no exact duplicates and no same-region overlaps.

##### Missing intervals

- **Official, Aug 29 to Sept 2, 2026:** no alert starts for 105 hours (Aug 29 04:55 to Sept 2 13:48 UTC), with none at all on Aug 30, Aug 31 or Sept 1. The volunteer file has 161–180 starts on each of those days. Between Aug 29 05:00 and Sept 2 13:00, 43 official rows are active at some point, against 741 volunteer rows. **August 2026 is therefore incomplete in the official file.**
- The official file has one other gap over 18 hours between starts anywhere: 19 hours on Apr 19–20, 2025. The volunteer file has no such gap then. **Can't tell** whether official alerts are missing.
- The volunteer file has one gap over 18 hours: 22 hours on Oct 22–23, 2022.
- This check only finds gaps across the whole country. **It can't detect missing alerts in a single area.**

##### Why the official file stops on Sept 7

Upstream issues [#6](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset/issues/6) and [#7](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset/issues/7) report it. Neither had a reply on Nov 25. #7 suggests that the new alert levels changed the message format, so the parser no longer matches.

What we saw may point elsewhere. On the channel's [public web page](https://t.me/s/air_alert_ua) (read Nov 25), alert posts run to message 338380 (Sept 7, 06:09 UTC). The next, 338381, is dated **Nov 1** and is about unauthorized access to the official app. The later posts, up to 338388 (Nov 19), are app notices or show no alert text. The upstream parser's saved position is 338388, the newest post. So **it appears the channel stopped posting alerts there**, leaving the parser nothing new to read. **Can't tell** why, whether alerts are now published somewhere else, or whether the official file will resume or be backfilled.

The upstream README says both files will be updated daily. On the audit date the official file wasn't.

##### Assumed end times in the official file

The official file has **no flag** for these. In the upstream code, if a new alert for a place arrives more than 3 hours after an unfinished one, the old one gets an end **1 hour** after its start. 255 distinct rows last exactly 3,600 s (148 of them in 2026). Some could be real hour-long alerts, so this isn't a count of assumed ends. If the new start arrives within 3 hours, it replaces the unfinished one, and the earlier start is lost.

##### Very long alerts

Some official rows last weeks or months. The longest are for Lypetska hromada (604 days) and Vovchanska hromada (439 days), both in Kharkiv oblast. Several for hromadas in Nikopol raion (Dnipropetrovsk oblast) last 8–26 days. 396 hromada, 488 raion and 13 oblast rows exceed 24 hours. **Can't tell** which reflect a standing threat and which a missing end message.

#### The raion switch

Raion alerting didn't begin in December 2025. It phased in during 2025:

| Distinct official rows by start month | `oblast` | `raion` | `hromada` |
|---|---|---|---|
| 2024-12 | 1,421 | 1 | 282 |
| 2025-01 | 1,642 | 154 | 235 |
| 2025-05 | 1,352 | 317 | 596 |
| 2025-08 | 1,117 | 2,437 | 631 |
| 2025-10 | 715 | 3,498 | 693 |
| 2025-11 | 164 | 7,266 | 708 |
| 2025-12 | 24 | 7,298 | 692 |
| 2026-07 | 59 | 10,377 | 637 |

For each area, we found the month from which oblast-level rows stay under half of its oblast-or-raion alert hours. It ranges from January 2025 (Cherkasy) to November 2025 (for example Lviv, Odesa and Zaporizhzhia). Kyiv city has no raions in the file and doesn't switch. In the median area, oblast-level rows cover 100% of those hours through July 2025, 89% in August, 61% in October, 4% in November and 0% from December.

**The granularity flag should cover the transition during 2025, with the main step in November 2025.** The plan says December 2025.

#### Roll-up options and their effect

All options use distinct rows and exclude Luhansk and Crimea. A "union" counts overlapping time once.

| Option | Rule for an area's hours |
|---|---|
| Sum of rows | Add every row's duration. **Double counts.** |
| Oblast rows only | Union of `level = oblast` rows. |
| Any part | Union of all rows: some part of the area was under alert. |
| Any raion | The same without hromada rows. |
| **Raion average** | For each raion, the union of oblast rows and that raion's rows. Then the mean over the area's raions. |
| Raion average + hromada | The same, counting each hromada row for its whole raion. |
| All raions | Time when every raion was covered at once. |
| Volunteer | Union of the volunteer rows for the area. |

National figures (mean hours per area per month):

| Period | Sum of rows | Oblast rows only | Any part | Any raion | **Raion average** | Raion avg. + hromada | All raions | Volunteer |
|---|---|---|---|---|---|---|---|---|
| 2023 | 75.6 | 58.5 | 70.9 | 58.5 | **58.5** | 60.2 | 58.5 | 61.8 |
| 2024 | 226.5 | 105.2 | 140.2 | 105.2 | **105.2** | 111.4 | 105.2 | 76.0 |
| Jan–Jun 2025 | 312.5 | 125.1 | 168.8 | 133.4 | **130.3** | 137.9 | 128.4 | 71.3 |
| Jul–Nov 2025 | 553.2 | 65.5 | 187.8 | 162.3 | **124.8** | 131.9 | 100.5 | 71.4 |
| Dec 2025–Jul 2026 | 900.7 | 1.7 | 207.8 | 200.8 | **133.0** | 136.6 | 86.9 | 76.0 |

("Sum of rows" is computed after removing exact copies. Without that step it would be higher still.)

Selected areas, mean hours per month, **Dec 2025–Jul 2026**:

| Area | Any part | Any raion | **Raion average** | Raion avg. + hromada | Volunteer |
|---|---|---|---|---|---|
| Kharkiv oblast | 635 | 588 | **339** | 351 | 157 |
| Kyiv city | 42 | 42 | **42** | 42 | 31 |
| Lviv oblast | 10 | 10 | **8** | 8 | 54 |
| Dnipropetrovsk oblast | 728 | 646 | **241** | 310 | 129 |
| Donetsk oblast | 686 | 648 | **648** | 652 | 150 |
| Zaporizhzhia oblast | 549 | 549 | **548** | 549 | 154 |
| Volyn oblast | 16 | 16 | **12** | 12 | 113 |

Over that period, ranking areas by "any part", "any raion" or "all raions" gives nearly the same order as the raion average (Spearman 0.98). "Oblast rows only" is unusable after the switch (−0.08). The volunteer ranking agrees less (0.81).

#### Roll-up rule

**Accepted by the owner on Nov 25, 2026.**

1. Drop exact duplicate rows.
2. Exclude Luhansk and Crimea, and flag them.
3. Leave out hromada-level rows.
4. For each raion, take the union of the area's oblast-level rows and that raion's rows.
5. The area's alert hours are the **mean of its raions' hours**. Kyiv city counts as one unit.
6. Split intervals at midnight Kyiv time when assigning days and months.

The audit takes each area's raion list from the names in the official file (3 to 8 per oblast). #4 fixed that list in [`raions.csv`](../data/reference/gazetteer.md#raions), and `uv run pipeline/audit/gazetteer.py` fails on a missing or renamed raion instead of changing a denominator. #8 should enforce the same list.

**What one oblast alert-hour then means:** the average raion of the oblast spent one hour under a raion-wide or oblast-wide alert. Half the raions under alert for two hours counts as one hour. It is **not** "some part of the oblast was under alert", and raions aren't weighted by population or area. A suggested label is "alert hours, average per raion". A national figure should be a mean per area, not a sum of areas.

**Why this rule:**

- It matches the oblast-level figure in 2023 and 2024 (58.5 and 105.2 hours nationally), so it doesn't redefine the earlier series.
- "Any part" and "any raion" count a whole oblast whenever one raion is under alert. After the switch this raises large oblasts with uneven alerts: for Kharkiv they give 1.7–1.9 times the raion average.
- A hromada row covers only part of a raion, and the file gives no way to weight it. Leaving these rows out understates the burden in the affected places. Counting each as a whole raion would raise Dec 2025–Jul 2026 by 3.6 hours nationally (2.7%) but by 69 hours (29%) in Dnipropetrovsk. It would also raise earlier months (2024: 6.2 hours nationally). Show this limit on the Data & Methods page.

**Comparability across the switch: only partial.** The unit is the same, but the alerting practice changed. Under an oblast-wide alert every raion counts. Under raion alerts, raions that aren't alerted don't. So part of any change across 2025 can come from the practice itself, and **this data can't separate that part from changes in attacks.** Similar national means (130.3 in Jan–Jun 2025 and 133.0 in Dec 2025–Jul 2026) are **not** evidence that nothing changed. Mark the transition on every alert time series, and don't describe changes across it as changes in threat.

- **Alert counts (`n_alerts`) aren't comparable** across the switch, because several raion alerts can stand where one oblast alert would have. Distinct raion rows in November 2025 (7,266) were almost four times the oblast rows in the busiest month of 2023 (1,916). Show hours. If counts are needed, #8 should define and test a per-raion count; this audit didn't.
- **Donetsk oblast** is under alert almost 90% of the time by this measure. Its 8 raion names include areas under occupation, and several have almost identical row counts. **Can't tell** how those alerts relate to what residents there hear.

#### Volunteer `naive=True` alerts

- **6,318 of 124,468 rows (5.1%).** All last exactly 30 minutes. Where an end was observed, the median is 30.1 minutes and the mean 47.2. So the assumed length matches a typical alert but is shorter than the average one. How long the unended alerts really lasted is unknown.
- By year: 2.0% of rows in 2022, 6.1% in 2023, 5.6% in 2024, 5.8% in 2025 and 5.0% in 2026.
- By area: highest in Kherson (16.7%), Donetsk (9.7%), Kyiv city (9.3%) and Sumy (8.7%). Lowest in Chernivtsi (1.1%). Luhansk has only 4 rows, all naive.
- Removing them would cut union hours (without Luhansk) by 1.1% in 2022, 3.2–3.5% in 2023–2025 and 4.7% in 2026. The largest effect on one area-month with at least 20 volunteer hours is 52% (Ternopil, October 2026).
- **Observed ends can look wrong too.** The file has multi-day alerts with `naive=False`, many in western oblasts, such as Zakarpattia from Nov 1 to Nov 13, 2026 (11 days). In 2026, rows over 12 hours (20 of them) hold 6.3% of volunteer hours. A missed end message matched to a later one would look like this. **Not verified.**

#### How the two files agree

Official oblast-level hours against volunteer hours, before the main switch:

- **2023:** 19 of 24 areas are within 7%. Dnipropetrovsk differs most (volunteer 1.67 times official), then Kirovohrad (1.33) and Kyiv oblast (1.26).
- **2024:** nationally the volunteer file is 28% lower (76.0 against 105.2). It has 43% of the official hours in Kharkiv, 46% in Sumy and 72% in Kyiv city.
- **Jan–Jun 2025:** the volunteer file is 45% lower than the raion average (71.3 against 130.3), which by then includes some raion rows. Kyiv city, with no raion split, is 40.4 against 68.8.

**Can't tell** which file is right. The volunteer parser guesses the area and state from keywords in message text. It keeps one open alert per area: a new start within 3 hours replaces the old start, and after 3 hours the old one gets the 30-minute end. Both rules can lose time. Some keywords also look ambiguous (`Подільський` maps to Lviv oblast). We didn't check any of this against posts.

After the switch the volunteer file stays at oblast level, and **we can't tell** what its oblast alert then means. In Dec 2025–Jul 2026 it shows 54 hours a month for Lviv and 113 for Volyn, against 10 and 16 for official "any part", so it isn't simply "any raion under alert". Long rows like those above may explain some western hours; we didn't measure how much of this gap.

#### Proposed source choice

| Period | Proposal | Why |
|---|---|---|
| Feb 25 – Mar 31, 2022 | Leave out of monthly figures | The official file starts Mar 15. Strike data starts only Sept 28, 2022. |
| **April 2022 – July 2026** | **Official file, with the [roll-up rule](#roll-up-rule)** | 52 months from one file with one formula. Flag the 2025 transition. |
| August 2026 | Leave out | About 4 days are largely missing. |
| Sept 2026 onward | **No figure.** Show as not available | The official file stops Sept 7. |
| All periods | Volunteer file as a cross-check only | Its levels differ from official by area and period. |

**Effect of splicing instead:** switching to the volunteer file after July 2026 would create a step caused only by the change of file. In Dec 2025–Jul 2026, where both exist, moving from official to volunteer takes the national mean from 133 to 76 hours, Kharkiv from 339 to 157, Lviv from 8 to 54 and Volyn from 12 to 113. The differences go both ways, so one correction factor wouldn't work.

**Owner's decision (Nov 25, 2026):** alert figures end at July 2026, with no volunteer-only view for later months. Check upstream again at the snapshot refresh (#28). The cost is that strike data runs to Nov 21, 2026, and the planned snapshot to Dec 31, which limits E1's month slider, E2, E3 and guided stops 9 and 10. So August 2026 is left out rather than shown as incomplete. Later that day, on #8, the owner also accepted building the alert tables from the official file only, starting April 2022 ([plan §11](plan.md#11-decisions)).

A third-party archive of alerts.in.ua history may be another route: a [pull request in another project](https://github.com/yehor-o/time_series_air_alerts/pull/1) reportedly says it fills the gap. We saw this only in a web search summary and **haven't checked** the claim, the archive, its license or its coverage.

A sum of raion averages over areas is hard to interpret, so for guided stop 1 the owner chose a mean per area in place of "total alert-hours nationwide".

#### Permanent alerts (Luhansk and Crimea)

The upstream [datasets README](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset/blob/1a349789e45d63a19c8faf46d0e5877cbb36ac8b/datasets/README.md) says there are two permanent alerts that **are not listed**: Luhansk from Apr 4, 2022, 16:45 UTC, and Crimea from Dec 10, 2022, 22:22 UTC. The files agree:

- **Crimea and Sevastopol:** no rows in either file.
- **Luhansk:** the official file has one row (Mar 24–28, 2022). The volunteer file has four 30-minute `naive` rows between Feb 28 and Apr 5, 2022. Neither has a row for the permanent alert, and neither has any row starting after Apr 5, 2022.

Summing the files would show these regions as nearly alert-free. **Exclude both and show them as flagged, never as zero.**

#### Yellow and red alert levels

**They aren't in the data.** Neither file has a threat-level column.

Background from web search, not checked against the resolution itself: Cabinet Resolution No. 1092 of Sept 2026 set a yellow level (drone threat) and a red level (missile or massed drone threat) ([summary](https://racio.ua/en/statti/air-raid-alerts-at-work-resolution-1092)). Sources differ on whether it is dated Sept 3 or 4. Kyiv's rollout was reported to start Sept 6, with other places following later.

- The official file ends about a day after that reported start.
- On Sept 7 the channel posted messages titled as strike-drone threats, marked 🔴 or 🟠, alongside ordinary air-raid messages. The upstream parser records only on or off. From its code, an 🟠 post with that title wouldn't count as a start.
- A Nov 1 channel post says the official app's map shows yellow and red levels. So the levels exist; these files don't carry them.
- The volunteer file continues after the change. Its national monthly means are 83 hours in August 2026, then 93, 92 and 95 in September to November (November partial). **Can't tell** which levels its alerts include, or whether the change affected these figures. Its parser treats words such as "threat" (`загроза`) and "danger" (`небезпека`) as a start.

**Consequence:** this dataset can't separate drone alerts from missile alerts. Any alert figure from Sept 2026 on also needs a note that the alert system changed.

#### Alerts: not checked

- Individual alerts against official or volunteer posts. Only the newest page of the official channel was read.
- The `_uk` files, including whether they have the same duplicates and end date.
- Alerts against any independent source, such as alerts.in.ua.
- Raion boundaries or population. #4 matched raion [names](../data/reference/gazetteer.md#raions), three of them by elimination, and didn't check renaming decisions.
- The text of Resolution No. 1092.
- Whether upstream rewrites past rows. Pinning the commit protects reproducibility either way.

### Definitions evidence

From [#5](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/5), on the snapshot ending Nov 21, 2026. Rerun with:

```powershell
uv run pipeline/audit/definitions.py
```

All launch figures here are reported ones. Those from Aug 11, 2026 on leave out unpublished missile counts.

#### Effect of the row rules

| Rows (counted classes) | Rows | Launched | Dates | Median date | 95th percentile |
|---|---|---|---|---|---|
| All accounts | 2,832 | 143,304 | 1,244 | 82 | 420.2 |
| National accounts | 2,391 | 141,350 | 1,194 | 86 | 430.4 |
| National accounts, `target` = `Ukraine` only | 1,814 | 136,938 | 1,060 | 98 | 450.0 |
| **Nights:** national accounts without daytime reports | 2,341 | 134,546 | 1,193 | 86 | 367.4 |

- Requiring `target` = `Ukraine` would drop Air Force reports about particular areas, including large daytime reports on Kyiv oblast in 2026.
- Of the 441 rows from other accounts, 199 report `destroyed` equal to `launched`.
- 35 of the 36 dates with a daytime report also have a night. Adding daytime reports to nights would change 6 of the 62 massive dates (and 10 of the 60 under one all-period percentile). It would also make 2026 nights larger because of how reports are split.
- The accounts and windows don't prove there's no double counting. National day and night windows [overlap](#nights-repeats-and-overlaps), and we can't tell whether any drone is counted twice.

#### Night sizes by year

| Year | Nights | Median | 75th percentile | 95th percentile | Largest |
|---|---|---|---|---|---|
| 2022 (from Sept 28) | 41 | 14 | 35 | 97 | 108 |
| 2023 | 190 | 20 | 33 | 52 | 158 |
| 2024 | 282 | 30 | 68 | 128 | 286 |
| 2025 | 358 | 112 | 162 | 506 | 823 |
| 2026 (to Nov 21) | 322 | 149 | 204 | 447 | 731 |

Figures are rounded to whole weapons. The 2023 to 2025 change is also a change in how many dates have a night (190 against 358).

#### Massive night options

| Definition | Nights | 2022 | 2023 | 2024 | 2025 | 2026 | Also in the chosen set |
|---|---|---|---|---|---|---|---|
| Fixed 100+ | 523 | 2 | 2 | 28 | 211 | 280 | 54 |
| Fixed 300+ | 78 | 0 | 0 | 0 | 43 | 35 | 35 |
| Top 5% of all nights (more than 367) | 60 | 0 | 0 | 0 | 36 | 24 | 35 |
| **Top 5% of its calendar year (chosen)** | **62** | 2 | 10 | 15 | 18 | 17 | 62 |
| Top 5% against the previous 365 days | 128 | – | 2 | 44 | 72 | 10 | 45 |
| 30+ missiles (every counted class but Shahed-type) | 94 | 8 | 14 | 19 | 27 | 26 | 42 |

The trailing window needs 100 earlier nights, so it can't classify one before June 16, 2023.

**Stability as drone volumes grew.** Each row uses only the data up to that date, then asks which of its massive nights still qualify with the whole snapshot.

| Data to | All-nights bar | Its massive nights: then → still | That year's bar so far | Its massive nights: then → still |
|---|---|---|---|---|
| Dec 31, 2024 | 105 | 26 → **0** | 128 (full year) | 15 → 15 |
| June 30, 2025 | 176 | 34 → 7 | 335 | 9 → **1** |
| Dec 31, 2025 | 283 | 44 → 36 | 506 (full year) | 18 → 18 |
| June 30, 2026 | 370 | 53 → 53 | 510 | 9 → 9 |
| Nov 21, 2026 | 367 | 60 | 447 | 17 |

- **A fixed number doesn't survive the growth.** 100+ marks 87% of 2026 nights and 1% of 2023 nights. 300+ marks nothing before 2025.
- **One percentile over all nights** has the same blind spot, and its bar more than tripled between the end of 2024 and the snapshot.
- **A percentile by calendar year** covers every year, and a finished year's labels don't change. The costs: the bar isn't one size, yearly counts are about 5% by design, and **a year in progress can be relabeled**. In mid-2025, 8 of 9 labels didn't last. So 2026 can change until #28.
- A **trailing window** never relabels, but it can't cover the first months and its share swings from 3% to 20% of a year's nights in 2025 and 2026.
- A **missile count** is steady across years and matches the older sense of a "massive missile strike", but it ignores drones: the largest night (Sept 7, 2025; 823 launched) had 13 missiles. The restriction also lowers missile counts from Aug 2026.

#### Intercept rate evidence

- **Left out of national rates:** 35 `hidden` rows, 9 other rows with a blank count, and 1 other row with more destroyed than launched.
- **The minimum of 10**, in months with any eligible launches:

| Class | Months with launches | With 10+ | With 20+ | With 30+ | With 10+, Aug 2026 on |
|---|---|---|---|---|---|
| Shahed-type | 51 | 50 | 50 | 50 | 4 of 4 |
| Cruise | 51 | 50 | 47 | 46 | 4 of 4 |
| Anti-ship and other | 42 | 29 | 17 | 10 | 0 of 2 |
| Ballistic | 39 | 27 | 19 | 9 | 0 of 3 |
| Aeroballistic and hypersonic | 33 | 13 | 3 | 0 | 0 of 2 |
| Mixed (no class rate) | 21 | 17 | 14 | 11 | 2 of 4 |

  Raising the minimum to 20 or 30 would mostly empty the aeroballistic series. A rate on 10 launches is still coarse: one weapon moves it 10 points, so tables and tooltips should show both counts.
- **Why missile rates stop at July 2026:** the dataset page says that when only `destroyed` is published, it's copied into `launched` as a minimum. Such a row would read as 100% intercepted, and **we can't tell** which unflagged rows are copies. The file doesn't show it clearly either way: in cruise rows from Aug 11, 15 of 29 have all launches destroyed, against 26 of 97 in the year before and 153 of 360 earlier, on few rows. The hidden rows we saw weren't raised that way ([audit](#ballistic-data-after-august-2026)). Only cruise loses months that would have met the minimum.
- Around March 2025, eligible ballistic launches were 20 to 26 a month from January to April, and aeroballistic ones 0 in each month from January to May.
