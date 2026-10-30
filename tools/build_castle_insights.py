#!/usr/bin/env python3
"""Build CASTLE phase and neuron-to-LFADS contribution data for the browser app."""

from __future__ import annotations

import argparse
import json
import pickle
import re
from pathlib import Path

import numpy as np
from scipy.io import loadmat
from scipy.stats import chi2_contingency, rankdata, spearmanr

from full_spike_data import (
    DEFAULT_SPIKE_ROOT,
    SAMPLE_RATE_HZ,
    iter_trial_windows,
    source_fingerprint,
    validate_spike_root,
)


CASTLE_RATE_HZ = 80.0
CASTLE_CUE_INDEX = 80
CASTLE_BINS = 480
LFADS_RATE_HZ = 80.0
LFADS_CUE_INDEX = 400
LFADS_START = LFADS_CUE_INDEX - 16
LFADS_STOP = LFADS_CUE_INDEX + 201
CASTLE_LFADS_START = LFADS_CUE_INDEX - CASTLE_CUE_INDEX
CASTLE_LFADS_STOP = CASTLE_LFADS_START + CASTLE_BINS


def compact(value: object) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True)


def load_assignment(path: Path, prefix: str) -> object:
    text = path.read_text(encoding="utf-8")
    if not text.startswith(prefix):
        raise ValueError(f"Unexpected assignment in {path}")
    return json.loads(text[len(prefix) :].rstrip().removesuffix(";"))


def load_unit_payload(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.UNIT_CACHE\[\d+\]=(\{.*\});\s*$", text)
    if not match:
        raise ValueError(f"Could not parse {path}")
    return json.loads(match.group(1))


def pearson(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    if a.size != b.size or a.size < 3 or np.std(a) < 1e-12 or np.std(b) < 1e-12:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def percentile_columns(values: np.ndarray) -> np.ndarray:
    out = np.zeros_like(values, dtype=float)
    for column in range(values.shape[1]):
        order = np.argsort(values[:, column], kind="mergesort")
        out[order, column] = np.linspace(0.0, 1.0, values.shape[0])
    return out


def percentile_vector(values: np.ndarray) -> np.ndarray:
    out = np.zeros(values.shape, dtype=float)
    order = np.argsort(values, kind="mergesort")
    out[order] = np.linspace(0.0, 1.0, values.size)
    return out


def phase_selectivity(rates: np.ndarray) -> float:
    total = float(np.sum(rates))
    if total <= 1e-12:
        return 0.0
    probabilities = np.maximum(rates, 0.0) / total
    entropy = -float(np.sum(probabilities * np.log(probabilities + 1e-12))) / np.log(
        rates.size
    )
    return max(0.0, min(1.0, 1.0 - entropy))


def partial_rank_correlation(
    x: np.ndarray, y: np.ndarray, covariates: np.ndarray
) -> float:
    design = np.column_stack(
        [np.ones(x.size), np.asarray(covariates, dtype=float)]
    )
    ranked_x = rankdata(x)
    ranked_y = rankdata(y)
    residual_x = ranked_x - design @ np.linalg.lstsq(
        design, ranked_x, rcond=None
    )[0]
    residual_y = ranked_y - design @ np.linalg.lstsq(
        design, ranked_y, rcond=None
    )[0]
    return pearson(residual_x, residual_y)


def build(
    app_root: Path,
    raw_root: Path,
    spike_root: Path = DEFAULT_SPIKE_ROOT,
) -> dict[str, object]:
    spike_root = spike_root.expanduser().resolve()
    validate_spike_root(spike_root)
    spike_fingerprint = source_fingerprint(spike_root)
    behavior_dir = raw_root / "behavior"
    labels_path = behavior_dir / "behavioral_data/castle-syllables-5class.npy"
    meta_path = behavior_dir / "behavioral_data/castle-syllables-meta-5class.npy"
    trial_path = behavior_dir / "trial_set_240320.npy"
    unit_info_path = raw_root / "spikes/B3D71_v4_unit_info.mat"
    factor_path = raw_root / "latent_dynamics/01_lfads/mPC_ALL_trial_base.pickle"

    labels = np.load(labels_path).reshape(-1, CASTLE_BINS).astype(int)
    trial_ids = np.load(trial_path).astype(int) - 1
    source_phases = np.load(meta_path, allow_pickle=True).tolist()
    if labels.shape != (52, CASTLE_BINS) or trial_ids.shape != (52,):
        raise ValueError(f"Unexpected CASTLE shapes: {labels.shape}, {trial_ids.shape}")

    phase_names = [str(item["name"]) for item in source_phases]
    phase_names = ["Touch Food" if name == "Toucn Food" else name for name in phase_names]
    phase_colors = ["#E5549E", "#00A9C0", "#E6A63A", "#51B848", "#7967D8"]
    n_phases = len(phase_names)
    phase_frames = np.bincount(labels.reshape(-1), minlength=n_phases)
    phase_seconds = phase_frames / CASTLE_RATE_HZ
    phase_trial_seconds = np.stack(
        [
            np.bincount(row, minlength=n_phases) / CASTLE_RATE_HZ
            for row in labels
        ]
    )
    phase_trial_counts = np.count_nonzero(phase_trial_seconds, axis=0)
    occupancy = np.stack(
        [(labels == phase).mean(axis=0) for phase in range(n_phases)], axis=1
    )
    dominant = np.argmax(occupancy, axis=1)
    transitions = np.zeros((n_phases, n_phases), dtype=int)
    for row in labels:
        changed = row[1:] != row[:-1]
        for source, target in zip(row[:-1][changed], row[1:][changed]):
            transitions[int(source), int(target)] += 1

    unit_info = loadmat(unit_info_path, squeeze_me=True)
    mpc_weight = np.asarray(unit_info["mPC_weight"], dtype=float)
    gamma_weight = np.asarray(unit_info["gamma_weight"], dtype=float)
    if mpc_weight.shape != (1346, 38) or gamma_weight.shape != (1346, 38):
        raise ValueError("Unexpected LFADS weight shape")

    core_units = load_assignment(app_root / "data/core.js", "window.UNITS=")
    if not isinstance(core_units, list) or len(core_units) != 1346:
        raise ValueError("Unexpected core unit metadata")

    with factor_path.open("rb") as handle:
        all_factors = np.asarray(pickle.load(handle), dtype=float)
    if all_factors.shape != (38, 80, 2000):
        raise ValueError(f"Unexpected LFADS factor shape: {all_factors.shape}")
    cropped_factors = all_factors[:, :, LFADS_START:LFADS_STOP]
    factor_mean = cropped_factors.mean(axis=1).T
    factor_std = cropped_factors.reshape(38, -1).std(axis=1)
    factor_tax = (
        np.arange(LFADS_START, LFADS_STOP) - LFADS_CUE_INDEX
    ) / LFADS_RATE_HZ

    matched_factors = np.transpose(
        all_factors[:, trial_ids, CASTLE_LFADS_START:CASTLE_LFADS_STOP],
        (1, 2, 0),
    )
    if matched_factors.shape != (labels.shape[0], CASTLE_BINS, 38):
        raise ValueError(
            f"Unexpected CASTLE-aligned factor shape: {matched_factors.shape}"
        )
    factor_center = matched_factors.mean(axis=(0, 1))
    centered_factors = matched_factors - factor_center
    factor_abs_all = np.abs(centered_factors).mean(axis=(0, 1))
    phase_factor_mean = np.zeros((n_phases, 38), dtype=float)
    phase_factor_abs = np.zeros((n_phases, 38), dtype=float)
    phase_factor_mean_se = np.zeros((n_phases, 38), dtype=float)
    phase_factor_abs_se = np.zeros((n_phases, 38), dtype=float)
    phase_factor_frames = np.zeros(n_phases, dtype=int)
    phase_drive_mean = np.zeros((n_phases, mpc_weight.shape[0]), dtype=float)
    phase_drive_abs = np.zeros((n_phases, mpc_weight.shape[0]), dtype=float)
    for phase in range(n_phases):
        phase_mask = labels == phase
        pooled = centered_factors[phase_mask]
        phase_factor_frames[phase] = pooled.shape[0]
        phase_factor_mean[phase] = pooled.mean(axis=0)
        phase_factor_abs[phase] = np.abs(pooled).mean(axis=0)
        phase_drive = pooled @ mpc_weight.T
        phase_drive_mean[phase] = phase_drive.mean(axis=0)
        phase_drive_abs[phase] = np.abs(phase_drive).mean(axis=0)

        trial_sum = []
        trial_abs_sum = []
        trial_frames = []
        for trial_index in range(labels.shape[0]):
            trial_mask = phase_mask[trial_index]
            if not np.any(trial_mask):
                continue
            values = centered_factors[trial_index, trial_mask]
            trial_sum.append(values.sum(axis=0))
            trial_abs_sum.append(np.abs(values).sum(axis=0))
            trial_frames.append(values.shape[0])
        trial_sum_array = np.asarray(trial_sum)
        trial_abs_sum_array = np.asarray(trial_abs_sum)
        trial_frames_array = np.asarray(trial_frames, dtype=float)[:, None]
        trial_count = trial_sum_array.shape[0]
        if trial_count > 1:
            signed_residual = (
                trial_sum_array
                - trial_frames_array * phase_factor_mean[phase]
            )
            abs_residual = (
                trial_abs_sum_array
                - trial_frames_array * phase_factor_abs[phase]
            )
            cluster_scale = np.sqrt(trial_count / (trial_count - 1))
            phase_factor_mean_se[phase] = (
                cluster_scale
                * np.sqrt(np.sum(signed_residual**2, axis=0))
                / np.sum(trial_frames_array)
            )
            phase_factor_abs_se[phase] = (
                cluster_scale
                * np.sqrt(np.sum(abs_residual**2, axis=0))
                / np.sum(trial_frames_array)
            )
    drive_abs_all = np.average(
        phase_drive_abs, axis=0, weights=phase_factor_frames
    )

    trial_to_castle = {int(trial): row for row, trial in enumerate(trial_ids)}
    spike_counts_by_unit_trial = np.zeros(
        (len(core_units), labels.shape[0], n_phases), dtype=np.int32
    )
    frame_samples = SAMPLE_RATE_HZ // int(CASTLE_RATE_HZ)
    for neural_trial, clusters, relative_samples in iter_trial_windows(spike_root):
        castle_row = trial_to_castle.get(int(neural_trial))
        if castle_row is None:
            continue
        valid = (relative_samples >= -SAMPLE_RATE_HZ) & (
            relative_samples < 5 * SAMPLE_RATE_HZ
        )
        unit_ids = clusters[valid]
        frames = (relative_samples[valid] + SAMPLE_RATE_HZ) // frame_samples
        phase_ids = labels[castle_row, frames]
        key = unit_ids.astype(np.int64) * n_phases + phase_ids
        spike_counts_by_unit_trial[:, castle_row, :] = np.bincount(
            key, minlength=len(core_units) * n_phases
        ).reshape(len(core_units), n_phases)

    rates = np.zeros((len(core_units), n_phases), dtype=float)
    split_reliability = np.zeros(len(core_units), dtype=float)
    phase_consistency = np.zeros(len(core_units), dtype=float)
    lfads_corr = np.zeros(len(core_units), dtype=float)
    gamma_corr = np.zeros(len(core_units), dtype=float)

    for unit_id in range(len(core_units)):
        payload = load_unit_payload(app_root / f"data/units/u{unit_id}.js")
        spike_counts_by_trial = spike_counts_by_unit_trial[unit_id].astype(float)
        spike_counts = spike_counts_by_trial.sum(axis=0)
        rates[unit_id] = spike_counts / np.maximum(phase_seconds, 1e-12)

        even = np.arange(labels.shape[0]) % 2 == 0
        odd = ~even
        even_rates = spike_counts_by_trial[even].sum(axis=0) / np.maximum(
            phase_trial_seconds[even].sum(axis=0), 1e-12
        )
        odd_rates = spike_counts_by_trial[odd].sum(axis=0) / np.maximum(
            phase_trial_seconds[odd].sum(axis=0), 1e-12
        )
        split_reliability[unit_id] = pearson(
            np.log1p(even_rates), np.log1p(odd_rates)
        )

        preferred = int(np.argmax(rates[unit_id]))
        leave_one_out_preferred = []
        for trial_index in range(labels.shape[0]):
            loo_counts = spike_counts - spike_counts_by_trial[trial_index]
            loo_seconds = phase_seconds - phase_trial_seconds[trial_index]
            loo_rates = loo_counts / np.maximum(loo_seconds, 1e-12)
            leave_one_out_preferred.append(int(np.argmax(loo_rates)))
        phase_consistency[unit_id] = np.mean(
            np.asarray(leave_one_out_preferred) == preferred
        )

        psth = np.asarray(payload["psth"], dtype=float)
        psth_tax = float(payload["psthX0"]) + (
            np.arange(psth.size) + 0.5
        ) * float(payload["psthDx"])
        observed = np.interp(factor_tax, psth_tax, psth)
        lfads_corr[unit_id] = pearson(
            factor_mean @ mpc_weight[unit_id], np.log1p(np.maximum(observed, 0.0))
        )
        gamma_corr[unit_id] = pearson(
            factor_mean @ gamma_weight[unit_id], np.log1p(np.maximum(observed, 0.0))
        )

    log_rates = np.log1p(rates)
    centered = log_rates - log_rates.mean(axis=1, keepdims=True)
    phase_z = centered / np.maximum(centered.std(axis=1, keepdims=True), 1e-12)
    phase_percentiles = percentile_columns(rates)
    preferred_phase = np.argmax(rates, axis=1)
    selectivity = np.asarray([phase_selectivity(row) for row in rates])

    mpc_norm = np.linalg.norm(mpc_weight, axis=1)
    gamma_norm = np.linalg.norm(gamma_weight, axis=1)
    axis_norm = np.linalg.norm(mpc_weight[:, [0, 1, 4]], axis=1)
    mpc_percentile = percentile_vector(mpc_norm)
    gamma_percentile = percentile_vector(gamma_norm)
    axis_percentile = percentile_vector(axis_norm)

    units = []
    for unit_id, metadata in enumerate(core_units):
        units.append(
            {
                "id": unit_id,
                "area": metadata["area"],
                "cell": str(unit_info["cell_type"][unit_id]).strip(),
                "qc": metadata["qc"],
                "meanHz": round(float(metadata["meanHz"]), 3),
                "phaseRate": np.round(rates[unit_id], 3).tolist(),
                "phaseZ": np.round(phase_z[unit_id], 3).tolist(),
                "phasePct": np.round(phase_percentiles[unit_id], 3).tolist(),
                "preferred": int(preferred_phase[unit_id]),
                "selectivity": round(float(selectivity[unit_id]), 4),
                "splitReliability": round(float(split_reliability[unit_id]), 4),
                "phaseConsistency": round(float(phase_consistency[unit_id]), 4),
                "mpc": np.round(mpc_weight[unit_id], 4).tolist(),
                "gamma": np.round(gamma_weight[unit_id], 4).tolist(),
                "mpcNorm": round(float(mpc_norm[unit_id]), 4),
                "gammaNorm": round(float(gamma_norm[unit_id]), 4),
                "axisNorm": round(float(axis_norm[unit_id]), 4),
                "mpcPct": round(float(mpc_percentile[unit_id]), 4),
                "gammaPct": round(float(gamma_percentile[unit_id]), 4),
                "axisPct": round(float(axis_percentile[unit_id]), 4),
                "lfadsCorr": round(float(lfads_corr[unit_id]), 4),
                "gammaCorr": round(float(gamma_corr[unit_id]), 4),
            }
        )

    cell_types = np.asarray([str(value).strip() for value in unit_info["cell_type"]])
    areas = np.asarray([metadata["area"] for metadata in core_units])
    mean_hz = np.asarray([float(metadata["meanHz"]) for metadata in core_units])
    fast_slow = np.isin(cell_types, ["fast", "slow"])
    preferred_table = np.stack(
        [
            np.bincount(
                preferred_phase[fast_slow & (cell_types == cell)],
                minlength=n_phases,
            )
            for cell in ["fast", "slow"]
        ]
    )
    pooled_chi2 = chi2_contingency(preferred_table)
    area_phase_p = {}
    for area in ["M1", "M2", "S1"]:
        mask = fast_slow & (areas == area)
        table = np.stack(
            [
                np.bincount(
                    preferred_phase[mask & (cell_types == cell)],
                    minlength=n_phases,
                )
                for cell in ["fast", "slow"]
            ]
        )
        area_phase_p[area] = float(chi2_contingency(table)[1])

    covariates = np.column_stack(
        [
            rankdata(np.log1p(mean_hz)),
            (areas == "M1").astype(float),
            (areas == "M2").astype(float),
            (cell_types == "fast").astype(float),
            (cell_types == "up-down").astype(float),
        ]
    )
    selective_low_weight = sorted(
        (
            unit
            for unit in units
            if unit["mpcPct"] <= 0.3
            and max(unit["phaseRate"]) >= 1.0
            and unit["phaseConsistency"] >= 0.75
        ),
        key=lambda unit: (
            unit["selectivity"]
            * np.log1p(max(unit["phaseRate"]))
            * unit["phaseConsistency"]
        ),
        reverse=True,
    )[:8]
    signals = {
        "fastMedianRate": np.round(
            np.median(rates[cell_types == "fast"], axis=0), 3
        ).tolist(),
        "slowMedianRate": np.round(
            np.median(rates[cell_types == "slow"], axis=0), 3
        ).tolist(),
        "preferredCounts": {
            "fast": preferred_table[0].tolist(),
            "slow": preferred_table[1].tolist(),
        },
        "preferredPhasePooledP": float(pooled_chi2[1]),
        "preferredPhaseAreaP": area_phase_p,
        "selectivityMpcSpearman": float(spearmanr(selectivity, mpc_norm).statistic),
        "selectivityLfadsSpearman": float(
            spearmanr(selectivity, lfads_corr).statistic
        ),
        "selectivityMpcPartialRank": partial_rank_correlation(
            selectivity, mpc_norm, covariates
        ),
        "selectivityLfadsPartialRank": partial_rank_correlation(
            selectivity, lfads_corr, covariates
        ),
        "selectiveLowWeightUnits": [unit["id"] for unit in selective_low_weight],
        "liftingTransitionEdges": int(
            transitions[4].sum() + transitions[:, 4].sum()
        ),
    }

    return {
        "phases": [
            {"id": i, "name": phase_names[i], "color": phase_colors[i]}
            for i in range(n_phases)
        ],
        "phaseTax": np.round(
            (np.arange(CASTLE_BINS) - CASTLE_CUE_INDEX) / CASTLE_RATE_HZ, 4
        ).tolist(),
        "trialIds": trial_ids.tolist(),
        "phaseSeconds": np.round(phase_seconds, 3).tolist(),
        "phaseTrialCounts": phase_trial_counts.tolist(),
        "occupancy": np.round(occupancy, 3).tolist(),
        "dominant": dominant.tolist(),
        "transitions": transitions.tolist(),
        "factorTax": np.round(factor_tax, 4).tolist(),
        "factorMean": np.round(factor_mean, 5).tolist(),
        "factorStd": np.round(factor_std, 5).tolist(),
        "factorCenter": np.round(factor_center, 6).tolist(),
        "factorAbsAll": np.round(factor_abs_all, 6).tolist(),
        "phaseFactorMean": np.round(phase_factor_mean, 6).tolist(),
        "phaseFactorAbs": np.round(phase_factor_abs, 6).tolist(),
        "phaseFactorMeanSe": np.round(phase_factor_mean_se, 6).tolist(),
        "phaseFactorAbsSe": np.round(phase_factor_abs_se, 6).tolist(),
        "phaseFactorFrames": phase_factor_frames.tolist(),
        "phaseDriveMean": np.round(phase_drive_mean, 6).tolist(),
        "phaseDriveAbs": np.round(phase_drive_abs, 6).tolist(),
        "driveAbsAll": np.round(drive_abs_all, 6).tolist(),
        "units": units,
        "signals": signals,
        "meta": {
            "castleSource": labels_path.name,
            "spikeSource": "complete paired S21-S40 spike_times/spike_clusters NPY recordings",
            "spikeSourceRoot": str(spike_root),
            "spikeSourceFingerprint": spike_fingerprint,
            "castleTrials": int(labels.shape[0]),
            "castleBins": CASTLE_BINS,
            "castleRateHz": CASTLE_RATE_HZ,
            "castleWindowSeconds": [-1.0, 5.0],
            "trialMapSource": trial_path.name,
            "weightSource": unit_info_path.name,
            "weightShape": [1346, 38],
            "factorSource": factor_path.name,
            "lfadsWindowSeconds": [-0.2, 2.5],
            "castleLfadsWindowSeconds": [-1.0, 5.0],
            "dynamicContribution": "D_i,k,p = mean over matched CASTLE frames in phase p of abs(w_i,k * (f_k(t) - matched-window factor mean))",
            "dynamicSignedMean": "S_i,k,p = mean over matched CASTLE frames in phase p of w_i,k * (f_k(t) - matched-window factor mean)",
            "phaseDriveMagnitude": "R_i,p = mean over matched CASTLE frames in phase p of abs(sum_k w_i,k * (f_k(t) - matched-window factor mean))",
            "phaseFactorUncertainty": "Trial-cluster ratio standard error for the occupancy-weighted phase mean; trials, not frames, define independent clusters",
            "dynamicContributionCaveat": "Descriptive phase-conditioned linear-readout decomposition; not a causal effect, reconstructed firing rate, or retrained LFADS ablation",
            "lfadsCorrelation": "Pearson correlation between mPC-weighted mean LFADS drive and log1p observed all-trial PSTH",
            "phaseReliability": "Odd/even CASTLE-trial correlation of log1p phase firing-rate profiles",
            "phaseConsistency": "Fraction of 52 leave-one-trial-out fits retaining the full-data preferred phase",
            "weightCaveat": "mPC_weight and gamma_weight are stored source matrices; gamma semantics are not specified by the supplied metadata",
        },
    }


def main() -> None:
    app_root = Path(__file__).resolve().parents[1]
    default_raw = (
        app_root.parent
        / "data/B3D71_project_raw_inputs_20260706/raw_inputs"
    )
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-root", type=Path, default=default_raw)
    parser.add_argument("--spike-root", type=Path, default=DEFAULT_SPIKE_ROOT)
    parser.add_argument("--output", type=Path, default=app_root / "data/castle.js")
    args = parser.parse_args()
    payload = build(app_root, args.raw_root.resolve(), args.spike_root)
    args.output.write_text("window.CASTLE=" + compact(payload) + ";\n", encoding="utf-8")
    print(
        f"Wrote {args.output}: {len(payload['units'])} units, "
        f"{len(payload['phases'])} CASTLE phases"
    )


if __name__ == "__main__":
    main()
