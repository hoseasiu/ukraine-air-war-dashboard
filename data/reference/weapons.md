# Weapon reference data

**Status: the owner approved the tables and their wording on Nov 27, 2026 ([#86](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/86)).** A coding agent compiled them and wrote the wording. Changing a figure or the wording needs the owner's review again. The approval doesn't mean anyone has checked each figure against its page (see [Sources](#sources)). The site's [weapon primer](../../site/src/weapons/primerPage.ts) (#87) shows these tables. It repeats parts of [Reading the figures](#reading-the-figures) and the wording below, so change them together.

What the members of the five weapon classes are, with cited figures. It's background for teaching: published nominal figures about types of weapon, with nothing about particular launches, places or times.

| File | Contents |
|---|---|
| `weapon_members.csv` | One row per member: its class, the raw `model` strings or parts of combined strings that name it (separated by `;`), role, launch platform, speed category, the sources for each, and a note. |
| `weapon_figures.csv` | One row per member, measure and source: `low` and `high` in `unit`. A measure with no figure has one row with those and `source` blank, and `note` says why. |
| `weapon_sources.csv` | One row per cited page: publisher, title, kind, link, the page's own date where read, and the day it was checked. |

Membership follows [model_classes.csv](model_classes.csv). Each string in the five classes, or each part of a combined one, has a member. Some strings cover several (`Shahed-136/131`, `X-101/X-555`, `Banderol/Dan-T`). The members listed under `Shahed-136/131` beyond those two are what's known or unknown about its catch-all. Parts of `mixed` rows are the same weapons, so they aren't listed again.

After editing a table, update the summary below and run the tests:

```powershell
uv run pipeline/reference/weapon_summary.py
```

```powershell
uv run pytest tests/test_weapons.py
```

## Reading the figures

- **They're published estimates and claims, not measurements.** Some come from a party to the war.
- **A span covers every cited row**, whether the versions differ or the sources disagree. It isn't a likely range or an uncertainty interval. `weapon_figures.csv` shows who says what, and its notes mark upper limits, "about" figures and estimates.
- **Unknown** means no figure we could cite was found on the pages opened. It doesn't mean none is published, and it never means zero.
- **Length and diameter** may or may not include boosters or fairings. Sources often don't say. For scale drawings (#89), pick one variant and source, not the ends of a span.
- **Payload isn't always warhead.** Where a source gives payload, the row says so, and it's in the warhead span.
- **Range** is a nominal published figure, which can depend on version, payload and flight path.
- **Speed** stays in the source's units. Cruise, maximum and brief peak speeds are mixed together, and the row notes say which where the source did.
- **Speed category** is our sorting of the fastest cited speed: `subsonic` is below Mach 1, `supersonic` Mach 1 to 5, `hypersonic` above Mach 5. The test converts at sea level (Mach 1 as 1,225 km/h), although Mach depends on altitude. `hypersonic` here means at some point in the flight, not all of it. Zircon's recorded Mach 6.8 isn't sustained, and ballistic and surface-to-air missiles slow down. The surface-to-air speeds are published for air defense.
- **Left out on purpose:** unit cost, anything about interception or defenses, guidance, accuracy, flight altitude, launch areas and bases.

## Sources

- The pages were opened on Nov 27, 2026 with an automated fetch tool that returns extracts, some of them summaries. That isn't a person reading each page, so open the links when reviewing. Where an extract said a page had no figures but the page's own text showed some, the text was used.
- **† in the summary means only Wikipedia pages support the figure.** That's most of the anti-ship and other class, and the Kh-59MK2, Kh-69 and Dan-T. Wikipedia's own footnotes weren't followed, and some of these figures, including most for the Kh-22 and all for the Kh-32 from its own page, have no footnote there. These are the weakest figures here.
- The War & Sanctions portal belongs to Ukraine's Defence Intelligence. Its figures haven't been independently checked.
- CSIS Missile Threat pages for several missiles were last updated in 2021 or 2024, and one page can disagree with itself. Where it does, rows follow its summary table, or its text where the table has no figure.
- Ukrainska Pravda's Zircon report and GlobalSecurity's S-300 page refused the fetch (HTTP 403), so they aren't used. No CSIS page was found for the Kh-59, Zircon or 9M728, and no Kh-22 or Kh-32 page was found outside encyclopedias and similar sites. That was a limited search.
- No source was found for what else the Shahed catch-all holds.

## Summary

Spans of every cited row. † as above.

<!-- summary: generated by pipeline/reference/weapon_summary.py -->

### Shahed-type and decoy drones

| Weapon | Speed category | Length (m) | Wingspan (m) | Diameter (m) | Warhead (kg) | Range (km) | Speed as published |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Shahed-136 (Geran-2) | subsonic | 3.3–3.5 | 2.5–3 | unknown | 20–90 | 650–2,500 | 180–185 km/h |
| Shahed-131 (Geran-1) | subsonic | 2.6 | 2.2 | unknown | 10–20 | 700–1,000 | 180 km/h |
| Gerbera and Gerbera-2 | subsonic | 2–2.6 | 2.5–3 | unknown | 5–25 | 300–1,200 | 160–200 km/h |
| Geran-4 | subsonic | 3.6 | 3.05 | unknown | 90 | 770 | 320–450 km/h |
| Geran-5 | subsonic | 6.5 | 3.2 | unknown | 90 | 1,000 | 400–450 km/h |
| Other and imitator drones in the Shahed count | unknown | unknown | unknown | unknown | unknown | unknown | unknown |

### Cruise missiles

| Weapon | Speed category | Length (m) | Wingspan (m) | Diameter (m) | Warhead (kg) | Range (km) | Speed as published |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kh-101 | subsonic | 7.45 | 4.3 | 0.51–0.742 | 400–800 | 2,500–5,500 | Mach 0.58–0.78; 900–1,000 km/h |
| Kh-555 | subsonic | unknown | unknown | unknown | 400 | 3,500 | unknown |
| Kalibr (3M14 land-attack versions) | subsonic | 6.2–8.9 | unknown | 0.514–0.533 † | 450 | 1,400–2,500 | Mach 0.8 † |
| Kh-59 family | subsonic | 5.7 | 1.3 | 0.38–0.42 | 320 | 115–290 | Mach 0.72–0.88; 310 m/s |
| Kh-59MK2 | unknown | unknown | unknown | unknown | 285–320 † | 290 † | unknown |
| Kh-69 | subsonic | unknown | unknown | unknown | 300 † | 400 † | 1,000 km/h † |
| Iskander-K cruise missile (9M727 / 9M728) | subsonic | 6.02 | unknown | 0.514 | 450–480 | 500 | 800–900 km/h |
| S8000 Banderol | subsonic | 5 | unknown | 0.3 | 150 † | 500 | 520–700 km/h |
| Dan-T | unknown | unknown | unknown | unknown | unknown | unknown | unknown |

### Ballistic missiles

| Weapon | Speed category | Length (m) | Wingspan (m) | Diameter (m) | Warhead (kg) | Range (km) | Speed as published |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Iskander-M (9M723) | hypersonic | 7.185–7.3 | unknown | 0.92 | 450–700 | 390–550 | 2,100–2,600 m/s |
| KN-23 (Hwasong-11A) | unknown | 7.5–8.77 | unknown | 0.95–1.1 | 500–1,500 | 190–900 | unknown |
| Ballistic missile, type not stated | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| Reported intercontinental ballistic missile | unknown | unknown | unknown | unknown | unknown | unknown | unknown |

### Aeroballistic and hypersonic missiles

| Weapon | Speed category | Length (m) | Wingspan (m) | Diameter (m) | Warhead (kg) | Range (km) | Speed as published |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kh-47M2 Kinzhal | hypersonic | 7.175–8 | 1.6 † | 0.92–1.2 | 450–480 | 460–2,000 | Mach 4–10; 3,333 m/s |
| 3M22 Zircon | hypersonic | 8–9 | unknown | 0.6–0.666 | 120 | 1,000 | Mach 6.8 |

### Anti-ship and other missiles

| Weapon | Speed category | Length (m) | Wingspan (m) | Diameter (m) | Warhead (kg) | Range (km) | Speed as published |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kh-22 | supersonic | 11.65 † | 3 † | 0.92 † | 960–1,000 † | 600 † | Mach 3.3–4.6 † |
| Kh-32 | supersonic | unknown | unknown | unknown | 500 † | 600–1,000 † | Mach 3.5–5 † |
| P-800 Oniks | supersonic | 8.3–8.9 | 1.7 † | 0.67–0.7 | 200–300 | 120–800 | Mach 2–2.9 |
| Kh-31 family | supersonic | 4.7–5.3 † | 0.914 † | 0.36 † | 87–94 † | 70–110 † | 2,160–2,520 km/h † |
| Kh-35 and Kh-35U | subsonic | 3.85–4.4 † | 1.33 † | 0.42 † | 145 † | 130–300 † | Mach 0.8–0.85 † |
| S-300 interceptor missiles | hypersonic | 7.25–7.5 | unknown | 0.51–0.519 | 130–143 | unknown | 1,900–2,000 m/s † |
| S-400 interceptor missiles (48N6 family) | hypersonic | unknown | unknown | unknown | 143–180 | unknown | 2,000 m/s † |
| Unknown missile | unknown | unknown | unknown | unknown | unknown | unknown | unknown |

<!-- end summary -->

## Drawings

**Status: not yet approved ([#89](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/89)).**

The primer draws one member of each class. [drawings.ts](../../site/src/weapons/drawings.ts) holds each outline, its variant, its dimensions and its references, and the build fails if a dimension isn't one that the named source's row gives. A coding agent drew the outlines as coordinates after looking at the pages below on Nov 27, 2026. No image was traced, copied or saved to the repo. All dimensions in one drawing come from one source, so spans aren't mixed.

| Drawing | View | Dimensions to scale | From | Shape drawn from |
|---|---|---|---|---|
| Shahed-136 | above | length 3.5 m, wingspan 2.5 m | `wp-shahed` (Wikipedia only) | [Three-view drawing](https://commons.wikimedia.org/wiki/File:Shahed-136-335-250draw.svg) by Alexpl, CC BY 4.0 |
| Kh-101 | above | length 7.45 m, wingspan 4.3 m, diameter 0.742 m | `gur-kh101` | [Top and side views](https://commons.wikimedia.org/wiki/File:H101_missile.jpg) uploaded by Vslv, CC0, and the 3D model on the `gur-kh101` page |
| Iskander-M (9M723) | side | length 7.185 m, diameter 0.92 m | `gur-iskander-m` | The 3D model on the `gur-iskander-m` page |
| Kinzhal, without tail fairing | side | length 7.175 m, diameter 0.92 m | `gur-kinzhal` | The 3D model on the `gur-kinzhal` page |
| Kh-22 | above | length 11.65 m, wingspan 3 m, diameter 0.92 m | `wp-kh22` (Wikipedia only) | Museum photos: a [side view](https://commons.wikimedia.org/wiki/File:Raduga_Kh-22,_side_view.JPG) by Антон Бородин, CC BY-SA 3.0, and a [Kh-22NA](https://commons.wikimedia.org/wiki/File:Kh-22NA_Kyiv_Museum_2018_G1.jpg) by George Chernilevsky, CC BY 4.0, and a [photo from below](https://commons.wikimedia.org/wiki/File:Raduga_Kh-22.jpg) uploaded by Victor12, public domain |

- **Checked again:** the owner found the Shahed-136's wing misplaced. It was re-measured, and then so were the other four against straighter views, on Nov 27, 2026. The Kh-101's wings and tailplane moved or changed size, the Iskander-M and Kinzhal noses got longer, and the Kh-22's wingtips got wider. Positions were read off screen views by eye. The 3D models are in perspective and the Kh-22 photos are at an angle, so those four are less certain than the Shahed-136, which has a flat drawing. The Kh-101 image's uploader calls it their own work; it looks processed from other material, and where that came from isn't known.
- **To scale:** only the dimensions above. Wing, fin and nose shapes and positions were judged by eye, as was the width of the Shahed-136's body, which has no cited diameter.
- **The person** is 1.75 m tall, a height chosen for comparison, not a figure from a source.
- **Scale:** every drawing is 13 m wide and shown at the same width, so they share one scale.
- **Kh-101 diameter:** `csis-kh101` gives 0.51 m and `gur-kh101` 0.742 m. The drawing uses the latter.
- **No drawing:** every other member. Each class has one representative drawing. Some of the others have no cited length, and for the unidentified ones there's no particular weapon to draw.

## Wording for the primer

Approved with the tables.

- **About the figures:** "These are published estimates and claims, not measurements. A span covers different versions, or sources that disagree. “Unknown” means we found no figure we could cite."
- **Mixed:** "“Mixed” is a way of reporting, not a type of weapon. It's one count that covers weapons from two or more classes. It counts toward totals and is never split between classes."
- **Decoys:** "The source counts decoy and imitator drones together with Shahed-type drones. This data can't separate them, so it can't show how many of the drones counted were decoys."
- **Left out:** "Reconnaissance, tactical and unidentified drones, including Lancet, and bombs aren't in totals, massive nights or intercept rates."

The approval also covers the names, roles, launch platforms and notes in `weapon_members.csv`, and the notes in `weapon_figures.csv`.

## What these sources cover in the glossary

[Plan §11](../../docs/plan.md#11-decisions) asks whether the general descriptions in [terms.ts](../../site/src/glossary/terms.ts) need sources. These pages cover some claims about particular weapons, not the general definitions:

| Glossary claim | Covered here |
|---|---|
| Shahed-136 and -131 are one-way attack drones, and Geran is Russia's name for them | Yes: `csis-shahed` |
| Some drones in or beside the Shahed count are jet-powered, and Gerbera is a decoy | Partly: `gur-geran4-news` and `gur-gerbera` describe the weapons. Neither shows what the Shahed count holds; that comes from the data audit. |
| Kinzhal is air-launched and ballistic | Yes: `csis-kinzhal` |
| Iskander-M can maneuver | Yes: `csis-iskander` |
| The Kh-31P is made to attack radars | Yes, from `wp-kh31` only |
| What "cruise", "ballistic", "aeroballistic", "hypersonic" and "decoy" mean in general | Not checked: no general reference page was opened |
| Electronic warfare, salvo and reporting window | No. The statements about this data trace to the data audit. |

So the question stays open. It would need a general reference for the weapon terms and for electronic warfare.

## License

`weapon_members.csv` copies raw `model` strings from the strike dataset, so treat it as [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), like `model_classes.csv`. Our choices and notes in `weapon_figures.csv` and `weapon_sources.csv` are CC BY 4.0. The figures are facts taken from the linked pages, which belong to their publishers. No text or images were copied, including for the [drawings](#drawings). See [LICENSING.md](../../LICENSING.md).
