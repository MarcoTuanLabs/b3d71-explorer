#!/usr/bin/env python3
"""Build slide-method comparison assets for the B3D71 explorer.

The output is deliberately descriptive. It reproduces analyses supported by the
local bundle and records where the lecture deck's exact trial selection or model
outputs were not supplied.
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.io import loadmat


ROOT = Path(__file__).resolve().parents[1]
RAW = Path(
    "/Users/mac/Documents/Neuron Visualization/yuwei/data/"
    "B3D71_project_raw_inputs_20260706/raw_inputs"
)
LFADS = RAW / "latent_dynamics/01_lfads"
COMMON = RAW / "matlab_common_trials/20240229_mPC_common_trials_factor_behavior"
PDF = "/Users/mac/Downloads/2025-10-21 中央大學 for Marco.pdf"
OUT = ROOT / "data/professor.js"

SOURCE_RATE = 80.0
CUE_INDEX = 400
WINDOW = (-0.2, 2.5)
SMOOTH_MS = 37.5
N_COMPONENTS = 8

# Correlation-matched common-trial row -> full 80-trial row. The mapping is
# one-to-one and has median whole-trajectory correlation 0.698 (minimum 0.592).
COMMON_TO_FULL = [
    0, 1, 4, 6, 7, 9, 10, 12, 15, 16, 18, 19, 21, 23, 24, 25,
    26, 27, 28, 29, 30, 31, 33, 34, 35, 39, 42, 50, 51, 52, 53, 54,
    56, 57, 58, 59, 62, 64, 66, 68, 70, 71, 72, 73, 75, 76, 77, 78,
]


def load_js(path: Path, prefix: str) -> dict:
    text = path.read_text().strip()
    if not text.startswith(prefix):
        raise ValueError(f"Unexpected JS wrapper in {path}")
    return json.loads(text[len(prefix) :].removesuffix(";"))


def load_pickle(path: Path) -> np.ndarray:
    with path.open("rb") as handle:
        value = pickle.load(handle)
    array = np.asarray(value, dtype=np.float64)
    if array.shape != (38, 80, 2000):
        raise ValueError(f"Unexpected shape {array.shape} in {path}")
    return np.transpose(array, (1, 2, 0))  # trial x time x component


def movement_window(array: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    start = CUE_INDEX + int(round(WINDOW[0] * SOURCE_RATE))
    stop = CUE_INDEX + int(round(WINDOW[1] * SOURCE_RATE)) + 1
    cropped = gaussian_filter1d(
        array[:, start:stop], sigma=SMOOTH_MS / 1000 * SOURCE_RATE,
        axis=1, mode="nearest"
    )
    cropped = cropped[:, ::2]
    tax = np.arange(start, stop, 2, dtype=float)
    tax = (tax - CUE_INDEX) / SOURCE_RATE
    return cropped, tax


def deterministic_sign(components: np.ndarray) -> np.ndarray:
    signs = np.ones(components.shape[0])
    for index, row in enumerate(components):
        anchor = int(np.argmax(np.abs(row)))
        signs[index] = 1.0 if row[anchor] >= 0 else -1.0
    return signs


def fit_pca(samples: np.ndarray, n: int = N_COMPONENTS) -> dict:
    mean = samples.mean(axis=0)
    centered = samples - mean
    _, singular, vt = np.linalg.svd(centered, full_matrices=False)
    components = vt[:n]
    signs = deterministic_sign(components)
    components = components * signs[:, None]
    eigen = singular**2 / max(1, samples.shape[0] - 1)
    return {
        "mean": mean,
        "components": components,
        "eigen": eigen,
        "explained": eigen / max(eigen.sum(), 1e-12),
    }


def transform_pca(samples: np.ndarray, model: dict) -> np.ndarray:
    return (samples - model["mean"]) @ model["components"].T


def invsqrt(matrix: np.ndarray, ridge: float = 1e-6) -> np.ndarray:
    values, vectors = np.linalg.eigh(matrix)
    floor = max(float(values.max()), 1.0) * ridge
    values = np.maximum(values, floor)
    return vectors @ np.diag(values**-0.5) @ vectors.T


def fit_cca(x: np.ndarray, y: np.ndarray) -> dict:
    x_mean, y_mean = x.mean(axis=0), y.mean(axis=0)
    xc, yc = x - x_mean, y - y_mean
    denom = max(1, len(x) - 1)
    cxx = xc.T @ xc / denom
    cyy = yc.T @ yc / denom
    cxy = xc.T @ yc / denom
    wx, wy = invsqrt(cxx), invsqrt(cyy)
    left, corr, right_t = np.linalg.svd(wx @ cxy @ wy)
    return {
        "x_mean": x_mean,
        "y_mean": y_mean,
        "a": wx @ left,
        "b": wy @ right_t.T,
        "corr": np.clip(corr, 0, 1),
    }


def apply_cca(x: np.ndarray, y: np.ndarray, model: dict) -> tuple[np.ndarray, np.ndarray]:
    u = (x - model["x_mean"]) @ model["a"]
    v = (y - model["y_mean"]) @ model["b"]
    return u, v


def correlation_columns(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    values = []
    for index in range(a.shape[1]):
        av, bv = a[:, index], b[:, index]
        values.append(float(np.corrcoef(av, bv)[0, 1]))
    return np.nan_to_num(values)


def global_alignment(joint: np.ndarray, regional: np.ndarray) -> dict:
    shape = joint.shape
    joint_pca = fit_pca(joint.reshape(-1, joint.shape[-1]))
    region_pca = fit_pca(regional.reshape(-1, regional.shape[-1]))
    x = transform_pca(joint.reshape(-1, joint.shape[-1]), joint_pca)
    y = transform_pca(regional.reshape(-1, regional.shape[-1]), region_pca)
    cca = fit_cca(x, y)
    u, v = apply_cca(x, y, cca)
    # Put regional canonical coordinates back into the joint PCA coordinate
    # system, so all four small multiples share interpretable axes.
    map_to_joint = np.linalg.lstsq(v, x, rcond=None)[0]
    aligned = (v @ map_to_joint).reshape(shape[0], shape[1], N_COMPONENTS)
    return {
        "joint_scores": x.reshape(shape[0], shape[1], N_COMPONENTS),
        "aligned": aligned,
        "corr": correlation_columns(u, v),
    }


def cross_validated_cca(joint: np.ndarray, regional: np.ndarray, folds: int = 5) -> np.ndarray:
    held_u = [[] for _ in range(N_COMPONENTS)]
    held_v = [[] for _ in range(N_COMPONENTS)]
    trial_ids = np.arange(joint.shape[0])
    for fold in range(folds):
        test = trial_ids[trial_ids % folds == fold]
        train = trial_ids[trial_ids % folds != fold]
        jp = fit_pca(joint[train].reshape(-1, joint.shape[-1]))
        rp = fit_pca(regional[train].reshape(-1, regional.shape[-1]))
        train_x = transform_pca(joint[train].reshape(-1, joint.shape[-1]), jp)
        train_y = transform_pca(regional[train].reshape(-1, regional.shape[-1]), rp)
        cca = fit_cca(train_x, train_y)
        test_x = transform_pca(joint[test].reshape(-1, joint.shape[-1]), jp)
        test_y = transform_pca(regional[test].reshape(-1, regional.shape[-1]), rp)
        u, v = apply_cca(test_x, test_y, cca)
        # Canonical signs can flip by fold. Orient using the held-out pair.
        for component in range(N_COMPONENTS):
            if np.corrcoef(u[:, component], v[:, component])[0, 1] < 0:
                v[:, component] *= -1
            held_u[component].append(u[:, component])
            held_v[component].append(v[:, component])
    return np.asarray([
        np.corrcoef(np.concatenate(held_u[index]), np.concatenate(held_v[index]))[0, 1]
        for index in range(N_COMPONENTS)
    ])


def cumulative_variance(samples: np.ndarray) -> np.ndarray:
    centered = samples - samples.mean(axis=0)
    covariance = centered.T @ centered / max(1, len(samples) - 1)
    values = np.linalg.eigvalsh(covariance)[::-1]
    values = np.maximum(values, 0)
    return np.cumsum(values) / max(values.sum(), 1e-12)


def event_map(pop: dict) -> dict[int, dict]:
    result = {}
    version = pop["everycon"]["77"]
    for outcome in ("success", "fail"):
        group = version[outcome]
        for row, trial in enumerate(group["idx"]):
            result[int(trial)] = {
                "outcome": outcome,
                **{
                    name: float(group[name][row]) if group[name][row] is not None else np.nan
                    for name in ("cue", "reach", "grasp", "atMouth")
                },
            }
    return result


def nearest_time(tax: np.ndarray, value: float) -> int:
    return int(np.argmin(np.abs(tax - value)))


def event_purity(trajectories: np.ndarray, tax: np.ndarray, events: dict, outcome: str) -> list[float]:
    names = ("cue", "reach", "grasp", "atMouth")
    points, labels, trials = [], [], []
    for trial, row in events.items():
        if row["outcome"] != outcome:
            continue
        for label, name in enumerate(names):
            value = row[name]
            if np.isfinite(value) and tax[0] <= value <= tax[-1]:
                points.append(trajectories[trial, nearest_time(tax, value), :3])
                labels.append(label)
                trials.append(trial)
    points = np.asarray(points, dtype=float)
    labels = np.asarray(labels)
    trials = np.asarray(trials)
    points = (points - points.mean(axis=0)) / np.maximum(points.std(axis=0), 1e-9)
    result = []
    for target in range(len(names)):
        scores = []
        for index in np.where(labels == target)[0]:
            distance = np.sum((points - points[index]) ** 2, axis=1)
            distance[(trials == trials[index])] = np.inf
            neighbors = np.argsort(distance)[:5]
            scores.append(np.mean(labels[neighbors] == target))
        result.append(float(np.mean(scores) * 100) if scores else 0.0)
    return result


def round_nested(value, digits=5):
    if isinstance(value, np.ndarray):
        return np.round(value, digits).tolist()
    if isinstance(value, dict):
        return {key: round_nested(item, digits) for key, item in value.items()}
    if isinstance(value, (np.floating, np.integer)):
        return value.item()
    return value


def common_match_correlations(full_joint: np.ndarray) -> np.ndarray:
    common = np.asarray(
        loadmat(COMMON / "mPC_common_trials_factor_all.mat")["factor_all_success"],
        dtype=float,
    )
    if common.shape != (38, 48, 480):
        raise ValueError(f"Unexpected common-trial shape: {common.shape}")
    common = np.transpose(common, (1, 2, 0))
    full_window = full_joint[:, CUE_INDEX - 80 : CUE_INDEX + 400]
    correlations = []
    for common_row, full_trial in enumerate(COMMON_TO_FULL):
        left = common[common_row].reshape(-1)
        right = full_window[full_trial].reshape(-1)
        left = (left - left.mean()) / max(left.std(), 1e-12)
        right = (right - right.mean()) / max(right.std(), 1e-12)
        correlations.append(float(np.mean(left * right)))
    return np.asarray(correlations)


def main() -> None:
    pop = load_js(ROOT / "data/pop.js", "window.POP=")
    full = {
        "joint": load_pickle(LFADS / "mPC_ALL_trial_base.pickle"),
        "m1": load_pickle(LFADS / "mPC_m1_trial_base.pickle"),
        "m2": load_pickle(LFADS / "mPC_m2_trial_base.pickle"),
        "s1": load_pickle(LFADS / "mPC_s1_trial_base.pickle"),
    }
    movement = {}
    tax = None
    for name, array in full.items():
        movement[name], tax = movement_window(array)

    joint_model = fit_pca(movement["joint"].reshape(-1, 38))
    joint_scores = transform_pca(movement["joint"].reshape(-1, 38), joint_model)
    joint_scores = joint_scores.reshape(80, len(tax), N_COMPONENTS)
    aligned = {"joint": joint_scores[:, :, :3]}
    cca = {}
    for region in ("m1", "m2", "s1"):
        fit = global_alignment(movement["joint"], movement[region])
        aligned[region] = fit["aligned"][:, :, :3]
        cca[region] = {
            "inSample": fit["corr"],
            "crossValidated": cross_validated_cca(movement["joint"], movement[region]),
        }

    events = event_map(pop)
    purity = {outcome: {} for outcome in ("success", "fail")}
    for outcome in purity:
        for region, trajectories in aligned.items():
            purity[outcome][region] = event_purity(trajectories, tax, events, outcome)

    full_samples = full["joint"].reshape(-1, 38)
    movement_samples = movement["joint"].reshape(-1, 38)
    trial_mean_samples = movement["joint"].mean(axis=0)
    neuron_mean = np.asarray(pop["heatmap"]["z"], dtype=float).T
    variance = {
        "factorSingleFull": cumulative_variance(full_samples),
        "factorSingleMovement": cumulative_variance(movement_samples),
        "factorTrialMeanMovement": cumulative_variance(trial_mean_samples),
        "neuronTrialMeanSite": cumulative_variance(neuron_mean),
        "slideTargetFirst8": 0.85,
    }
    variance["first8"] = {
        key: float(value[min(7, len(value) - 1)])
        for key, value in variance.items() if isinstance(value, np.ndarray)
    }

    m1_common = COMMON / "mPC_common_trials_factor_m1.mat"
    match_corr = common_match_correlations(full["joint"])
    payload = {
        "meta": {
            "sourcePdf": PDF,
            "slides": {
                "variance": 27,
                "alignment": [28, 33],
                "manifold": 36,
                "eventClustering": 37,
                "sMap": [38, 42],
                "singleUnitMap": 43,
            },
            "method": "37.5 ms Gaussian smoothing; PCA; trial-blocked CCA; 5-NN event-label purity",
            "sourceRateHz": SOURCE_RATE,
            "outputRateHz": 40,
            "windowSeconds": list(WINDOW),
            "commonTrialIds": COMMON_TO_FULL,
            "commonMatchCorrelationMedian": float(np.median(match_corr)),
            "commonMatchCorrelationMinimum": float(np.min(match_corr)),
            "teacherDisplayTrialIds": COMMON_TO_FULL[:30],
            "teacherSubsetCaveat": "The lecture figure labels 30 trials but the supplied file contains 48 and does not identify the historical 30-trial subset. The 30-trial display uses the first 30 rows in supplied file order.",
            "m1CommonFileBytes": m1_common.stat().st_size,
            "m1Recovery": "The supplied common-trial M1 MAT file is empty. M1 was recovered from the full 80-trial mPC bundle using one-to-one whole-trajectory matching to the common joint bundle.",
        },
        "tax": tax,
        "aligned": aligned,
        "cca": cca,
        "variance": variance,
        "eventPurity": {
            "metric": "mean percentage of five nearest event-state neighbors with the same event label, excluding states from the same trial",
            "labels": ["Cue", "Reach", "Grasp", "At mouth"],
            "success": purity["success"],
            "fail": purity["fail"],
        },
        "audit": [
            {"slides": "27", "feature": "Accumulated variance", "status": "partial", "finding": "Available mPC samples do not reproduce the stated 85% in eight PCs; preprocessing/model-fit differences remain."},
            {"slides": "28–33", "feature": "PCA + CCA inter-area alignment", "status": "reconstructed", "finding": "Method reproduced with five-fold trial-blocked CCA; exact historical basis matrices were not supplied."},
            {"slides": "34–35", "feature": "Event-aligned regional activity", "status": "reconstructed", "finding": "Built from the supplied M1/M2/S1 trial signals and final 77 classified outcomes."},
            {"slides": "36", "feature": "PC1 × PC2 × PC5 manifold", "status": "partial", "finding": f"Axes, time window, events, and smoothing match. Common-to-full trial matching has median r={np.median(match_corr):.3f}; the historical 30-trial row selection is unavailable."},
            {"slides": "37", "feature": "Event-state clustering", "status": "substitute", "finding": "The slide's NNI formula is absent; the site reports an explicit leave-same-trial-out 5-NN label-purity metric."},
            {"slides": "38–42", "feature": "Multivariate S-map", "status": "reconstructed", "finding": "Current data support six state-dependent predictive slopes and trial-by-time summaries, not causal connectivity."},
            {"slides": "43", "feature": "Spatial component-weight map", "status": "reconstructed", "finding": "Stored mPC readout weights are mapped to unit positions; sign reversal is shown because component sign is arbitrary."},
        ],
    }
    OUT.write_text("window.PROF=" + json.dumps(round_nested(payload), separators=(",", ":")) + ";\n")
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1_000_000:.2f} MB)")
    print("First-eight cumulative variance:", round_nested(variance["first8"], 4))
    for region, values in cca.items():
        print(region.upper(), "CV CCA first 3:", np.round(values["crossValidated"][:3], 3).tolist())
    print("Common-to-full match correlation: median", round(float(np.median(match_corr)), 3), "minimum", round(float(np.min(match_corr)), 3))


if __name__ == "__main__":
    main()
