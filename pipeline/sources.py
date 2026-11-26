"""The raw input files: where they come from, and the pinned alerts fetch."""

import hashlib
import urllib.request
from pathlib import Path

from pipeline.errors import PipelineError

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"
REFERENCE_DIR = ROOT / "data" / "reference"

# Kaggle needs a login, so a person downloads these. They aren't pinned: a snapshot
# refresh replaces them, and the manifest records which files a build used.
KAGGLE_URL = "https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine"
KAGGLE_LICENSE = "CC BY-NC-SA 4.0"
KAGGLE_DAILY = "missile_attacks_daily.csv"
KAGGLE_REFERENCE = "missiles_and_uavs.csv"
KAGGLE_FILES = (KAGGLE_DAILY, KAGGLE_REFERENCE)

# The commit audited in #2. To move it (#28), change the commit and both checksums
# together, rerun pipeline/audit/alerts.py and update data/README.md.
ALERTS_REPO = "Vadimkin/ukrainian-air-raid-sirens-dataset"
ALERTS_COMMIT = "1a349789e45d63a19c8faf46d0e5877cbb36ac8b"
ALERTS_SHA256 = {
    "official_data_en.csv": "b396f87696243069eec0219880e87dcd642b20beb0a7bae0d0e1f61e1ed20ec4",
    "volunteer_data_en.csv": "c67fb71a19c69e690d4921fd5edc8338892bcf4a5a6b6a23836e600bf2a5f454",
}


def sha256_of(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def alert_url(name):
    return f"https://raw.githubusercontent.com/{ALERTS_REPO}/{ALERTS_COMMIT}/datasets/{name}"


def require_kaggle(raw_dir):
    missing = [name for name in KAGGLE_FILES if not (raw_dir / name).is_file()]
    if missing:
        raise PipelineError(
            f"Missing Kaggle file(s) in {raw_dir}: {', '.join(missing)}.\n"
            f"They need a Kaggle login, so the build can't download them. Get the dataset "
            f"from {KAGGLE_URL} (or the repo owner's archive.zip) and extract both CSVs "
            f"into that folder. See data/README.md."
        )


def download(url, destination):
    try:
        with urllib.request.urlopen(url, timeout=60) as response, destination.open("wb") as out:
            while chunk := response.read(1 << 20):
                out.write(chunk)
    except OSError as error:
        raise PipelineError(f"Couldn't download {url}: {error}") from error


def fetch_alerts(raw_dir, checksums=ALERTS_SHA256, downloader=download):
    """Make sure the pinned alert files are in raw_dir. Uses the network only if one is missing.

    A file that doesn't match its checksum is never overwritten.
    """
    raw_dir.mkdir(parents=True, exist_ok=True)
    for name, expected in checksums.items():
        path = raw_dir / name
        if path.exists():
            actual = sha256_of(path)
            if actual != expected:
                raise PipelineError(
                    f"{path} doesn't match commit {ALERTS_COMMIT[:7]} "
                    f"(sha256 {actual}, expected {expected}). Raw files must not be edited. "
                    f"Delete or move it, then run the build again."
                )
            print(f"{name}: present, checksum OK")
            continue
        print(f"{name}: downloading from commit {ALERTS_COMMIT[:7]}")
        partial = path.with_name(name + ".part")
        try:
            downloader(alert_url(name), partial)
            actual = sha256_of(partial)
            if actual != expected:
                raise PipelineError(
                    f"The download of {name} has sha256 {actual}, expected {expected}."
                )
            partial.replace(path)
        finally:
            partial.unlink(missing_ok=True)
        print(f"{name}: downloaded, checksum OK")
