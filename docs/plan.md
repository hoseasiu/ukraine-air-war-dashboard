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
- A1. How has monthly launch volume changed for each weapon class since 2022?
- A2. Are salvos getting bigger, or just more frequent? What separates an ordinary night from a "massive" one?
- A3. What does a massive combined strike consist of?
- A4. Is there a rhythm: day of week, gaps between massive strikes, seasonal build-ups such as pre-winter energy campaigns?
- A5. What share of drones are decoys (Gerbera and similar) or jet-powered, and how has that changed? *Include only if the data distinguishes them; check in Phase 0.*

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

- **Attack night** is the unit for A and B. An Air Force morning report covers roughly 18:00–09:00 Kyiv time, so one night spans two calendar dates. Key each night by the date it *ends*, and document that.
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
  - Ballistic counts are restricted from Aug 12, 2026.
  - Some alert end times are assumed (`naive`).
  - Luhansk and Crimea are excluded from alert totals.
  - The alert data switches from oblast to raion granularity in Dec 2025.

**Definitions to settle in Phase 0 and show in the UI:**
- **"Massive" night:** proposed as the top 5% of nights by total launched, or a fixed threshold such as 100 or more combined weapons. Pick one, explain it in plain language, and keep it consistent.
- **Intercept rate:** destroyed ÷ launched for each class, with the EW caveat shown on every chart that uses it. Don't report a rate for any month with fewer than about 10 launches in a class; show it as a gap instead.

---

## 5. Guided mode (Day 1, ~20 minutes)

The presenter steps through numbered stops with Next/Back, using the arrow keys or a clicker. Each stop sets the charts to a fixed view, highlights one point and shows a 1–2 sentence caption in large type that reads well on a projector. A small "stop 4 / 11" indicator is always visible. Each stop also has a URL hash (`#stop-4`), so slides or links can jump straight to it.

Draft stops (Hosea to edit):

1. **Title.** "Every night, an air war." Three headline numbers for the full period: total launched, the share intercepted (with the caveat) and total alert-hours nationwide.
2. **The long view** (A1). Monthly launches by class for 2022–2026, with event markers.
3. **Drones changed the game** (A1/A5). Shahed-type launches singled out, with the decoy or jet share if the data has it.
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
- Never present a reported intercept rate without the EW caveat. Never present a launch count after Aug 12, 2026 without the ballistic-restriction flag.
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
- Repo: `ukraine-air-war-dashboard` (replaces the name suggested in §8). Private until the data license check and a review are done.
- Annotation list (#15): on Nov 25, 2026 the owner approved the nine verified rows in [annotations.csv](../data/reference/annotations.csv). The two unverified rows stay off the site.
- Issue dependencies: GitHub's "blocked by" links are the only record. A GitHub Action generates a graph and list from them in #31, which replaces the hand-kept table in `DEPENDENCIES.md`.
- Alert coverage (owner, Nov 25, 2026, #2): alert figures end at July 2026, because the official file stops Sept 7, 2026 and August is incomplete. No volunteer-only view for later months. Check upstream again at the snapshot refresh (#28). This overrides §3's snapshot date for alert data and affects E1–E3 and stops 9 and 10.

**Open**
- Definition of a "massive" night: percentile or fixed threshold (decide in Phase 0).
- Snapshot cutoff date: Dec 31, 2026 or the latest complete month (decide in early January).
- Which three oblasts to compare in stop 10 (suggested: Kharkiv, Kyiv city, Lviv).
- Ballistic-restriction flag start date (#1). This plan and `AGENTS.md` rule 3 say after Aug 12, 2026. The Kaggle page says reporting stopped Aug 10, and `hidden` rows end from Aug 11. They also cover some cruise and anti-ship missiles. Suggested: flag every night ending Aug 11 or later and call it a missile-reporting restriction.
- Rows marked `hidden` mostly carry `launched` = 0 (#1). Suggested: treat `launched` as unknown, never zero, leave these rows out of intercept rates, and decide how to show their published `destroyed` counts.
- Which rows count as attacks (#1; for #5 and #7): regional-command reports that may repeat national figures (including all `Geran` rows), and reconnaissance and unknown UAV rows, which are almost all logged as destroyed.
- How daytime reports fit "attack night" keyed by end date, given overlapping windows (#1; for #5 and #7).
- Scope of A5 (#1; for #5): decoys can't be separated. A jet-drone share is possible only from about Aug 28, 2026, with partial coverage in September. This also affects guided stop 3 and the "Shahed-type and decoy" wording.
- Wording for "since 2022" and "full period" (A1, stops 1 and 2): strike data starts Sept 28, 2022 (#1). Suggested: say "since Sept 28, 2022".
- News coverage bearing on the ballistic-flag question above (#15): LIGA says the report for Aug 9 already gave no missile count (Meduza, citing Strana, also gives Aug 9), the Air Force confirmed the change publicly on Aug 12, and LIGA says cruise missiles are affected too.
- Alert roll-up rule and source choice (#2; for #5 and #8). Suggested: drop duplicates; leave out hromada rows; average each oblast's raions (each raion's rows plus oblast-wide rows); official file April 2022 to July 2026; volunteer file only as a cross-check. See [data-audit.md](data-audit.md#proposed-roll-up-rule).
- Alert granularity flag (#2). §3 and §4 say the switch to raions was in Dec 2025. It phased in during 2025, with the main step in Nov 2025. Suggested: mark the transition from 2025.
- "Total alert-hours nationwide" in stop 1 (#2). Suggested: replace it with a mean per area (23 oblasts and Kyiv city), because a sum of raion averages is hard to interpret.

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

