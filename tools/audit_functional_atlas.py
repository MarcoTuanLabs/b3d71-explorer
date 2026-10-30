#!/usr/bin/env python3
"""Audit functional-atlas graph definitions against the supplied reference panel."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix

from build_functional_hierarchy import (
    AREAS,
    REFERENCE_COMMUNITY_AREAS,
    REFERENCE_EDGE_STRENGTH,
    REFERENCE_HUBS,
    build_raster_matrix,
    smoothed_trial_z_pearson,
    weighted_label_propagation,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "functional_atlas_audit.json"


def assigned_json(path: Path) -> list[dict]:
    text = path.read_text()
    return json.loads(text[text.index("=") + 1 :].strip().rstrip(";"))


def graph_definitions(corr: np.ndarray, units: list[dict]) -> dict:
    n = corr.shape[0]
    k = 10
    work = corr.copy()
    np.fill_diagonal(work, -np.inf)
    neighbors = np.argpartition(-work, kth=k - 1, axis=1)[:, :k]

    directed = []
    union: dict[tuple[int, int], float] = {}
    for source in range(n):
        for target_value in neighbors[source]:
            target = int(target_value)
            weight = float(corr[source, target])
            if weight <= 0:
                continue
            directed.append((source, target, weight))
            edge = tuple(sorted((source, target)))
            union[edge] = max(weight, union.get(edge, -np.inf))

    area_index = {area: index for index, area in enumerate(AREAS)}
    directed_area = np.zeros((3, 3), dtype=np.float64)
    directed_degree = np.zeros(n, dtype=np.float64)
    directed_bridge = np.zeros(n, dtype=np.float64)
    for source, target, weight in directed:
        source_area = area_index[units[source]["area"]]
        target_area = area_index[units[target]["area"]]
        directed_degree[source] += weight
        directed_degree[target] += weight
        if source_area != target_area:
            directed_bridge[source] += weight
            directed_bridge[target] += weight
            directed_area[source_area, target_area] += weight
            directed_area[target_area, source_area] += weight
        else:
            directed_area[source_area, source_area] += weight

    rows, columns, values = [], [], []
    union_area = np.zeros((3, 3), dtype=np.float64)
    union_degree = np.zeros(n, dtype=np.float64)
    for (source, target), weight in union.items():
        rows.extend((source, target))
        columns.extend((target, source))
        values.extend((weight, weight))
        union_degree[source] += weight
        union_degree[target] += weight
        source_area = area_index[units[source]["area"]]
        target_area = area_index[units[target]["area"]]
        union_area[source_area, target_area] += weight
        if source_area != target_area:
            union_area[target_area, source_area] += weight

    adjacency = csr_matrix((values, (rows, columns)), shape=(n, n), dtype=np.float64)
    return {
        "k": k,
        "directed": directed,
        "union": union,
        "adjacency": adjacency,
        "directedArea": directed_area,
        "unionArea": union_area,
        "directedDegree": directed_degree,
        "unionDegree": union_degree,
        "directedBridge": directed_bridge,
    }


def ranked_units(values: np.ndarray, units: list[dict], limit: int = 10) -> list[dict]:
    return [
        {
            "unit": int(index),
            "area": units[int(index)]["area"],
            "value": round(float(values[int(index)]), 3),
        }
        for index in np.argsort(-values)[:limit]
    ]


def seed_audit(adjacency: csr_matrix, limit: int = 2000) -> dict:
    teacher = sorted(REFERENCE_COMMUNITY_AREAS.sum(axis=1).tolist(), reverse=True)
    best = None
    counts = Counter()
    for seed in range(limit):
        labels = weighted_label_propagation(adjacency, seed=seed)
        sizes = sorted(np.unique(labels, return_counts=True)[1].tolist(), reverse=True)
        counts[len(sizes)] += 1
        padded = sizes + [0] * max(0, len(teacher) - len(sizes))
        score = sum(abs(a - b) for a, b in zip(padded[: len(teacher)], teacher))
        score += sum(padded[len(teacher) :])
        candidate = (score, seed, sizes)
        if best is None or candidate < best:
            best = candidate
    return {
        "seedsTested": limit,
        "communityCountFrequency": {str(key): value for key, value in sorted(counts.items())},
        "bestL1": int(best[0]),
        "bestSeed": int(best[1]),
        "bestSizes": [int(value) for value in best[2]],
        "teacherSizes": teacher,
    }


def main() -> None:
    units = assigned_json(ROOT / "data" / "core.js")
    raster_matrix = build_raster_matrix(len(units))
    corr = smoothed_trial_z_pearson(raster_matrix)
    graph = graph_definitions(corr, units)

    teacher_edge = np.asarray(REFERENCE_EDGE_STRENGTH, dtype=np.float64)
    reference_hub_ids = [int(item[0]) for item in REFERENCE_HUBS]
    report = {
        "source": "recomputed from complete S21-S40 recordings across all 80 trial windows",
        "correlation": {
            "offDiagonalQuantiles": np.round(
                np.quantile(corr[~np.eye(len(corr), dtype=bool)], [0.005, 0.5, 0.995]), 6
            ).tolist(),
            "finite": bool(np.isfinite(corr).all()),
        },
        "graph": {
            "directedChoices": len(graph["directed"]),
            "uniqueUndirectedEdges": len(graph["union"]),
            "directedBudgetAreaMatrix": np.round(graph["directedArea"], 1).tolist(),
            "unionEdgeAreaMatrix": np.round(graph["unionArea"], 1).tolist(),
            "teacherAreaMatrix": teacher_edge.tolist(),
            "directedBudgetMeanAbsoluteError": round(
                float(np.mean(np.abs(graph["directedArea"] - teacher_edge))), 3
            ),
            "unionEdgeMeanAbsoluteError": round(
                float(np.mean(np.abs(graph["unionArea"] - teacher_edge))), 3
            ),
        },
        "rankings": {
            "directedDegree": ranked_units(graph["directedDegree"], units),
            "unionDegree": ranked_units(graph["unionDegree"], units),
            "directedCrossRegion": ranked_units(graph["directedBridge"], units),
            "teacherHubIds": reference_hub_ids,
        },
        "communitySeedSensitivity": seed_audit(graph["adjacency"]),
    }
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
