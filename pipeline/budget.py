"""The 2 MB budget for the data and font the site loads (docs/plan.md §8).

It's counted before minifying or compression, with LF line endings, and 2 MB is
taken as 2,000,000 bytes. Every processed JSON file counts, whether or not the
site imports it yet, so that adding a chart can't break the budget unnoticed.
"""

from pathlib import Path

from pipeline.errors import PipelineError

BUDGET_BYTES = 2_000_000

# The reference files the site imports, or will: annotations.csv has no importer yet.
# A test fails if the site imports one that isn't listed.
SITE_REFERENCE_FILES = (
    "annotations.csv",
    "model_classes.csv",
    "oblasts.csv",
    "ukraine_admin1.geojson",
    "weapon_classes.csv",
    "weapon_figures.csv",
    "weapon_members.csv",
    "weapon_sources.csv",
)

# The font files the site serves. A test fails if there's one that isn't listed.
FONT_DIR = Path(__file__).resolve().parent.parent / "site" / "src" / "theme" / "fonts"
SITE_FONT_FILES = ("source-sans-3-latin-wght-normal.woff2",)


def reference_sizes(reference_dir):
    """{name: bytes} for the site's reference files that are in reference_dir.

    A made-up build has only some of them. A test requires all of them in the real folder.
    """
    paths = (reference_dir / name for name in SITE_REFERENCE_FILES)
    return {
        path.name: len(path.read_bytes().replace(b"\r\n", b"\n"))
        for path in paths
        if path.is_file()
    }


def font_sizes(font_dir=FONT_DIR):
    """{name: bytes} for the site's fonts. They're binary, so every byte counts."""
    return {name: (font_dir / name).stat().st_size for name in SITE_FONT_FILES}


def check_budget(sizes, limit=BUDGET_BYTES):
    """The total of {name: bytes}. Fails if it's over the limit."""
    total = sum(sizes.values())
    if total > limit:
        largest = ", ".join(
            f"{name} {size:,}" for name, size in sorted(sizes.items(), key=lambda i: -i[1])[:3]
        )
        raise PipelineError(
            f"The site's data and font are {total:,} bytes, over the {limit:,}-byte budget. "
            f"Largest: {largest}."
        )
    return total
