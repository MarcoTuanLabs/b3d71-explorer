#!/usr/bin/env python3
"""Utilities for the complete B3D71 S21-S40 spike recordings.

The browser's original per-unit raster export retained at most 300 events per
unit and trial.  These helpers rebuild trial windows directly from the paired
``spike_times`` and ``spike_clusters`` arrays so scientific analyses never
depend on that display-oriented cap.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Iterator

import numpy as np
from scipy.sparse import csr_matrix


DEFAULT_SPIKE_ROOT = Path(
    "/Users/mac/Documents/Neuron Visualization/yuwei/data/"
    "B3D71 Spike Timing and Unit Identity "
)
SESSION_IDS = tuple(range(21, 41))
N_UNITS = 1346
N_TRIALS = 80
TRIALS_PER_SESSION = 4
SAMPLE_RATE_HZ = 32_000
CUE_SECONDS = (5, 35, 65, 95)
TRIAL_START_SECONDS = -5.0
TRIAL_END_SECONDS = 20.0


def source_files(spike_root: Path) -> list[Path]:
    root = Path(spike_root).expanduser().resolve()
    files: list[Path] = []
    for session in SESSION_IDS:
        files.extend(
            [
                root / f"S{session}_spike_times.npy",
                root / f"S{session}_spike_clusters.npy",
            ]
        )
    return files


def validate_spike_root(spike_root: Path) -> dict[str, object]:
    root = Path(spike_root).expanduser().resolve()
    files = source_files(root)
    missing = [str(path) for path in files if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing raw spike files:\n" + "\n".join(missing))

    total_events = 0
    for session in SESSION_IDS:
        times = np.load(root / f"S{session}_spike_times.npy", mmap_mode="r")
        clusters = np.load(
            root / f"S{session}_spike_clusters.npy", mmap_mode="r"
        )
        if times.ndim != 1 or clusters.ndim != 1 or times.shape != clusters.shape:
            raise ValueError(
                f"S{session} time/cluster shape mismatch: "
                f"{times.shape} versus {clusters.shape}"
            )
        if clusters.size and (clusters.min() < 0 or clusters.max() >= N_UNITS):
            raise ValueError(f"S{session} contains an out-of-range unit ID")
        if times.size and not np.all(times == np.rint(times)):
            raise ValueError(f"S{session} spike times are not integer sample indices")
        total_events += int(times.size)

    return {
        "root": str(root),
        "sessions": [SESSION_IDS[0], SESSION_IDS[-1]],
        "files": len(files),
        "continuousEvents": total_events,
        "sampleRateHz": SAMPLE_RATE_HZ,
        "units": N_UNITS,
        "trials": N_TRIALS,
    }


def source_fingerprint(spike_root: Path) -> str:
    """Return a content digest for all paired time/cluster source files."""
    digest = hashlib.sha256()
    for path in source_files(spike_root):
        digest.update(path.name.encode("utf-8"))
        with path.open("rb") as handle:
            while chunk := handle.read(1024 * 1024):
                digest.update(chunk)
    return digest.hexdigest()


def iter_trial_windows(
    spike_root: Path,
) -> Iterator[tuple[int, np.ndarray, np.ndarray]]:
    """Yield ``trial, unit IDs, cue-relative sample offsets`` for 80 trials."""
    root = Path(spike_root).expanduser().resolve()
    start_offset = int(TRIAL_START_SECONDS * SAMPLE_RATE_HZ)
    stop_offset = int(TRIAL_END_SECONDS * SAMPLE_RATE_HZ)
    for session in SESSION_IDS:
        times = np.rint(
            np.load(root / f"S{session}_spike_times.npy", mmap_mode="r")
        ).astype(np.int64, copy=False)
        clusters = np.load(
            root / f"S{session}_spike_clusters.npy", mmap_mode="r"
        ).astype(np.int32, copy=False)
        for local_trial, cue_seconds in enumerate(CUE_SECONDS):
            cue_sample = cue_seconds * SAMPLE_RATE_HZ
            mask = (times >= cue_sample + start_offset) & (
                times < cue_sample + stop_offset
            )
            trial = (session - SESSION_IDS[0]) * TRIALS_PER_SESSION + local_trial
            yield trial, clusters[mask], times[mask] - cue_sample


def build_sparse_raster_matrix(
    spike_root: Path,
    n_units: int = N_UNITS,
    bin_hz: int = 80,
) -> csr_matrix:
    """Build unit x concatenated-trial spike counts directly from raw samples."""
    if SAMPLE_RATE_HZ % bin_hz:
        raise ValueError(f"{bin_hz} Hz does not divide {SAMPLE_RATE_HZ} Hz")
    bins_per_trial = int((TRIAL_END_SECONDS - TRIAL_START_SECONDS) * bin_hz)
    samples_per_bin = SAMPLE_RATE_HZ // bin_hz
    trial_start_samples = int(TRIAL_START_SECONDS * SAMPLE_RATE_HZ)
    rows: list[np.ndarray] = []
    columns: list[np.ndarray] = []
    values: list[np.ndarray] = []

    for trial, clusters, relative_samples in iter_trial_windows(spike_root):
        bins = (relative_samples - trial_start_samples) // samples_per_bin
        valid = (
            (clusters >= 0)
            & (clusters < n_units)
            & (bins >= 0)
            & (bins < bins_per_trial)
        )
        key = clusters[valid].astype(np.int64) * bins_per_trial + bins[valid]
        unique, counts = np.unique(key, return_counts=True)
        rows.append((unique // bins_per_trial).astype(np.int32))
        columns.append(
            (trial * bins_per_trial + unique % bins_per_trial).astype(np.int32)
        )
        values.append(counts.astype(np.float32))

    row = np.concatenate(rows)
    column = np.concatenate(columns)
    value = np.concatenate(values)
    matrix = csr_matrix(
        (value, (row, column)),
        shape=(n_units, N_TRIALS * bins_per_trial),
        dtype=np.float32,
    )
    matrix.sort_indices()
    return matrix


def collect_unit_rasters(
    spike_root: Path,
    n_units: int = N_UNITS,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Collect complete rasters in contiguous, unit-indexed NumPy arrays."""
    counts = np.zeros(n_units, dtype=np.int64)
    total = 0
    for _, clusters, _ in iter_trial_windows(spike_root):
        counts += np.bincount(clusters, minlength=n_units)[:n_units]
        total += int(clusters.size)

    offsets = np.zeros(n_units + 1, dtype=np.int64)
    offsets[1:] = np.cumsum(counts)
    if int(offsets[-1]) != total:
        raise ValueError("Unit counts do not sum to the full trial-window event count")

    event_trials = np.empty(total, dtype=np.uint8)
    event_samples = np.empty(total, dtype=np.int32)
    cursor = offsets[:-1].copy()
    for trial, clusters, relative_samples in iter_trial_windows(spike_root):
        order = np.argsort(clusters, kind="stable")
        sorted_clusters = clusters[order]
        sorted_samples = relative_samples[order].astype(np.int32, copy=False)
        units, starts, lengths = np.unique(
            sorted_clusters, return_index=True, return_counts=True
        )
        for unit, start, length in zip(units, starts, lengths):
            unit = int(unit)
            if unit < 0 or unit >= n_units:
                continue
            destination = int(cursor[unit])
            stop = destination + int(length)
            event_trials[destination:stop] = trial
            event_samples[destination:stop] = sorted_samples[start : start + length]
            cursor[unit] = stop

    if not np.array_equal(cursor, offsets[1:]):
        raise ValueError("Raster fill cursors do not match the expected unit offsets")
    return offsets, event_trials, event_samples


def read_unit_payload(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.UNIT_CACHE\[\d+\]=(\{.*\});\s*$", text)
    if not match:
        raise ValueError(f"Could not parse {path}")
    return json.loads(match.group(1))


def rebuild_browser_rasters(
    app_root: Path,
    spike_root: Path,
    fingerprint: str | None = None,
) -> dict[str, object]:
    """Replace capped browser raster arrays while preserving supplied summaries."""
    app_root = Path(app_root).resolve()
    spike_root = Path(spike_root).expanduser().resolve()
    fingerprint = fingerprint or source_fingerprint(spike_root)
    offsets, trials, samples = collect_unit_rasters(spike_root)
    prior_events = 0
    psth_count_errors: list[dict[str, object]] = []

    for unit_id in range(N_UNITS):
        path = app_root / "data" / "units" / f"u{unit_id}.js"
        payload = read_unit_payload(path)
        prior_events += len(payload.get("raster", {}).get("t", []))
        start, stop = int(offsets[unit_id]), int(offsets[unit_id + 1])
        unit_samples = samples[start:stop].astype(np.float64) / SAMPLE_RATE_HZ
        payload["raster"] = {
            "tr": trials[start:stop].astype(int).tolist(),
            "t": np.round(unit_samples, 6).tolist(),
        }
        payload["rasterMeta"] = {
            "source": "S21-S40 paired spike_times/spike_clusters NPY files",
            "complete": True,
            "windowSeconds": [TRIAL_START_SECONDS, TRIAL_END_SECONDS],
            "sampleRateHz": SAMPLE_RATE_HZ,
            "timePrecisionSeconds": 0.000001,
            "sourceFingerprint": fingerprint,
        }

        psth = np.asarray(payload.get("psth", []), dtype=float)
        psth_dx = float(payload.get("psthDx", 0.0) or 0.0)
        if psth.size and psth_dx > 0:
            implied = int(round(float(psth.sum()) * N_TRIALS * psth_dx))
            if abs(implied - (stop - start)) > 2:
                psth_count_errors.append(
                    {
                        "unit": unit_id,
                        "rawEvents": stop - start,
                        "psthImpliedEvents": implied,
                    }
                )

        temporary = path.with_suffix(".js.tmp")
        temporary.write_text(
            f"window.UNIT_CACHE=window.UNIT_CACHE||{{}};"
            f"window.UNIT_CACHE[{unit_id}]="
            + json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
            + ";\n",
            encoding="utf-8",
        )
        temporary.replace(path)
        if (unit_id + 1) % 200 == 0 or unit_id + 1 == N_UNITS:
            print(f"  rebuilt browser rasters {unit_id + 1}/{N_UNITS}", flush=True)

    complete_events = int(offsets[-1])
    return {
        "source": "S21-S40 paired spike_times/spike_clusters NPY files",
        "sourceRoot": str(spike_root),
        "sourceFingerprint": fingerprint,
        "sampleRateHz": SAMPLE_RATE_HZ,
        "trialMapping": "session S(21 + floor(trial/4)); cue at 5 + 30*(trial mod 4) seconds",
        "trialWindowSeconds": [TRIAL_START_SECONDS, TRIAL_END_SECONDS],
        "units": N_UNITS,
        "trials": N_TRIALS,
        "previousBrowserEvents": prior_events,
        "completeBrowserEvents": complete_events,
        "eventsRestored": complete_events - prior_events,
        "previousRetentionFraction": round(prior_events / complete_events, 6),
        "maximumUnitEvents": int(np.diff(offsets).max()),
        "maximumUnitId": int(np.argmax(np.diff(offsets))),
        "psthEventAuditFailures": psth_count_errors,
    }


def main() -> None:
    app_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spike-root", type=Path, default=DEFAULT_SPIKE_ROOT)
    parser.add_argument("--app-root", type=Path, default=app_root)
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="validate and fingerprint the raw source without rewriting unit files",
    )
    args = parser.parse_args()
    summary = validate_spike_root(args.spike_root)
    fingerprint = source_fingerprint(args.spike_root)
    summary["sourceFingerprint"] = fingerprint
    if not args.verify_only:
        summary.update(
            rebuild_browser_rasters(args.app_root, args.spike_root, fingerprint)
        )
        destination = args.app_root / "data" / "spike_provenance.js"
        destination.write_text(
            "window.SPIKE_PROVENANCE="
            + json.dumps(summary, separators=(",", ":"), ensure_ascii=True)
            + ";\n",
            encoding="utf-8",
        )
        print(f"Wrote {destination}", flush=True)
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
