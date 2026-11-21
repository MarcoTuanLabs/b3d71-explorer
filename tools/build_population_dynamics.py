#!/usr/bin/env python3
"""Rebuild the population manifold bundle from the 38-D LFADS mPC inputs."""

from __future__ import annotations

import argparse
import json
import pickle
from pathlib import Path

import numpy as np


REGION_FILES = {
    "all": "mPC_ALL_trial_base.pickle",
    "m1": "mPC_m1_trial_base.pickle",
    "m2": "mPC_m2_trial_base.pickle",
    "s1": "mPC_s1_trial_base.pickle",
}


def parse_args() -> argparse.Namespace:
    app_dir = Path(__file__).resolve().parents[1]
    default_raw = (
        app_dir.parent
        / "data/B3D71_project_raw_inputs_20260706/raw_inputs/latent_dynamics/01_lfads"
    )
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=default_raw)
    parser.add_argument("--output", type=Path, default=app_dir / "data/pop.js")
    parser.add_argument("--source-rate", type=float, default=80.0)
    parser.add_argument("--cue-index", type=int, default=400)
    parser.add_argument("--window-start", type=float, default=-0.2)
    parser.add_argument("--window-end", type=float, default=2.5)
    parser.add_argument("--output-rate", type=float, default=40.0)
    parser.add_argument("--smooth-ms", type=float, default=37.5)
    parser.add_argument("--components", type=int, default=8)
    return parser.parse_args()


def read_pop(path: Path) -> dict:
    text = path.read_text()
    prefix = "window.POP="
    if not text.startswith(prefix):
        raise ValueError(f"{path} does not start with {prefix!r}")
    return json.loads(text[len(prefix) :].rstrip(";\n"))


def gaussian_smooth(data: np.ndarray, sigma_bins: float) -> np.ndarray:
    if sigma_bins <= 0:
        return data
    radius = max(1, int(np.ceil(4 * sigma_bins)))
    offsets = np.arange(-radius, radius + 1, dtype=float)
    kernel = np.exp(-0.5 * (offsets / sigma_bins) ** 2)
    kernel /= kernel.sum()
    padded = np.pad(data, ((0, 0), (0, 0), (radius, radius)), mode="edge")
    return np.apply_along_axis(lambda values: np.convolve(values, kernel, mode="valid"), 2, padded)


def deterministic_components(centered: np.ndarray, count: int) -> tuple[np.ndarray, np.ndarray]:
    _, all_singular_values, all_components = np.linalg.svd(centered, full_matrices=False)
    components = all_components[:count]
    singular_values = all_singular_values[:count]

    for index, component in enumerate(components):
        pivot = int(np.argmax(np.abs(component)))
        if component[pivot] < 0:
            components[index] *= -1

    total_variance = np.square(all_singular_values).sum()
    explained = np.square(singular_values) / max(total_variance, np.finfo(float).eps)
    return components, explained


def pca_projection(samples: np.ndarray, fit_samples: np.ndarray, count: int) -> tuple[np.ndarray, np.ndarray]:
    center = fit_samples.mean(axis=0)
    components, explained = deterministic_components(fit_samples - center, count)
    projected = (samples - center) @ components.T
    return projected, explained


def prepare_region(raw: np.ndarray, args: argparse.Namespace) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    if raw.ndim != 3 or raw.shape[0] < args.components:
        raise ValueError(f"Expected factors x trials x time, got {raw.shape}")

    source_time = (np.arange(raw.shape[2]) - args.cue_index) / args.source_rate
    mask = (source_time >= args.window_start) & (source_time <= args.window_end)
    if not mask.any():
        raise ValueError("Requested time window does not overlap the source data")

    source_step = args.source_rate / args.output_rate
    rounded_step = int(round(source_step))
    if not np.isclose(source_step, rounded_step):
        raise ValueError("output-rate must divide source-rate exactly")

    cropped = gaussian_smooth(raw[:, :, mask], args.smooth_ms / 1000 * args.source_rate)
    sampled = cropped[:, :, ::rounded_step].transpose(1, 2, 0)
    output_time = source_time[mask][::rounded_step]
    flat = sampled.reshape(-1, sampled.shape[-1])

    all_pc, all_evar = pca_projection(flat, flat, args.components)
    mean_fit = sampled.mean(axis=0)
    mean_pc, mean_evar = pca_projection(flat, mean_fit, args.components)

    shape = (sampled.shape[0], sampled.shape[1], args.components)
    return output_time, all_pc.reshape(shape), all_evar, mean_pc.reshape(shape), mean_evar


def rounded_list(values: np.ndarray, decimals: int = 4) -> list:
    return np.round(values, decimals).tolist()


def main() -> None:
    args = parse_args()
    pop = read_pop(args.output)
    previous_latent_time = pop.get("latentTax", [])
    if pop.get("paw80") and "pawTax" not in pop:
        pop["pawTax"] = previous_latent_time

    latent = {}
    shared_time = None
    for region, filename in REGION_FILES.items():
        source = args.raw_dir / filename
        if not source.exists():
            raise FileNotFoundError(source)
        with source.open("rb") as handle:
            raw = np.asarray(pickle.load(handle), dtype=float)

        time, pc, evar, mean_pc, mean_evar = prepare_region(raw, args)
        if shared_time is None:
            shared_time = time
        elif not np.allclose(shared_time, time):
            raise ValueError(f"Time axis differs for region {region}")

        latent[region] = {
            "pc": rounded_list(pc),
            "evar": rounded_list(evar),
            "meanPc": rounded_list(mean_pc),
            "meanEvar": rounded_list(mean_evar),
        }
        print(
            f"{region}: trials={pc.shape[0]} bins={pc.shape[1]} "
            f"all-sample variance={evar.sum():.3f} mean-trajectory variance={mean_evar.sum():.3f}"
        )

    pop["latentTax"] = rounded_list(shared_time)
    pop["latent80"] = latent
    pop["latentMeta"] = {
        "source": "LFADS mPC, 38 factors x 80 trials x 2000 bins",
        "regionSources": REGION_FILES,
        "cueIndexZeroBased": args.cue_index,
        "sourceRateHz": args.source_rate,
        "windowSeconds": [args.window_start, args.window_end],
        "outputRateHz": args.output_rate,
        "smoothingSigmaMs": args.smooth_ms,
        "components": args.components,
        "centering": "Subtract the mean of the samples used to fit each basis",
        "bases": {
            "pc": "PCA fitted across all single-trial time samples",
            "meanPc": "PCA fitted to the 80-trial mean trajectory",
        },
        "rotationalInference": "Not performed; the viewer does not claim jPCA significance",
        "pawCoverage": "Stored separately in pawTax; never extrapolated to the neural window",
    }

    destination = args.output
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    temporary.write_text("window.POP=" + json.dumps(pop, separators=(",", ":")) + ";\n")
    temporary.replace(destination)
    print(f"Wrote {destination} ({destination.stat().st_size / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    main()
