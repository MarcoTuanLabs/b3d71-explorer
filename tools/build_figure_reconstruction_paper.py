#!/usr/bin/env python3
"""Build publication-ready Figure Reconstruction plates from audited raster data."""

from __future__ import annotations

import json
import math
from pathlib import Path

import matplotlib as mpl
import matplotlib.image as mpimg
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.cm import ScalarMappable


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "exports" / "paper_edition"

REGION_COLORS = {"M2": "#0F4D92", "M1": "#4C956C", "S1": "#B64342"}
RESPONSE_COLORS = {
    "Cue-excited": "#B64342",
    "Cue-suppressed": "#0F4D92",
    "Unmodulated": "#9BA3AF",
}
WAVE_COLORS = {"Broad": "#6B5BD2", "Fast/Narrow": "#E8CF4A"}
WAVE_LABELS = {"Broad": "Slow / broad", "Fast/Narrow": "Fast / narrow"}
RATE_COLORS = {"baseline": "#8FA9B8", "post": "#263746", "peak": "#C46A3D"}
EVENT_COLORS = {"cue": "#27313F", "reach": "#D98E04", "grasp": "#7655A6", "atMouth": "#008C95"}
SCOPES = ["All", "M2", "M1", "S1"]
AREAS = ["M2", "M1", "S1"]
RESPONSE_CLASSES = ["Cue-excited", "Cue-suppressed", "Unmodulated"]
RESPONSE_DISPLAY = {
    "Cue-excited": "Post-cue increased",
    "Cue-suppressed": "Post-cue decreased",
    "Unmodulated": "Not significant",
}
WAVE_CLASSES = ["Broad", "Fast/Narrow"]

PARULA = LinearSegmentedColormap.from_list(
    "reference_parula",
    [
        "#312A88", "#2141B0", "#1158D6", "#0976D4", "#0094D2",
        "#11A6BD", "#21B7A7", "#4EB789", "#79B76B", "#A9B85B",
        "#DABA4D", "#EAD729", "#F8F508",
    ],
)


def load_js_assignment(path: Path):
    text = path.read_text(encoding="utf-8")
    payload = text.split("=", 1)[1].strip()
    if payload.endswith(";"):
        payload = payload[:-1]
    return json.loads(payload)


DATA = load_js_assignment(ROOT / "data" / "figure_reconstruction_third_draft.js")
UNITS = load_js_assignment(ROOT / "data" / "core.js")
METRICS = DATA["metrics"]
METRIC_BY_ID = {metric["id"]: metric for metric in METRICS}


def _one_sample_t(rows):
    rows = np.asarray(rows, dtype=float)
    n = rows.shape[0]
    means = rows.mean(axis=0)
    standard_errors = rows.std(axis=0, ddof=1) / math.sqrt(n)
    return np.divide(means, standard_errors, out=np.zeros_like(means), where=standard_errors > 0)


def _clusters(t_values, threshold):
    clusters = []
    index = 0
    while index < len(t_values):
        if abs(t_values[index]) <= threshold:
            index += 1
            continue
        sign = 1 if t_values[index] > 0 else -1
        start = index
        while index < len(t_values) and abs(t_values[index]) > threshold and (1 if t_values[index] > 0 else -1) == sign:
            index += 1
        stop = index
        clusters.append({
            "start_index": start,
            "stop_index": stop,
            "sign": "positive" if sign > 0 else "negative",
            "mass": float(np.abs(t_values[start:stop]).sum()),
            "peak_t": float(t_values[start:stop][np.argmax(np.abs(t_values[start:stop]))]),
        })
    return clusters


def _max_cluster_mass(t_values, threshold):
    clusters = _clusters(t_values, threshold)
    return max((cluster["mass"] for cluster in clusters), default=0.0)


def cluster_permutation_significance(inference, permutations=10_000, seed=42):
    """Two-sided sign-flip cluster test, FWER-corrected across time and panels."""
    threshold = 2.68456  # two-sided p < .01 for df=47
    n_trials = int(inference["nTrials"])
    tax = np.asarray(inference["tax"], dtype=float)
    bin_seconds = float(inference["binSeconds"])
    rows_by_scope = {
        scope: np.asarray(inference["scopes"][scope]["rows"], dtype=float)
        for scope in SCOPES
    }
    observed_t = {scope: _one_sample_t(rows) for scope, rows in rows_by_scope.items()}

    rng = np.random.default_rng(seed)
    signs = rng.choice(np.array([-1.0, 1.0]), size=(permutations, n_trials))
    null_max = np.zeros(permutations, dtype=float)
    for scope in SCOPES:
        rows = rows_by_scope[scope]
        means = signs @ rows / n_trials
        sum_squares = np.square(rows).sum(axis=0)
        variances = np.maximum((sum_squares[None, :] - n_trials * np.square(means)) / (n_trials - 1), 0)
        standard_errors = np.sqrt(variances / n_trials)
        t_permuted = np.divide(means, standard_errors, out=np.zeros_like(means), where=standard_errors > 0)
        for permutation in range(permutations):
            null_max[permutation] = max(
                null_max[permutation],
                _max_cluster_mass(t_permuted[permutation], threshold),
            )

    events = DATA["behaviorEventTiming"]["events"]
    scopes = {}
    for scope in SCOPES:
        rows = rows_by_scope[scope]
        scope_clusters = []
        for cluster in _clusters(observed_t[scope], threshold):
            start = float(tax[cluster["start_index"]] - bin_seconds / 2)
            end = float(tax[cluster["stop_index"] - 1] + bin_seconds / 2)
            corrected_p = (1 + int(np.count_nonzero(null_max >= cluster["mass"]))) / (permutations + 1)
            overlap = []
            for event_key in ["reach", "grasp", "atMouth"]:
                event = events[event_key]
                if end > event["q1"] and start < event["q3"]:
                    overlap.append(event["label"])
            segment = rows[:, cluster["start_index"]:cluster["stop_index"]]
            scope_clusters.append({
                **cluster,
                "start_s": round(start, 4),
                "end_s": round(end, 4),
                "corrected_p": corrected_p,
                "significant": corrected_p < 0.05,
                "mean_delta_hz_per_unit": float(segment.mean()),
                "overlapping_event_iqrs": overlap,
            })
        scopes[scope] = {
            "n_units": int(inference["scopes"][scope]["nUnits"]),
            "clusters": scope_clusters,
        }

    return {
        "method": "Two-sided one-sample t statistics on raw 100-ms trial-wise rate-minus-baseline values; p<.01 cluster formation; 10,000 joint trial sign flips; maximum absolute cluster mass across time and All/M2/M1/S1 controls family-wise error at .05.",
        "cohort": "48 matched successful trials with both spike rasters and behavioral event times",
        "baseline_window_s": DATA["meta"]["baselineWindow"],
        "inference_window_s": inference["window"],
        "bin_seconds": bin_seconds,
        "n_trials": n_trials,
        "cluster_forming_t": threshold,
        "cluster_forming_two_sided_p": 0.01,
        "permutations": permutations,
        "seed": seed,
        "family_wise_alpha": 0.05,
        "scopes": scopes,
    }


SIGNIFICANCE = cluster_permutation_significance(DATA["populationInference"])
FIGURE_1_WINDOW = tuple(DATA["meta"]["figure1Window"])
EVENT_MODEL_KEYS = ["reach", "grasp", "atMouth"]
EVENT_MODEL_LABELS = {"reach": "Reach", "grasp": "Grasp", "atMouth": "At mouth"}
EVENT_BASIS_CENTERS = np.linspace(-0.25, 0.50, 7)
EVENT_BASIS_HALF_WIDTH = 0.18
RIDGE_ALPHAS = [0.01, 0.1, 1.0, 10.0, 100.0]


def _r_squared(observed, predicted):
    observed = np.asarray(observed, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    denominator = np.square(observed - observed.mean()).sum()
    return float(1 - np.square(observed - predicted).sum() / denominator) if denominator > 0 else 0.0


def _pearson(values_a, values_b):
    values_a = np.asarray(values_a, dtype=float)
    values_b = np.asarray(values_b, dtype=float)
    if values_a.size < 3 or values_a.std() == 0 or values_b.std() == 0:
        return 0.0
    return float(np.corrcoef(values_a, values_b)[0, 1])


def _event_basis(tax, event_timing):
    """Raised-cosine event kernels evaluated at each trial's observed event time."""
    trial_count = len(next(iter(event_timing.values())))
    basis = np.zeros((trial_count, len(tax), len(EVENT_MODEL_KEYS) * len(EVENT_BASIS_CENTERS)))
    event_slices = {}
    for event_index, event_key in enumerate(EVENT_MODEL_KEYS):
        start = event_index * len(EVENT_BASIS_CENTERS)
        event_slices[event_key] = slice(start, start + len(EVENT_BASIS_CENTERS))
        event_times = np.asarray(event_timing[event_key], dtype=float)
        relative_time = tax[None, :, None] - event_times[:, None, None]
        distance = np.abs((relative_time - EVENT_BASIS_CENTERS[None, None, :]) / EVENT_BASIS_HALF_WIDTH)
        basis[:, :, event_slices[event_key]] = np.where(
            distance <= 1,
            0.5 * (1 + np.cos(np.pi * distance)),
            0,
        )
    return basis, event_slices


def _fit_event_model(rows, basis, event_slices, train_trials, test_trials, active_events, alpha):
    train_trials = np.asarray(train_trials, dtype=int)
    test_trials = np.asarray(test_trials, dtype=int)
    cue_mean = rows[train_trials].mean(axis=0)
    y_train = (rows[train_trials] - cue_mean).reshape(-1)
    y_test = (rows[test_trials] - cue_mean).reshape(-1)
    columns = np.concatenate([
        np.arange(event_slices[event_key].start, event_slices[event_key].stop)
        for event_key in active_events
    ])
    x_train = basis[train_trials][:, :, columns].reshape(-1, len(columns))
    x_test = basis[test_trials][:, :, columns].reshape(-1, len(columns))
    column_mean = x_train.mean(axis=0)
    column_sd = x_train.std(axis=0)
    column_sd[column_sd < 1e-10] = 1
    x_train = (x_train - column_mean) / column_sd
    x_test = (x_test - column_mean) / column_sd
    x_train = np.column_stack([np.ones(len(x_train)), x_train])
    x_test = np.column_stack([np.ones(len(x_test)), x_test])
    penalty = np.eye(x_train.shape[1]) * alpha
    penalty[0, 0] = 0
    system = x_train.T @ x_train + penalty
    target = x_train.T @ y_train
    try:
        coefficients = np.linalg.solve(system, target)
    except np.linalg.LinAlgError:
        coefficients = np.linalg.lstsq(system, target, rcond=None)[0]
    return y_test, x_test @ coefficients


def _trial_folds(trials, count, seed):
    trials = np.asarray(trials, dtype=int)
    shuffled = np.random.default_rng(seed).permutation(trials)
    return [fold for fold in np.array_split(shuffled, count) if len(fold)]


def _select_ridge_alpha(rows, basis, event_slices, train_trials, active_events, seed):
    folds = _trial_folds(train_trials, 4, seed)
    best_alpha = RIDGE_ALPHAS[0]
    best_score = -np.inf
    for alpha in RIDGE_ALPHAS:
        observed_parts = []
        predicted_parts = []
        for test_fold in folds:
            fit_fold = np.setdiff1d(train_trials, test_fold)
            observed, predicted = _fit_event_model(
                rows, basis, event_slices, fit_fold, test_fold, active_events, alpha,
            )
            observed_parts.append(observed)
            predicted_parts.append(predicted)
        score = _r_squared(np.concatenate(observed_parts), np.concatenate(predicted_parts))
        if score > best_score:
            best_score = score
            best_alpha = alpha
    return best_alpha


def _cross_validated_event_model(rows, basis, event_slices, active_events, outer_folds, seed):
    observed_parts = []
    predicted_parts = []
    fold_scores = []
    selected_alphas = []
    all_trials = np.arange(rows.shape[0])
    for fold_index, test_trials in enumerate(outer_folds):
        train_trials = np.setdiff1d(all_trials, test_trials)
        alpha = _select_ridge_alpha(
            rows, basis, event_slices, train_trials, active_events, seed + fold_index + 1,
        )
        observed, predicted = _fit_event_model(
            rows, basis, event_slices, train_trials, test_trials, active_events, alpha,
        )
        observed_parts.append(observed)
        predicted_parts.append(predicted)
        fold_scores.append(_r_squared(observed, predicted))
        selected_alphas.append(alpha)
    observed = np.concatenate(observed_parts)
    predicted = np.concatenate(predicted_parts)
    return {
        "r2": _r_squared(observed, predicted),
        "fold_r2": fold_scores,
        "selected_alphas": selected_alphas,
    }


def event_timing_analysis(seed=42):
    """Relate observed event timing to trial-wise post-cue-minus-baseline activity."""
    inference = DATA["populationInference"]
    tax = np.asarray(inference["tax"], dtype=float)
    timing = {
        key: np.asarray(DATA["behaviorEventTiming"]["events"][key]["times"], dtype=float)
        for key in EVENT_MODEL_KEYS
    }
    basis, event_slices = _event_basis(tax, timing)
    outer_folds = _trial_folds(np.arange(inference["nTrials"]), 5, seed)
    scopes = {}
    for scope_index, scope in enumerate(SCOPES):
        rows = np.asarray(inference["scopes"][scope]["rows"], dtype=float)
        full = _cross_validated_event_model(
            rows, basis, event_slices, EVENT_MODEL_KEYS, outer_folds, seed + 100 * scope_index,
        )
        events = {}
        trial_mean_delta = rows.mean(axis=1)
        for event_key in EVENT_MODEL_KEYS:
            active_events = [key for key in EVENT_MODEL_KEYS if key != event_key]
            reduced = _cross_validated_event_model(
                rows,
                basis,
                event_slices,
                active_events,
                outer_folds,
                seed + 100 * scope_index + 20 * (EVENT_MODEL_KEYS.index(event_key) + 1),
            )
            fold_delta = [
                full_score - reduced_score
                for full_score, reduced_score in zip(full["fold_r2"], reduced["fold_r2"])
            ]
            events[event_key] = {
                "label": EVENT_MODEL_LABELS[event_key],
                "pearson_r_latency_vs_mean_delta": _pearson(timing[event_key], trial_mean_delta),
                "unique_delta_r2": full["r2"] - reduced["r2"],
                "fold_delta_r2": fold_delta,
                "reduced_r2": reduced["r2"],
                "reduced_selected_alphas": reduced["selected_alphas"],
            }
        scopes[scope] = {
            "n_units": inference["scopes"][scope]["nUnits"],
            "full_model_r2": full["r2"],
            "full_selected_alphas": full["selected_alphas"],
            "events": events,
        }
    return {
        "method": (
            "Fivefold trial-blocked ridge encoding model on 48 matched successful trials. "
            "The training-fold cue-locked mean is removed at every 100-ms bin; reach, grasp, "
            "and at-mouth times enter as seven raised-cosine temporal basis functions each. "
            "Ridge strength is selected by inner fourfold trial cross-validation. Unique event "
            "contribution is held-out full-model R2 minus held-out R2 after omitting that event."
        ),
        "interpretation": (
            "Unique delta R2 measures trial-by-trial timing association beyond the shared cue response "
            "and the other two events; it is predictive association, not causal influence."
        ),
        "descriptive_correlation": (
            "Pearson r compares each event latency with that trial's mean 0-2 s population rate "
            "minus its own -5-0 s baseline. It is retained as a transparent secondary audit."
        ),
        "n_trials": inference["nTrials"],
        "window_s": inference["window"],
        "bin_seconds": inference["binSeconds"],
        "basis_centers_s": EVENT_BASIS_CENTERS.tolist(),
        "basis_half_width_s": EVENT_BASIS_HALF_WIDTH,
        "outer_folds": 5,
        "inner_folds": 4,
        "ridge_alphas": RIDGE_ALPHAS,
        "seed": seed,
        "scopes": scopes,
    }


EVENT_TIMING = event_timing_analysis()


def publication_style():
    mpl.rcParams.update(
        {
            "font.family": "sans-serif",
            "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
            "font.size": 8.5,
            "axes.titlesize": 9.5,
            "axes.labelsize": 8.5,
            "axes.linewidth": 0.8,
            "axes.edgecolor": "#27313F",
            "axes.labelcolor": "#27313F",
            "xtick.labelsize": 7.5,
            "ytick.labelsize": 7.5,
            "xtick.color": "#4D596B",
            "ytick.color": "#4D596B",
            "xtick.major.width": 0.7,
            "ytick.major.width": 0.7,
            "xtick.major.size": 3,
            "ytick.major.size": 3,
            "legend.fontsize": 7.5,
            "legend.frameon": False,
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "savefig.facecolor": "white",
            "svg.fonttype": "none",
            "pdf.fonttype": 42,
            "ps.fonttype": 42,
        }
    )


def clean_axis(ax, grid=True):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    if grid:
        ax.grid(axis="y", color="#E5E9EF", linewidth=0.65, zorder=0)
    ax.tick_params(direction="out")


def header_axis(fig, spec, label, title, detail):
    ax = fig.add_subplot(spec)
    ax.axis("off")
    ax.axhline(0.03, color="#AEB7C3", linewidth=0.75)
    ax.text(0.0, 0.62, label, fontsize=13, fontweight="bold", va="center")
    ax.text(0.035, 0.62, title, fontsize=10.5, fontweight="bold", va="center")
    ax.text(0.035, 0.18, detail, fontsize=7.2, color="#647084", va="center")
    return ax


def cohort(scope):
    return METRICS if scope == "All" else [m for m in METRICS if m["area"] == scope]


def sample_sd(values):
    values = np.asarray(values, dtype=float)
    return float(values.std(ddof=1)) if len(values) > 1 else 0.0


def adaptive_hist(values, edges):
    counts, _ = np.histogram(values, bins=edges)
    return counts / np.diff(edges)


def adaptive_trend(records, key, response_class, edges):
    selected = [m for m in records if m["responseClass"] == response_class]
    points = []
    for index, (left, right) in enumerate(zip(edges[:-1], edges[1:])):
        values = [
            m for m in selected
            if m[key] >= left and (m[key] < right or (index == len(edges) - 2 and m[key] <= right))
        ]
        if len(values) < 5:
            continue
        x = float(np.median([m[key] for m in values]))
        y = np.asarray([m["cueDelta"] for m in values], dtype=float)
        points.append((x, float(y.mean()), float(y.std(ddof=1)), len(values)))
    return points


def add_panel_legend(ax, items, **kwargs):
    handles = [mpl.lines.Line2D([], [], color=color, lw=2.1, label=label) for label, color in items]
    legend = ax.legend(handles=handles, ncol=len(items), columnspacing=1.2, handlelength=2.2, **kwargs)
    legend.set_in_layout(False)
    return legend


def rate_histogram_limit():
    edges = np.asarray(DATA["meta"]["adaptiveRateBinsHz"], dtype=float)
    maximum = 0.0
    for scope in SCOPES:
        records = cohort(scope)
        for key in ["baselineHz", "postHz"]:
            maximum = max(maximum, float(adaptive_hist([m[key] for m in records], edges).max()))
    return math.ceil(maximum / 25) * 25


def draw_rate_histogram(ax, scope, ymax, show_ylabel=False, show_xlabel=True):
    records = cohort(scope)
    edges = np.asarray(DATA["meta"]["adaptiveRateBinsHz"], dtype=float)
    baseline = np.asarray([m["baselineHz"] for m in records])
    post = np.asarray([m["postHz"] for m in records])
    density_baseline = adaptive_hist(baseline, edges)
    density_post = adaptive_hist(post, edges)
    widths = np.diff(edges)
    bar_width = widths * 0.44
    ax.bar(edges[:-1], density_baseline, bar_width, align="edge", color=RATE_COLORS["baseline"], alpha=0.88, zorder=2)
    ax.bar(edges[:-1] + widths * 0.52, density_post, bar_width, align="edge", color=RATE_COLORS["post"], alpha=0.94, zorder=2)
    ax.set_xlim(0, 50)
    ax.set_ylim(0, ymax)
    ax.set_yticks([0, ymax / 2, ymax])
    ax.set_title(f"{scope}  n={len(records):,}", color="#202936" if scope == "All" else REGION_COLORS[scope], fontweight="bold")
    if show_xlabel:
        ax.set_xlabel("Firing rate (Hz)")
    if show_ylabel:
        ax.set_ylabel("Unit density (# per Hz)")
    else:
        ax.tick_params(labelleft=False)
    ax.text(
        0.985,
        0.95,
        f"mean: {baseline.mean():.2f} -> {post.mean():.2f} Hz\n"
        f"mean change: {post.mean() - baseline.mean():+.2f} Hz",
        transform=ax.transAxes,
        ha="right",
        va="top",
        fontsize=6.4,
        color="#445064",
        bbox={"facecolor": "white", "edgecolor": "none", "alpha": 0.82, "pad": 1.4},
    )
    clean_axis(ax)


def draw_heatmap(ax, scope):
    info = DATA["heatmaps"][scope]
    image = mpimg.imread(ROOT / info["src"])
    ax.imshow(image, aspect="auto", interpolation="nearest", extent=[-1, 5, info["n"], 1])
    ax.axvline(0, color="white", lw=0.95, ls=(0, (4, 3)))
    for event_key in ["reach", "grasp", "atMouth"]:
        timing = DATA["behaviorEventTiming"]["events"][event_key]
        ax.axvspan(timing["q1"], timing["q3"], color=EVENT_COLORS[event_key], alpha=0.08, linewidth=0)
        ax.axvline(timing["median"], color=EVENT_COLORS[event_key], lw=0.75, ls=(0, (2, 2)), alpha=0.95)
    ax.set_xlim(*FIGURE_1_WINDOW)
    ax.set_xticks([-1, 0, 1, 2])
    ax.set_xlabel("Time from cue (s)")
    ax.set_title(f"{scope}  n={info['n']:,}", color="#202936" if scope == "All" else REGION_COLORS[scope], fontweight="bold")
    ax.text(
        0.025,
        0.975,
        f"odd-trial order -> even-trial display\nsplit-half rho={info['splitHalfPeakSpearmanR']:+.2f}",
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=5.8,
        color="white",
        bbox={"facecolor": "#162131", "edgecolor": "none", "alpha": 0.68, "pad": 1.5},
    )
    if scope == "All":
        ax.set_ylabel("Cross-validated peak order")
        ax.set_yticks([1, 500, 1000, info["n"]])
        strip = ax.inset_axes([1.008, 0, 0.025, 1])
        rgb = np.array([mpl.colors.to_rgb(REGION_COLORS[area]) for area in info["areaStrip"]]).reshape(-1, 1, 3)
        strip.imshow(rgb, aspect="auto", origin="upper")
        strip.set_axis_off()
    else:
        ax.set_yticks([])
        ax.spines["top"].set_color(REGION_COLORS[scope])
        ax.spines["top"].set_linewidth(3.0)
    for spine in ax.spines.values():
        spine.set_linewidth(0.65)
        spine.set_color("#778395")


def population_trace_limit():
    values = []
    tax = np.asarray(DATA["tax"], dtype=float)
    visible = (tax >= FIGURE_1_WINDOW[0]) & (tax <= FIGURE_1_WINDOW[1])
    for scope in SCOPES:
        trace = DATA["populationMatchedCueTraces"][scope]
        mean_values = np.asarray(trace["mean"], dtype=float)[visible]
        ci_values = np.asarray(trace["ci95"], dtype=float)[visible]
        values.extend(mean_values - ci_values)
        values.extend(mean_values + ci_values)
    low = math.floor(min(values) * 2) / 2
    high = math.ceil(max(values) * 2) / 2
    return min(-1.0, low), max(1.0, high)


def draw_population_trace(ax, scope, limits, show_ylabel=False, show_xlabel=True):
    trace = DATA["populationMatchedCueTraces"][scope]
    tax = np.asarray(DATA["tax"], dtype=float)
    mean_values = np.asarray(trace["mean"], dtype=float)
    ci_values = np.asarray(trace["ci95"], dtype=float)
    color = "#202936" if scope == "All" else REGION_COLORS[scope]
    ax.axvspan(-1, 0, color="#AEB7C3", alpha=0.10, linewidth=0)
    for event_key in ["reach", "grasp", "atMouth"]:
        timing = DATA["behaviorEventTiming"]["events"][event_key]
        ax.axvspan(timing["q1"], timing["q3"], color=EVENT_COLORS[event_key], alpha=0.10, linewidth=0)
        ax.axvline(timing["median"], color=EVENT_COLORS[event_key], lw=0.75, ls=(0, (2, 2)))
    ax.fill_between(tax, mean_values - ci_values, mean_values + ci_values, color=color, alpha=0.18, linewidth=0)
    ax.plot(tax, mean_values, color=color, lw=1.9)
    ax.axvline(0, color=EVENT_COLORS["cue"], lw=0.85, ls=(0, (4, 3)))
    ax.axhline(0, color="#7F8A99", lw=0.7, ls=(0, (3, 3)))
    ax.set_xlim(*FIGURE_1_WINDOW)
    ax.set_ylim(*limits)
    span = limits[1] - limits[0]
    for cluster in SIGNIFICANCE["scopes"][scope]["clusters"]:
        if not cluster["significant"]:
            continue
        positive = cluster["sign"] == "positive"
        y = limits[0] + span * (0.055 if positive else 0.105)
        ax.plot(
            [cluster["start_s"], cluster["end_s"]],
            [y, y],
            color=color,
            lw=3.0,
            ls="-" if positive else (0, (3, 2)),
            solid_capstyle="butt",
            clip_on=False,
            zorder=6,
        )
    ax.set_xticks([-1, 0, 1, 2])
    if show_xlabel:
        ax.set_xlabel("Time from cue (s)")
    if show_ylabel:
        ax.set_ylabel("Rate - pre-cue baseline (Hz/unit)")
    ax.set_title(
        f"{scope}  {trace['nUnits']:,} units / {trace['nTrials']} trials",
        color=color,
        fontweight="bold",
    )
    clean_axis(ax)


def event_trace_limit():
    values = []
    for event_key in ["cue", "reach", "grasp", "atMouth"]:
        for area in AREAS:
            trace = DATA["eventAlignedPopulation"][event_key][area]
            mean_values = np.asarray(trace["mean"], dtype=float)
            ci_values = np.asarray(trace["ci95"], dtype=float)
            values.extend(mean_values - ci_values)
            values.extend(mean_values + ci_values)
    low = math.floor(min(values) * 2) / 2
    high = math.ceil(max(values) * 2) / 2
    return min(-1.0, low), max(1.0, high)


def draw_event_aligned_trace(ax, event_key, limits, show_ylabel=False):
    tax = np.asarray(DATA["eventAlignmentTax"], dtype=float)
    event = DATA["eventAlignedPopulation"][event_key]
    for area in AREAS:
        trace = event[area]
        mean_values = np.asarray(trace["mean"], dtype=float)
        ci_values = np.asarray(trace["ci95"], dtype=float)
        ax.fill_between(tax, mean_values - ci_values, mean_values + ci_values, color=REGION_COLORS[area], alpha=0.12, linewidth=0)
        ax.plot(tax, mean_values, color=REGION_COLORS[area], lw=1.55)
    ax.axvline(0, color=EVENT_COLORS[event_key], lw=0.95, ls=(0, (4, 3)))
    ax.axhline(0, color="#7F8A99", lw=0.7, ls=(0, (3, 3)))
    ax.set_xlim(float(tax[0]), float(tax[-1]))
    ax.set_ylim(*limits)
    ax.set_xticks([-0.75, 0, 0.75, 1.5])
    ax.set_xlabel(f"Time from {event['label'].lower()} (s)")
    if show_ylabel:
        ax.set_ylabel("Rate - pre-cue baseline (Hz/unit)")
    else:
        ax.tick_params(labelleft=False)
    ax.set_title(event["label"], color=EVENT_COLORS[event_key], fontweight="bold")
    clean_axis(ax)


def draw_unique_event_contribution(ax):
    x = np.arange(len(EVENT_MODEL_KEYS), dtype=float)
    width = 0.18
    offsets = (np.arange(len(SCOPES)) - 1.5) * width
    for scope_index, scope in enumerate(SCOPES):
        color = "#202936" if scope == "All" else REGION_COLORS[scope]
        values = np.asarray([
            100 * EVENT_TIMING["scopes"][scope]["events"][event_key]["unique_delta_r2"]
            for event_key in EVENT_MODEL_KEYS
        ])
        positions = x + offsets[scope_index]
        ax.bar(positions, values, width=width * 0.88, color=color, alpha=0.90, label=scope, zorder=2)
        for event_index, event_key in enumerate(EVENT_MODEL_KEYS):
            folds = np.asarray(
                EVENT_TIMING["scopes"][scope]["events"][event_key]["fold_delta_r2"],
                dtype=float,
            ) * 100
            jitter = np.linspace(-0.035, 0.035, len(folds))
            ax.scatter(
                np.full(len(folds), positions[event_index]) + jitter,
                folds,
                s=8,
                color="white",
                edgecolors=color,
                linewidths=0.55,
                alpha=0.90,
                zorder=4,
            )
    ax.axhline(0, color="#687483", lw=0.75)
    ax.set_xticks(x, [EVENT_MODEL_LABELS[key] for key in EVENT_MODEL_KEYS])
    ax.set_ylabel("Unique held-out delta R2\n(percentage points)")
    ax.set_title("Cross-validated event timing contribution", loc="left", fontweight="bold")
    ax.text(
        0.01,
        0.97,
        "Bars: pooled held-out delta R2; points: five outer folds",
        transform=ax.transAxes,
        va="top",
        fontsize=6.5,
        color="#647084",
    )
    ax.legend(loc="upper right", ncol=4, columnspacing=0.9, handlelength=1.2)
    clean_axis(ax)


def draw_event_correlation_audit(ax):
    matrix = np.asarray([
        [
            EVENT_TIMING["scopes"][scope]["events"][event_key]["pearson_r_latency_vs_mean_delta"]
            for event_key in EVENT_MODEL_KEYS
        ]
        for scope in SCOPES
    ])
    image = ax.imshow(matrix, cmap="RdBu_r", vmin=-1, vmax=1, aspect="auto")
    for row in range(len(SCOPES)):
        for column in range(len(EVENT_MODEL_KEYS)):
            value = matrix[row, column]
            ax.text(
                column,
                row,
                f"r={value:+.2f}",
                ha="center",
                va="center",
                fontsize=7.3,
                fontweight="bold",
                color="white" if abs(value) > 0.48 else "#182230",
            )
    ax.set_xticks(range(len(EVENT_MODEL_KEYS)), [EVENT_MODEL_LABELS[key] for key in EVENT_MODEL_KEYS])
    ax.set_yticks(range(len(SCOPES)), SCOPES)
    for label, scope in zip(ax.get_yticklabels(), SCOPES):
        label.set_color("#202936" if scope == "All" else REGION_COLORS[scope])
        label.set_fontweight("bold")
    ax.set_title("Direct latency correlation (secondary audit)", loc="left", fontweight="bold")
    ax.set_xlabel("Event time after cue")
    ax.set_ylabel("Population")
    colorbar = ax.figure.colorbar(image, ax=ax, fraction=0.045, pad=0.03, ticks=[-1, 0, 1])
    colorbar.set_label("Pearson r")
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)


def response_limit():
    tax = np.asarray(DATA["tax"], dtype=float)
    visible = (tax >= FIGURE_1_WINDOW[0]) & (tax <= FIGURE_1_WINDOW[1])
    values = []
    for scope in SCOPES:
        for response_class in RESPONSE_CLASSES:
            trace = DATA["responseTraces"][scope][response_class]
            mean_values = np.asarray(trace["mean"], dtype=float)[visible]
            values.extend(mean_values)
            spread = 1.96 * np.asarray(trace["sem"], dtype=float)[visible]
            values.extend(mean_values - spread)
            values.extend(mean_values + spread)
    return max(4, int(math.ceil(max(abs(float(np.min(values))), abs(float(np.max(values)))) / 2) * 2))


def draw_response_trace(ax, scope, limit):
    tax = np.asarray(DATA["tax"], dtype=float)
    visible = (tax >= FIGURE_1_WINDOW[0]) & (tax <= FIGURE_1_WINDOW[1])
    draw_order = ["Unmodulated", "Cue-suppressed", "Cue-excited"]
    for response_class in draw_order:
        trace = DATA["responseTraces"][scope][response_class]
        mean_values = np.asarray(trace["mean"], dtype=float)[visible]
        spread = 1.96 * np.asarray(trace["sem"], dtype=float)[visible]
        color = RESPONSE_COLORS[response_class]
        ax.fill_between(
            tax[visible],
            mean_values - spread,
            mean_values + spread,
            color=color,
            alpha=0.14,
            linewidth=0,
            zorder=1,
        )
        ax.plot(
            tax[visible],
            mean_values,
            color=color,
            lw=1.65 if response_class != "Unmodulated" else 1.35,
            zorder=3,
        )
    ax.axvline(0, color="#667386", lw=0.8, ls=(0, (4, 3)))
    ax.axhline(0, color="#9AA4B3", lw=0.65, ls=(0, (3, 3)))
    ax.set_xlim(*FIGURE_1_WINDOW)
    ax.set_ylim(-limit, limit)
    ax.set_xticks([-1, 0, 1, 2])
    ax.set_yticks([-limit, 0, limit])
    ax.set_xlabel("Time from cue (s)", fontsize=6.7, labelpad=1.5)
    if scope == "All":
        ax.set_ylabel("Cue-aligned rate - baseline (Hz)")
    else:
        ax.set_yticklabels([])
    counts = DATA["thresholdCounts"][scope]["counts"]
    ax.set_title(
        f"Increased {counts['Cue-excited']} | NS {counts['Unmodulated']} | Decreased {counts['Cue-suppressed']}",
        fontsize=7.2,
        color="#445064",
    )
    clean_axis(ax)


def response_effect_limit():
    values = np.abs(np.asarray([metric["cueDelta"] for metric in METRICS], dtype=float))
    return max(5, int(math.ceil(float(np.percentile(values, 99.5)) / 5) * 5))


def draw_response_effect_strip(ax, scope, limit):
    records = cohort(scope)
    rows = [("Cue-suppressed", 0), ("Unmodulated", 1), ("Cue-excited", 2)]
    for response_class, row in rows:
        selected = [metric for metric in records if metric["responseClass"] == response_class]
        values = np.asarray([metric["cueDelta"] for metric in selected], dtype=float)
        jitter = np.asarray(
            [(((int(metric["id"]) * 73 + 19) % 101) / 100 - 0.5) * 0.42 for metric in selected],
            dtype=float,
        )
        y = row + jitter
        inside = np.abs(values) <= limit
        color = RESPONSE_COLORS[response_class]
        ax.scatter(
            values[inside],
            y[inside],
            s=4.5,
            alpha=0.34,
            color=color,
            edgecolors="none",
            rasterized=True,
            zorder=2,
        )
        if np.any(values < -limit):
            ax.scatter(
                np.full(np.count_nonzero(values < -limit), -limit),
                y[values < -limit],
                s=10,
                marker="<",
                color=color,
                edgecolors="none",
                alpha=0.7,
                zorder=3,
            )
        if np.any(values > limit):
            ax.scatter(
                np.full(np.count_nonzero(values > limit), limit),
                y[values > limit],
                s=10,
                marker=">",
                color=color,
                edgecolors="none",
                alpha=0.7,
                zorder=3,
            )
        q1, median, q3 = np.percentile(values, [25, 50, 75])
        ax.hlines(row, max(-limit, q1), min(limit, q3), color=color, lw=2.4, zorder=4)
        ax.scatter(
            [np.clip(median, -limit, limit)],
            [row],
            s=20,
            marker="D",
            color=color,
            edgecolors="white",
            linewidths=0.6,
            zorder=5,
        )
    ax.axvline(0, color="#5D6979", lw=0.75, ls=(0, (4, 3)), zorder=1)
    ax.set_xlim(-limit, limit)
    ax.set_ylim(-0.45, 2.45)
    ax.set_xticks([-limit, 0, limit])
    ax.set_yticks([0, 1, 2], ["Decreased", "NS", "Increased"])
    for label, response_class in zip(ax.get_yticklabels(), ["Cue-suppressed", "Unmodulated", "Cue-excited"]):
        label.set_color(RESPONSE_COLORS[response_class])
        label.set_fontweight("bold")
    ax.set_xlabel("Mean 0-3 s - baseline rate (Hz)", fontsize=6.7)
    if scope == "All":
        ax.set_ylabel("0-3 s screening class", fontsize=6.7)
    ax.grid(axis="x", color="#E5E9EF", linewidth=0.6, zorder=0)
    clean_axis(ax, grid=False)


def draw_composition_bar(ax, records):
    bottom = 0
    for response_class in RESPONSE_CLASSES:
        count = sum(m["responseClass"] == response_class for m in records)
        share = count / len(records)
        ax.bar(0, share, bottom=bottom, width=0.9, color=RESPONSE_COLORS[response_class])
        if share >= 0.08:
            ax.text(0, bottom + share / 2, f"{share * 100:.0f}%", ha="center", va="center", color="white", fontsize=5.8, fontweight="bold")
        bottom += share
    ax.set_xlim(-0.6, 0.6)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_color("#AAB3BF")
        spine.set_linewidth(0.6)


def draw_modulation(ax, scope, cue_limit):
    records = cohort(scope)
    edges = np.asarray(DATA["meta"]["adaptiveRateBinsHz"])
    for response_class in RESPONSE_CLASSES:
        selected = [m for m in records if m["responseClass"] == response_class]
        ax.scatter(
            [min(50, m["postHz"]) for m in selected],
            [m["cueDelta"] for m in selected],
            s=7, alpha=0.48, color=RESPONSE_COLORS[response_class], edgecolors="none", rasterized=True,
        )
        points = adaptive_trend(records, "postHz", response_class, edges)
        if len(points) >= 2:
            x = np.asarray([p[0] for p in points])
            y = np.asarray([p[1] for p in points])
            sd = np.asarray([p[2] for p in points])
            ax.fill_between(x, np.maximum(-cue_limit, y - sd), np.minimum(cue_limit, y + sd), color=RESPONSE_COLORS[response_class], alpha=0.10, linewidth=0)
            ax.plot(x, y, color=RESPONSE_COLORS[response_class], lw=1.6, marker="o", ms=2.4)
    ax.axhline(0, color="#7C8797", lw=0.75, ls=(0, (4, 3)))
    ax.set_xlim(0, 50)
    ax.set_ylim(-cue_limit, cue_limit)
    ax.set_xticks([0, 10, 20, 30, 40, 50])
    ax.set_yticks([-cue_limit, 0, cue_limit])
    ax.set_xlabel("0-20 s firing rate (Hz)")
    ax.set_ylabel("Mean 0-3 s - baseline (Hz)")
    ax.set_title(f"{scope}  n={len(records):,}", color="#202936" if scope == "All" else REGION_COLORS[scope], fontweight="bold")
    clean_axis(ax)


def draw_confusion(ax):
    matrix = np.array(
        [[DATA["statisticalAudit"]["confusion"][old][new] for new in RESPONSE_CLASSES] for old in RESPONSE_CLASSES]
    )
    ax.imshow(matrix, cmap="Blues", aspect="auto")
    for row in range(3):
        total = matrix[row].sum()
        for col in range(3):
            value = matrix[row, col]
            ax.text(col, row - 0.08, str(value), ha="center", va="center", fontsize=10, fontweight="bold", color="white" if value > matrix.max() * 0.48 else "#15202D")
            ax.text(col, row + 0.22, f"{100 * value / total:.0f}%", ha="center", va="center", fontsize=6.3, color="white" if value > matrix.max() * 0.48 else "#445064")
    labels = [label.replace("Cue-", "") for label in RESPONSE_CLASSES]
    ax.set_xticks(range(3), labels)
    ax.set_yticks(range(3), labels)
    ax.set_xlabel("Third-draft paired-test + FDR class")
    ax.set_ylabel("Previous project class")
    ax.set_title("Classification audit", loc="left", fontweight="bold")
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)


def build_figure_1():
    fig = plt.figure(figsize=(16.5, 20.6))
    outer = fig.add_gridspec(
        6,
        1,
        height_ratios=[0.36, 3.0, 0.36, 3.35, 0.46, 8.6],
        left=0.045,
        right=0.985,
        top=0.976,
        bottom=0.028,
        hspace=0.20,
    )
    fig.suptitle(
        "Figure 1 | Firing-rate distributions and post-cue population timing",
        fontsize=15,
        fontweight="bold",
        y=0.993,
    )

    header_a = header_axis(
        fig,
        outer[0],
        "A",
        "Baseline and post-cue firing-rate distributions",
        "Each unit contributes one -5 to 0 s baseline rate and one 0 to 20 s post-cue rate. Adaptive bins are normalized by bin width so unequal widths remain comparable.",
    )
    add_panel_legend(
        header_a,
        [("Baseline -5 to 0 s", RATE_COLORS["baseline"]), ("Post-cue 0 to 20 s", RATE_COLORS["post"])],
        loc="center right",
        bbox_to_anchor=(0.98, 0.58),
    )
    a_grid = outer[1].subgridspec(2, 2, hspace=0.30, wspace=0.10)
    histogram_ymax = rate_histogram_limit()
    for index, scope in enumerate(SCOPES):
        draw_rate_histogram(
            fig.add_subplot(a_grid[index // 2, index % 2]),
            scope,
            histogram_ymax,
            show_ylabel=index % 2 == 0,
            show_xlabel=index >= 2,
        )

    header_b = header_axis(
        fig,
        outer[2],
        "B",
        "Cue-aligned regional population response",
        "Display: -1 to 2 s; each trial's -5 to 0 s pre-cue baseline is subtracted. Ribbons are 95% confidence intervals across 48 matched successful trials; bars mark cluster-permutation FWER p<.05.",
    )
    add_panel_legend(
        header_b,
        [
            ("Reach median / IQR", EVENT_COLORS["reach"]),
            ("Grasp median / IQR", EVENT_COLORS["grasp"]),
            ("At mouth median / IQR", EVENT_COLORS["atMouth"]),
        ],
        loc="center right",
        bbox_to_anchor=(0.98, 0.58),
    )
    b_grid = outer[3].subgridspec(2, 2, hspace=0.22, wspace=0.10)
    trace_limits = population_trace_limit()
    for index, scope in enumerate(SCOPES):
        draw_population_trace(
            fig.add_subplot(b_grid[index // 2, index % 2]),
            scope,
            trace_limits,
            show_ylabel=index % 2 == 0,
            show_xlabel=index >= 2,
        )

    header_c = header_axis(
        fig,
        outer[4],
        "C",
        "Cross-validated peak ordering, post-cue trajectories, and unit-level response effects",
        "Top: odd-numbered trials determine the order; independently averaged even-numbered trials are displayed after baseline z scoring. Bottom: means use 95% confidence intervals; effect strips show each unit's 0-3 s minus baseline mean.",
    )
    handles = [
        mpl.lines.Line2D([], [], color=RESPONSE_COLORS[response_class], lw=2.1, label=RESPONSE_DISPLAY[response_class])
        for response_class in RESPONSE_CLASSES
    ]
    handles.append(mpl.lines.Line2D([], [], color="#303A47", marker="D", ms=4, lw=2, label="Effect strip: median / IQR"))
    legend = header_c.legend(
        handles=handles,
        ncol=4,
        loc="center right",
        bbox_to_anchor=(0.985, 0.60),
        columnspacing=1.0,
        handlelength=2.0,
    )
    legend.set_in_layout(False)
    c_grid = outer[5].subgridspec(
        2,
        5,
        height_ratios=[2.15, 1.62],
        width_ratios=[1, 1, 1, 1, 0.045],
        hspace=0.27,
        wspace=0.14,
    )
    axes_c = [fig.add_subplot(c_grid[0, i]) for i in range(4)]
    for ax, scope in zip(axes_c, SCOPES):
        draw_heatmap(ax, scope)
    cax = fig.add_subplot(c_grid[0, 4])
    fig.colorbar(
        ScalarMappable(norm=Normalize(-2, 4), cmap=PARULA),
        cax=cax,
        ticks=[-2, -1, 0, 1, 2, 3, 4],
        label="Baseline z score",
    )
    trace_limit = response_limit()
    effect_limit = response_effect_limit()
    for index, scope in enumerate(SCOPES):
        lower = c_grid[1, index].subgridspec(2, 1, height_ratios=[2.35, 0.92], hspace=0.42)
        draw_response_trace(fig.add_subplot(lower[0]), scope, trace_limit)
        draw_response_effect_strip(fig.add_subplot(lower[1]), scope, effect_limit)
    fig.add_subplot(c_grid[1, 4]).axis("off")
    return fig


def waveform_time():
    return (np.arange(len(UNITS[0]["wf"])) - 41) / 32.0


def draw_waveform(ax, wave_class):
    selected = [unit for unit in UNITS if unit["cls"] == wave_class]
    values = np.asarray([unit["wf"] for unit in selected], dtype=float)
    time = waveform_time()
    step = max(1, len(selected) // 45)
    for trace in values[::step][:45]:
        ax.plot(time, trace, color=WAVE_COLORS[wave_class], alpha=0.10, lw=0.55)
    mean_values = values.mean(axis=0)
    sd_values = values.std(axis=0, ddof=1)
    ax.fill_between(time, mean_values - sd_values, mean_values + sd_values, color=WAVE_COLORS[wave_class], alpha=0.18, linewidth=0)
    ax.plot(time, mean_values, color=WAVE_COLORS[wave_class], lw=2.2)
    ax.axvline(0, color="#7A8596", lw=0.7, ls=(0, (4, 3)))
    ax.set_xlim(-1.05, 1.15)
    ax.set_ylim(-1.08, 1.05)
    ax.set_xticks([-1, 0, 1])
    ax.set_yticks([-1, 0, 1])
    ax.set_xlabel("Time from trough (ms)")
    ax.set_ylabel("Normalized amplitude")
    ax.set_title(f"{WAVE_LABELS[wave_class]}  n={len(selected):,}", color="#5A4ABB" if wave_class == "Broad" else "#665C00", fontweight="bold")
    ax.text(0.02, 0.96, "Mean +/- 1 SD", transform=ax.transAxes, va="top", fontsize=6.7, color="#647084")
    clean_axis(ax)


def draw_feature_space(ax):
    for wave_class in WAVE_CLASSES:
        selected = [unit for unit in UNITS if unit["cls"] == wave_class]
        ax.scatter([u["t2p"] for u in selected], [u["ratio"] for u in selected], s=9, alpha=0.5, color=WAVE_COLORS[wave_class], edgecolors="#4A4750", linewidths=0.18, rasterized=True, label=WAVE_LABELS[wave_class])
    ax.axvline(0.4, color="#303A47", lw=0.8, ls=(0, (4, 3)))
    ax.text(0.408, 0.97, "0.4 ms operational cutoff", transform=ax.get_xaxis_transform(), va="top", fontsize=7, color="#4D596B")
    ax.set_xlim(0, 1.05)
    ax.set_xlabel("Trough-to-peak duration (ms)")
    ax.set_ylabel("Post-peak / trough ratio")
    ax.legend(loc="upper right", ncol=2)
    clean_axis(ax)


def draw_wave_composition(ax):
    x = np.arange(4)
    broad_share = []
    fast_share = []
    for scope in SCOPES:
        info = DATA["waveComposition"][scope]
        broad_share.append(100 * info["Broad"] / info["n"])
        fast_share.append(100 * info["Fast/Narrow"] / info["n"])
    ax.bar(x, broad_share, color=WAVE_COLORS["Broad"], width=0.55, label=WAVE_LABELS["Broad"])
    ax.bar(x, fast_share, bottom=broad_share, color=WAVE_COLORS["Fast/Narrow"], width=0.55, label=WAVE_LABELS["Fast/Narrow"])
    for index, scope in enumerate(SCOPES):
        info = DATA["waveComposition"][scope]
        ax.text(index, broad_share[index] / 2, f"{info['Broad']:,}\n{broad_share[index]:.0f}%", ha="center", va="center", color="white", fontsize=7.2, fontweight="bold")
        ax.text(index, broad_share[index] + fast_share[index] / 2, f"{info['Fast/Narrow']:,}\n{fast_share[index]:.0f}%", ha="center", va="center", color="#302B00", fontsize=6.7, fontweight="bold")
    ax.set_xticks(x, SCOPES)
    for label, scope in zip(ax.get_xticklabels(), SCOPES):
        label.set_color("#202936" if scope == "All" else REGION_COLORS[scope])
        label.set_fontweight("bold")
    ax.set_ylim(0, 100)
    ax.set_ylabel("Within-area proportion (%)")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, 1.13), ncol=2)
    clean_axis(ax)


def waveform_trace_limit(wave_class):
    values = []
    for area in AREAS:
        trace = DATA["waveformTraces"][wave_class][area]
        mean_values = np.asarray(trace["mean"])
        sd_values = np.asarray(trace["sd"])
        keep = np.asarray(DATA["tax"]) <= 4
        values.extend((mean_values - sd_values)[keep])
        values.extend((mean_values + sd_values)[keep])
    return max(5, int(math.ceil(max(abs(float(np.min(values))), abs(float(np.max(values)))) / 5) * 5))


def draw_wave_response(ax, wave_class):
    tax = np.asarray(DATA["tax"])
    keep = tax <= 4
    limit = waveform_trace_limit(wave_class)
    for area in AREAS:
        trace = DATA["waveformTraces"][wave_class][area]
        mean_values = np.asarray(trace["mean"])[keep]
        sd_values = np.asarray(trace["sd"])[keep]
        ax.fill_between(tax[keep], mean_values - sd_values, mean_values + sd_values, color=REGION_COLORS[area], alpha=0.10, linewidth=0)
        ax.plot(tax[keep], mean_values, color=REGION_COLORS[area], lw=1.65, label=area)
    ax.axvline(0, color="#687487", lw=0.75, ls=(0, (4, 3)))
    ax.axhline(0, color="#9BA5B3", lw=0.65, ls=(0, (3, 3)))
    ax.set_xlim(-1, 4)
    ax.set_ylim(-limit, limit)
    ax.set_yticks([-limit, 0, limit])
    ax.set_xlabel("Time from cue (s)")
    ax.set_ylabel("Baseline-centered rate (Hz)")
    ax.set_title(f"{WAVE_LABELS[wave_class]}: mean +/- 1 SD", color="#5A4ABB" if wave_class == "Broad" else "#665C00", fontweight="bold")
    ax.legend(loc="upper right", ncol=3)
    clean_axis(ax)


def draw_latency(ax, wave_class, cue_limit):
    for area in AREAS:
        trace = DATA["waveformTraces"][wave_class][area]
        points = trace["latencyPoints"]
        ax.scatter([p["latency"] for p in points], [p["cueDelta"] for p in points], s=8, alpha=0.45, color=REGION_COLORS[area], edgecolors="none", rasterized=True)
        if points:
            ax.scatter([trace["medianLatency"]], [float(np.median([p["cueDelta"] for p in points]))], s=42, marker="D", color=REGION_COLORS[area], edgecolors="white", linewidths=0.7, zorder=4)
    ax.axvline(0, color="#687487", lw=0.75, ls=(0, (4, 3)))
    ax.axhline(0, color="#9BA5B3", lw=0.65, ls=(0, (3, 3)))
    ax.set_xlim(-1, 4)
    ax.set_ylim(-cue_limit, cue_limit)
    ax.set_yticks([-cue_limit, 0, cue_limit])
    ax.set_xlabel("PSTH peak latency from cue (s)")
    ax.set_ylabel("Mean 0-3 s - baseline (Hz)")
    ax.set_title(f"{WAVE_LABELS[wave_class]} latency map", color="#5A4ABB" if wave_class == "Broad" else "#665C00", fontweight="bold")
    clean_axis(ax)


def draw_response_matrix(ax, scope):
    info = DATA["responsiveMatrices"][scope]
    matrix = np.array([[info[wave][response] for response in RESPONSE_CLASSES[:2]] for wave in WAVE_CLASSES])
    row_share = matrix / np.maximum(matrix.sum(axis=1, keepdims=True), 1)
    ax.imshow(row_share, cmap=LinearSegmentedColormap.from_list("response", ["#EEF2F6", "#486A93"]), vmin=0, vmax=1, aspect="auto")
    for row in range(2):
        total = matrix[row].sum()
        for col in range(2):
            count = int(matrix[row, col])
            share = count / total if total else 0
            ax.text(col, row - 0.08, str(count), ha="center", va="center", fontsize=9.5, fontweight="bold", color="white" if share > 0.52 else "#182230")
            ax.text(col, row + 0.22, f"{share * 100:.0f}%", ha="center", va="center", fontsize=6.2, color="white" if share > 0.52 else "#4D596B")
    ax.set_xticks([0, 1], ["Increased", "Decreased"])
    ax.set_yticks([0, 1], ["Slow / broad", "Fast / narrow"])
    ax.set_title(f"{scope}  responsive n={matrix.sum():,}", color="#202936" if scope == "All" else REGION_COLORS[scope], fontweight="bold")
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)


def build_figure_2():
    fig = plt.figure(figsize=(16.5, 21.5), constrained_layout=True)
    outer = fig.add_gridspec(
        9,
        1,
        height_ratios=[0.34, 2.7, 3.0, 0.34, 3.0, 0.34, 6.6, 0.34, 2.7],
    )
    fig.suptitle("Figure 2 | Waveform class, post-cue timing, and response direction", fontsize=15, fontweight="bold")

    header_axis(fig, outer[0], "A", "Normalized extracellular waveforms and waveform feature space", "Pale traces are deterministic samples; bold traces and bands are class mean +/- 1 SD. The 0.4 ms boundary is operational.")
    wave_grid = outer[1].subgridspec(1, 2, wspace=0.14)
    draw_waveform(fig.add_subplot(wave_grid[0, 0]), "Broad")
    draw_waveform(fig.add_subplot(wave_grid[0, 1]), "Fast/Narrow")
    draw_feature_space(fig.add_subplot(outer[2]))

    header_axis(fig, outer[3], "B", "Waveform-class composition by recording area", "Equal-height bars use each area total as the denominator; labels report both count and percentage.")
    draw_wave_composition(fig.add_subplot(outer[4]))

    header_axis(fig, outer[5], "C", "Post-cue time courses and peak latency by waveform class", "Separate slow/broad and fast/narrow panels retain all three regions; ribbons are mean +/- 1 SD and diamonds mark medians.")
    c_grid = outer[6].subgridspec(2, 2, hspace=0.08, wspace=0.10)
    draw_wave_response(fig.add_subplot(c_grid[0, 0]), "Broad")
    draw_wave_response(fig.add_subplot(c_grid[0, 1]), "Fast/Narrow")
    cue_limit = int(math.ceil(max(abs(m["cueDelta"]) for m in METRICS) / 5) * 5)
    draw_latency(fig.add_subplot(c_grid[1, 0]), "Broad", cue_limit)
    draw_latency(fig.add_subplot(c_grid[1, 1]), "Fast/Narrow", cue_limit)

    header_axis(fig, outer[7], "D", "Significant post-cue composition by waveform class", "FDR-significant units only. Rows are waveform classes; columns are increased and decreased 0-3 s activity.")
    d_grid = outer[8].subgridspec(1, 4, wspace=0.22)
    for index, scope in enumerate(SCOPES):
        draw_response_matrix(fig.add_subplot(d_grid[0, index]), scope)
    return fig


def build_figure_2d():
    fig = plt.figure(figsize=(16.5, 3.5), constrained_layout=True)
    grid = fig.add_gridspec(1, 4, wspace=0.22)
    for index, scope in enumerate(SCOPES):
        draw_response_matrix(fig.add_subplot(grid[0, index]), scope)
    return fig


def export_figure(fig, stem):
    OUT.mkdir(parents=True, exist_ok=True)
    paths = {}
    for extension in ("svg", "pdf", "png"):
        path = OUT / f"{stem}.{extension}"
        fig.savefig(path, dpi=300, bbox_inches="tight", pad_inches=0.12)
        paths[extension] = path
    plt.close(fig)
    return paths


def combine_figure_2_with_d(main_paths, d_paths):
    # Figure 2D remains a separate editable plate so its small matrices retain
    # legible typography. The web page presents it directly beneath Figure 2.
    return {"main": {k: str(v.relative_to(ROOT)) for k, v in main_paths.items()}, "panel_d": {k: str(v.relative_to(ROOT)) for k, v in d_paths.items()}}


def main():
    publication_style()
    OUT.mkdir(parents=True, exist_ok=True)
    significance_path = OUT / "figure_1_significance.json"
    significance_path.write_text(json.dumps(SIGNIFICANCE, indent=2) + "\n", encoding="utf-8")
    figure_1_paths = export_figure(build_figure_1(), "figure_1_paper")
    figure_2_paths = export_figure(build_figure_2(), "figure_2_paper")
    figure_2d_paths = export_figure(build_figure_2d(), "figure_2_panel_d_paper")
    manifest = {
        "analysis_source": DATA["meta"]["source"],
        "classification": DATA["meta"]["classification"],
        "n_units": DATA["meta"]["nUnits"],
        "n_trials": DATA["meta"]["nTrials"],
        "figure_1_inference_trials": SIGNIFICANCE["n_trials"],
        "figure_1_significance": str(significance_path.relative_to(ROOT)),
        "figure_1_significance_method": SIGNIFICANCE["method"],
        "figure_1": {k: str(v.relative_to(ROOT)) for k, v in figure_1_paths.items()},
        "figure_2": combine_figure_2_with_d(figure_2_paths, figure_2d_paths),
        "note": "Dense heatmap and scatter artists are rasterized inside SVG/PDF; typography, axes, lines, bars, and annotations remain vector.",
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
