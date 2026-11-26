# Oblast gazetteer and boundaries

From [#4](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/4), built Nov 25, 2026 from the Kaggle files dated Nov 21, the alert data at commit `1a34978` and the OCHA boundaries below. The coding agent chose the names, the matching rules and the boundary source; the owner hasn't reviewed them one by one.

| File | Contents |
|---|---|
| `oblasts.csv` | 27 areas: 24 oblasts, Crimea, Kyiv city and Sevastopol. Columns: `iso_3166_2`, `name` (canonical English), `name_uk`, `kind`, `boundary_pcode`, `in_alert_totals` (`yes` or `no`), `alert_exclusion_reason`. |
| `oblast_aliases.csv` | Every accepted spelling. Columns: `alias`, `iso_3166_2`, `match_type`, `seen_in` (which source files use it, separated by `;`; blank if none of those checked do). |
| `raions.csv` | The 118 raion names in the official alert file, for the [roll-up rule](../../docs/data-audit.md#roll-up-rule). Columns: `iso_3166_2`, `raion` (as in the official English file), `raion_uk`, `boundary_adm2_name`, `note`. |
| `ukraine_admin1.geojson` | One boundary per area, for the map. Generated; don't edit it by hand. |

## Check after a change or a data refresh

```powershell
uv run pipeline/audit/gazetteer.py
```

It needs the Kaggle and alert CSVs in `data/raw/`. It fails if an alert-file oblast name or a Kaggle `affected region` item has no alias, if the official file's raion names differ from `raions.csv`, or if `seen_in` is wrong about a file it reads. `uv run pytest` checks the tables and the boundary file without raw data.

On the files above, all 25 names in each English alert file and all 27 distinct `affected region` items (from 217 non-blank rows) resolve.

## Matching rules

- **Match aliases exactly.** Don't trim, lowercase or drop "oblast". `Kyiv` is Kyiv **city** (UA-30); `Kyiv oblast` is UA-32. A new spelling should fail until someone adds it.
- **`affected region` is a Python-style list stored as text.** Parse it (`ast.literal_eval`) and match each item.
- **Canonical names** are short English forms such as "Kharkiv oblast", mostly as Kaggle writes them, with "Kyiv city", "Sevastopol" and "Crimea". The alert files use forms such as "Kharkivska oblast", which match the ISO 3166-2 names.

| `match_type` | Meaning |
|---|---|
| `name` | A spelling of the area's name. |
| `typo` | `Ivano-Frankivsk obкlast`, which contains a Cyrillic к (one use in `affected region`). |
| `city_within` | `Kryvyi Rih`, a city, resolved to Dnipropetrovsk oblast (one use). It loses the city-level detail. |
| `nationwide` | `Ukraine` (two uses). It has no ISO code. **It isn't an oblast: don't drop it silently or spread it across oblasts.** |

Resolving a name says nothing about what `affected region` measures. The Kaggle page doesn't define it beyond what's in the [audit](../../docs/data-audit.md#schema), and it's blank in most rows.

**Not covered:** Kaggle's `target`, `target_main` and `launch_place` columns. They mix oblasts with cities, raions, directions and places outside Ukraine.

Ukrainian names come from the `_uk` alert files at the same commit, paired with the English files row by row (their timestamps match). Crimea and Sevastopol have no alert rows, so their Ukrainian names come from the boundary source.

## Alert exclusions

Luhansk oblast, Crimea and Sevastopol have `in_alert_totals` = `no`, which leaves 24 areas. Show them as excluded, **never as zero**. The upstream note on [permanent alerts](../../docs/data-audit.md#permanent-alerts-luhansk-and-crimea) names Luhansk and Crimea. Sevastopol is excluded too because neither alert file has a row for it. The Luhansk rows that do exist still resolve, so filter on this column and not on whether a name matches.

## Raions

`raions.csv` fixes each oblast's denominator for the raion average. Kyiv city counts as one unit and has no rows. Excluded areas have none.

115 names match the boundary source's raion names once " raion" is removed. Three don't. Each was the only unmatched name on both sides in its oblast, so we paired them by elimination. We didn't compare outlines or check the renaming decisions.

| Oblast | Alert file | Boundary source |
|---|---|---|
| Volyn | `Volodymyr-Volynskyi raion` | Volodymyrskyi |
| Lviv | `Chervonohradskyi raion` | Sheptytskyi |
| Kharkiv | `Krasnohradskyi raion` | Berestynskyi |

The boundary source also lists a Chornobyl Exclusion Zone unit in Kyiv oblast. The alert file doesn't, so it isn't in the table.

## Boundaries

### Source

[Ukraine - Subnational Administrative Boundaries](https://data.humdata.org/dataset/cod-ab-ukr) (COD-AB, version 05, Admin-1), published by OCHA on the Humanitarian Data Exchange (HDX). HDX names the source as the State Scientific Production Enterprise "Kartographia", and says the data is valid from Sept 1, 2025 and was reviewed on Dec 18, 2025. Download steps and the file hash are in [data/README.md](../README.md#boundaries).

We didn't dissolve the alerts repository's `example/ukr_admin2.geojson`. At the pinned commit, that file is byte-identical to `ukr_admin2.geojson` in the OCHA download, and OCHA already publishes Admin-1. The repository's MIT license shouldn't be read as covering that data.

**Alternatives not used:** geoBoundaries' Ukraine Admin-1 file (OpenStreetMap-based, represents 2017, ODbL 1.0). Natural Earth wasn't examined.

### License

HDX lists the license as **Creative Commons Attribution for Intergovernmental Organisations ([CC BY-IGO](https://creativecommons.org/licenses/by/3.0/igo/legalcode))**, read from the HDX API on Nov 25, 2026. It requires credit, a link to the license and a note of changes. The GeoJSON carries both in its top-level `attribution` and `license` members:

> Boundaries: State Scientific Production Enterprise "Kartographia", via OCHA (COD-AB Ukraine v05, HDX). Simplified.

**The site must show this credit** with the map (#18) and on Data & Methods (#23), and must not suggest that OCHA or Kartographia endorses it. The file doesn't use Kaggle data. This is a reading of the license, not legal advice; #26 reviews licenses.

### How the borders are drawn

- The 27 units follow the source and include **Crimea and Sevastopol as part of Ukraine**, along with Luhansk and Donetsk oblasts in full.
- The map shows **administrative boundaries only**. It has no front line, line of contact or occupied areas, and says nothing about who controls a place.
- **The source's Sevastopol unit is small** (57 km² by its own area field). The surrounding land is in its Crimea unit. HDX also notes that parts of its Crimea and Sevastopol data don't yet follow Ukraine's new administrative structure. Both areas are excluded from alert totals, so style them the same.

### Processing

```powershell
uv run pipeline/reference/build_boundaries.py
```

- Keeps each feature's `iso_3166_2` and canonical `name`, and drops the other properties.
- Simplifies shared edges together (tolerance 0.01°), so neighbors don't separate, then rounds to 4 decimals. Points go from 385,271 to 10,284 and the file is 187 KB (59 KB gzipped), within the site's 2 MB data budget. The area that differs from the source is 0.146% of the country's, measured in degrees.
- **Winds rings for d3-geo** (outer rings clockwise), the opposite of RFC 7946. Tools that expect RFC 7946 may need the rings reversed.
- It's for a country-wide map, not for measuring areas or locating anything.

**Join on `iso_3166_2`.** The source's P-codes look like ISO codes but aren't: for example, Kyiv city is `UA80` there and `UA-30` in ISO, and Chernivtsi is `UA73` and `UA-77`. `oblasts.csv` maps between them. ISO codes were checked against the `pycountry` package's ISO 3166-2 list.
