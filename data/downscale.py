"""Quantile Delta Mapping — statistical downscaling (not generative)."""

import numpy as np
from scipy import stats


def quantile_delta_mapping(
    coarse_projection: list[float],
    coarse_historical: list[float],
    local_historical: list[float],
    confidence_pct: int = 90,
) -> dict:
    """Bias-correct coarse CMIP6 projections using local historical observations.

    For each projected value:
      1. Find quantile position in coarse_historical distribution
      2. Find local_historical value at that quantile
      3. Apply coarse model's delta (change) on top of local value

    CI captures mapping uncertainty: spread of local historical distribution
    scaled by the correction ratio.
    """
    coarse_proj = np.array(coarse_projection, dtype=float)
    coarse_hist = np.sort(coarse_historical)
    local_hist = np.sort(local_historical)

    corrected = []
    for val in coarse_proj:
        q = np.clip(stats.percentileofscore(coarse_hist, val) / 100, 0.01, 0.99)
        local_val = np.percentile(local_hist, q * 100)
        coarse_at_q = np.percentile(coarse_hist, q * 100)
        corrected.append(float(local_val + (val - coarse_at_q)))

    corrected_arr = np.array(corrected)
    mean_corrected = float(np.mean(corrected_arr))

    # CI: use local historical spread as uncertainty proxy
    # Scale by correction ratio (how much QDM shifted the distribution)
    local_std = np.std(local_hist)
    coarse_std = np.std(coarse_hist)
    correction_ratio = local_std / coarse_std if coarse_std > 0 else 1.0
    ci_half_width = local_std * correction_ratio * 1.645  # 90% CI multiplier

    return {
        "corrected_values": {
            "precip_mm_month": mean_corrected,
            "temp_max_c": mean_corrected,
        },
        "confidence_interval": {
            "lower": float(mean_corrected - ci_half_width),
            "upper": float(mean_corrected + ci_half_width),
            "confidence_pct": confidence_pct,
        },
    }


if __name__ == "__main__":
    np.random.seed(42)
    result = quantile_delta_mapping(
        coarse_projection=np.random.normal(230, 35, 12).tolist(),
        coarse_historical=np.random.normal(200, 30, 100).tolist(),
        local_historical=np.random.normal(220, 25, 100).tolist(),
    )
    print(f"Corrected: {result['corrected_values']}")
    print(f"CI: {result['confidence_interval']}")
