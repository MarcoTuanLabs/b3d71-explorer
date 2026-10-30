#!/usr/bin/env python3
"""Audit plausible hierarchy methods without fitting to teacher class sizes.

Reference-panel counts are reported only as a secondary reconstruction check.
The primary diagnostics are cophenetic fidelity, silhouette separation, and
split-half trial reproducibility.
"""

from collections import Counter

import numpy as np
from scipy.cluster.hierarchy import cophenet, fcluster, linkage
from scipy.spatial.distance import pdist, squareform

from build_functional_hierarchy import (
    AREAS,
    ROOT,
    assigned_json,
    build_raster_matrix,
    correlation,
    cue_profiles_from_trials,
    cut_hierarchy,
    hierarchy,
    raster_cue_trial_profiles,
    raster_trial_mean_profiles,
    row_zscore,
    semantic_cue_labels,
    subtype_labels,
    weighted_label_propagation,
)
from scipy.sparse import csr_matrix


def cluster_counts(corr: np.ndarray, method: str) -> list[int]:
    distance = np.clip(1.0 - corr, 0.0, 2.0)
    np.fill_diagonal(distance, 0.0)
    tree = linkage(squareform(distance, checks=False), method=method)
    labels = fcluster(tree, t=5, criterion="maxclust")
    return sorted(Counter(labels).values(), reverse=True)


def adjusted_rand(left: np.ndarray, right: np.ndarray) -> float:
    """Adjusted Rand index without requiring scikit-learn."""
    _, left_inverse = np.unique(left, return_inverse=True)
    _, right_inverse = np.unique(right, return_inverse=True)
    table = np.zeros((left_inverse.max() + 1, right_inverse.max() + 1), dtype=np.int64)
    np.add.at(table, (left_inverse, right_inverse), 1)
    choose2 = lambda values: np.sum(values * (values - 1) // 2)
    pairs = len(left) * (len(left) - 1) / 2
    if pairs == 0:
        return 1.0
    observed = float(choose2(table))
    row_pairs = float(choose2(table.sum(axis=1)))
    column_pairs = float(choose2(table.sum(axis=0)))
    expected = row_pairs * column_pairs / pairs
    maximum = 0.5 * (row_pairs + column_pairs)
    return (observed - expected) / (maximum - expected) if maximum > expected else 1.0


def silhouette(distance: np.ndarray, labels: np.ndarray) -> float:
    """Mean silhouette using an already computed dissimilarity matrix."""
    unique = np.unique(labels)
    values = np.zeros(len(labels), dtype=np.float64)
    for index, label in enumerate(labels):
        same = labels == label
        if same.sum() <= 1:
            continue
        within = distance[index, same].sum() / (same.sum() - 1)
        between = min(distance[index, labels == other].mean() for other in unique if other != label)
        values[index] = (between - within) / max(within, between, 1e-12)
    return float(values.mean())


def candidate_tree(corr: np.ndarray, method: str, transform: str) -> tuple[np.ndarray, np.ndarray]:
    base = np.clip(1.0 - corr, 0.0, 2.0)
    if transform == "sqrt2":
        distance = np.sqrt(2.0 * base)
    elif transform == "angular":
        distance = np.arccos(np.clip(corr, -1.0, 1.0))
    else:
        distance = base
    np.fill_diagonal(distance, 0.0)
    tree = linkage(squareform(distance, checks=False), method=method)
    labels = fcluster(tree, t=5, criterion="maxclust")
    return tree, labels


def report_cue_validation(trial_profiles: np.ndarray, expected: list[int]) -> None:
    """Compare cue-hierarchy candidates using split-half trial stability."""
    candidates = [
        ("average", "linear"),
        ("average", "sqrt2"),
        ("average", "angular"),
        ("complete", "linear"),
        ("weighted", "linear"),
        ("ward", "sqrt2"),
    ]
    full_values = row_zscore(trial_profiles.mean(axis=0, dtype=np.float64))
    full_corr = correlation(full_values)
    rng = np.random.default_rng(20260721)
    splits = [rng.permutation(trial_profiles.shape[0]) for _ in range(8)]
    print("cue candidate validation (teacher count error is secondary)")
    for method, transform in candidates:
        tree, full_labels = candidate_tree(full_corr, method, transform)
        base = np.clip(1.0 - full_corr, 0.0, 2.0)
        if transform == "sqrt2":
            distance = np.sqrt(2.0 * base)
        elif transform == "angular":
            distance = np.arccos(np.clip(full_corr, -1.0, 1.0))
        else:
            distance = base
        np.fill_diagonal(distance, 0.0)
        condensed = squareform(distance, checks=False)
        coph = float(cophenet(tree, condensed)[0])
        sil = silhouette(distance, full_labels)
        half_ari, full_ari = [], []
        for permutation in splits:
            midpoint = len(permutation) // 2
            left = correlation(row_zscore(trial_profiles[permutation[:midpoint]].mean(axis=0)))
            right = correlation(row_zscore(trial_profiles[permutation[midpoint:]].mean(axis=0)))
            _, left_labels = candidate_tree(left, method, transform)
            _, right_labels = candidate_tree(right, method, transform)
            half_ari.append(adjusted_rand(left_labels, right_labels))
            full_ari.extend((adjusted_rand(full_labels, left_labels), adjusted_rand(full_labels, right_labels)))
        counts = sorted(Counter(full_labels).values(), reverse=True)
        count_error = sum(abs(a - b) for a, b in zip(counts, sorted(expected, reverse=True))) / len(full_labels)
        print(
            f"  {method:8s}/{transform:7s} coph={coph:.3f} sil={sil:.3f} "
            f"halfARI={np.mean(half_ari):.3f} fullARI={np.mean(full_ari):.3f} "
            f"countL1={count_error:.3f} counts={counts}"
        )


def report(name: str, corr: np.ndarray) -> None:
    print(name)
    for method in ("single", "complete", "average", "weighted", "centroid", "median", "ward"):
        try:
            print(f"  {method:8s} {cluster_counts(corr, method)}")
        except Exception as error:
            print(f"  {method:8s} ERROR {error}")


def report_transforms(name: str, corr: np.ndarray) -> None:
    expected_shape = corr.shape[0]
    candidates = {
        "1-r": np.clip(1.0 - corr, 0.0, 2.0),
        "sqrt(1-r)": np.sqrt(np.clip(1.0 - corr, 0.0, 2.0)),
        "angular": np.arccos(np.clip(corr, -1.0, 1.0)),
        "1-|r|": 1.0 - np.abs(corr),
        "1-max(r,0)": 1.0 - np.maximum(corr, 0.0),
    }
    print(name, "average-linkage distance transforms")
    for label, distance in candidates.items():
        np.fill_diagonal(distance, 0.0)
        tree = linkage(squareform(distance, checks=False), method="average")
        groups = fcluster(tree, t=5, criterion="maxclust")
        print(f"  {label:14s} {sorted(Counter(groups).values(), reverse=True)}")
    for metric in ("euclidean", "correlation", "cosine"):
        distance = pdist(corr, metric=metric)
        tree = linkage(distance, method="average")
        groups = fcluster(tree, t=5, criterion="maxclust")
        print(f"  corr rows/{metric:11s} {sorted(Counter(groups).values(), reverse=True)}")
    assert expected_shape == corr.shape[0]


def report_graph(corr: np.ndarray, units: list[dict]) -> None:
    """Compare the reconstructed kNN graph with reference-image summaries."""
    n, k = len(corr), 10
    similarity = corr.copy()
    np.fill_diagonal(similarity, -np.inf)
    neighbors = np.argpartition(-similarity, kth=k - 1, axis=1)[:, :k]
    edge_map: dict[tuple[int, int], float] = {}
    directed_strength = np.zeros((3, 3), dtype=float)
    area_index = {area: index for index, area in enumerate(AREAS)}
    for source in range(n):
        for target_value in neighbors[source]:
            target = int(target_value)
            weight = float(corr[source, target])
            if weight <= 0:
                continue
            a, b = sorted((source, target))
            edge_map[(a, b)] = max(weight, edge_map.get((a, b), -1.0))
            source_area = area_index[units[source]["area"]]
            target_area = area_index[units[target]["area"]]
            directed_strength[source_area, target_area] += weight

    rows, columns, weights = [], [], []
    union_strength = np.zeros((3, 3), dtype=float)
    for (a, b), weight in edge_map.items():
        rows.extend((a, b))
        columns.extend((b, a))
        weights.extend((weight, weight))
        ai, bi = area_index[units[a]["area"]], area_index[units[b]["area"]]
        union_strength[ai, bi] += weight
        if ai != bi:
            union_strength[bi, ai] += weight
    adjacency = csr_matrix((weights, (rows, columns)), shape=(n, n))
    print("normalized full-trial kNN graph")
    print("  undirected union edges", len(edge_map))
    print("  union edge strength", np.round(union_strength, 1).tolist())
    print("  directed edge strength", np.round(directed_strength, 1).tolist())
    for seed in (0, 1, 7, 42, 71, 77, 2025):
        labels = weighted_label_propagation(adjacency, seed=seed)
        print(f"  LPA seed {seed:4d}", sorted(Counter(labels).values(), reverse=True))


def report_subtypes(profiles: np.ndarray, corr: np.ndarray, tax: np.ndarray) -> None:
    tree, _ = hierarchy(corr)
    tree, _, major = cut_hierarchy(tree)
    major = semantic_cue_labels(major, profiles, tax)
    expected = {1: [91, 86, 42, 28, 25], 2: [4], 3: [30, 20, 15], 4: [7], 5: [276, 194, 168, 150, 115, 95]}
    labels, _ = subtype_labels(profiles, major)
    print("cue subtype reconstruction")
    for parent in range(1, 6):
        observed = sorted(
            [sum(label == subtype for label in labels) for subtype in sorted(set(labels)) if subtype.startswith(f"C{parent}")],
            reverse=True,
        )
        print(f"  C{parent} raster k-means", observed, "teacher", expected[parent])


def main() -> None:
    pop = assigned_json(ROOT / "data" / "pop.js")
    units = assigned_json(ROOT / "data" / "core.js")
    raster = build_raster_matrix(len(units))
    profiles = raster_trial_mean_profiles(raster, output_hz=40)
    cue_trials = raster_cue_trial_profiles(raster)
    _, cue_z, cue_tax, _ = cue_profiles_from_trials(cue_trials)
    report_cue_validation(cue_trials, [272, 4, 65, 7, 998])
    report("supplied 50 ms z profiles", correlation(np.asarray(pop["heatmap"]["z"], dtype=np.float64)))
    report("raster-derived 50 ms cue profile", correlation(cue_z))

    cached = np.load(ROOT / "assets" / "hierarchy" / "pearson_matrices.npz")
    report("raw 80-trial cached", cached["raw_full"].astype(np.float64))
    report("smoothed-z 80-trial cached", cached["smoothed_z_full"].astype(np.float64))
    report_transforms("cue", correlation(np.asarray(pop["heatmap"]["z"], dtype=np.float64)))
    report_transforms("raw full", cached["raw_full"].astype(np.float64))
    report_transforms("smoothed-z full", cached["smoothed_z_full"].astype(np.float64))
    report_subtypes(cue_z, correlation(cue_z), cue_tax)
    report_graph(cached["smoothed_z_full"].astype(np.float64), units)


if __name__ == "__main__":
    main()
