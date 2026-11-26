"""Pipeline scaffold tests. All inputs are made up; no source rows are copied."""

import csv
import hashlib
import json

import pytest

from pipeline import __main__ as cli
from pipeline.build import build
from pipeline.columns import COLUMNS, read_raw
from pipeline.errors import PipelineError
from pipeline.sources import KAGGLE_DAILY, KAGGLE_REFERENCE, fetch_alerts

ALERTS = ("official_data_en.csv", "volunteer_data_en.csv")


def write_csv(path, header, rows=()):
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(header)
        writer.writerows([[row.get(column, "") for column in header] for row in rows])


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture
def raw(tmp_path):
    folder = tmp_path / "raw"
    folder.mkdir()
    write_csv(folder / KAGGLE_DAILY, list(COLUMNS[KAGGLE_DAILY]), [
        {"time_end": "2030-03-02 09:00", "model": "Тест"},
        {"time_end": "2030-03-04  "},
        {"time_end": "2030-03-01"},
    ])
    for name in (KAGGLE_REFERENCE, *ALERTS):
        write_csv(folder / name, list(COLUMNS[name]), [{}])
    return folder


def checksums(folder):
    return {name: digest(folder / name) for name in ALERTS}


def no_network(url, destination):
    raise AssertionError(f"unexpected download of {url}")


def test_build_writes_manifest_and_snapshot_date(raw, tmp_path):
    out = tmp_path / "processed"
    build(raw, out, checksums(raw))
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["snapshot_date"] == "2030-03-04"
    assert json.loads((out / "build_info.json").read_text()) == {"snapshot_date": "2030-03-04"}
    files = [f for source in manifest["sources"].values() for f in source["files"]]
    assert {f["name"] for f in files} == set(COLUMNS)
    for entry in files:
        assert entry["sha256"] == digest(raw / entry["name"])
    assert files[0]["rows"] == 3


def test_build_is_reproducible(raw, tmp_path):
    out = tmp_path / "processed"
    build(raw, out, checksums(raw))
    first = {p.name: p.read_bytes() for p in out.iterdir()}
    build(raw, out, checksums(raw))
    assert {p.name: p.read_bytes() for p in out.iterdir()} == first
    assert all(b"\r" not in content for content in first.values())


@pytest.mark.parametrize("name", [KAGGLE_DAILY, KAGGLE_REFERENCE])
def test_missing_kaggle_file_is_a_clear_error(raw, tmp_path, name):
    (raw / name).unlink()
    with pytest.raises(PipelineError, match=f"Missing Kaggle.*{name}"):
        build(raw, tmp_path / "processed", checksums(raw))
    assert not (tmp_path / "processed").exists()


def test_cli_reports_missing_kaggle_files_without_a_traceback(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "RAW_DIR", tmp_path / "empty")
    monkeypatch.setattr(cli, "PROCESSED_DIR", tmp_path / "processed")
    assert cli.main([]) == 1
    error = capsys.readouterr().err
    assert error.startswith("Error: Missing Kaggle")
    assert "data/README.md" in error
    assert "Traceback" not in error


@pytest.mark.parametrize("value", ["", "March 4", "2030-02-30", "2030-03-04T09:00"])
def test_bad_time_end_fails(raw, tmp_path, value):
    write_csv(raw / KAGGLE_DAILY, list(COLUMNS[KAGGLE_DAILY]), [{"time_end": value}])
    with pytest.raises(PipelineError, match="time_end"):
        build(raw, tmp_path / "processed", checksums(raw))


@pytest.mark.parametrize("change", ["missing", "extra"])
def test_changed_header_fails(raw, change):
    header = list(COLUMNS[KAGGLE_DAILY])
    header = header[1:] if change == "missing" else [*header, "new_column"]
    write_csv(raw / KAGGLE_DAILY, header)
    with pytest.raises(PipelineError, match="don't match"):
        read_raw(raw, KAGGLE_DAILY)


def test_read_raw_renames_and_keeps_the_file(raw):
    before = (raw / "volunteer_data_en.csv").read_bytes()
    frame = read_raw(raw, "volunteer_data_en.csv")
    assert "oblast" in frame.columns and "region" not in frame.columns
    assert (raw / "volunteer_data_en.csv").read_bytes() == before


def test_mapping_never_merges_two_columns():
    for mapping in COLUMNS.values():
        assert len(set(mapping.values())) == len(mapping)


def test_fetch_skips_the_network_when_files_match(raw):
    fetch_alerts(raw, checksums(raw), no_network)


def test_fetch_never_overwrites_a_mismatched_file(raw):
    expected = checksums(raw)
    (raw / ALERTS[0]).write_bytes(b"edited")
    with pytest.raises(PipelineError, match="doesn't match"):
        fetch_alerts(raw, expected, no_network)
    assert (raw / ALERTS[0]).read_bytes() == b"edited"


def test_fetch_downloads_a_missing_file_from_the_pinned_commit(tmp_path):
    urls = []

    def fake(url, destination):
        urls.append(url)
        destination.write_bytes(b"data")

    fetch_alerts(tmp_path, {"a.csv": hashlib.sha256(b"data").hexdigest()}, fake)
    assert (tmp_path / "a.csv").read_bytes() == b"data"
    assert "/1a349789e45d63a19c8faf46d0e5877cbb36ac8b/datasets/a.csv" in urls[0]


@pytest.mark.parametrize("fails", ["checksum", "network"])
def test_failed_download_leaves_nothing_behind(tmp_path, fails):
    def fake(url, destination):
        destination.write_bytes(b"partial")
        if fails == "network":
            raise PipelineError("Couldn't download")

    with pytest.raises(PipelineError):
        fetch_alerts(tmp_path, {"a.csv": "0" * 64}, fake)
    assert list(tmp_path.iterdir()) == []
