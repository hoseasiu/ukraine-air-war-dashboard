"""One entry point for the data build, on Windows and Linux.

uv run python -m pipeline          build (downloads the alert files if missing)
uv run python -m pipeline fetch    only download and verify the pinned alert files
"""

import argparse
import sys

from pipeline.build import build
from pipeline.errors import PipelineError
from pipeline.sources import PROCESSED_DIR, RAW_DIR, fetch_alerts


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m pipeline", description="Build the data.")
    parser.add_argument(
        "command", nargs="?", choices=["build", "fetch"], default="build",
        help="build (default), or only fetch the pinned alert files",
    )
    args = parser.parse_args(argv)
    try:
        if args.command == "fetch":
            fetch_alerts(RAW_DIR)
        else:
            build(RAW_DIR, PROCESSED_DIR)
    except PipelineError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
