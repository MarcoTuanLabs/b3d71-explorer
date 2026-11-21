#!/usr/bin/env python3
"""Build the professor-reference population bundle from the supplied MATLAB files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from scipy.io import loadmat


SOURCE_DIR = Path(
    "data/B3D71_project_raw_inputs_20260706/raw_inputs/matlab_common_trials/"
    "20240229_mPC_common_trials_factor_behavior"
)
CUE_INDEX_ONE_BASED = 80
SOURCE_RATE_HZ = 80.0
START_ZERO_BASED = 63
STOP_ZERO_BASED = 280


def compact(value: object) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True)


def event_values(source: Path, filename: str, key: str) -> np.ndarray:
    return np.asarray(loadmat(source / filename)[key]).reshape(-1).astype(int)


def build(source: Path) -> dict[str, object]:
    factor_path = source / "mPC_common_trials_factor_all.mat"
    paw_path = source / "mPC_common_trials_paw_pos_success_cleaned_v2.mat"

    factors = np.asarray(loadmat(factor_path)["factor_all_success"], dtype=float)
    paw = np.asarray(loadmat(paw_path)["paw_pos_success"], dtype=float)
    if factors.shape != (38, 48, 480):
        raise ValueError(f"Unexpected factor shape: {factors.shape}")
    if paw.shape != (3, 48, 480):
        raise ValueError(f"Unexpected paw shape: {paw.shape}")

    factor_trials = np.transpose(
        factors[:, :, START_ZERO_BASED:STOP_ZERO_BASED], (1, 2, 0)
    )
    paw_trials = np.transpose(
        paw[:, :, START_ZERO_BASED:STOP_ZERO_BASED], (1, 2, 0)
    )
    tax = (
        np.arange(START_ZERO_BASED, STOP_ZERO_BASED)
        - (CUE_INDEX_ONE_BASED - 1)
    ) / SOURCE_RATE_HZ

    event_source = {
        "reach": event_values(
            source,
            "aligned_pt_common_success_reach_1st.mat",
            "aligned_pt_common_success_reach_1st",
        ),
        "grasp": event_values(
            source,
            "aligned_pt_common_success_touch_food.mat",
            "aligned_pt_common_success_touch_food",
        ),
        "atMouth": event_values(
            source,
            "aligned_pt_common_success_at_mouth.mat",
            "aligned_pt_common_success_at_mouth",
        ),
    }
    events = {"cue": [0.0] * factor_trials.shape[0]}
    for name, values in event_source.items():
        events[name] = np.round(
            (values - CUE_INDEX_ONE_BASED) / SOURCE_RATE_HZ, 4
        ).tolist()

    return {
        "tax": np.round(tax, 4).tolist(),
        "factors": np.round(factor_trials, 5).tolist(),
        "paw": np.round(paw_trials, 3).tolist(),
        "events": events,
        "meta": {
            "cohort": "48 matched successful trials",
            "factorSource": factor_path.name,
            "pawSource": paw_path.name,
            "factorShape": [38, 48, 480],
            "pawShape": [3, 48, 480],
            "sourceRateHz": SOURCE_RATE_HZ,
            "cueIndexOneBased": CUE_INDEX_ONE_BASED,
            "windowSeconds": [-0.2, 2.5],
            "coordinates": "Supplied LFADS factors; no additional PCA rotation",
            "defaultAxes": [0, 1, 4],
            "pawProjection": "Camera X versus inverted camera Y",
            "pawPositionColor": "Cleaned camera X coordinate",
            "pawVelocityColor": "Three-dimensional paw speed",
            "pawCleanup": "Robust Whittaker smoothing from the supplied cleaned-v2 file",
        },
    }


def main() -> None:
    app_root = Path(__file__).resolve().parents[1]
    default_source = app_root.parent / SOURCE_DIR
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=default_source)
    parser.add_argument("--output", type=Path, default=app_root / "data/reference.js")
    args = parser.parse_args()

    payload = build(args.source.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("window.REFPOP=" + compact(payload) + ";\n", encoding="utf-8")
    print(
        f"Wrote {args.output}: {len(payload['factors'])} trials x "
        f"{len(payload['tax'])} bins x {len(payload['factors'][0][0])} factors"
    )


if __name__ == "__main__":
    main()
