#!/usr/bin/env python3
"""Refresh only the generated functional-atlas spectral coordinates."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import laplacian
from scipy.sparse.linalg import eigsh


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "functional_hierarchy.js"
PREFIX = "window.FUNCTIONAL_HIERARCHY="


def normalize_positions(positions: np.ndarray) -> np.ndarray:
    positions = positions.copy()
    for dimension in range(2):
        lower, upper = np.quantile(positions[:, dimension], [0.01, 0.99])
        positions[:, dimension] = np.clip(
            (positions[:, dimension] - lower) / max(1e-8, upper - lower),
            0.0,
            1.0,
        )
    return positions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--method",
        choices=("spectral", "unnormalized", "spring"),
        default="spectral",
    )
    parser.add_argument("--iterations", type=int, default=35)
    parser.add_argument("--spring-k", type=float, default=0.055)
    args = parser.parse_args()
    source = OUTPUT.read_text().strip()
    if not source.startswith(PREFIX) or not source.endswith(";"):
        raise ValueError("Unexpected hierarchy payload wrapper")
    payload = json.loads(source[len(PREFIX) : -1])
    graph = payload["graph"]
    size = len(graph["communityById"])

    rows: list[int] = []
    columns: list[int] = []
    weights: list[float] = []
    for first, second, weight in graph["edges"]:
        rows.extend((int(first), int(second)))
        columns.extend((int(second), int(first)))
        weights.extend((float(weight), float(weight)))
    adjacency = csr_matrix((weights, (rows, columns)), shape=(size, size), dtype=np.float64)

    normalized = args.method != "unnormalized"
    component_count = 4 if normalized else 3
    _, vectors = eigsh(
        laplacian(adjacency, normed=normalized),
        k=component_count,
        which="SM",
        tol=0.001,
    )
    positions = normalize_positions(vectors[:, 1:3])
    layout_label = (
        "normalized graph-Laplacian spectral embedding"
        if normalized
        else "unnormalized graph-Laplacian spectral embedding"
    )
    if args.method == "spring":
        import networkx as nx

        network = nx.Graph()
        network.add_nodes_from(range(size))
        network.add_weighted_edges_from(
            (int(first), int(second), float(weight)) for first, second, weight in graph["edges"]
        )
        initial = {index: positions[index] for index in range(size)}
        resolved = nx.spring_layout(
            network,
            pos=initial,
            k=args.spring_k,
            iterations=args.iterations,
            threshold=1e-4,
            weight="weight",
            seed=71,
        )
        positions = np.asarray([resolved[index] for index in range(size)], dtype=np.float64)
        layout_label = "seeded Fruchterman-Reingold layout of the reconstructed weighted kNN graph"
    positions = normalize_positions(positions)

    graph["x"] = np.round(positions[:, 0], 4).tolist()
    graph["y"] = np.round(positions[:, 1], 4).tolist()
    graph["layout"] = layout_label
    OUTPUT.write_text(PREFIX + json.dumps(payload, separators=(",", ":")) + ";\n")
    print(f"Updated {size} atlas coordinates from {len(graph['edges'])} graph edges.")


if __name__ == "__main__":
    main()
