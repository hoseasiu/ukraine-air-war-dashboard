# Event annotations

[annotations.csv](annotations.csv) is the hand-compiled list of chart markers ([#15](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/15)). UTF-8, one event per row.

## Display rule

**The site shows a row only if `verification` is `verified` and `owner_review` is `approved`.** This applies to markers, before/after panels (#17) and guided stops (#21). Approval is the owner's alone.

## Columns

| Column | Meaning |
|---|---|
| `id` | Stable key. Don't reuse. |
| `date` | `YYYY-MM-DD`. Blank only in unverified rows. |
| `date_marks` | What the date refers to, such as an announcement or the event itself. |
| `label` | Short marker text. |
| `description` | Neutral account of the event. No causal claims. |
| `source_url`, `source_url_2` | Citations to show with the marker. |
| `verification` | `verified`: the cited page was opened, and it supports the date and description. Otherwise `unverified`. |
| `checked_on` | When the sources were opened. |
| `owner_review` | `pending`, `approved` or `rejected`. |
| `origin` | `issue`: a candidate named in #15. `kas`: found in the KAS / Kyiv Dialogue monitor. |
| `notes` | Limits and open points. Not for display. |

`description` is meant to be supported by `source_url` and `source_url_2`. Further links in `notes` are background.

## How the sources were checked

On Nov 25, 2026, pages were opened with an automated fetch tool that returned extracts and short quotes. That isn't the same as a person reading each page, so open the links when reviewing. Several are news or secondary reports, not primary statements.

Refused or timed out, so not used: the UN monitoring update PDF on un.org, the State Department's Jeddah statement, zakon.rada.gov.ua, a Ukrainska Pravda report and an NPR report.

## KAS coverage

Only Vols. XII and XVI–XX were read, as web pages; no PDFs. Together they're mostly about 2025 and 2026, so the list is thin for 2023–2024. Most of their dated items are monthly statistics, Ukrainian operations or single local strikes, and weren't added. Record nights were left to the data (the one `record-948-drones-2026` row shows why).
