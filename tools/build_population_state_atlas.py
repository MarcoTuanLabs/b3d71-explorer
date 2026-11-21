#!/usr/bin/env python3
"""Build a transcriptomics-inspired population-state atlas from trial rasters.

The output is a static browser asset. UMAP is used only for visualization;
Leiden communities are fitted on the fuzzy nearest-neighbor graph in PCA space.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import igraph as ig
import leidenalg
import numpy as np
import umap
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, confusion_matrix
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
EVENT_ORDER = ["baseline", "cue", "reach", "grasp", "at-mouth"]
EVENT_LABELS = {
    "baseline": "Baseline",
    "cue": "Cue",
    "reach": "Reach",
    "grasp": "Grasp",
    "at-mouth": "At mouth",
}
WINDOW_SECONDS = 0.25
N_VARIABLE_UNITS = 500
N_COMPONENTS = 30
N_NEIGHBORS = 20
RANDOM_SEED = 42


def read_window_json(path: Path, prefix: str) -> object:
    text = path.read_text()
    start = text.index(prefix) + len(prefix)
    return json.loads(text[start:].rstrip().rstrip(";"))


def read_unit(path: Path) -> dict:
    text = path.read_text()
    return json.loads(text.rsplit("=", 1)[1].rstrip().rstrip(";"))


def finite(value: object) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(value)


def build_observations(pop: dict) -> list[dict]:
    observations: list[dict] = []
    version = pop["everycon"]["77"]
    for outcome in ("success", "fail"):
        group = version[outcome]
        for row, trial in enumerate(group["idx"]):
            centers = {
                "baseline": -0.5,
                "cue": 0.125,
                "reach": group["reach"][row],
                "grasp": group["grasp"][row],
                "at-mouth": group["atMouth"][row],
            }
            for event in EVENT_ORDER:
                center = centers[event]
                if not finite(center):
                    continue
                observations.append(
                    {
                        "trial": int(trial),
                        "outcome": outcome,
                        "event": event,
                        "eventLabel": EVENT_LABELS[event],
                        "center": float(center),
                    }
                )
    observations.sort(key=lambda item: (item["trial"], EVENT_ORDER.index(item["event"])))
    return observations


def build_rate_matrix(observations: list[dict], n_units: int) -> np.ndarray:
    matrix = np.zeros((len(observations), n_units), dtype=np.float32)
    half_window = WINDOW_SECONDS / 2
    observation_indices: dict[int, list[int]] = {}
    for index, observation in enumerate(observations):
        observation_indices.setdefault(observation["trial"], []).append(index)

    for unit_id in range(n_units):
        detail = read_unit(DATA / "units" / f"u{unit_id}.js")
        trial_spikes: dict[int, list[float]] = {}
        for trial, time in zip(detail["raster"]["tr"], detail["raster"]["t"]):
            trial_spikes.setdefault(int(trial), []).append(float(time))
        sorted_spikes = {
            trial: np.sort(np.asarray(times, dtype=np.float32))
            for trial, times in trial_spikes.items()
        }
        for trial, indices in observation_indices.items():
            spikes = sorted_spikes.get(trial)
            if spikes is None:
                continue
            for observation_index in indices:
                center = observations[observation_index]["center"]
                left = np.searchsorted(spikes, center - half_window, side="left")
                right = np.searchsorted(spikes, center + half_window, side="left")
                matrix[observation_index, unit_id] = (right - left) / WINDOW_SECONDS
    return matrix


def fit_leiden(graph, resolution: float = 0.55) -> tuple[np.ndarray, float]:
    coo = graph.tocoo()
    edges = []
    weights = []
    for source, target, weight in zip(coo.row, coo.col, coo.data):
        if source >= target or weight <= 0:
            continue
        edges.append((int(source), int(target)))
        weights.append(float(weight))
    network = ig.Graph(n=graph.shape[0], edges=edges, directed=False)
    partition = leidenalg.find_partition(
        network,
        leidenalg.RBConfigurationVertexPartition,
        weights=weights,
        resolution_parameter=resolution,
        seed=RANDOM_SEED,
    )
    return np.asarray(partition.membership, dtype=int), float(partition.modularity)


def relabel_clusters(labels: np.ndarray, events: np.ndarray) -> np.ndarray:
    event_rank = {event: index for index, event in enumerate(EVENT_ORDER)}
    ordering = []
    for cluster in np.unique(labels):
        mask = labels == cluster
        mean_stage = float(np.mean([event_rank[event] for event in events[mask]]))
        ordering.append((mean_stage, -int(mask.sum()), int(cluster)))
    mapping = {old: new for new, (_, _, old) in enumerate(sorted(ordering), start=1)}
    return np.asarray([mapping[int(label)] for label in labels], dtype=int)


def json_number(value: float, digits: int = 4) -> float:
    return round(float(value), digits)


def main() -> None:
    units = read_window_json(DATA / "core.js", "window.UNITS=")
    pop = read_window_json(DATA / "pop.js", "window.POP=")
    observations = build_observations(pop)
    rates = build_rate_matrix(observations, len(units))

    transformed = np.sqrt(rates)
    feature_variance = transformed.var(axis=0)
    selected = np.argsort(feature_variance, kind="stable")[-N_VARIABLE_UNITS:]
    selected = selected[np.argsort(feature_variance[selected], kind="stable")[::-1]]
    selected_values = transformed[:, selected]
    means = selected_values.mean(axis=0)
    scales = selected_values.std(axis=0, ddof=0)
    scales[scales < 1e-8] = 1
    standardized = np.clip((selected_values - means) / scales, -6, 6)

    pca = PCA(n_components=N_COMPONENTS, random_state=RANDOM_SEED)
    scores = pca.fit_transform(standardized)
    reducer = umap.UMAP(
        n_neighbors=N_NEIGHBORS,
        min_dist=0.2,
        metric="euclidean",
        n_components=2,
        random_state=RANDOM_SEED,
        transform_seed=RANDOM_SEED,
        n_jobs=1,
    )
    embedding = reducer.fit_transform(scores)
    raw_clusters, modularity = fit_leiden(reducer.graph_)
    event_values = np.asarray([observation["event"] for observation in observations])
    cluster_values = relabel_clusters(raw_clusters, event_values)

    # Trial-blocked event decoding validates structure without evaluating UMAP itself.
    full_transformed = np.sqrt(rates)
    groups = np.asarray([observation["trial"] for observation in observations])
    decoder = make_pipeline(
        StandardScaler(),
        PCA(n_components=N_COMPONENTS, random_state=RANDOM_SEED),
        LogisticRegression(max_iter=3000, class_weight="balanced", C=0.5),
    )
    cv = GroupKFold(n_splits=5)
    predicted = cross_val_predict(decoder, full_transformed, event_values, groups=groups, cv=cv)
    balanced_accuracy = balanced_accuracy_score(event_values, predicted)
    confusion = confusion_matrix(event_values, predicted, labels=EVENT_ORDER, normalize="true")

    # Pseudobulk event signatures mimic sample aggregation, not cell-type inference.
    event_centroids = np.vstack(
        [standardized[event_values == event].mean(axis=0) for event in EVENT_ORDER]
    )
    similarity = np.corrcoef(event_centroids)
    grand_centroid = standardized.mean(axis=0)
    area_names = ["M2", "M1", "S1"]
    selected_areas = np.asarray([units[int(unit_id)]["area"] for unit_id in selected])
    regional_signatures = []
    for event_index, event in enumerate(EVENT_ORDER):
        delta = np.abs(event_centroids[event_index] - grand_centroid)
        regional_signatures.append(
            [float(delta[selected_areas == area].mean()) for area in area_names]
        )

    cluster_summaries = []
    for cluster in sorted(np.unique(cluster_values)):
        mask = cluster_values == cluster
        rest = ~mask
        effects = standardized[mask].mean(axis=0) - standardized[rest].mean(axis=0)
        marker_order = np.argsort(effects, kind="stable")[::-1][:8]
        markers = []
        for marker_index in marker_order:
            unit_id = int(selected[marker_index])
            markers.append(
                {
                    "unit": unit_id,
                    "area": units[unit_id]["area"],
                    "waveform": units[unit_id]["cls"],
                    "functional": units[unit_id]["func"],
                    "effect": json_number(effects[marker_index]),
                    "clusterMean": json_number(standardized[mask, marker_index].mean()),
                    "restMean": json_number(standardized[rest, marker_index].mean()),
                }
            )
        event_counts = {event: int(np.sum(event_values[mask] == event)) for event in EVENT_ORDER}
        outcome_values = np.asarray([observation["outcome"] for observation in observations])
        outcome_counts = {
            outcome: int(np.sum(outcome_values[mask] == outcome))
            for outcome in ("success", "fail")
        }
        cluster_summaries.append(
            {
                "id": int(cluster),
                "n": int(mask.sum()),
                "eventCounts": event_counts,
                "outcomeCounts": outcome_counts,
                "centroid": [json_number(value) for value in embedding[mask].mean(axis=0)],
                "markers": markers,
            }
        )

    marker_unit_ids = []
    for cluster in cluster_summaries:
        for marker in cluster["markers"][:5]:
            if marker["unit"] not in marker_unit_ids:
                marker_unit_ids.append(marker["unit"])
    marker_heatmap = []
    for cluster in sorted(np.unique(cluster_values)):
        mask = cluster_values == cluster
        row = []
        for unit_id in marker_unit_ids:
            marker_index = int(np.where(selected == unit_id)[0][0])
            row.append(json_number(standardized[mask, marker_index].mean()))
        marker_heatmap.append(row)

    for index, observation in enumerate(observations):
        observation["umap"] = [json_number(value) for value in embedding[index]]
        observation["cluster"] = int(cluster_values[index])

    output = {
        "meta": {
            "title": "Population-state atlas",
            "nUnits": len(units),
            "nTrials": 80,
            "nLabeledTrials": len(set(groups.tolist())),
            "nObservations": len(observations),
            "nVariableUnits": N_VARIABLE_UNITS,
            "nComponents": N_COMPONENTS,
            "nNeighbors": N_NEIGHBORS,
            "windowSeconds": WINDOW_SECONDS,
            "events": EVENT_ORDER,
            "eventLabels": EVENT_LABELS,
            "preprocessing": "250 ms event-window firing rates; square-root transform; 500 highest-variance units; feature z-score; 30-PC neighbor space",
            "umap": "UMAP 2D, n_neighbors=20, min_dist=0.20, random_state=42",
            "clustering": "Leiden on the UMAP fuzzy k-nearest-neighbor graph, resolution=0.55; clusters are not fitted on 2D coordinates",
            "markerDefinition": "cluster-minus-rest mean difference in standardized square-root firing rate; descriptive effect size, no unit-wise p-value",
            "modularity": json_number(modularity),
            "eventBalancedAccuracy": json_number(balanced_accuracy),
            "eventChance": 1 / len(EVENT_ORDER),
            "generated": "2026-07-19",
        },
        "observations": observations,
        "clusters": cluster_summaries,
        "markerUnitIds": marker_unit_ids,
        "markerHeatmap": marker_heatmap,
        "eventSimilarity": [[json_number(value) for value in row] for row in similarity],
        "regionalSignatures": [[json_number(value) for value in row] for row in regional_signatures],
        "eventConfusion": [[json_number(value) for value in row] for row in confusion],
        "explainedVariance": [json_number(value, 6) for value in pca.explained_variance_ratio_],
    }
    target = DATA / "population_state_atlas.js"
    target.write_text(
        "window.POPULATION_STATE_ATLAS="
        + json.dumps(output, separators=(",", ":"))
        + ";\n"
    )
    print(
        json.dumps(
            {
                "output": str(target),
                "observations": len(observations),
                "clusters": len(cluster_summaries),
                "balancedAccuracy": balanced_accuracy,
                "modularity": modularity,
                "selectedUnits": N_VARIABLE_UNITS,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
