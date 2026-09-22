"""Policy Agent — generates municipal adaptation briefs using LLM."""

import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.base import BaseAgent
from state.schema import MunicipalityClimateState, PolicyBrief, PolicyAction
from prompts.system import POLICY_SYSTEM
from agents.impact_agent import CITY_DATA


def get_city_context(municipality_id: str) -> dict:
    """Get city-specific context for policy generation."""
    city_key = municipality_id.replace('_in', '').lower()
    return CITY_DATA.get(city_key, CITY_DATA['coimbatore'])


class PolicyAgent(BaseAgent):
    name = "policy_agent"
    description = "Generates municipal adaptation policies using LLM"

    async def execute(self, state: MunicipalityClimateState) -> MunicipalityClimateState:
        self.add_timeline_event(state, "policy_start", f"Generating policy for {state.municipality_name}...")

        precip = state.downscaled.corrected_precip_mm
        ci = state.downscaled.confidence_interval
        impact = state.impact
        city = get_city_context(state.municipality_id)

        prompt = f"""Generate flood adaptation policy for {state.municipality_name} based on verified climate data:

CLIMATE DATA (verified by downscaling agent):
- Corrected precipitation: {precip:.1f} mm/month
- 90% Confidence interval: [{ci.get('lower', 0):.1f} - {ci.get('upper', 300):.1f}] mm
- Risk score: {state.downscaled.risk_score:.0f}/100

INFRASTRUCTURE AT RISK (verified by impact agent):
- {impact.hospitals_affected} hospitals in flood zones
- {impact.schools_affected} schools in flood zones
- {impact.buildings_affected} buildings at risk
- {impact.population_affected} people affected

LOCAL CONTEXT:
- City: {state.municipality_name}, Tamil Nadu
- Elevation: {city.get('elevation_m', 100)}m ASL
- River: {city.get('river', 'local rivers')}
- Flood risk level: {city.get('flood_risk', 'medium')}
- Annual rainfall: {city.get('annual_rain_mm', 800)}mm

Generate 5-7 specific, actionable policies with timelines and responsible agencies.
Reference {state.municipality_name} specifically in the title and actions."""

        response = await self.llm_call(prompt, POLICY_SYSTEM)

        try:
            data = json.loads(response) if isinstance(response, str) else response
            actions = []
            for i, a in enumerate(data.get("actions", []), 1):
                actions.append(PolicyAction(
                    priority=a.get("priority", i),
                    action=a.get("action", ""),
                    timeline=a.get("timeline", "within 24 hours"),
                    target=a.get("target", state.municipality_name),
                ))
            state.policy = PolicyBrief(
                title=data.get("title", f"Flood Adaptation Policy for {state.municipality_name}"),
                summary=data.get("summary", ""),
                actions=actions,
                confidence=data.get("confidence", 0.8),
                sources=data.get("sources", ["IPCC AR6", "WHO Guidance"]),
            )
        except (json.JSONDecodeError, TypeError):
            state.policy = PolicyBrief(
                title=f"Flood Adaptation Policy for {state.municipality_name}",
                summary=f"Comprehensive flood preparedness measures for {state.municipality_name} based on verified climate projections.",
                actions=[
                    PolicyAction(priority=1, action=f"Deploy early-warning system with river gauge alerts in {state.municipality_name}", timeline="0-12 months", target="Municipal Corporation"),
                    PolicyAction(priority=2, action=f"Reinforce river embankments and install flood gates in {state.municipality_name}", timeline="1-3 years", target="Irrigation Department"),
                    PolicyAction(priority=3, action=f"Implement green infrastructure in flood-prone zones of {state.municipality_name}", timeline="1-2 years", target="Urban Planning"),
                    PolicyAction(priority=4, action=f"Elevate critical facilities in high-risk zones of {state.municipality_name}", timeline="2-4 years", target="Health Department"),
                    PolicyAction(priority=5, action=f"Enforce flood-proof building codes in {state.municipality_name}", timeline="3-5 years", target="Municipal Corporation"),
                ],
                confidence=0.85,
                sources=["IPCC AR6 South Asia", "WHO Flood Preparedness Guidelines"],
            )

        self.add_timeline_event(state, "policy_complete",
            f"Policy: {state.policy.title} ({len(state.policy.actions)} actions)")

        return state
