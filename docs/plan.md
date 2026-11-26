# The Air War, in Data: Build Plan

> Repo copy of the planning note (Nov 25, 2026). This is the product spec; open work is tracked in GitHub issues. Record new decisions and open questions in §11.

A teaching dashboard on Russia's missile and drone campaign against Ukraine, built for **Build for Ukraine 3.0** (Day 1, Wed Jan 13, 2027). It has two modes: a **guided mode** for a ~20-minute lecture segment, and a **free-exploration mode** that students can use for the rest of the class.

This is the handoff spec for coding sessions. Phases in §9 have done-when criteria.

---

## 1. Goals and non-goals

**Goals**
- Give students a grounded, quantitative picture of the air war before they start on civil-defense projects: how big it is, how it has changed, how well defenses work, and what it costs civilians in time under alert.
- Teach data literacy along the way: where these numbers come from, what "destroyed" means, and what the public data can't tell you.
- Run on a projector as a step-through lecture, and work just as well as a self-serve tool afterwards.

**Non-goals (v1)**
- No trajectory reconstruction or approach-corridor analysis (question family C).
- No impact or civilian-harm analysis (family D, which needs ACLED).
- No cost-exchange or forecasting (family F).
- No live data. v1 uses a frozen snapshot.
- No Ukrainian translation. English only for now.
- Not tied to specific 3.0 challenges yet. Discussion prompts stay generic.

**Audience:** MIT and Ukrainian-partner students in an engineering-heavy, project-based class, with mixed backgrounds. They're comfortable with charts but not necessarily with defense terminology, so define terms such as cruise vs. ballistic, Shahed-type, and decoy in place.

---

## 2. Questions the dashboard answers

### A. Scale and rhythm of attacks
- A1. How has monthly launch volume changed for each weapon class since Sept 28, 2022?
- A2. Are salvos getting bigger, or just more frequent? What separates an ordinary night from a "massive" one?
- A3. What does a massive combined strike consist of?
- A4. Is there a rhythm: day of week, gaps between massive strikes, seasonal build-ups such as pre-winter energy campaigns?
- A5. What share of drones are decoys (Gerbera and similar) or jet-powered, and how has that changed? ***Dropped from v1** (#5): the data can't separate decoys, and covers jet drones for only about three months.*

### B. Air defense performance
- B1. How has the reported intercept rate for each weapon class changed over time?
- B2. Saturation: do larger or more mixed salvos let more weapons through?
- B3. Did intercept rates shift around notable events, such as the March 2025 US aid pause? Present this descriptively, not as a causal claim.

### E. Civilian burden from alerts
- E1. How many hours per month is each oblast under alert? This is shown as a map with a month slider.
- E2. What does life under alerts look like in a frontline oblast, Kyiv and a western oblast, side by side?
- E3. How does attack intensity (launches) relate to alert burden over time?

---

## 3. Data sources

| Source                                                                                                        | Used for                             | Access                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kaggle "Massive Missile Attacks on Ukraine"** (Petro Ivaniuk, `piterfm/massive-missile-attacks-on-ukraine`) | A, B: the backbone                   | Hosea downloads it (needs a Kaggle login); a Code session can't fetch it | CSIS's Firepower Strike Tracker uses it and says it matches the Air Force's official counts. "Destroyed" includes weapons lost to electronic warfare (EW). Expected files (**not yet verified**): `missile_attacks_daily.csv` (one row per report × model, with launched/destroyed counts, launch place, target, time window) and `missiles_and_uav.csv` (a model reference table). Verify the columns, license and last-update date in Phase 0.                                                                                                                           |
| **Vadimkin/ukrainian-air-raid-sirens-dataset** (GitHub, MIT license)                                          | E                                    | Public on GitHub; the Code session can fetch it                          | `official_data_en.csv` from Mar 15, 2022; `volunteer_data_en.csv` (eTryvoga) from Feb 25, 2022; updated daily; times in UTC. **Gotchas:** official data is mostly **raion-level since Dec 2025** (oblast-level before), so roll it up to oblast. Some volunteer alerts have no end message and get `naive=True` with an assumed 30-minute end. Two permanent alerts (Luhansk from Apr 4, 2022; Crimea from Dec 10, 2022) are **not listed**, so exclude both regions or flag them. Check whether the yellow/red alert levels introduced in 2026 appear in the data at all. |
| **MDAA Ukrainian War Tracker** (missiledefenseadvocacy.org)                                                   | Optional cross-check for 2025 onward | Public download                                                          | Uses only the Air Force's Telegram; covers Jan 1, 2025 onward; updated weekly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Event annotations**                                                                                         | Chart markers                        | Compiled by hand during the build                                        | Each marker needs a citation. Candidates: Shaheds first used (Sept 2022), start of the Oct 2022 energy campaign, the March 2025 US aid pause, the Aug 12, 2026 restriction on ballistic-missile figures, the 2026 two-level alert system. Hosea reviews the list before it ships.                                                                                                                                                                                                                                                                                          |

**Checked and rejected**
- **RaidTrend** (archived June 2022).
- **alerts.in.ua API** (history goes back only one month, at 2 requests/minute). It's not usable for historical work, but could be useful later for a live view.
- ACLED is deferred to v2.

**Snapshot:** freeze the data through **Dec 31, 2026** if the Kaggle copy is current by early January. If not, use the latest complete month. The build reruns from one command, and the snapshot date appears on every page.

---

## 4. Data model (after processing)

All processing happens offline in Python. The site only loads small, precomputed JSON or Parquet files.

- **Attack night** is the unit for night sizes, massive nights and saturation; monthly figures also count daytime reports ([which reports count](data-audit.md#which-rows-count)). An Air Force morning report covers roughly 18:00–09:00 Kyiv time, so one night spans two calendar dates. Key each night by the date it *ends*, and document that.
- **Weapon-class taxonomy:** map the raw `model` strings to a short list of classes: Shahed-type and decoy drones · cruise missiles (Kh-101/555, Kalibr, Kh-59/69) · ballistic (Iskander-M, KN-23) · aeroballistic and hypersonic (Kinzhal, Zircon) · anti-ship and other (Kh-22/32, Oniks) · guided bombs, if present. Combined entries are never split by guesswork: one whose components share a class (such as "X-101/X-555 and Kalibr") takes that class, and one that crosses classes goes to **mixed**. Reconnaissance, tactical and unidentified UAVs and bombs are excluded from totals. The mapping is an editable CSV in the repo; rules and decisions are in [data/reference/README.md](../data/reference/README.md).
- **Oblast gazetteer:** one canonical English name and ISO 3166-2 code per oblast, with aliases covering Ukrainian, transliterated and Kaggle spellings. Boundaries come from an Admin-1 GeoJSON (the alerts repo ships Admin-2; dissolve it to Admin-1 or use a standard Admin-1 file).
- **Derived tables:**
  - `nights` (date, class, launched, destroyed, n_models, is_massive)
  - `monthly_by_class`
  - `alert_hours_monthly` (oblast, month, hours, n_alerts)
  - `alert_daily` (for the calendar view)
  - `annotations`
- **Data-quality flags** are carried as columns and shown in the UI:
  - "Destroyed" includes EW-lost weapons.
  - Some missile counts, ballistic among them, are unpublished from Aug 11, 2026.
  - Some alert end times are assumed (`naive`).
  - Luhansk and Crimea are excluded from alert totals.
  - The alert data switches from oblast to raion granularity in Dec 2025.

**Definitions, settled in Phase 0 (#5) and shown in the UI.** The full rules are in [data-audit.md](data-audit.md#definitions).
- **"Massive" night:** more weapons launched than 95% of the attack nights in the same calendar year. Explain it in plain language, show that year's bar, and keep it consistent.
- **Intercept rate:** destroyed ÷ launched for each class by month, with the EW caveat shown on every chart that uses it. A class-month with fewer than 10 eligible launches is a gap. Missile classes have no rate from August 2026.

---

## 5. Guided mode (Day 1, ~20 minutes)

The presenter steps through numbered stops with Next/Back, using the arrow keys or a clicker. Each stop sets the charts to a fixed view, highlights one point and shows a 1–2 sentence caption in large type that reads well on a projector. A small "stop 4 / 11" indicator is always visible. Each stop also has a URL hash (`#stop-4`), so slides or links can jump straight to it.

Draft stops (Hosea to edit):

1. **Title.** "Every night, an air war." Three headline numbers, each with its own dates: total launched since Sept 28, 2022, the share intercepted (with the caveat) and mean alert hours per area.
2. **The long view** (A1). Monthly launches by class since Sept 28, 2022, with event markers.
3. **Drones changed the game** (A1). Shahed-type launches singled out, noting that the counts include decoys, which can't be separated.
4. **Ordinary vs. massive nights** (A2). The distribution of salvo sizes and how the threshold is defined.
5. **Anatomy of one massive strike** (A3). One record night broken down by class and launch area.
6. **Rhythm** (A4). Calendar heatmap; ask the room "do you see a pattern?" before revealing the day-of-week chart.
7. **How well do defenses hold?** (B1). Intercept-rate lines by class. The definition of "destroyed" is shown prominently.
8. **Saturation** (B2). Scatter of salvo size against number not intercepted.
9. **The civilian clock** (E1). Map of alert hours, animated across the months.
10. **Three cities** (E2). A frontline oblast, Kyiv and a western oblast compared by month.
11. **What this data can't tell you.** Data-literacy stop: reporting windows, EW, OPSEC gaps, no trajectories or impact points.
12. **Over to you.** Three generic design questions for students to carry into their projects (see §7).

Leave about 3–5 minutes of the 20 for questions. Stops 6 and 8 make natural pauses for discussion.

---

## 6. Free-exploration mode

- **Layout:** three tabs (A. Attacks · B. Defense · E. Alerts) plus a **Data & Methods** page.
- **Global controls:** date range (brush or slider), weapon-class toggles and an oblast picker for the E tab. Filter state lives in the URL so views can be shared.
- **Charts:**
  - **A:** stacked monthly bars by class; salvo-size histogram with the massive threshold marked; calendar heatmap; day-of-week bars; small multiples of class mix over time.
  - **B:** intercept rate over time by class, with the low-count gaps; saturation scatter with class coloring and hover details for each night; before/after panels for selected annotations.
  - **E:** choropleth of alert hours with a month slider; line chart comparing up to three oblasts; alert hours against launches over time.
- **Every chart has:**
  - a "How to read this" note (one or two sentences)
  - hover tooltips
  - a "Show as table" toggle (for accessibility, and to show the actual numbers)
  - the data-quality badges that apply to it
- **Data & Methods page:** sources and licenses, the snapshot date, the taxonomy table, definitions, the known gaps listed in §4, how to cite, and a changelog.

---

## 7. Teaching layer

- **Generic discussion prompts** on stops and tabs, not tied to particular challenges. For example:
  - If you were designing a warning system, what does the alert-hours map tell you about false-alarm cost?
  - What would you need to know that this data hides?
  - Why might intercept rate be a misleading metric?
- **Glossary popovers** for weapon classes, Shahed-type, decoy, EW, salvo and reporting window.
- **Tone:** factual and sober. Counts, not spectacle. No weapon imagery and no Russian-source propaganda imagery.

---

## 8. Design, stack and hosting

- **Hosting:** a static site. **GitHub Pages is the default** (same pattern as ACW and StackWatch, no secrets needed because the data is baked in). Vercel works too if it ends up easier. Either way, link it from sites.mit.edu/build4ukraine.
- **Suggested stack** (the Code session can adjust):
  - **Offline data build:** Python (pandas + DuckDB) → small JSON files committed to the repo, run with one command such as `make data`.
  - **Front end:** Vite + TypeScript, Observable Plot for charts, d3-geo for the map. No backend.
- **Repo:** new public repo, suggested name `b4u-air-war-dashboard`. Raw source files go in `data/raw/` (gitignored if the Kaggle license forbids redistribution; check in Phase 0), processed outputs in `data/processed/`.
- **Visual design:**
  - Projector-first: large type in guided mode, high-contrast palette, no reliance on color alone.
  - Light and dark themes are optional, and light is the default for projectors.
  - One consistent color per weapon class across every chart.
  - Run the dataviz skill's palette validator.
- **Accessibility (WCAG 2.2 AA):**
  - keyboard navigation for the stops and all controls
  - a table alternative for every chart
  - meaningful alt text and descriptions
  - checked contrast
  - reduced-motion setting respected for the map animation
- **Performance:** must load quickly on classroom Wi-Fi and on Zoom screen-share. Target under 2 MB of total data.

---

## 9. Phased build plan

### Phase 0: Data audit (target: by ~Dec 12)
*Hosea:* download the Kaggle dataset and drop it in the repo's `data/raw/` (or attach it to the session). *Received Nov 25; see `data/README.md`.*
- Inspect the schemas, date coverage, missing values, model-string variety, license and last update for both main sources.
- Draft the weapon-class mapping CSV and the oblast gazetteer.
- Answer these questions:
  - Does Kaggle separate decoys and jet Shaheds?
  - Does the alert data carry the yellow/red levels?
  - How much ballistic data is missing after Aug 12, 2026?
- **Done when:** a one-page "Data Audit" note (`docs/data-audit.md`) lists what each question in §2 can and can't support, with proposed definitions for "massive" and intercept rate. Hosea signs off on the taxonomy.

### Phase 1: Processing pipeline
- Build the scripts that turn the raw files into the derived tables in §4, with the flags included.
- Add tests: totals reconcile with the raw files, there are no unmapped model strings, and alert durations are non-negative.
- **Done when:** `make data` reproduces every processed file from raw, and a summary report prints the headline numbers.

### Phase 2: Exploration-mode skeleton and tab A
- Scaffold the site, global filters, URL state and the A charts.
- **Done when:** tab A works with filters, and table toggles and tooltips are in place.

### Phase 3: Tabs B and E
- Intercept and saturation charts; choropleth, oblast comparison and alerts-versus-launches.
- **Done when:** all §6 charts are rendered and the data-quality badges appear where they apply.

### Phase 4: Guided mode
- Stop engine (Next/Back, keyboard, URL hash) and the stops from §5 with captions.
- **Done when:** Hosea can run all 12 stops on a projector in about 17 minutes.

### Phase 5: Methods page, annotations and the teaching layer
- Cited annotation list, glossary, discussion prompts and the Data & Methods page.
- **Done when:** every number shown traces to its source and every annotation has a citation.

### Phase 6: Review, accessibility pass and deploy (target: draft by ~Dec 23, final by ~Jan 8)
- Run the WCAG audit, test on a projector and over Zoom screen-share, and refresh the snapshot.
- Deploy to GitHub Pages and link it from the course site.
- **Done when:** a live URL is up, the accessibility audit has no AA failures, and Hosea has rehearsed the walkthrough once.

---

## 10. Conventions for coding sessions (also in the repo's `AGENTS.md`)
- Data is never fetched at page load. Everything is precomputed and versioned with the snapshot date.
- Never present a reported intercept rate without the EW caveat. Never present a launch count from Aug 11, 2026 on without the missile-restriction flag.
- Keep raw source column names in `data/raw/`. All renaming happens in one mapping module.
- Weapon-class colors are defined once and imported everywhere.
- Describe changes around annotated events neutrally. No causal language unless an analysis actually supports it.
- No real-time data and no anything that could work as live targeting or warning information. This is a retrospective teaching tool.
- If something is ambiguous, write the question down in the Decisions section of this note rather than guessing.

---

## 11. Decisions

**Settled (Nov 25, 2026)**
- Purpose: teaching material for Build for Ukraine 3.0.
- Scope v1: question families A, B and E.
- Form: a dashboard is the main deliverable; notebooks and a repo are secondary.
- Modes: guided (lecture) and free exploration.
- Language: English only for now.
- Challenge-specific prompts: not yet.
- Student data pack: not yet, but on the roadmap (§12).
- Hosting: GitHub Pages or Vercel, whichever is easier. Default is GitHub Pages.
- Data: frozen snapshot with manual refresh.
- Guided mode: Day 1 context segment, about 20 minutes, step-through stops.
- Alert source: the Vadimkin sirens dataset (RaidTrend and alerts.in.ua history rejected).
- Build vs. reuse: **build the full plan** (all of Phases 0–6), chosen over a slide deck only or a scoped-down build. §14 records the prior-art review behind that choice.
- Kaggle license (checked Nov 25, 2026, #1): CC BY-NC-SA 4.0. Processed data may go in a public repo with attribution, a note of changes, noncommercial use and the same license on adapted data. Details are in [data-audit.md](data-audit.md#license-and-redistribution). Visibility and the code license are still the owner's call (#26).
- Weapon classes (Nov 25, 2026, #3). The owner delegated the choices to the coding agent, which decided them; [data/reference/README.md](../data/reference/README.md#decisions) has the reasons.
  - Counted: Shahed-type and decoy, cruise, ballistic, aeroballistic and hypersonic, anti-ship and other, and mixed (no class intercept rate).
  - Excluded from totals, the massive-night threshold and intercept rates: reconnaissance, tactical and unidentified UAVs (including Lancet) and bombs. List them on Data & Methods.
  - No separate mixed-cruise bucket (changes the original §4): rows naming only cruise missiles are cruise.
  - Cross-class rows aren't split, so the A and B charts must say that some class series and rates don't cover every launch of that kind.
- Phase 0 definitions (owner, Nov 25, 2026, #5). The owner chose these from options the coding agent put to them. The full rules are in [data-audit.md](data-audit.md#definitions); details marked *agent's detail* there are the agent's.
  - **Massive night:** more weapons launched than 95% of the attack nights in the same calendar year. The bar differs by year, so massive nights per year aren't charted as a trend. Chosen over one percentile for all nights, a fixed 300+ and 30+ missiles. The agent didn't offer a fixed 100+: it would mark 87% of 2026 nights.
  - **Intercept rate:** monthly destroyed ÷ launched for each class, with at least 10 launches. Rows with unpublished, blank or impossible counts are left out. Mixed rows get no class rate. Every chart carries the EW caveat. **Missile-class rates end at July 2026.**
  - **Rows:** only national military reports count. Daytime reports count in monthly totals, not in a night's size or the massive test. Unpublished counts are unknown, never zero.
  - **Restriction flag:** from Aug 11, 2026 (not Aug 12), as a missile-reporting restriction. The first `hidden` rows end that day. The Kaggle page says Aug 10, and LIGA and Meduza say the Aug 9 report already gave no missile count; the Air Force confirmed the change on Aug 12 (#15).
  - **A5 is dropped from v1.** Decoys can't be separated, and jet-drone figures cover only about three months.
  - **Wording:** "since Sept 28, 2022" for strike figures. Stop 1 shows alert hours as a mean per area (23 oblasts and Kyiv city), not a national total.
- Weapon-class sign-off (owner, Nov 25, 2026, #5): the owner signed off on the classes decided on #3. `Geran` rows keep their class, but they come from a regional command, so the row rule above leaves them out of figures.
- Repo: `ukraine-air-war-dashboard` (replaces the name suggested in §8). Private until the data license check and a review are done.
- License review and going public (owner, Nov 25, 2026, #26). The owner chose these from options the coding agent put to them:
  - **Visibility and hosting:** a public repo, with the site on GitHub Pages. The repo becomes public after the #26 fixes merge, changed by the owner or on their explicit instruction.
  - **License:** MIT for the code and CC BY 4.0 for our docs and teaching text. Data from other sources keeps its own terms; [LICENSING.md](../LICENSING.md) lists them. The agent wrote that file, including which files fall under which terms.
  - **Content:** publish as it is, including the history, issues, the commit email, the prior-art review in §14, the roadmap's partner ideas and the records of choices delegated to agents.
  - What the review covered (by the coding agent): file paths in all history, pattern searches of history, issue and pull request text, comments and Actions logs, and the data licenses. It found no archives, `data/raw/` files or secrets by those checks. It didn't read every line, and it isn't legal advice.
  - Agent's changes for a public repo: the built site ships license notices, and the dependency list leaves out issues opened by anyone but the owner, members and collaborators.
  - **Ownership and approval:** on Nov 25, 2026 the owner confirmed that Hosea Siu is the right copyright holder in [LICENSE](../LICENSE), and that no other approval is needed to publish.
  - **Done:** on Nov 25, 2026 the owner merged #48 and made the repo public, and asked the agent to record it. The agent checked that GitHub reports the repo as public with an MIT license, and that its page loads without signing in. This replaces the "private until" note above. The site isn't deployed yet (#27).
- Early preview (owner, Nov 25, 2026, #27): after enabling GitHub Pages, the owner chose to deploy the unfinished dashboard now, from options the coding agent put to them, instead of waiting for the #25 review. A workflow publishes it from `main`, so merges that touch the site or its data go live. The agent wrote the preview note on the site; the owner hasn't reviewed its wording. #27 stays open.
- Annotation list (#15): on Nov 25, 2026 the owner approved the nine verified rows in [annotations.csv](../data/reference/annotations.csv). The two unverified rows stay off the site.
- Site scaffold (#10): pages are URL hashes, so static hosting needs no rewrite rules. There's one light theme. The six counted classes have custom colors that pass the dataviz validator on white, for all pairs and not just adjacent ones, plus a pattern, symbol and dash each ([classStyles.ts](../site/src/theme/classStyles.ts)). Excluded classes aren't charted and have no color.
- Chart frame (#12): badges are derived from what each column measures, the dates the chart covers and pipeline row flags, and a chart can't switch one off ([flags.ts](../site/src/chart/flags.ts)). The restriction flag applies to launch-based figures, including destroyed counts and rates, from Aug 12, 2026 (moved to Aug 11 on #5, above). Besides the §4 flags, launch figures broken down by class say that mixed rows aren't split. Every chart that counts alerts shows the Luhansk and Crimea exclusion, and the alert-area flag applies from 2025. The agent wrote the badge wording; the owner hasn't reviewed it.
- Issue dependencies: GitHub's "blocked by" links are the only record. A GitHub Action generates a graph and list from them in #31, which replaces the hand-kept table in `DEPENDENCIES.md`.
- Gazetteer and boundaries (Nov 25, 2026, #4; decided by the coding agent): [gazetteer.md](../data/reference/gazetteer.md). 27 areas keyed by ISO 3166-2, matched by exact alias. Luhansk oblast, Crimea and Sevastopol are out of alert totals, leaving 24. Boundaries are OCHA's COD-AB v05 Admin-1 (source: Kartographia, CC BY-IGO), simplified. They include Crimea and Sevastopol as part of Ukraine and show no front line or areas of control. Kaggle's `Kryvyi Rih` counts as Dnipropetrovsk oblast, and `Ukraine` stays nationwide.
- Alert coverage (owner, Nov 25, 2026, #2): alert figures end at July 2026, because the official file stops Sept 7, 2026 and August is incomplete. No volunteer-only view for later months. Check upstream again at the snapshot refresh (#28). This overrides §3's snapshot date for alert data and affects E1–E3 and stops 9 and 10.
- Alert roll-up (owner, Nov 25, 2026, #2): drop exact duplicates, exclude Luhansk and Crimea, leave out hromada rows, and average each oblast's raions (each raion's rows plus oblast-wide rows), splitting at Kyiv-time midnight. An oblast alert-hour is then an hour for the average raion, and months after the 2025 switch are only partly comparable. Full rule and limits: [data-audit.md](data-audit.md#roll-up-rule).
- Alert tables (#8; built by the coding agent): columns and limits are in [data/README.md](../data/README.md#alert-tables). Days and months are Kyiv time. `n_alerts` is the per-raion average of merged alert periods, counted when they start. The official file has no `naive` column, so `alert_end_assumed` marks periods that include a counted row lasting exactly one hour, the length the upstream parser assigns. `alert_granularity_change` is set from January 2025, matching the chart frame. On Nov 25, 2026 the owner accepted three of these choices: the tables use the official file only, from April 2022; the alert-area flag starts in January 2025, not Dec 2025 as §3 and §4 say; and `alert_end_assumed` follows the one-hour rule.
- Pipeline (#6): one command, `uv run python -m pipeline`, stands in for `make data`. The coding agent defined `snapshot_date` as the latest `time_end` date in the daily strike file, so it doesn't depend on file timestamps. This doesn't settle the snapshot cutoff below.
- Strike tables (#7; built by the coding agent, not yet reviewed by the owner): columns are in [data/README.md](../data/README.md#strike-tables). The agent's choices, beyond the Phase 0 definitions: `destroyed` is summed only over rows where both counts are usable, and `launched_with_outcome` gives the matching launches. A date has a night if it has any counted national report that isn't daytime; if none of its counts is known, `is_massive` is null and it stays out of the percentile (no such date in this snapshot). `n_models` counts raw strings, unknown-count ones included. The restriction flag is on every class's row from the night of Aug 11, 2026, and on all of August in monthly rows. Missile destroyed counts after July stay in both tables, flagged, with no rate; this doesn't decide the open question below. Launch places are listed as reported, never split or counted, with one Cyrillic lookalike letter made Latin. An unlisted source account stops the build, and `watch` video links, which name no account, are accepted only in excluded classes.
- Global filters (#11; decided by the coding agent): the date range is whole months, set with two sliders, from Mar 2022 (the first official alert month) to the snapshot month. Strike data starts later and alert figures end earlier, and each tab says so. The six counted classes can be turned on and off, including all off. The oblast picker takes up to three of the 24 areas in alert totals and starts empty, so it doesn't settle the comparison oblasts below. State is kept in the query string, leaving out defaults. A change replaces the history entry instead of adding one.
- Filter bar (#60; built by the coding agent, not yet reviewed by the owner): replaces the two sliders and the open form above. The filters show as a one-line summary that sticks to the top of the window once the page scrolls past it; the tabs scroll away. Edit opens a panel over the page, which closes on Escape or when focus or a press goes elsewhere. The date range is one track with two thumbs. The presets are All, each calendar year the filter covers from January to December (now 2023–2025), and Last 12 months, which ends with the snapshot month, partial or not. A preset writes ordinary months to the URL, so a "Last 12 months" link doesn't move with a data refresh and, having no "to", runs to the new latest month. Each tab's filter notes stay on the page below the bar.
- Alert map (#18; built by the coding agent, not yet reviewed by the owner): one month at a time from the monthly table, with a slider, previous and next buttons and an optional play button (1.2 seconds a month, never automatic, stops at the last month). With the system's reduced-motion setting on, there is no play button. The month filter limits the months offered, the class toggles don't apply, and chosen oblasts are outlined. The map's month isn't in the URL. Colors are six fixed blue steps (under 25, 25–50, 50–100, 100–200, 200–400, 400 or more hours), the same for every month, and each area shows its rounded number. Excluded areas are hatched, labeled and listed in the table, never zero. The alert-area badge keeps the January 2025 start the owner accepted on #8, not the "Dec 2025" in #18's wording. The agent reworded the assumed-end badge to say ends *may* be assumed, because the source doesn't mark them.
- Tab A charts (#13, #14; built by the coding agent, not yet reviewed by the owner):
  - **Class filter:** it sets which classes are drawn and counted in night sizes. A class's share of a month stays out of all counted classes. With any class off, the histogram hides the massive bars, which are defined on all counted classes. Massive labels in the calendar and day-of-week bars still come from all counted classes, and the chart of gaps between massive nights ignores the class filter.
  - **Class mix:** one panel per class showing its monthly share, each with its own vertical scale.
  - **Salvo sizes:** one row per year on shared scales, in bins of 25, each with that year's median and bar (#63; before that, five separate panels). The axis is capped at 600, or higher if a year's bar needs it, with one overflow bin; the table gives each year's largest night. Labels and captions round a bar down to a whole number, which marks the same nights as the exact bar (127.55 reads "more than 127"; rounding to 128 would not). Tables and tooltips keep it in full.
  - **One night:** offers the massive nights in the months shown and opens on the largest. Launch areas are listed as reported, with no counts, in a table. A strip shows every night of that year by date, with the chosen night and the year's bar marked (#64); it counts all counted classes whatever the class filter shows. On stop 5 it comes after the launch areas. The component takes its night and classes as settings, for stop 5.
  - **Rhythm:** the calendar uses six fixed blue steps ([nightScale.ts](../site/src/theme/nightScale.ts); gray before #64), in the alert map's blue family but starting darker so they stand out from empty dates. Lines separate the months. Day-of-week bars show median night size and massive nights.
  - **Seasons:** no seasonal pattern is charted or claimed. The [data audit](data-audit.md#what-each-question-can-support) found that about four winters can't support a firm one; the calendar says so.
  - **Restriction flag:** the 2026 massive bar uses nights from Aug 11 on, so anything that shows it, or labels a night with it, is flagged even for earlier 2026 nights.
- Glossary and discussion prompts (#24): on Nov 25, 2026 the owner approved the wording of the coding agent's drafts in [terms.ts](../site/src/glossary/terms.ts) and [prompts.ts](../site/src/teaching/prompts.ts). The "salvo" and "reporting window" definitions may need another look once salvo sizes and daytime reports are settled. #5 settled both; the agent found that the two definitions still read correctly and didn't change them.
- Tab E comparison and launches (#19; built by the coding agent, not yet reviewed by the owner):
  - **Comparison:** monthly alert hours, one line per oblast, on one scale from zero. The month and oblast filters apply. With no oblast chosen it shows Kharkiv oblast, Kyiv city and Lviv oblast, which doesn't settle the question under Open. An oblast keeps its line color while others are added or removed on the same visit. The three colors are separate from the weapon-class colors.
  - **Launches and alert hours:** two aligned panels, each with its own scale, with no correlation, ratio or trend line. Alert hours are the mean of the 24 areas in alert totals; the oblast filter doesn't change them, because monthly launches aren't broken down by oblast. The month filter applies to both panels and the class toggles to launches. A total over only some classes carries the mixed-rows badge.
  - Launches run to the snapshot month, so the restriction flag appears. Alert hours stop at July 2026 and are gaps after that, labeled, never zero. A month with no published launch count has no bar.
- Saturation after the restriction (owner, Nov 25, 2026, #16): B2 keeps nights from Aug 11, 2026, with the restriction flag, a note about the possible copied counts, and a mark that sets them apart. The owner chose this from options the coding agent put to them; the other main option was to end the chart at Aug 10.
- Tab B charts (#16; built by the coding agent, not yet reviewed by the owner):
  - **Intercept rate:** one panel per class with a class rate, all from 0% to 100%, with lines broken at every gap, including months with no report. For missile classes from August 2026, the table also leaves out the destroyed and launched counts, which would give back the suppressed rate. Below the 10-launch minimum, both counts are shown.
  - **Saturation:** night size against `launched_with_outcome − destroyed`. A night where some published launches have no usable outcome is in the table but has no point (three nights in this snapshot).
  - **Class mix:** panels for one, two, and three or more classes reported, on shared scales. A point's color and symbol show the class with the most published launches. A mixed row counts as one class. Nights from Aug 11, 2026 are drawn hollow.
  - **Filters:** the classes turned on set each night's size, mix and number not reported destroyed. No massive bar is drawn, and no trend or reference line is fitted.
- Before/after panels (#17; built by the coding agent, not yet reviewed by the owner):
  - **Events:** the March 3, 2025 US aid pause (shown first), its lifting on March 11 and the Oct 10, 2022 energy strikes, all from the owner-approved rows. The agent left out the other approved rows: the Shahed shoot-down predates the strike data, missile rates end before the August 2026 reporting change, and the two-level alerts, both Oreshnik strikes and the August 2026 attack series weren't judged useful anchors for comparing intercept rates.
  - **Windows:** 30, 60 or 90 days on each side, 90 by default, chosen before looking at the results. The event's date is in neither. A window the data cuts short says how many days it covers (12 before Oct 10, 2022). Other approved events dated inside the windows are listed with their citations: the aid pause and its lifting fall inside each other's windows.
  - **Figures:** added up from the nights table, so daytime reports are out and they don't add up to the monthly rates. The monthly rules apply to each window: at least 10 launches, no mixed rate, and no missile rate or counts once a window reaches August 2026. Each class shows its launches and nights, and each window its days and nights. No difference is calculated or tested.
  - **Filters:** the classes turned on apply; “Months shown” doesn't. The event and window length aren't in the URL.
  - **Wording:** the agent read the captions for causal wording. A test checks the panels' fixed notes and the offered events' text against a list of causal words, apart from the sentence saying a difference doesn't show cause.
- Build checks, summary report and CI (#9; built by the coding agent, not yet reviewed by the owner): the build prints a summary report and stops if the site's data would pass 2,000,000 bytes, counting every processed JSON file and the site's reference files before minifying or compression. Output stays JSON. The report's all-class share reported destroyed and mean alert hours per area follow the two decisions below. CI lints and tests the pipeline on made-up inputs and the committed tables; the checks on real raw files run only where those files are. The optional MDAA cross-check wasn't done.
- All-class share (owner, Nov 25, 2026, #9; for #21): any all-class share reported destroyed is computed through July 31, 2026, and says so. The owner accepted the suggestion the coding agent had recorded under Open. Like other shares, it carries the EW caveat.
- Alert hours on stop 1 (owner, Nov 25, 2026, #9; for #21): mean alert hours per area are shown for an average month, not as a total, with their own dates (April 2022 to July 2026 in this snapshot). The owner chose this from the two options, and the coding agent had suggested it. This doesn't approve the stop's caption.
- Guided stop captions (owner, Nov 25, 2026, #21): the owner approved the six titles and captions in [stops.ts](../site/src/guided/stops.ts) as the coding agent drafted them. Before approving, they were told that stop 1's title from §5, “Every night, an air war”, isn't literally true of the data (175 of 365 dates in 2023 have no night, which may mean quiet or unreported), and that the agent thought stop 3's title, “Drones changed the game”, also from §5, claims more than a launch chart shows. This approves the titles and captions, not the other wording or choices below.
- Guided stops 1–6 (#21; built by the coding agent; apart from the titles and captions, not yet reviewed by the owner):
  - **Fixed views:** each chart covers every month of the strike data and ignores the exploration filters.
  - **Stop 1:** launches are all published counts in `monthly_by_class`. The share and the alert hours follow the owner's two decisions above; the share is over all counted classes, with no minimum count.
  - **Stop 2:** a numbered marker for every verified, approved annotation, with its date, label and citations under the chart. The Sept 13, 2022 event is marked on September's bar and noted as before the strike data.
  - **Stop 5:** the night with the most published launches, picked from the data, so a refresh can change it.
  - **Stop 6:** Next, or a button, swaps the calendar for the day-of-week chart; a second Next moves on. The prompt is the approved one from #24.
  - **Projector layout:** on stops, “How to read this” sits below the chart, badges sit side by side, page headings are smaller, and chart height follows the window. At 1280 × 720 the calendar's last row, stop 1's last alert notes and most notes under the charts need scrolling.
- Guided stop text for stops 7–12 (owner, Nov 25, 2026, #22): the owner approved the coding agent's drafts of the six titles and captions, stop 7's definition of "destroyed" and stop 11's four points, with stop 10 retitled from §5's "Three cities" to "Three places". Before approving, they were told that two of the three suggested areas are whole oblasts, that "frontline" in stop 10's caption is §5's description and the map shows no front line, and that the repo's audit records no reason for the withheld figures. This doesn't pick stop 10's oblasts, settle how stop 9's animation starts, approve the other choices below or record a walkthrough.
- Comparison oblasts (owner, Nov 25, 2026, #22): stop 10 compares Kharkiv oblast, Kyiv city and Lviv oblast. The owner confirmed §5's suggestion when the coding agent asked. Stop 10 and tab E's default share one list, so they stay the same. This replaces the notes above and below that treat the choice as unsettled.
- Guided stops 7–12 (#22; built by the coding agent; apart from the text above, not yet reviewed by the owner):
  - **Text:** it's in [stops.ts](../site/src/guided/stops.ts). The other titles are §5's. Stop 8 uses the saturation prompt and stop 12 the three closing prompts, both approved on #24; the closing three are §7's examples.
  - **Fixed views:** stops 7 and 8 cover every month of the strike data and all classes they can show; stops 9 and 10 cover every month of the alert data. All ignore the exploration filters.
  - **Stop 9:** the map opens on April 2022 with no oblast outlined. Playing stays a button the presenter presses, never automatic (as on #18), and a clicker's Next moves to stop 10 without starting it. With reduced motion on, there is no Play button.
  - **Stop 10:** the areas are the owner's pick above, from the same list as tab E's default comparison.
  - **Stop 11:** a list instead of a chart. The plan's "OPSEC gaps" point is headed "Withheld figures" and gives no reason for them, because the repo's audit doesn't record one.
  - **Projector layout:** at 1920 × 1080 each stop's chart or list is above the control bar; notes under some charts need scrolling. At 1280 × 720, stop 7's five panels go in one row and the bottom of them, and more of stop 8's chart, need scrolling. Stop 9's map sits beside its controls. Neither size was checked on a projector, and the walkthrough hasn't been timed.
- Saturation redesign (#66, Nov 26, 2026; built by the coding agent, not yet reviewed by the owner). This replaces the class-mix and hollow-point layout in the #16 notes above:
  - **One panel:** by default every night is in one panel, styled by period: faint filled gray circles before Aug 11, 2026 and hollow orange squares from then on ([periodStyles.ts](../site/src/theme/periodStyles.ts)). Overlapping circles show darker.
  - **Axes:** both use a symlog scale, which spreads out low values and still has a place for zero (many nights have nothing reported not destroyed, so a plain log scale can't show them). The chart says so under the axis, so stop 8 carries it too. The agent preferred this to hexagonal bins, which would lose the point for each night and mix the two periods.
  - **Split view:** a switch brings back the panels by number of classes reported, with the earlier class colors and symbols, which keeps §6's class coloring. The default view has none. The switch isn't a filter and isn't in the URL. Stop 8 shows the one panel; its approved title, caption and prompt are unchanged.
  - **Summary:** below the scatter, one panel per year shows the median night's share not reported destroyed in seven size groups (1–9 up to 400 or more). A group with fewer than 5 nights has no median. Because it adds classes together, it stops at July 31, 2026, applying the owner's #9 rule for all-class shares, whatever classes are shown. It counts only nights with a point on the scatter, and each night once.
- Before/after redesign (#67, Nov 26, 2026; built by the coding agent, not yet reviewed by the owner): a dumbbell chart replaces the two columns of bars in the #17 notes above. One row per class, with a ring for the window before and a filled dot for the window after on one 0% to 100% axis, joined by a line with no arrow, and both windows' rates, launches and nights beside it. A window with no rate has no dot and says why. Window length is a segmented control. Events, windows, figures, filters and the sentence saying a difference doesn't show cause are as before.
- Data & Methods page (#23; built by the coding agent, not yet reviewed by the owner, wording included):
  - **Tracing:** a table maps each figure to its built table, method and code; each year's massive bar, stop 1's three numbers, the raw-row reconciliation and source checksums are read or worked out from the built files. Destroyed totals in the reconciliation aren't shown, apart from the hidden rows' count, because with launches they'd give an all-class share past July 2026 (#9).
  - **Taxonomy:** generated from `weapon_classes.csv` and `model_classes.csv`, with every raw model string and the excluded classes' row counts. The latter file now counts toward the 2 MB budget, and its CC BY-NC-SA 4.0 notice is in `licenses.txt`.
  - **How to cite:** the format is the agent's. It asks readers not to cite the dashboard while the preview note is up.
  - **Links out:** the KAS link is the foundation's Ukraine Air War Monitor page, not the general series page in §13, which didn't show the monitor. The UCSC address, which the plan didn't give, is the council's “Duration of air alarms” page. Both loaded on Nov 26, 2026. CSIS refused the automated check (HTTP 403), so its §13 link is unchecked.
  - **Glossary sources:** the page says the general descriptions have no cited source. The question stays open.

**Open**
- Terms of the sources behind the alert data (#26): the dataset is MIT, but it's collected from Telegram channels, including a volunteer one (eTryvoga), whose terms we don't know ([data audit](data-audit.md#alerts-license)). The site uses only the official-channel file.
- Sources for the glossary (#24). The owner approved the wording (see Settled) without answering this separately: the general descriptions of weapons, EW and decoys in [terms.ts](../site/src/glossary/terms.ts) have no cited source. Suggested: decide before shipping whether they need citations (§9 Phase 5 asks that numbers trace to a source), alongside the Data & Methods page (#23).
- Snapshot cutoff date: Dec 31, 2026 or the latest complete month (decide in early January). The 2026 massive-night bar and labels can change with it (#28).
- Stop 9's animation (#22): is pressing the Play button enough, or should a clicker be able to start it?

---

## 12. Roadmap (after v1)
- **Student data pack:** cleaned CSVs, a data dictionary and a starter notebook (Colab or Jupyter) for teams to use during studio time.
- **Family C (geography):** target oblasts over time, launch-area-to-target flows. Approach corridors are approximate at best.
- **Family D (impact and harm):** join ACLED air/drone-strike events and infrastructure tags by date and oblast. Needs Hosea's ACLED account.
- **Family F:** cost-exchange view with transparent price assumptions; exploratory forecasting of massive strikes.
- **Challenge tie-ins:** once the 3.0 slate is locked, add prompts aimed at the air-raid situational-awareness track. The alert pipeline could also feed the LRAF challenge's regional baseline.
- **Ukrainian translation** for partner universities (KAI, KSE).
- **Reuse for Hack for Ukraine:** the cleaned data pack as a hackathon data challenge.
- **Optional live layer** using the alerts.in.ua API (proxied server-side, within its rate limits) to show current alert status.

---

## 13. References
- CSIS Futures Lab, Russian Firepower Strike Tracker (uses the Kaggle dataset): https://www.csis.org/programs/futures-lab/projects/russian-firepower-strike-tracker-analyzing-missile-attacks-ukraine
- CSIS dashboard, for design reference: https://csis-ilab.github.io/js-missile-tracker
- Kaggle dataset: https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine
- Air raid sirens dataset: https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset
- alerts.in.ua developer docs: https://devs.alerts.in.ua/
- MDAA Ukrainian War Tracker: https://missiledefenseadvocacy.org/?p=39307
- ISIS monthly Shahed analyses (methodology reference for reporting windows): https://isis-online.org/isis-reports/monthly-analysis-of-russian-shahed-136-deployment-against-ukraine-updated
- KAS/Kyiv Dialogue "Monitor Air War Ukraine" (monthly context and annotation candidates): https://www.kas.de/en/web/ukraine/blickpunkt-ukraine

---

## 14. Prior art and value-add (review, Nov 25, 2026)

**What already exists**
- **CSIS missile tracker** (https://csis-ilab.github.io/js-missile-tracker). Interactive daily and cumulative launches, missile types and intercepts, built on the same Kaggle data. This is the closest existing tool. It has no alert data and doesn't explain the data's limits.
- **KAS / Kyiv Dialogue "Ukraine Air War Monitor"** (Marcus Welsch, Perspectus Analytics). The strongest analysis available: monthly issues on intercept rates by class, record nights and regional patterns, from a database of airstrikes on civilian targets since autumn 2022. Published as a monthly write-up, so you can't explore it.
- **Static chart stories.** The Kyiv Independent's "chart of the week" and Texty's "four years in five graphs" (alerts, Shaheds, missiles, air-defense effectiveness).
- **Alerts (family E is largely covered).** The Ukrainian Council of Shopping Centers publishes an interactive monthly map of alert duration by region since Feb 24, 2022. Sites like alerts.in.ua, air-alarms.in.ua, neptun.in.ua and alarmmap.online offer statistics and district-level history.

**Where our version adds value**
1. **Strikes and alerts joined in one place.** Nothing found connects attack volume to the time civilians spend under alert, which is the most relevant link for a civil-defense class.
2. **Built for a lecture.** Existing tools are for analysts or readers, not for a 20-minute projector walkthrough with planned discussion pauses.
3. **Data limits as part of the lesson.** This matters more now: since August 2026, the Air Force has only partially published cruise and ballistic data, so KAS says reliable missile deployment and interception statements aren't possible. Teaching students to notice gaps like this is valuable in itself.
4. **A reusable data asset.** A cleaned strikes + alerts dataset could feed the student data pack, a Hack for Ukraine data challenge, an LRAF regional baseline and future editions of the class.

**Where it doesn't add much**
- As a public resource, it won't beat CSIS or KAS on depth or freshness.
- For the 20-minute lecture alone, a cited slide deck gets most of the value at a fraction of the effort.

**Implication for scope.** If built, lean into (1)–(4). Treat the alert map and the intercept charts as context rather than the main story, and link out to CSIS, KAS and the UCSC map from the Methods page.

