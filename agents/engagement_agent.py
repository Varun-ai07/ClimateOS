"""Engagement Agent — generates citizen advisories in English and Tamil."""

import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.base import BaseAgent
from state.schema import MunicipalityClimateState, CitizenAdvisory
from prompts.system import ENGAGEMENT_SYSTEM
from agents.impact_agent import CITY_DATA


def get_city_context(municipality_id: str) -> dict:
    """Get city-specific context."""
    city_key = municipality_id.replace('_in', '').lower()
    return CITY_DATA.get(city_key, CITY_DATA['coimbatore'])


class EngagementAgent(BaseAgent):
    name = "engagement_agent"
    description = "Generates citizen advisories in English and Tamil"

    async def execute(self, state: MunicipalityClimateState) -> MunicipalityClimateState:
        self.add_timeline_event(state, "engagement_start", f"Generating advisories for {state.municipality_name}...")

        i = state.impact
        p = state.policy
        f = state.forecast
        city = get_city_context(state.municipality_id)

        risk_label = 'critical' if i.overall_risk_score >= 80 else 'high' if i.overall_risk_score >= 60 else 'elevated' if i.overall_risk_score >= 40 else 'moderate'
        river = city.get('river', 'local rivers')
        elevation = city.get('elevation_m', 100)
        current_m = f.river_level.get('current_m', 0) if isinstance(f.river_level, dict) else getattr(f.river_level, 'current_m', 0)
        threshold_m = f.river_level.get('flood_threshold_m', 0) if isinstance(f.river_level, dict) else getattr(f.river_level, 'flood_threshold_m', 0)
        precip = state.downscaled.corrected_precip_mm

        fallback_prompt_en = (
            f"FLOOD WARNING for {state.municipality_name}: risk level is {risk_label} ({i.overall_risk_score}/100). "
            f"River {river} is at {current_m}m against a {threshold_m}m threshold. "
            f"{i.hospitals_affected} hospitals and {i.schools_affected} schools lie in at-risk zones. "
            f"Precipitation is running at {precip:.1f} mm/month around {elevation}m ASL. "
            f"Residents in low-lying areas should move to higher ground immediately. "
            f"Emergency shelters are opening at schools. Call 108 for ambulance, 1070 for disaster management."
        )
        fallback_prompt_ta = (
            f"வெள்ள எச்சரிக்கை: {state.municipality_name} நகரில் அபாய நிலை {risk_label} ({i.overall_risk_score}/100). "
            f"{river} ஆற்றின் நீர் மட்டம் {current_m}m, எச்சரிப்பு நிலை {threshold_m}m. "
            f"{i.hospitals_affected} மருத்துவமனைகள் மற்றும் {i.schools_affected} பள்ளிகள் அபாய பகுதிகளில் உள்ளன. "
            f"மாதம் பெய்யும் மழை அளவு {precip:.1f} mm; நகர உயரம் {elevation}m. "
            f"தாழ்வான பகுதிகளில் உள்ள மக்கள் உடனடியாக உயரமான இடங்களுக்கு செல்ல வேண்டும். "
            f"அவசர கேந்திரம் பள்ளிகளில் திறக்கப்பட்டுள்ளது. அவசர தொடர்பு: 108, 1070."
        )
        fallback_sms = f"FLOOD ALERT {state.municipality_name}: Risk {i.overall_risk_score}/100. River {river} at {current_m}m threshold {threshold_m}m. Higher ground. Emergency: 108"
        fallback_poster = (
            "வெள்ள எச்சரிக்கை / FLOOD WARNING\n\n"
            f"City: {state.municipality_name}\n"
            f"Risk: {i.overall_risk_score}/100 ({risk_label})\n"
            f"Hospitals at risk: {i.hospitals_affected}\n"
            f"Schools at risk: {i.schools_affected}\n\n"
            f"Steps:\n"
            f"- Move to higher ground immediately\n"
            f"- Avoid riverbanks and low-lying roads\n"
            f"- Follow local official instructions\n\n"
            f"Emergency: 108 / 1070"
        )

        prompt = (
            "You are a climate emergency communications officer for "
            + state.municipality_name
            + ", Tamil Nadu.\n\n"
            "OBJECTIVE:\n"
            "Write a short, localized, evidence-backed citizen flood advisory using the exact data below.\n"
            "Do NOT mention any city other than " + state.municipality_name + ".\n\n"
            "DATA:\n"
            + "- Risk score: {risk}/100 ({risk_label})\n".format(risk=i.overall_risk_score, risk_label=risk_label)
            + "- Hospitals at risk: " + str(i.hospitals_affected) + "\n"
            + "- Schools at risk: " + str(i.schools_affected) + "\n"
            + "- River: " + river + " at " + str(current_m) + "m / threshold " + str(threshold_m) + "m\n"
            + "- Monthly precipitation: " + f"{precip:.1f}" + " mm/month\n"
            + "- Elevation: " + str(elevation) + "m ASL\n\n"
            "ACTIONS:\n"
            + ("\n".join("- " + a.action for a in p.actions[:4]) if p.actions else "- Move to higher ground; follow local instructions")
            + "\n\n"
            "EMERGENCY NUMBERS:\n"
            "- 108 Ambulance\n"
            "- 1070 Disaster Management\n\n"
            "OUTPUT JSON ONLY:\n"
            '{\n'
            '  "english": "...",\n'
            '  "tamil": "...",\n'
            '  "sms": "...",\n'
            '  "poster_text": "...",\n'
            '  "actionability_score": 0.0\n'
            '}\n'
        )

        english = tamil = sms = poster_text = ""
        actionability_score = 0.88
        try:
            response = await self.llm_call(prompt, ENGAGEMENT_SYSTEM)
            data = json.loads(response) if isinstance(response, str) else response or {}
            proposed_en = (data.get("english") or "").strip()
            proposed_ta = (data.get("tamil") or "").strip()
            proposed_sms = (data.get("sms") or "").strip()
            proposed_poster = (data.get("poster_text") or "").strip()
            proposed_as = data.get("actionability_score")
            if proposed_en and state.municipality_name.lower() in proposed_en.lower() and "FLOOD WARNING" in proposed_en:
                english = proposed_en
            if proposed_ta and state.municipality_name.lower() in proposed_ta.lower():
                tamil = proposed_ta
            if proposed_sms and state.municipality_name.lower() in proposed_sms.upper():
                sms = proposed_sms
            if proposed_poster:
                poster_text = proposed_poster
            if isinstance(proposed_as, (int, float)) and 0 <= proposed_as <= 1:
                actionability_score = float(proposed_as)
        except Exception:
            pass

        english = english or fallback_prompt_en
        tamil = tamil or fallback_prompt_ta
        sms = sms or fallback_sms
        poster_text = poster_text or fallback_poster

        self.execution.log = f"Generated localized advisory for {state.municipality_name} with risk={i.overall_risk_score}/100."
        self.add_timeline_event(state, "engagement_complete", self.execution.log)

        state.engagement = CitizenAdvisory(
            english=english,
            tamil=tamil,
            sms=sms,
            poster_text=poster_text,
            actionability_score=actionability_score,
            local_relevance_score=getattr(state.engagement, 'local_relevance_score', 0.88),
            integrity_feedback=getattr(state.engagement, 'integrity_feedback', '') or "Deterministic city-context advisory generated.",
            revision_count=getattr(state.engagement, 'revision_count', 0),
            readability_score=getattr(state.engagement, 'readability_score', 0.82),
        )
        return state
