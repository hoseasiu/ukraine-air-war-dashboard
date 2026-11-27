# Accessibility, projector, Zoom and performance review

The #25 review, done Nov 26, 2026, on `main` at `0999b4e` plus the fixes listed below. It's a record of what was checked, not a conformance certificate.

## Physical checks

| Check | Status |
|---|---|
| Zoom screen-share | **Assumed to pass, on the owner's instruction (Nov 26, 2026). Nobody performed or observed it in this review.** |
| Projector | **Passed, as reported by the owner (Nov 26, 2026).** This review didn't observe it. The report didn't give the screen resolution or which build was shown. |

## Method

A production build, run in the Claude desktop app's built-in (Chromium) browser:

- Scripts run in the page on tabs A, B, E and Data & Methods, and on the guided stops: HTML text contrast, SVG text contrast against the page behind the chart (not against marks drawn under the text), names of controls, duplicate ids and broken id references, heading order, target size and unlabelled images. The tabs were also checked with every table shown and every notes section open.
- Layout at 320 px wide (reflow), at 320 px with WCAG text spacing (tabs and stops 1 and 9), and focus visibility at 640 × 360. Guided stops were also measured at 1280 × 720 and 1920 × 1080.
- Chart, line and period colors computed against white.
- Spot checks with the keyboard (skip link, arrow keys on a chart's points), and scripted checks that focus isn't lost when a control redraws the page or hidden behind the sticky filter bar.
- Source review of the tooltips, glossary popovers, filter panel, map animation and guided engine.

axe-core and other audit tools weren't used.

## Results

After the fixes, these checks found no WCAG 2.2 AA failure.

| Area | Result |
|---|---|
| Keyboard | Controls are native elements or buttons. A chart's points are one tab stop with arrow keys. No focus loss in the scripted check. Outside the skip link, which appears on focus, the one element the script flagged as hidden was a table taller than the window, which its sample points missed. |
| Tables and text alternatives | Each chart on the tabs offers a table, with a caption and headers, and has a text description. The drawings are hidden from screen readers. |
| Contrast | No text below the minimum in the scripted check. Class, comparison and period colors are at least 3:1 on white. The lightest steps of the calendar and map scales are below that; their cells and areas are outlined, and their figures are in tooltips and tables. |
| Reduced motion | By source review only: the map's Play button is hidden and a note says why, a change of setting stops playback, and a global rule cuts CSS animation and transitions. The setting couldn't be emulated. |
| Target size | Controls under 24 px have either a larger clickable label or enough space around them. Chart point buttons are 24 px. Links and terms inside text are exempt. |
| Reflow | Failed in three places, now fixed. Charts and data tables scroll sideways within their own area, which the criterion allows. |

## Fixed

| Finding | Criterion | Fix |
|---|---|---|
| At 320 px, the guided Next button ran off the right edge. | 1.4.10 Reflow | Back and Next shrink on the narrowest screens. |
| At 320 px, stop 11's points were 480 px wide, so the page scrolled sideways. | 1.4.10 Reflow | The grid's minimum width can't exceed the screen. The same guard is on stop 1's grid. |
| At 320 px, the filter panel scrolled sideways once the oblast list was in it. | 1.4.10 Reflow | The same guard on the oblast grid. |
| The calendar's outline for "No night in the data" was about 2.2:1. | 1.4.11 Non-text contrast | Darkened to about 3.4:1. |

## Filed

- #84: some guided stops need scrolling at 1920 × 1080 and 1280 × 720. This isn't a WCAG failure.

## Loading

- **Budget:** the pipeline's count of data and font is 1,338,916 bytes, under the 2,000,000-byte limit.
- **What the page loads:** HTML, one script (1,452,159 bytes, with the data built in), one stylesheet (28,941) and one font (28,872): about 1.51 MB before compression. Nothing else is requested, and no data is fetched.
- **Over the network:** the public preview, still on the build before these fixes, served gzip. The HTML, script and stylesheet were 277,527 bytes on the wire. With the font, that's about 306 KB.
- **Slow connection:** not throttled or timed. By arithmetic, 306 KB takes about 1.5 s at 1.6 Mbit/s, before latency and processing. Classroom Wi-Fi shared by many devices could be slower.
- **Local timing:** the built page's load event fired at about 0.5 s from a local server. Most later page changes took under 0.4 s. One first visit to stop 9 took 1.8 s; repeat visits took under 30 ms.

## Not checked

- A screen reader.
- Firefox, Safari, touch devices, forced colors and printing.
- A real projector and Zoom, by this review (see [Physical checks](#physical-checks)).
