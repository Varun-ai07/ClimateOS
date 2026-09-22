"""Downscaling Agent — applies QDM to bias-correct coarse projections."""

import numpy as np
from scipy import stats
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.base import BaseAgent
from state.schema import MunicipalityClimateState, DownscaledData


class DownscalingAgent(BaseAgent):
    name = "downscaling_agent"
    description = "Quantile Delta Mapping for statistical downscaling"

    async def execute(self, state: MunicipalityClimateState) -> MunicipalityClimateState:
        self.add_timeline_event(state, "downscaling_start", "Starting climate downscaling...")

        raw_precip = state.forecast.precipitation.get("monthly_peak_mm", 210.0)
        raw_temp = state.forecast.temperature.get("max_c", 34.2)

        # QDM with synthetic historical data
        coarse_hist = [180, 195, 210, 225, 240, 255, 200, 190, 220, 235, 215, 205] * 5
        local_hist = [200, 215, 230, 245, 260, 275, 220, 210, 240, 255, 235, 225] * 5
        temp_coarse = [30, 31, 32, 33, 34, 35, 31, 30, 32, 33, 31, 30] * 5
        temp_local = [31, 32, 33, 34, 35, 36, 32, 31, 33, 34, 32, 31] * 5

        precip_corrected = self._qdm([raw_precip], coarse_hist, local_hist)
        temp_corrected = self._qdm([raw_temp], temp_coarse, temp_local)

        # Compute confidence interval
        local_std = np.std(local_hist)
        coarse_std = np.std(coarse_hist)
        correction_ratio = local_std / coarse_std if coarse_std > 0 else 1.0
        ci_half_width = local_std * correction_ratio * 1.645

        state.downscaled = DownscaledData(
            corrected_precip_mm=float(precip_corrected),
            corrected_temp_c=float(temp_corrected),
            confidence_interval={
                "lower": float(precip_corrected - ci_half_width),
                "upper": float(precip_corrected + ci_half_width),
            },
            risk_score=min(100, max(0, (precip_corrected - 200) / 5 + 50)),
        )

        self.add_timeline_event(state, "downscaling_complete",
            f"Corrected: {state.downscaled.corrected_precip_mm:.1f}mm, "
            f"CI: [{state.downscaled.confidence_interval['lower']:.1f}-{state.downscaled.confidence_interval['upper']:.1f}]")

        self.add_map_update(state, "precipitation_layer", {
            "corrected_mm": state.downscaled.corrected_precip_mm,
            "ci_lower": state.downscaled.confidence_interval["lower"],
            "ci_upper": state.downscaled.confidence_interval["upper"],
        })

        return state

    def _qdm(self, projection, coarse_hist, local_hist):
        """Quantile Delta Mapping."""
        proj = np.array(projection, dtype=float)
        coarse = np.sort(coarse_hist)
        local = np.sort(local_hist)

        corrected = []
        for val in proj:
            q = np.clip(stats.percentileofscore(coarse, val) / 100, 0.01, 0.99)
            local_val = np.percentile(local, q * 100)
            coarse_val = np.percentile(coarse, q * 100)
            corrected.append(float(local_val + (val - coarse_val)))

        return np.mean(corrected)
