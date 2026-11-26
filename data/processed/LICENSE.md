# License for the files in this folder

## Derived from Kaggle: CC BY-NC-SA 4.0

Files here that are derived from the strike data are adapted from [Massive Missile Attacks on Ukraine](https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine) by Petro Ivaniuk, and are licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). You must give credit, note your changes, use them only for noncommercial purposes, and share adaptations under the same license.

**Changes made:** `manifest.json` and `build_info.json` hold only facts about the source files (names, row counts, sizes, checksums) and the latest report end date. They contain no rows from the dataset.

`nights.json`, `monthly_by_class.json` and `strike_reconciliation.json` are adapted from `missile_attacks_daily.csv`, so this license covers them. **Changes made:** raw model names are grouped into our [weapon classes](../reference/README.md#weapon-classes); only national military reports in counted classes are used; counts are added by attack night (the date a report ends, without daytime reports) and by month; unpublished and blank counts are treated as unknown; destroyed counts use only rows where both counts are usable; we added massive-night labels, intercept rates and data-quality flags; and launch places are listed as reported, apart from one Cyrillic letter replaced with the Latin letter it resembles. The reconciliation file totals the rows used and left out. Details: [columns](../README.md#strike-tables). Describe each new table's changes here when it's added.

## Alert data: MIT

`alert_hours_monthly.json` and `alert_daily.json` are made from the [Ukrainian air-raid sirens dataset](https://github.com/Vadimkin/ukrainian-air-raid-sirens-dataset) and use no Kaggle data. **Changes made:** only the official English file is used; exact duplicate rows, hromada-level rows, Luhansk, Crimea and Sevastopol are left out; alerts are averaged over each oblast's raions and totaled by Kyiv-time day and month from April 2022 through July 2026 ([columns](../README.md#alert-tables)). `manifest.json` only describes the source files. Anything that joins these tables with Kaggle-derived data is also covered by CC BY-NC-SA 4.0 above, and keeps this notice:

```text
MIT License

Copyright (c) 2022 Vadym Klymenko

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
