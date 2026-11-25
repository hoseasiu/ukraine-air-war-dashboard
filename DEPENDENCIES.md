# Issue dependencies

This file records only what can't be derived from GitHub: which issues block which, and which ones touch the same files. For who is working on what, check the issues and PRs themselves.

## Hard blockers

"Blocked by" means the listed issues must be closed first. If this table and an issue body disagree, this table wins.

| Issue | Work | Blocked by |
|---|---|---|
| #1 | Audit Kaggle strike data | none |
| #2 | Audit alerts data | none |
| #3 | Weapon-class mapping | #1 |
| #4 | Oblast gazetteer and boundaries | #1, #2 |
| #5 | Data Audit note and definitions | #1, #2, #3, #4 |
| #6 | Pipeline scaffold and alerts fetch | #2 |
| #7 | Strikes pipeline | #3, #5, #6 |
| #8 | Alerts pipeline | #4, #6 |
| #9 | Pipeline tests, report, one-command build | #7, #8 |
| #10 | Site scaffold and shared theme | #3 |
| #11 | Global filters and URL state | #4, #10 |
| #12 | Shared chart frame | #10 |
| #13 | Tab A: volume and class mix | #7, #11, #12 |
| #14 | Tab A: salvo size and rhythm | #7, #11, #12 |
| #15 | Cited annotation list | none |
| #16 | Tab B: intercept rate and saturation | #7, #11, #12 |
| #17 | Tab B: before/after panels | #15, #16 |
| #18 | Tab E: alert-hours map | #4, #8, #11, #12 |
| #19 | Tab E: comparisons | #7, #8, #11, #12 |
| #20 | Guided-mode stop engine | #10 |
| #21 | Guided stops 1–6 | #8, #13, #14, #15, #20 |
| #22 | Guided stops 7–12 | #16, #18, #19, #20, #21 |
| #23 | Data & Methods page | #5, #9, #11 |
| #24 | Glossary and discussion prompts | #12, #20 |
| #25 | Accessibility audit | #17, #21, #22, #23, #24 |
| #26 | License review and going public | #1, #2 |
| #27 | Deploy to GitHub Pages | #25, #26 |
| #28 | Refresh the snapshot | #9 |
| #29 | Rehearsal and course-site link | #27, #28 |

## Can start now

#1, #2 and #15. #1 is on the critical path. #15 is filed under Phase 5, but start it early because #17 and #21 need it.

## File-overlap risks

These issues may have no formal dependency on each other but are likely to edit the same files. Avoid running two from one row at once, or coordinate on the issues.

| Shared area | Issues |
|---|---|
| App shell, routing, global state | #11, #12, #20 |
| Python project config and mapping module | #7, #8 |
| Tab A page layout | #13, #14 |
| Tab B page layout | #16, #17 |
| Tab E page layout | #18, #19 |
| Guided stop definitions | #21, #22 |
| Chart frame and glossary hooks | #12, #24 |
| `docs/plan.md` §11, `AGENTS.md` | any issue that records a decision or command |
