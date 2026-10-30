#!/usr/bin/env python3
"""Reconstruct functional-hierarchy analyses from the complete S21-S40 recordings.

The paired spike-time and spike-cluster arrays retain every event at 32 kHz.
This builder therefore reproduces both full-trial feature definitions shown in
the reference figures without passing through browser-oriented raster exports:

* raw: 80 trials x 25 seconds x 80 Hz, concatenated before Pearson correlation;
* normalized: a centered five-bin moving average followed by a separate
  within-unit z-score for every 25-second trial, then concatenation.

The cue hierarchy and its z-score heatmap are rebuilt from those same rasters.
Teacher screenshots are used only for a count/range audit; no class or graph
membership is fitted to a reference count.
"""

from __future__ import annotations

import argparse
import gc
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

import networkx as nx
import numpy as np
from PIL import Image
from scipy.cluster.hierarchy import dendrogram, fcluster, leaves_list, linkage
from scipy.cluster.vq import kmeans2
from scipy.optimize import linear_sum_assignment
from scipy.sparse import csr_matrix, diags
from scipy.sparse.csgraph import laplacian
from scipy.sparse.linalg import eigsh
from scipy.spatial.distance import squareform

from full_spike_data import (
    DEFAULT_SPIKE_ROOT,
    build_sparse_raster_matrix,
    source_fingerprint,
    validate_spike_root,
)


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "hierarchy"
CLASS_COLORS = ["#e76f00", "#49b653", "#ff3f91", "#24a7df", "#6657c8"]
AREAS = ("M2", "M1", "S1")
REFERENCE_SUBTYPE_COUNTS = {
    "C1a": 91, "C1b": 86, "C1c": 25, "C1d": 42, "C1e": 28,
    "C2a": 4,
    "C3a": 30, "C3b": 20, "C3c": 15,
    "C4a": 7,
    "C5a": 276, "C5b": 115, "C5c": 168,
    "C5d": 95, "C5e": 150, "C5f": 194,
}
REFERENCE_COMMUNITY_AREAS = np.asarray(
    [
        [348, 296, 341],
        [0, 0, 115],
        [57, 31, 2],
        [2, 63, 0],
        [0, 0, 29],
        [0, 0, 27],
        [0, 21, 0],
        [4, 7, 3],
    ],
    dtype=int,
)
REFERENCE_MATRIX_RANGES = {
    "raw": [-0.014, 0.046],
    "smoothed": [-0.050, 0.138],
}
REFERENCE_HIERARCHY_AREAS = {
    "raw": np.asarray(
        [
            [4, 7, 3],
            [2, 0, 0],
            [3, 0, 2],
            [396, 407, 509],
            [6, 4, 3],
        ],
        dtype=int,
    ),
    "smoothed": np.asarray(
        [
            [4, 7, 2],
            [399, 405, 512],
            [2, 4, 0],
            [1, 0, 1],
            [5, 2, 2],
        ],
        dtype=int,
    ),
}
REFERENCE_EDGE_STRENGTH = [
    [67.4, 143.7, 90.3],
    [143.7, 206.7, 220.1],
    [90.3, 220.1, 444.1],
]
REFERENCE_HUBS = [
    (828, "S1", "C1", 65.53),
    (171, "M1", "C1", 58.94),
    (1200, "S1", "C1", 55.90),
    (383, "M1", "C1", 54.76),
    (495, "M1", "C1", 49.18),
    (175, "M1", "C1", 34.46),
    (1206, "S1", "C1", 33.37),
    (472, "S1", "C1", 20.27),
]
REFERENCE_BRIDGES = [
    (171, "M1", "C1", 58.94),
    (383, "M1", "C1", 54.76),
    (828, "S1", "C1", 65.53),
    (495, "M1", "C1", 49.18),
    (1200, "S1", "C1", 55.90),
    (175, "M1", "C1", 34.46),
    (1206, "S1", "C1", 33.37),
    (472, "S1", "C1", 20.27),
]
N_TRIALS = 80
TRIAL_START = -5.0
TRIAL_END = 20.0
BIN_HZ = 80
BINS_PER_TRIAL = int((TRIAL_END - TRIAL_START) * BIN_HZ)
N_FEATURES = N_TRIALS * BINS_PER_TRIAL
CUE_START = -1.0
CUE_END = 5.0
CUE_HZ = 20
SUBTYPE_CHILDREN = {1: 5, 2: 1, 3: 3, 4: 1, 5: 6}
SUBTYPE_KMEANS_STARTS = 32
GRAPH_COMMUNITIES = 8
GRAPH_LPA_RUNS = 100


def assigned_json(path: Path) -> dict | list:
    text = path.read_text()
    return json.loads(text[text.index("=") + 1 :].strip().rstrip(";"))


def correlation(values: np.ndarray) -> np.ndarray:
    corr = np.corrcoef(values)
    corr = np.nan_to_num(corr, nan=0.0, posinf=0.0, neginf=0.0)
    np.fill_diagonal(corr, 1.0)
    return np.clip(corr, -1.0, 1.0)


def hierarchy(corr: np.ndarray, euclidean_equivalent: bool = False) -> tuple[np.ndarray, np.ndarray]:
    distance = np.clip(1.0 - corr, 0.0, 2.0)
    if euclidean_equivalent:
        distance = np.sqrt(2.0 * distance)
    np.fill_diagonal(distance, 0.0)
    tree = linkage(squareform(distance, checks=False), method="average")
    return tree, leaves_list(tree).astype(int)


def ordered_labels(raw: np.ndarray, order: np.ndarray) -> np.ndarray:
    position = np.empty(len(order), dtype=int)
    position[order] = np.arange(len(order))
    labels = sorted(np.unique(raw), key=lambda label: float(np.median(position[raw == label])))
    mapping = {label: index + 1 for index, label in enumerate(labels)}
    return np.array([mapping[label] for label in raw], dtype=int)


def orient_tree_by_class(tree: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """Rotate linkage branches so displayed classes run from C1 through C5."""
    oriented = tree.copy()
    n = len(labels)
    subtree_key: dict[int, tuple[int, int]] = {
        index: (int(labels[index]), index) for index in range(n)
    }
    for row_index, row in enumerate(oriented):
        left, right = int(row[0]), int(row[1])
        if subtree_key[left] > subtree_key[right]:
            oriented[row_index, 0], oriented[row_index, 1] = right, left
            left, right = right, left
        subtree_key[n + row_index] = min(subtree_key[left], subtree_key[right])
    return oriented


def cut_hierarchy(tree: np.ndarray, n_classes: int = 5) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Cut a recovered tree and number classes by their displayed leaf order."""
    initial_order = leaves_list(tree).astype(int)
    labels = ordered_labels(
        fcluster(tree, t=n_classes, criterion="maxclust"),
        initial_order,
    )
    oriented = orient_tree_by_class(tree, labels)
    order = leaves_list(oriented).astype(int)
    labels = ordered_labels(labels, order)
    return oriented, order, labels


def semantic_cue_labels(
    labels: np.ndarray,
    profiles: np.ndarray,
    tax: np.ndarray,
) -> np.ndarray:
    """Name five data-derived cue clusters by their response archetypes.

    Class numbers in the reference have functional meaning: C1 is suppressed,
    C5 is early excited, C3 rises later, and C2/C4 are low-rate classes. This
    mapping uses only raster profile shape and rate; teacher class sizes never
    enter the assignment.
    """
    stats: dict[int, dict[str, float]] = {}
    for label in np.unique(labels):
        mean_profile = profiles[labels == label].mean(axis=0)
        baseline = float(mean_profile[tax < 0].mean())
        early = float(mean_profile[(tax >= 0) & (tax < 1)].mean())
        late = float(mean_profile[tax >= 3].mean())
        stats[int(label)] = {
            "earlyDelta": early - baseline,
            "lateRise": late - early,
            "mean": float(mean_profile.mean()),
        }
    available = set(stats)
    excited = max(available, key=lambda label: stats[label]["earlyDelta"])
    available.remove(excited)
    suppressed = min(available, key=lambda label: stats[label]["earlyDelta"])
    available.remove(suppressed)
    slow_rising = max(available, key=lambda label: stats[label]["lateRise"])
    available.remove(slow_rising)
    low_rate, high_rate = sorted(available, key=lambda label: stats[label]["mean"])
    mapping = {
        suppressed: 1,
        low_rate: 2,
        slow_rising: 3,
        high_rate: 4,
        excited: 5,
    }
    return np.asarray([mapping[int(label)] for label in labels], dtype=int)


def full_trial_display_labels(
    labels: np.ndarray,
    profiles: np.ndarray,
    mode: str,
) -> np.ndarray:
    """Apply the reference panel's class-name convention without changing membership.

    Full-trial class numbers are nominal. The source panels consistently name
    the dominant raw class C4 and the dominant normalized class C2. Remaining
    names follow descending reconstructed class size. This mapping affects
    color/order only; no reference count is used to form a cluster.
    """
    counts = Counter(int(label) for label in labels)
    ranked = [label for label, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))]
    mapping = {ranked[0]: 4 if mode == "raw" else 2, ranked[1]: 1}
    remaining = ranked[2:]
    means = {label: float(profiles[labels == label].mean()) for label in remaining}
    peaks = {label: float(profiles[labels == label].mean(axis=0).max()) for label in remaining}
    if mode == "raw":
        low = min(remaining, key=lambda label: (means[label], label))
        high = max(remaining, key=lambda label: (means[label], -label))
        middle = next(label for label in remaining if label not in (low, high))
        mapping.update({low: 2, high: 3, middle: 5})
    else:
        low = min(remaining, key=lambda label: (means[label], label))
        candidates = [label for label in remaining if label != low]
        transient = max(candidates, key=lambda label: (peaks[label], -label))
        other = next(label for label in candidates if label != transient)
        mapping.update({low: 4, transient: 5, other: 3})
    return np.asarray([mapping[int(label)] for label in labels], dtype=int)


def best_kmeans(
    values: np.ndarray,
    clusters: int,
    starts: int,
    seed: int,
) -> tuple[np.ndarray, np.ndarray, float]:
    """Return the lowest-inertia non-empty k-means solution across starts."""
    if clusters == 1:
        centroid = values.mean(axis=0, keepdims=True)
        labels = np.zeros(len(values), dtype=int)
        inertia = float(np.square(values - centroid).sum())
        return centroid, labels, inertia
    best: tuple[np.ndarray, np.ndarray, float] | None = None
    for start in range(starts):
        centroids, labels = kmeans2(
            values,
            clusters,
            minit="++",
            iter=200,
            seed=seed + start,
            check_finite=False,
        )
        labels = labels.astype(int)
        if len(np.unique(labels)) != clusters:
            continue
        inertia = float(np.square(values - centroids[labels]).sum())
        if best is None or inertia < best[2]:
            best = (centroids, labels, inertia)
    if best is None:
        raise RuntimeError(f"no non-empty {clusters}-cluster k-means solution")
    return best


def subtype_labels(
    values: np.ndarray,
    major: np.ndarray,
    starts: int = SUBTYPE_KMEANS_STARTS,
    seed: int = 20260721,
) -> tuple[list[str], list[str]]:
    """Partition each cue class at the reference panel's 16-subtype resolution.

    The number of children per major class (5/1/3/1/6) is taken from the
    displayed resolution, but membership and child order are data-derived.
    Each nontrivial partition uses multi-start k-means on raster-derived,
    row-z-scored cue profiles; the minimum-inertia solution is retained.
    """
    labels_by_id = np.empty(len(major), dtype=object)
    ordered: list[str] = []
    for parent in range(1, 6):
        members = np.flatnonzero(major == parent)
        child_count = min(SUBTYPE_CHILDREN[parent], len(members))
        if child_count == 1 or len(members) <= 1:
            raw_children = np.ones(len(members), dtype=int)
        else:
            _, zero_based, _ = best_kmeans(
                values[members],
                child_count,
                starts=starts,
                seed=seed + 1000 * parent,
            )
            raw_children = zero_based + 1
        child_labels = sorted(np.unique(raw_children))
        child_labels.sort(
            key=lambda child: (
                int(np.argmax(values[members[raw_children == child]].mean(axis=0))),
                -int(np.sum(raw_children == child)),
                int(child),
            )
        )
        names = [f"C{parent}{chr(97 + index)}" for index in range(len(child_labels))]
        for child, label in zip(child_labels, names):
            labels_by_id[members[raw_children == child]] = label
        ordered.extend(names)
    return labels_by_id.tolist(), ordered


def hierarchy_segments(tree: np.ndarray, major: np.ndarray) -> list[dict]:
    n = len(major)
    merge_class: dict[int, int] = {index: int(major[index]) for index in range(n)}
    for index, row in enumerate(tree):
        left, right = int(row[0]), int(row[1])
        left_class, right_class = merge_class[left], merge_class[right]
        merge_class[n + index] = left_class if left_class == right_class else 0

    def color_link(node_id: int) -> str:
        label = merge_class.get(int(node_id), 0)
        return CLASS_COLORS[label - 1] if label else "#68758a"

    info = dendrogram(tree, no_plot=True, link_color_func=color_link)
    max_distance = max(max(values) for values in info["dcoord"]) or 1.0
    count = len(info["leaves"])
    segments = []
    for leaf_coords, distances, color in zip(info["icoord"], info["dcoord"], info["color_list"]):
        row = [max(0.0, min(1.0, (value - 5.0) / (10.0 * max(1, count - 1)))) for value in leaf_coords]
        dist = [value / max_distance for value in distances]
        segments.append(
            {
                "points": [
                    round(dist[0], 4), round(row[0], 5),
                    round(dist[1], 4), round(row[1], 5),
                    round(dist[2], 4), round(row[2], 5),
                    round(dist[3], 4), round(row[3], 5),
                ],
                "color": color,
            }
        )
    return segments


def class_summaries(
    values: np.ndarray,
    labels: np.ndarray,
    units: list[dict],
    raster_mean_hz: np.ndarray,
) -> list[dict]:
    out = []
    for label in sorted(np.unique(labels)):
        members = np.flatnonzero(labels == label)
        counts = Counter(units[index]["area"] for index in members)
        out.append(
            {
                "label": f"C{int(label)}",
                "n": int(len(members)),
                "values": np.round(values[members].mean(axis=0), 3).tolist(),
                "areas": {area: int(counts.get(area, 0)) for area in AREAS},
                "meanHz": round(float(raster_mean_hz[members].mean()), 3),
            }
        )
    return out


def subtype_summaries(
    values: np.ndarray,
    corr: np.ndarray,
    labels: list[str],
    ordered: list[str],
    units: list[dict],
    raster_mean_hz: np.ndarray,
    stability: dict[str, dict[str, float]],
) -> list[dict]:
    labels_array = np.array(labels)
    out = []
    for label in ordered:
        members = np.flatnonzero(labels_array == label)
        counts = Counter(units[index]["area"] for index in members)
        if len(members) > 1:
            block = corr[np.ix_(members, members)]
            within_pearson = float((block.sum() - len(members)) / (len(members) * (len(members) - 1)))
        else:
            within_pearson = 1.0
        out.append(
            {
                "label": label,
                "major": label[:2],
                "n": int(len(members)),
                "values": np.round(values[members].mean(axis=0), 3).tolist(),
                "areas": {area: int(counts.get(area, 0)) for area in AREAS},
                "stability": stability[label]["mean"],
                "stabilityCI": [stability[label]["low"], stability[label]["high"]],
                "withinSubtypePearson": round(within_pearson, 3),
                "meanHz": round(float(raster_mean_hz[members].mean()), 3),
            }
        )
    return out


def grayscale_image(
    corr: np.ndarray,
    order: np.ndarray,
    path: Path,
    robust: bool,
    display_range: list[float] | None = None,
) -> list[float]:
    matrix = corr[np.ix_(order, order)]
    if display_range is not None:
        lo, hi = display_range
    elif robust:
        off_diagonal = matrix[~np.eye(matrix.shape[0], dtype=bool)]
        lo, hi = np.quantile(off_diagonal, [0.005, 0.995])
    else:
        lo, hi = -1.0, 1.0
    if hi - lo < 1e-8:
        hi = lo + 1.0
    normalized = np.clip((matrix - lo) / (hi - lo), 0.0, 1.0)
    gray = np.round(12 + normalized * 243).astype(np.uint8)
    rgb = np.repeat(gray[:, :, None], 3, axis=2)
    image = Image.fromarray(rgb, "RGB")
    image.resize((900, 900), Image.Resampling.BILINEAR).save(path, optimize=True)
    return [round(float(lo), 4), round(float(hi), 4)]


def build_raster_matrix(
    n_units: int,
    spike_root: Path = DEFAULT_SPIKE_ROOT,
) -> csr_matrix:
    """Build the full unit x trial matrix from S21-S40 sample indices."""
    return build_sparse_raster_matrix(spike_root, n_units=n_units, bin_hz=BIN_HZ)


def raster_trial_mean_profiles(matrix: csr_matrix, output_hz: int = 40) -> np.ndarray:
    """Average all raster trials into physical-rate profiles at ``output_hz``."""
    if BIN_HZ % output_hz:
        raise ValueError(f"{output_hz} Hz must divide the {BIN_HZ} Hz raster grid")
    counts = np.zeros((matrix.shape[0], BINS_PER_TRIAL), dtype=np.float64)
    for trial in range(N_TRIALS):
        start = trial * BINS_PER_TRIAL
        counts += matrix[:, start : start + BINS_PER_TRIAL].toarray()
    group = BIN_HZ // output_hz
    return counts.reshape(matrix.shape[0], BINS_PER_TRIAL // group, group).sum(axis=2) * (
        output_hz / N_TRIALS
    )


def row_zscore(values: np.ndarray) -> np.ndarray:
    mean = values.mean(axis=1, keepdims=True)
    std = values.std(axis=1, keepdims=True)
    return np.divide(values - mean, std, out=np.zeros_like(values), where=std > 1e-12)


def cue_profiles_from_rasters(
    full_profiles: np.ndarray,
    profile_hz: int = 40,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Return 20-Hz cue rates, row z-scores, time centers, and peak bins."""
    relative_tax = TRIAL_START + (np.arange(full_profiles.shape[1]) + 0.5) / profile_hz
    mask = (relative_tax >= CUE_START) & (relative_tax < CUE_END)
    cue_40 = full_profiles[:, mask]
    group = profile_hz // CUE_HZ
    cue_rate = cue_40.reshape(cue_40.shape[0], -1, group).mean(axis=2)
    cue_z = row_zscore(cue_rate)
    tax = CUE_START + (np.arange(cue_rate.shape[1]) + 0.5) / CUE_HZ
    return cue_rate, cue_z, tax, np.argmax(cue_z, axis=1)


def raster_cue_trial_profiles(matrix: csr_matrix) -> np.ndarray:
    """Return per-trial cue-window firing rates at 20 Hz.

    The result has shape ``trial x unit x cue-bin``. Keeping trials separate
    allows subtype stability to be estimated by resampling trials instead of
    borrowing values from the reference image.
    """
    start_bin = int(round((CUE_START - TRIAL_START) * BIN_HZ))
    end_bin = int(round((CUE_END - TRIAL_START) * BIN_HZ))
    bins_per_output = BIN_HZ // CUE_HZ
    cue_bins = (end_bin - start_bin) // bins_per_output
    out = np.empty((N_TRIALS, matrix.shape[0], cue_bins), dtype=np.float32)
    for trial in range(N_TRIALS):
        offset = trial * BINS_PER_TRIAL
        counts = matrix[:, offset + start_bin : offset + end_bin].toarray()
        out[trial] = counts.reshape(matrix.shape[0], cue_bins, bins_per_output).sum(axis=2) * CUE_HZ
    return out


def cue_profiles_from_trials(
    trial_profiles: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Average trial-resolved cue profiles and return rate, z, time, and peak."""
    cue_rate = trial_profiles.mean(axis=0, dtype=np.float64)
    cue_z = row_zscore(cue_rate)
    tax = CUE_START + (np.arange(cue_rate.shape[1]) + 0.5) / CUE_HZ
    return cue_rate, cue_z, tax, np.argmax(cue_z, axis=1)


def align_partition(reference: np.ndarray, candidate: np.ndarray) -> np.ndarray:
    """Align arbitrary candidate labels to reference labels by maximum overlap."""
    reference_labels = np.unique(reference)
    candidate_labels = np.unique(candidate)
    overlap = np.zeros((len(reference_labels), len(candidate_labels)), dtype=np.int64)
    reference_index = {int(label): index for index, label in enumerate(reference_labels)}
    candidate_index = {int(label): index for index, label in enumerate(candidate_labels)}
    for left, right in zip(reference, candidate):
        overlap[reference_index[int(left)], candidate_index[int(right)]] += 1
    reference_rows, candidate_columns = linear_sum_assignment(-overlap)
    mapping = {
        int(candidate_labels[column]): int(reference_labels[row])
        for row, column in zip(reference_rows, candidate_columns)
    }
    return np.asarray([mapping.get(int(label), -1) for label in candidate], dtype=int)


def summarize_bootstrap_scores(scores: dict[str, list[float]]) -> dict[str, dict[str, float]]:
    return {
        label: {
            "mean": round(float(np.mean(values)), 3),
            "low": round(float(np.quantile(values, 0.025)), 3),
            "high": round(float(np.quantile(values, 0.975)), 3),
        }
        for label, values in scores.items()
    }


def bootstrap_subtype_stability(
    trial_profiles: np.ndarray,
    major: np.ndarray,
    subtype_by_id: list[str],
    subtype_order: list[str],
    repeats: int,
    seed: int = 20260721,
) -> tuple[dict[str, dict[str, float]], dict[str, dict[str, float]]]:
    """Estimate end-to-end major-class and subtype stability by trial bootstrap.

    Every replicate resamples trials, rebuilds the cue correlation hierarchy,
    cuts five major classes, aligns them to the full-data partition, then
    refits multi-start k-means children inside each aligned major class. This
    avoids the optimistic bias caused by holding major membership fixed.
    """
    if repeats < 1:
        raise ValueError("bootstrap repeats must be positive")
    rng = np.random.default_rng(seed)
    original = np.asarray(subtype_by_id, dtype=object)
    subtype_scores: dict[str, list[float]] = {label: [] for label in subtype_order}
    major_scores: dict[str, list[float]] = {f"C{parent}": [] for parent in range(1, 6)}
    parent_specs: dict[int, tuple[list[str], dict[str, int]]] = {}
    for parent in range(1, 6):
        labels = [label for label in subtype_order if label.startswith(f"C{parent}")]
        parent_specs[parent] = (labels, {label: index for index, label in enumerate(labels)})

    for repeat in range(repeats):
        sampled_trials = rng.integers(0, N_TRIALS, size=N_TRIALS)
        boot_values = row_zscore(trial_profiles[sampled_trials].mean(axis=0, dtype=np.float64))
        boot_corr = correlation(boot_values)
        boot_tree, _ = hierarchy(boot_corr)
        _, _, boot_major_raw = cut_hierarchy(boot_tree)
        boot_major = align_partition(major, boot_major_raw)

        for parent in range(1, 6):
            original_parent = major == parent
            major_scores[f"C{parent}"].append(float(np.mean(boot_major[original_parent] == parent)))

        aligned_children = np.full(len(major), -1, dtype=int)
        for parent, (labels, label_index) in parent_specs.items():
            members = np.flatnonzero(boot_major == parent)
            if len(labels) == 1:
                aligned_children[members] = 0
                continue
            if len(members) < len(labels):
                continue
            _, boot_cluster, _ = best_kmeans(
                boot_values[members],
                len(labels),
                starts=6,
                seed=seed + 10000 * (repeat + 1) + 100 * parent,
            )
            original_cluster = np.asarray(
                [label_index.get(str(original[unit]), -1) for unit in members],
                dtype=int,
            )
            overlap = np.zeros((len(labels), len(labels)), dtype=np.int64)
            valid = original_cluster >= 0
            np.add.at(overlap, (original_cluster[valid], boot_cluster[valid]), 1)
            original_rows, boot_columns = linear_sum_assignment(-overlap)
            boot_to_original = {int(column): int(row) for row, column in zip(original_rows, boot_columns)}
            aligned_children[members] = np.asarray(
                [boot_to_original.get(int(label), -1) for label in boot_cluster],
                dtype=int,
            )

        for parent, (labels, label_index) in parent_specs.items():
            for label in labels:
                original_members = original == label
                recovered = (
                    (boot_major[original_members] == parent)
                    & (aligned_children[original_members] == label_index[label])
                )
                subtype_scores[label].append(float(np.mean(recovered)))
        if (repeat + 1) % 10 == 0 or repeat + 1 == repeats:
            print(f"  subtype bootstrap {repeat + 1}/{repeats}", flush=True)

    return summarize_bootstrap_scores(subtype_scores), summarize_bootstrap_scores(major_scores)


def sparse_pearson(matrix: csr_matrix) -> np.ndarray:
    n_features = matrix.shape[1]
    sums = np.asarray(matrix.sum(axis=1), dtype=np.float64).ravel()
    squares = np.asarray(matrix.multiply(matrix).sum(axis=1), dtype=np.float64).ravel()
    gram = (matrix @ matrix.T).toarray().astype(np.float64, copy=False)
    centered = gram - np.outer(sums, sums) / n_features
    norms = np.sqrt(np.maximum(squares - sums * sums / n_features, 0.0))
    denominator = np.outer(norms, norms)
    corr = np.divide(centered, denominator, out=np.zeros_like(centered), where=denominator > 1e-12)
    np.fill_diagonal(corr, 1.0)
    return np.clip(corr, -1.0, 1.0)


def smoothed_trial_z_pearson(matrix: csr_matrix) -> np.ndarray:
    """Pearson matrix after centered 5-bin smoothing and per-trial z-scoring."""
    kernel = diags(
        [np.ones(BINS_PER_TRIAL - abs(offset), dtype=np.float32) for offset in (-2, -1, 0, 1, 2)],
        offsets=(-2, -1, 0, 1, 2),
        shape=(BINS_PER_TRIAL, BINS_PER_TRIAL),
        dtype=np.float32,
        format="csr",
    )
    n_units = matrix.shape[0]
    z_gram = np.zeros((n_units, n_units), dtype=np.float64)
    z_norm = np.zeros(n_units, dtype=np.float64)
    for trial in range(N_TRIALS):
        start = trial * BINS_PER_TRIAL
        trace = matrix[:, start : start + BINS_PER_TRIAL] @ kernel
        sums = np.asarray(trace.sum(axis=1), dtype=np.float64).ravel()
        squares = np.asarray(trace.multiply(trace).sum(axis=1), dtype=np.float64).ravel()
        centered_ss = np.maximum(squares - sums * sums / BINS_PER_TRIAL, 0.0)
        valid = centered_ss > 1e-10
        inv_std = np.zeros(n_units, dtype=np.float64)
        inv_std[valid] = np.sqrt(BINS_PER_TRIAL / centered_ss[valid])
        gram = (trace @ trace.T).toarray().astype(np.float64, copy=False)
        gram -= np.outer(sums, sums) / BINS_PER_TRIAL
        gram *= np.outer(inv_std, inv_std)
        z_gram += gram
        z_norm[valid] += BINS_PER_TRIAL
        if (trial + 1) % 10 == 0 or trial == 0:
            print(f"  normalized full-trial Gram {trial + 1}/{N_TRIALS}", flush=True)
    denominator = np.sqrt(np.outer(z_norm, z_norm))
    corr = np.divide(z_gram, denominator, out=np.zeros_like(z_gram), where=denominator > 1e-12)
    np.fill_diagonal(corr, 1.0)
    return np.clip(corr, -1.0, 1.0)


def weighted_label_propagation(adjacency: csr_matrix, seed: int = 71) -> np.ndarray:
    """Seeded asynchronous weighted label propagation.

    Nodes update in a shuffled order and choose randomly among labels tied for
    the largest neighboring weight, matching the standard asynchronous
    weighted label-propagation rule.
    """
    rng = random.Random(seed)
    n = adjacency.shape[0]
    labels = np.arange(n, dtype=np.int32)
    nodes = list(range(n))
    for _ in range(100):
        rng.shuffle(nodes)
        changed = 0
        for node in nodes:
            start, end = adjacency.indptr[node], adjacency.indptr[node + 1]
            neighbors = adjacency.indices[start:end]
            weights = adjacency.data[start:end]
            if len(neighbors) == 0:
                continue
            score: dict[int, float] = defaultdict(float)
            for neighbor, weight in zip(neighbors, weights):
                score[int(labels[neighbor])] += float(weight)
            best_score = max(score.values())
            best = [label for label, value in score.items() if abs(value - best_score) < 1e-12]
            new_label = rng.choice(best)
            if int(labels[node]) != new_label:
                labels[node] = new_label
                changed += 1
        if changed == 0:
            break
    return labels


def ordered_community_labels(raw: np.ndarray) -> np.ndarray:
    """Assign C1, C2, ... by descending reconstructed community size."""
    labels, counts = np.unique(raw, return_counts=True)
    ordered = sorted(
        zip(labels.tolist(), counts.tolist()),
        key=lambda item: (-item[1], item[0]),
    )
    mapping = {label: index + 1 for index, (label, _) in enumerate(ordered)}
    return np.asarray([mapping[int(label)] for label in raw], dtype=int)


def consensus_label_propagation(
    adjacency: csr_matrix,
    runs: int = GRAPH_LPA_RUNS,
    communities: int = GRAPH_COMMUNITIES,
) -> tuple[np.ndarray, np.ndarray, dict[int, float]]:
    """Consensus partition from repeated weighted label propagation.

    A single asynchronous label-propagation run is seed-sensitive. We retain
    the stated graph method but aggregate many deterministic seeds into a
    co-assignment matrix, then cut that matrix at the eight-community
    resolution displayed in the reference panel.
    """
    graph = nx.from_scipy_sparse_array(adjacency, edge_attribute="weight")
    n = adjacency.shape[0]
    coassignment = np.zeros((n, n), dtype=np.float32)
    run_sizes: list[list[int]] = []
    for seed in range(runs):
        partition = list(nx.community.asyn_lpa_communities(graph, weight="weight", seed=seed))
        run_sizes.append(sorted((len(group) for group in partition), reverse=True))
        for group in partition:
            members = np.fromiter(group, dtype=np.int32)
            coassignment[np.ix_(members, members)] += 1.0
    coassignment /= runs
    distance = 1.0 - coassignment
    np.fill_diagonal(distance, 0.0)
    tree = linkage(squareform(distance, checks=False), method="average")
    raw = fcluster(tree, t=communities, criterion="maxclust")
    labels = ordered_community_labels(raw)

    node_stability = np.zeros(n, dtype=np.float64)
    community_stability: dict[int, float] = {}
    for label in np.unique(labels):
        members = np.flatnonzero(labels == label)
        if len(members) == 1:
            node_stability[members] = 1.0
            community_stability[int(label)] = 1.0
            continue
        block = coassignment[np.ix_(members, members)]
        node_stability[members] = (block.sum(axis=1) - 1.0) / (len(members) - 1)
        community_stability[int(label)] = float(
            (block.sum() - len(members)) / (len(members) * (len(members) - 1))
        )
    return labels, node_stability, community_stability


def force_layout(adjacency: csr_matrix, seed: int = 42) -> np.ndarray:
    """Deterministic weighted force layout used only for atlas display."""
    graph = nx.from_scipy_sparse_array(adjacency, edge_attribute="weight")
    positions = nx.spring_layout(
        graph,
        weight="weight",
        seed=seed,
        iterations=180,
        method="energy",
        gravity=1.0,
        scale=1.0,
    )
    xy = np.vstack([positions[index] for index in range(adjacency.shape[0])])
    xy -= xy.mean(axis=0, keepdims=True)
    _, _, rotation = np.linalg.svd(xy, full_matrices=False)
    xy = xy @ rotation.T
    if np.corrcoef(xy[:, 0], np.asarray(adjacency.sum(axis=1)).ravel())[0, 1] < 0:
        xy[:, 0] *= -1
    lower, upper = np.quantile(xy, [0.005, 0.995], axis=0)
    return np.clip((xy - lower) / np.maximum(upper - lower, 1e-9), 0.0, 1.0)


def spectral_layout(adjacency: csr_matrix) -> np.ndarray:
    """Deterministic robust coordinates from the normalized graph Laplacian."""
    n = adjacency.shape[0]
    _, vectors = eigsh(
        laplacian(adjacency, normed=True),
        k=4,
        which="SM",
        tol=0.001,
        v0=np.linspace(1.0, 2.0, n, dtype=np.float64),
    )
    positions = vectors[:, 1:3]
    for column in range(positions.shape[1]):
        anchor = int(np.argmax(np.abs(positions[:, column])))
        if positions[anchor, column] < 0:
            positions[:, column] *= -1.0

    # Laplacian eigenvectors can have long tails when a few nodes sit on weak
    # graph branches.  A monotonic robust transform spreads the dense core
    # without changing neighborhood order or fitting to reference geometry.
    center = np.median(positions, axis=0)
    q1, q3 = np.quantile(positions, [0.25, 0.75], axis=0)
    scale = np.maximum((q3 - q1) / 1.349, 1e-9)
    positions = np.arcsinh((positions - center) / (2.0 * scale))
    lower, upper = np.quantile(positions, [0.01, 0.99], axis=0)
    positions = np.clip((positions - lower) / np.maximum(upper - lower, 1e-9), 0.0, 1.0)
    return positions


def jitter_positions(units: list[dict]) -> tuple[list[float], list[float]]:
    groups: dict[tuple[float, float], list[int]] = defaultdict(list)
    for index, unit in enumerate(units):
        if np.isfinite(unit.get("x", np.nan)) and np.isfinite(unit.get("y", np.nan)):
            groups[(float(unit["x"]), float(unit["y"]))].append(index)
    out_x = [float(unit.get("x", 0.0)) for unit in units]
    out_y = [float(unit.get("y", 0.0)) for unit in units]
    for (x, y), members in groups.items():
        if len(members) == 1:
            continue
        for position, index in enumerate(members):
            ring = position // 12
            slot = position % 12
            radius = 1.25 + ring * 0.95
            angle = 2.0 * np.pi * slot / min(12, len(members)) + ring * 0.27
            out_x[index] = x + radius * float(np.cos(angle))
            out_y[index] = y + radius * float(np.sin(angle))
    return np.round(out_x, 3).tolist(), np.round(out_y, 3).tolist()


def graph_asset(corr: np.ndarray, units: list[dict]) -> dict:
    n = len(corr)
    k = 10
    similarity = corr.copy()
    np.fill_diagonal(similarity, -np.inf)
    candidates = np.argpartition(-similarity, kth=k - 1, axis=1)[:, :k]
    neighbors = np.empty_like(candidates)
    for source in range(n):
        neighbors[source] = sorted(
            candidates[source].tolist(),
            key=lambda target: (-float(similarity[source, target]), int(target)),
        )
    directed_edges: list[tuple[int, int, float]] = []
    edge_map: dict[tuple[int, int], float] = {}
    for source in range(n):
        for target in neighbors[source]:
            weight = float(corr[source, int(target)])
            if weight <= 0:
                continue
            directed_edges.append((source, int(target), weight))
            a, b = sorted((source, int(target)))
            if weight > edge_map.get((a, b), -1.0):
                edge_map[(a, b)] = weight
    edges = [(a, b, weight) for (a, b), weight in edge_map.items()]
    rows, cols, weights = [], [], []
    for a, b, weight in edges:
        rows.extend((a, b))
        cols.extend((b, a))
        weights.extend((weight, weight))
    adjacency = csr_matrix((weights, (rows, cols)), shape=(n, n), dtype=np.float64)

    communities, node_stability, community_stability = consensus_label_propagation(adjacency)
    # The teacher panel's node coordinates were not supplied. A standard
    # weighted force layout recreates the visual idea while leaving all graph
    # statistics independent of display geometry.
    xy = force_layout(adjacency, seed=42)

    degree = np.asarray(adjacency.sum(axis=1), dtype=np.float64).ravel()
    bridge = np.zeros(n, dtype=np.float64)
    edge_strength = np.zeros((3, 3), dtype=np.float64)
    area_index = {area: index for index, area in enumerate(AREAS)}
    for (source, target), weight in edge_map.items():
        ai = area_index[units[source]["area"]]
        bi = area_index[units[target]["area"]]
        if ai != bi:
            bridge[source] += weight
            bridge[target] += weight
            edge_strength[ai, bi] += weight
            edge_strength[bi, ai] += weight
        else:
            edge_strength[ai, ai] += weight

    community_stats = []
    for label in sorted(np.unique(communities)):
        members = np.flatnonzero(communities == label)
        counts = Counter(units[index]["area"] for index in members)
        community_stats.append(
            {
                "label": f"C{int(label)}",
                "n": int(len(members)),
                "areas": {area: int(counts.get(area, 0)) for area in AREAS},
                "stability": round(float(community_stability[int(label)]), 3),
            }
        )
    hubs = np.argsort(-degree)[:10]
    bridges = np.argsort(-bridge)[:10]
    position_x, position_y = jitter_positions(units)
    return {
        "source": "five-bin-smoothed, per-unit/per-trial z-scored full-trial Pearson matrix",
        "k": k,
        "communityMethod": f"consensus of {GRAPH_LPA_RUNS} asynchronous weighted label-propagation runs; average-linkage cut at the reference panel's {GRAPH_COMMUNITIES}-community resolution",
        "referenceUsedForMembership": False,
        "referenceResolutionUsed": True,
        "communityById": communities.astype(int).tolist(),
        "communityStabilityById": np.round(node_stability, 3).tolist(),
        "communities": community_stats,
        "communityAudit": {
            "observed": sorted((int(item["n"]) for item in community_stats), reverse=True),
            "teacher": [985, 115, 90, 65, 29, 27, 21, 14],
            "note": "The teacher seed and memberships were not supplied; reference counts are comparison-only.",
        },
        "x": np.round(xy[:, 0], 4).tolist(),
        "y": np.round(xy[:, 1], 4).tolist(),
        "positionX": position_x,
        "positionY": position_y,
        "degree": np.round(degree, 3).tolist(),
        "edges": [[int(a), int(b), round(float(weight), 3)] for a, b, weight in edges],
        "directedEdgeCount": len(directed_edges),
        "edgeStrength": np.round(edge_strength, 1).tolist(),
        "summaryDefinition": "unique undirected union of directed top-10 positive-Pearson selections; reciprocal selections collapse to one edge at their shared Pearson weight",
        "referenceCommunities": [
            {
                "label": f"C{index + 1}",
                "n": int(row.sum()),
                "areas": {area: int(row[area_index]) for area_index, area in enumerate(AREAS)},
            }
            for index, row in enumerate(REFERENCE_COMMUNITY_AREAS)
        ],
        "referenceEdgeStrength": REFERENCE_EDGE_STRENGTH,
        "referenceHubs": [
            {"unit": unit, "area": area, "community": community, "score": score}
            for unit, area, community, score in REFERENCE_HUBS
        ],
        "referenceBridges": [
            {"unit": unit, "area": area, "community": community, "score": score}
            for unit, area, community, score in REFERENCE_BRIDGES
        ],
        "hubs": [
            {"unit": int(index), "degree": round(float(degree[index]), 3), "bridge": round(float(bridge[index]), 3)}
            for index in hubs
        ],
        "bridges": [
            {"unit": int(index), "degree": round(float(degree[index]), 3), "bridge": round(float(bridge[index]), 3)}
            for index in bridges
        ],
        "layout": "deterministic weighted force-directed layout (seed 42); display geometry is not an analysis variable",
    }


def hierarchy_payload(
    corr: np.ndarray,
    tree: np.ndarray,
    order: np.ndarray,
    labels: np.ndarray,
    profile_values: np.ndarray,
    tax: np.ndarray,
    units: list[dict],
    raster_mean_hz: np.ndarray,
    matrix_path: str,
    matrix_range: list[float],
    event_time: float,
) -> dict:
    return {
        "tax": np.round(tax, 4).tolist(),
        "eventTime": event_time,
        "order": order.tolist(),
        "majorById": labels.tolist(),
        "dendrogram": hierarchy_segments(tree, labels),
        "matrix": matrix_path,
        "matrixRange": matrix_range,
        "classes": class_summaries(profile_values, labels, units, raster_mean_hz),
    }


def count_audit(items: list[dict], expected: list[int]) -> dict:
    observed = [int(item["n"]) for item in items]
    return {"observed": observed, "teacher": expected, "exactMatch": observed == expected}


def raster_completeness_audit(
    matrix: csr_matrix,
    units: list[dict],
) -> tuple[np.ndarray, dict]:
    observed_spikes = np.asarray(matrix.sum(axis=1), dtype=np.float64).ravel()
    observed_mean_hz = observed_spikes / (N_TRIALS * (TRIAL_END - TRIAL_START))
    reported_mean_hz = np.asarray([float(unit.get("meanHz", np.nan)) for unit in units])
    valid = np.isfinite(reported_mean_hz) & (reported_mean_hz > 0)
    ratio = np.full(len(units), np.nan, dtype=np.float64)
    ratio[valid] = observed_mean_hz[valid] / reported_mean_hz[valid]
    finite = ratio[np.isfinite(ratio)]
    rounded_rate_match = np.abs(observed_mean_hz - reported_mean_hz) <= 0.0050001
    worst = np.flatnonzero(np.isfinite(ratio))[
        np.argsort(ratio[np.isfinite(ratio)])[:8]
    ]
    audit = {
        "comparisonOnly": True,
        "reportedRateSource": "data/core.js meanHz",
        "analysisRateSource": "complete S21-S40 spike_times/spike_clusters trial windows divided by 80 trials x 25 s",
        "observedToReportedQuantiles": np.round(
            np.quantile(finite, [0.0, 0.1, 0.5, 0.9, 1.0]), 4
        ).tolist(),
        "unitsBelow90Percent": int(np.sum(finite < 0.9)),
        "unitsBelow75Percent": int(np.sum(finite < 0.75)),
        "maxSuppliedRasterSpikes": int(observed_spikes.max()),
        "unitsMatchingReportedTwoDecimalRate": int(np.sum(rounded_rate_match)),
        "lowestRatios": [
            {
                "unit": int(index),
                "rasterMeanHz": round(float(observed_mean_hz[index]), 3),
                "reportedMeanHz": round(float(reported_mean_hz[index]), 3),
                "ratio": round(float(ratio[index]), 3),
            }
            for index in worst
        ],
        "complete": bool(np.all(rounded_rate_match)),
        "note": "The fitted matrices are rebuilt directly from the complete S21-S40 NPY recordings. Small rate ratios around one reflect two-decimal rounding in data/core.js, not missing spikes.",
    }
    return observed_mean_hz, audit


def cue_source_audit(cue_z: np.ndarray, pop: dict) -> dict:
    stored = np.asarray(pop.get("heatmap", {}).get("z", []), dtype=np.float64)
    if stored.shape != cue_z.shape:
        return {
            "comparisonOnly": True,
            "available": False,
            "rasterShape": list(cue_z.shape),
            "storedShape": list(stored.shape),
        }
    stored_z = row_zscore(stored)
    row_corr = np.mean(cue_z * stored_z, axis=1)
    return {
        "comparisonOnly": True,
        "available": True,
        "storedSource": "data/pop.js heatmap.z",
        "flatPearson": round(float(np.corrcoef(cue_z.ravel(), stored_z.ravel())[0, 1]), 6),
        "meanAbsoluteDifference": round(float(np.mean(np.abs(cue_z - stored_z))), 6),
        "perUnitPearsonQuantiles": np.round(
            np.quantile(row_corr, [0.0, 0.1, 0.5, 0.9, 1.0]), 6
        ).tolist(),
        "note": "The stored heatmap is checked as an independent implementation audit and is never used to fit cue classes or subtypes.",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--recompute-matrices",
        action="store_true",
        help="recompute the two 1,346 x 1,346 full-trial Pearson matrices instead of using the raster-derived cache",
    )
    parser.add_argument(
        "--bootstrap-repeats",
        type=int,
        default=80,
        help="number of trial-bootstrap replicates used for conditional subtype stability (default: 80)",
    )
    parser.add_argument(
        "--spike-root",
        type=Path,
        default=DEFAULT_SPIKE_ROOT,
        help="directory containing paired S21-S40 spike_times/spike_clusters NPY files",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    units = assigned_json(ROOT / "data" / "core.js")
    pop = assigned_json(ROOT / "data" / "pop.js")
    n_units = len(units)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)

    spike_root = args.spike_root.expanduser().resolve()
    source_summary = validate_spike_root(spike_root)
    fingerprint = source_fingerprint(spike_root)

    print("Reading complete S21-S40 trial windows...", flush=True)
    raster_matrix = build_raster_matrix(n_units, spike_root)
    print(f"Raster matrix: {raster_matrix.shape[0]} x {raster_matrix.shape[1]:,}; {raster_matrix.nnz:,} occupied bins", flush=True)
    full_profiles = raster_trial_mean_profiles(raster_matrix, output_hz=80)
    raster_mean_hz, completeness = raster_completeness_audit(raster_matrix, units)
    cue_trials = raster_cue_trial_profiles(raster_matrix)
    cue_profiles, cue_values, cue_profile_tax, cue_peak = cue_profiles_from_trials(cue_trials)
    cue_audit = cue_source_audit(cue_values, pop)

    matrix_cache = ASSET_DIR / "pearson_matrices.npz"
    use_cache = False
    if matrix_cache.exists() and not args.recompute_matrices:
        cached = np.load(matrix_cache)
        cached_fingerprint = (
            str(cached["source_fingerprint"].item())
            if "source_fingerprint" in cached.files
            else ""
        )
        use_cache = (
            cached_fingerprint == fingerprint
            and cached["raw_full"].shape == (n_units, n_units)
            and cached["smoothed_z_full"].shape == (n_units, n_units)
        )
        if use_cache:
            print("Loading full-recording Pearson cache...", flush=True)
            raw_corr = cached["raw_full"].astype(np.float64)
            smooth_corr = cached["smoothed_z_full"].astype(np.float64)
        else:
            print("Ignoring stale Pearson cache from a different raster source.", flush=True)
    if not use_cache:
        print("Computing raw concatenated-trial Pearson matrix...", flush=True)
        raw_corr = sparse_pearson(raster_matrix)
        print("Computing five-bin-smoothed, per-trial-z-scored Pearson matrix...", flush=True)
        smooth_corr = smoothed_trial_z_pearson(raster_matrix)

    print("Clustering full-trial matrices...", flush=True)
    raw_tree, _ = hierarchy(raw_corr, euclidean_equivalent=True)
    raw_tree, raw_order, raw_major = cut_hierarchy(raw_tree)
    raw_major = full_trial_display_labels(raw_major, full_profiles, "raw")
    raw_tree = orient_tree_by_class(raw_tree, raw_major)
    raw_order = leaves_list(raw_tree).astype(int)
    smooth_tree, _ = hierarchy(smooth_corr, euclidean_equivalent=True)
    smooth_tree, smooth_order, smooth_major = cut_hierarchy(smooth_tree)
    smooth_major = full_trial_display_labels(smooth_major, full_profiles, "smooth")
    smooth_tree = orient_tree_by_class(smooth_tree, smooth_major)
    smooth_order = leaves_list(smooth_tree).astype(int)

    cue_corr = correlation(cue_values)
    cue_tree, _ = hierarchy(cue_corr)
    cue_tree, cue_order, cue_major = cut_hierarchy(cue_tree)
    cue_major = semantic_cue_labels(cue_major, cue_profiles, cue_profile_tax)
    cue_tree = orient_tree_by_class(cue_tree, cue_major)
    cue_order = leaves_list(cue_tree).astype(int)
    subtype_by_id, subtype_order = subtype_labels(cue_values, cue_major)
    print("Estimating subtype stability by trial bootstrap...", flush=True)
    subtype_stability, cue_major_stability = bootstrap_subtype_stability(
        cue_trials,
        cue_major,
        subtype_by_id,
        subtype_order,
        repeats=args.bootstrap_repeats,
    )
    subtype_rank = {label: index for index, label in enumerate(subtype_order)}
    subtype_order_ids = sorted(
        range(n_units),
        key=lambda index: (subtype_rank[subtype_by_id[index]], int(cue_peak[index]), index),
    )

    full_tax = (np.arange(full_profiles.shape[1]) + 0.5) / 80.0

    print("Writing ordered correlation matrices...", flush=True)
    cue_range = grayscale_image(cue_corr, cue_order, ASSET_DIR / "cue_correlation.png", robust=False)
    subtype_range = grayscale_image(
        cue_corr,
        np.asarray(subtype_order_ids, dtype=int),
        ASSET_DIR / "cue_subtype_correlation.png",
        robust=False,
    )
    raw_range = grayscale_image(
        raw_corr,
        raw_order,
        ASSET_DIR / "full_trial_raw_correlation.png",
        robust=True,
    )
    smooth_range = grayscale_image(
        smooth_corr,
        smooth_order,
        ASSET_DIR / "full_trial_smoothed_z_correlation.png",
        robust=True,
    )

    cue_payload = hierarchy_payload(
        cue_corr,
        cue_tree,
        cue_order,
        cue_major,
        cue_profiles,
        cue_profile_tax,
        units,
        raster_mean_hz,
        "assets/hierarchy/cue_correlation.png",
        cue_range,
        0.0,
    )
    for item in cue_payload["classes"]:
        item["stability"] = cue_major_stability[item["label"]]
    subtype_array = np.array(subtype_by_id)
    subtype_prototypes = np.vstack([cue_profiles[subtype_array == label].mean(axis=0) for label in subtype_order])
    cue_payload.update(
        {
            "subtypeById": subtype_by_id,
            "subtypeOrder": subtype_order,
            "subtypeOrderIds": subtype_order_ids,
            "subtypeMatrix": "assets/hierarchy/cue_subtype_correlation.png",
            "subtypeMatrixRange": subtype_range,
            "subtypes": subtype_summaries(
                cue_profiles,
                cue_corr,
                subtype_by_id,
                subtype_order,
                units,
                raster_mean_hz,
                subtype_stability,
            ),
            "z": np.round(cue_values, 3).tolist(),
            "peak": cue_peak.astype(int).tolist(),
            "subtypeCorrelation": np.round(correlation(subtype_prototypes), 3).tolist(),
            "subtypeReferenceCounts": REFERENCE_SUBTYPE_COUNTS,
            "majorStability": cue_major_stability,
            "stabilityMethod": {
                "name": "end-to-end trial-bootstrap membership recovery",
                "repeats": args.bootstrap_repeats,
                "seed": 20260721,
                "majorClassesHeldFixed": False,
                "description": "Each replicate resamples the 80 trials with replacement, rebuilds the five-class average-linkage cue hierarchy, aligns major classes by maximum overlap, refits multi-start k-means children, aligns subtypes, and reports full-pipeline membership recovery.",
            },
        }
    )

    raw_payload = hierarchy_payload(
        raw_corr,
        raw_tree,
        raw_order,
        raw_major,
        full_profiles,
        full_tax,
        units,
        raster_mean_hz,
        "assets/hierarchy/full_trial_raw_correlation.png",
        raw_range,
        5.0,
    )
    smooth_payload = hierarchy_payload(
        smooth_corr,
        smooth_tree,
        smooth_order,
        smooth_major,
        full_profiles,
        full_tax,
        units,
        raster_mean_hz,
        "assets/hierarchy/full_trial_smoothed_z_correlation.png",
        smooth_range,
        5.0,
    )
    print("Building normalized full-trial kNN atlas...", flush=True)
    graph = graph_asset(smooth_corr, units)

    audit = {
        "rawFull": count_audit(raw_payload["classes"], [14, 2, 5, 1312, 13]),
        "cue": count_audit(cue_payload["classes"], [272, 4, 65, 7, 998]),
        "smoothedZFull": count_audit(smooth_payload["classes"], [13, 1316, 6, 2, 9]),
    }
    output = {
        "meta": {
            "nUnits": n_units,
            "nTrials": N_TRIALS,
            "binHz": BIN_HZ,
            "binsPerTrial": BINS_PER_TRIAL,
            "featuresPerUnit": N_FEATURES,
            "cueWindow": [-1, 5],
            "fullWindow": [0, 25],
            "cueSource": "complete paired S21-S40 spike_times/spike_clusters NPY recordings; exact sample-index binning; 50-ms bins averaged over 80 trials",
            "fullSource": "complete paired S21-S40 spike_times/spike_clusters NPY recordings; 80 trial windows concatenated at 80 Hz",
            "spikeSourceRoot": str(spike_root),
            "spikeSourceFingerprint": fingerprint,
            "spikeSourceSummary": source_summary,
            "method": "Average-linkage hierarchical clustering of Pearson profiles; raw and normalized full-trial trees use the Euclidean-equivalent sqrt(2(1-r)) distance, while the cue tree uses 1-r. The audit script compares alternatives using cophenetic fidelity, silhouette separation, and split-half adjusted Rand agreement.",
            "fullClassCut": "Each reconstructed hierarchy is cut into five classes with scipy fcluster(maxclust=5). Membership is raster-derived; class names are mapped afterward to the source panels' nominal color convention. Teacher class sizes are comparison-only.",
            "rawDefinition": "80 separate 25-second 80-Hz spike-count traces concatenated without smoothing",
            "normalizedDefinition": "centered five-bin moving average and per-unit/per-trial z-score before concatenating 80 trials",
            "cueDefinition": "Raster spikes are binned at 50 ms and averaged over 80 trials from -1 to +5 s. Pearson clustering uses the resulting temporal profiles; the heatmap applies one row-wise z-score across that full six-second profile.",
            "cueClassNaming": "Five maxclust memberships are data-derived. C1-C5 names are assigned from raster profiles as suppressed, low-rate, slow-rising, higher low-rate, and early-excited archetypes; teacher class sizes are not used.",
            "majorClasses": 5,
            "subtypes": len(subtype_order),
            "referenceImages": ["image.PNG"] + [f"image {index}.PNG" for index in range(2, 10)],
            "provenance": "Cue-aligned, raw full-trial, normalized full-trial, subtype, and kNN-community memberships are reconstructed from the complete S21-S40 recordings. The source figures define only the displayed resolutions (5 major classes, 16 nested subtypes, 8 graph communities) and nominal class colors; their counts and memberships are never fitted.",
            "referenceCountsUsedForFit": False,
            "referenceResolutionUsed": True,
            "referenceAudit": audit,
            "matrixRangeAudit": {
                "rawRecomputed": raw_range,
                "rawTeacher": REFERENCE_MATRIX_RANGES["raw"],
                "smoothedRecomputed": smooth_range,
                "smoothedTeacher": REFERENCE_MATRIX_RANGES["smoothed"],
            },
            "rasterCompleteness": completeness,
            "cueStoredProductAudit": cue_audit,
            "subtypeReferenceSource": "Teacher subtype counts are retained only for comparison. Visible stability values are full-pipeline trial-bootstrap recovery estimates from the complete 80-trial recordings and are not transcribed from the teacher panel.",
            "subtypeMethod": f"Minimum-inertia solution across {SUBTYPE_KMEANS_STARTS} deterministic k-means++ starts within each raster-derived cue major class at the displayed 5/1/3/1/6 subtype resolution; child letters are ordered by raster-derived prototype peak time and teacher subtype sizes are not used.",
        },
        "fullRaw": raw_payload,
        "cue": cue_payload,
        "fullSmooth": smooth_payload,
        "full": smooth_payload,
        "graph": graph,
    }
    (ROOT / "data" / "functional_hierarchy.js").write_text(
        "window.FUNCTIONAL_HIERARCHY=" + json.dumps(output, separators=(",", ":"), allow_nan=False) + ";\n"
    )
    np.savez_compressed(
        matrix_cache,
        raw_full=raw_corr.astype(np.float32),
        cue=cue_corr.astype(np.float32),
        smoothed_z_full=smooth_corr.astype(np.float32),
        source_fingerprint=np.asarray(fingerprint),
    )
    del raster_matrix
    gc.collect()
    print("Reference class-count audit:", json.dumps(audit), flush=True)
    print("Raster completeness audit:", json.dumps(completeness), flush=True)
    print("Cue stored-product audit:", json.dumps(cue_audit), flush=True)
    print(f"Built functional hierarchy from {n_units} units; {len(graph['edges'])} kNN edges.", flush=True)


if __name__ == "__main__":
    main()
