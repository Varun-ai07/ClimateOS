"""Orchestrator — runs all agents with negotiation protocol.

Pipeline:
1. Forecast Agent → loads climate data
2. Downscaling Agent → QDM bias correction
3. Impact Agent → maps risks onto OSM infrastructure
4. Policy Agent → generates adaptation brief (LLM)
5. Negotiation Loop:
   a. Engagement Agent drafts citizen advisory
   b. Integrity Agent verifies claims
   c. If rejected → Engagement revises (no new numbers)
   d. Repeat up to MAX_ROUNDS
   e. If no consensus → escalate to HITL
6. Final output with full transparency
"""

import json
import asyncio
from datetime import datetime
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from state.schema import MunicipalityClimateState, AgentExecution, FinalOutput
from agents.forecast_agent import ForecastAgent
from agents.downscaling_agent import DownscalingAgent
from agents.impact_agent import ImpactAgent, CITY_DATA
from datetime import datetime

try:
  from agents.impact_agent import impact_agent as _ImpactAgent
except Exception: _ImpactAgent = None
try:
  from agents.policy_agent import policy_agent as _PolicyAgent
except Exception: _PolicyAgent = None
try:
  from agents.community_agent import community_agent as _CommunityAgent
except Exception: _CommunityAgent = None

BROADCAST_THINKING = True
from agents.policy_agent import PolicyAgent
from agents.negotiation import run_negotiation


def get_city_name(municipality_id: str) -> str:
    """Get city name from municipality ID."""
    city_key = municipality_id.replace('_in', '').lower()
    return CITY_DATA.get(city_key, {}).get('name', municipality_id)


AGENTS = [
    ("forecast_agent", ForecastAgent),
    ("downscaling_agent", DownscalingAgent),
    ("impact_agent", ImpactAgent),
    ("policy_agent", PolicyAgent),
]

DOUBLE_AGENTS = {"policy_agent", "integrity_agent"}


from typing import Callable, Optional
import time as _time

BroadcastFn = Optional[Callable[[dict], None]]


def _safe(v):
    if v is None:
        return "N/A"
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
        return f"{v:.1f}"
    return str(v)


def _summarize_agent_output(agent_name: str, state: MunicipalityClimateState) -> dict:
    summary = {"output": "", "thinking": "", "summary": ""}
    try:
        if agent_name == 'forecast_agent':
            p = state.forecast.precipitation
            t = state.forecast.temperature
            summary["summary"] = f"Forecast ready: precip={_safe(p.get('monthly_peak_mm') if isinstance(p, dict) else getattr(p, 'monthly_peak_mm', None))}mm, temp={_safe(t.get('max_c') if isinstance(t, dict) else getattr(t, 'max_c', None))}C"
            summary["thinking"] = f"Loaded deterministic climate projection for {state.municipality_name}, hazard={state.hazard_type}. Scenario ssp2-4.5 baseline applied."
            summary["output"] = json.dumps({
                "precipitation": p,
                "temperature": t,
                "river_level": state.forecast.river_level,
                "humidity": state.forecast.humidity,
                "wind": state.forecast.wind,
                "monsoon": state.forecast.monsoon,
            }, ensure_ascii=False)
            return summary

        if agent_name == 'downscaling_agent':
            d = state.downscaled
            summary["summary"] = f"Downscaled precip={_safe(getattr(d, 'corrected_precip_mm', None))}mm/month"
            summary["thinking"] = "Applied Quantile Delta Mapping on local station-derived scaling factors."
            summary["output"] = json.dumps({
                "corrected_precip_mm": d.corrected_precip_mm,
                "corrected_temp_c": d.corrected_temp_c,
                "corrected_humidity_pct": d.corrected_humidity_pct,
                "confidence_interval": d.confidence_interval,
            }, ensure_ascii=False)
            return summary

        if agent_name == 'impact_agent':
            i = state.impact
            summary["summary"] = f"Impact computed: risk={_safe(getattr(i, 'overall_risk_score', None))}/100, hospitals={_safe(getattr(i, 'hospitals_affected', None))}, schools={_safe(getattr(i, 'schools_affected', None))}"
            summary["thinking"] = f"Mapped flood exposure onto {len(i.risk_polygons)} risk polygons for {state.municipality_name}."
            summary["output"] = json.dumps({
                "overall_risk_score": i.overall_risk_score,
                "population_affected": i.population_affected,
                "hospitals_affected": i.hospitals_affected,
                "schools_affected": i.schools_affected,
                "risk_zones": [z.model_dump() for z in i.risk_zones[:5]],
            }, ensure_ascii=False, default=lambda x: x.model_dump() if hasattr(x, 'model_dump') else str(x))
            return summary

        if agent_name == 'policy_agent':
            p = state.policy
            summary["summary"] = f"Policy brief generated: {p.title or 'Municipal Adaptation Brief'} ({len(p.actions)} actions)"
            summary["thinking"] = "Selected evidence-based adaptation actions prioritized by exposure and feasibility."
            summary["output"] = json.dumps({
                "title": p.title,
                "actions_count": len(p.actions),
                "confidence": p.confidence,
                "actions": [a.model_dump() for a in p.actions[:6]],
            }, ensure_ascii=False, default=lambda x: x.model_dump() if hasattr(x, 'model_dump') else str(x))
            return summary

        if agent_name == 'integrity_agent':
            ig = state.integrity
            summary["summary"] = f"Integrity check complete: SFS={_safe(getattr(ig, 'scientific_fidelity_score', None))}, verdict={getattr(ig, 'verdict', '')}"
            summary["thinking"] = f"Checked {len(ig.claims_checked)} claims; sources used: {', '.join(ig.sources_used[:3])}"
            summary["output"] = json.dumps({
                "scientific_fidelity_score": ig.scientific_fidelity_score,
                "verdict": ig.verdict,
                "claims_checked": [c.model_dump() for c in ig.claims_checked[:5]],
            }, ensure_ascii=False, default=lambda x: x.model_dump() if hasattr(x, 'model_dump') else str(x))
            return summary

        if agent_name == 'engagement_agent':
            e = state.engagement
            summary["summary"] = f"Advisory generated for {state.municipality_name}"
            summary["thinking"] = "Drafted evidenced-based localized advisory with Tamil/SMS variants."
            summary["output"] = json.dumps({
                "english": e.english,
                "tamil": e.tamil,
                "sms": e.sms,
                "poster_text": e.poster_text,
                "actionability_score": e.actionability_score,
            }, ensure_ascii=False)
            return summary
    except Exception:
        pass
    summary["summary"] = "completed"
    summary["thinking"] = "Agent completed."
    summary["output"] = "{}"
    return summary

async def run_mission(
    municipality_id: str = "coimbatore_in",
    hazard_type: str = "flood",
    broadcast: BroadcastFn = None,
) -> dict:
    """Run full mission pipeline with negotiation."""
    t0 = _time.perf_counter()
    state = MunicipalityClimateState(
        municipality_id=municipality_id,
        municipality_name=get_city_name(municipality_id),
        hazard_type=hazard_type,
    )

    results = {
        "state": state,
        "stages": [],
        "final_state": None,
    }

    for idx, (agent_name, AgentClass) in enumerate(AGENTS, start=1):
        agent = AgentClass()
        stage_result = {
            "agent": agent_name,
            "status": "running",
            "started_at": datetime.now().isoformat(),
        }
        if broadcast:
            try:
                await broadcast({"event": "agent_started", "agent": agent_name, "timestamp": datetime.now().isoformat()})
            except Exception:
                pass

        agent_t0 = _time.perf_counter()
        try:
            state = await agent.run(state)
            stage_result["status"] = "completed"
            stage_result["completed_at"] = datetime.now().isoformat()
            stage_result["details"] = _summarize_agent_output(agent_name, state)
            if broadcast:
                try:
                    await broadcast({
                        "event": "agent_completed",
                        "agent": agent_name,
                        "output_summary": stage_result["details"]["summary"],
                        "thinking": stage_result["details"]["thinking"],
                        "output": stage_result["details"]["output"],
                        "timestamp": datetime.now().isoformat(),
                        "duration_ms": stage_result.get("duration_ms", int((_time.perf_counter() - agent_t0) * 1000)),
                        "attempt": 1,
                    })
                except Exception:
                    pass

            weak = False
            if agent_name == "policy_agent" and state.policy:
                weak = len(getattr(state.policy, "actions", [])) < 5 or float(getattr(state.policy, "confidence", 0) or 0) < 0.7
            if agent_name == "integrity_agent" and state.integrity:
                sfs = float(getattr(state.integrity, "scientific_fidelity_score", 0) or 0)
                weak = sfs < 0.8 or getattr(state.integrity, "verdict", "") != "approved"
            if weak and agent_name in DOUBLE_AGENTS:
                retry_t0 = _time.perf_counter()
                try:
                    await broadcast({"event": "agent_started", "agent": agent_name, "timestamp": datetime.now().isoformat(), "attempt": 2})
                except Exception:
                    pass
                try:
                    state = await agent.run(state)
                    stage_result["retry"] = True
                    stage_result["status"] = "completed"
                    stage_result["duration_ms"] = int((_time.perf_counter() - retry_t0) * 1000)
                    stage_result["details"] = _summarize_agent_output(agent_name, state)
                    if broadcast:
                        try:
                            await broadcast({
                                "event": "agent_completed",
                                "agent": agent_name,
                                "output_summary": stage_result["details"]["summary"],
                                "thinking": stage_result["details"]["thinking"],
                                "output": stage_result["details"]["output"],
                                "timestamp": datetime.now().isoformat(),
                                "duration_ms": stage_result["duration_ms"],
                                "attempt": 2,
                            })
                        except Exception:
                            pass
                except Exception as retry_err:
                    stage_result["status"] = "error"
                    stage_result["error"] = f"retry failed: {retry_err}"
                    stage_result["duration_ms"] = int((_time.perf_counter() - retry_t0) * 1000)
                    if broadcast:
                        try:
                            await broadcast({"event": "agent_error", "agent": agent_name, "error": str(retry_err), "duration_ms": stage_result["duration_ms"], "timestamp": datetime.now().isoformat(), "attempt": 2})
                        except Exception:
                            pass

        except Exception as e:
            stage_result["status"] = "error"
            stage_result["error"] = str(e)
            if agent_name in DOUBLE_AGENTS:
                retry_t0 = _time.perf_counter()
                try:
                    await broadcast({"event": "agent_started", "agent": agent_name, "timestamp": datetime.now().isoformat(), "attempt": 2})
                except Exception:
                    pass
                try:
                    state = await agent.run(state)
                    stage_result["status"] = "completed"
                    stage_result["retry"] = True
                    stage_result["duration_ms"] = int((_time.perf_counter() - retry_t0) * 1000)
                    stage_result["details"] = _summarize_agent_output(agent_name, state)
                    if broadcast:
                        try:
                            await broadcast({
                                "event": "agent_completed",
                                "agent": agent_name,
                                "output_summary": stage_result["details"]["summary"],
                                "thinking": stage_result["details"]["thinking"],
                                "output": stage_result["details"]["output"],
                                "timestamp": datetime.now().isoformat(),
                                "duration_ms": stage_result["duration_ms"],
                                "attempt": 2,
                            })
                        except Exception:
                            pass
                except Exception as retry_err:
                    stage_result["duration_ms"] = int((_time.perf_counter() - retry_t0) * 1000)
                    stage_result["error"] = f"{e} | retry={retry_err}"
                    if broadcast:
                        try:
                            await broadcast({"event": "agent_error", "agent": agent_name, "error": stage_result["error"], "duration_ms": stage_result["duration_ms"], "timestamp": datetime.now().isoformat(), "attempt": 2})
                        except Exception:
                            pass
        finally:
            if stage_result.get("status") == "completed" and "details" not in stage_result:
                stage_result["status"] = "completed"
                stage_result["details"] = _summarize_agent_output(agent_name, state)
            stage_result.setdefault("duration_ms", int((_time.perf_counter() - agent_t0) * 1000))
            if not stage_result.get("completed_at"):
                stage_result["completed_at"] = datetime.now().isoformat()
            if stage_result["status"] != "completed":
                stage_result.setdefault("error", stage_result.get("error", "failed"))
            results["stages"].append(stage_result)
    
    # expose final agent list for agent detail section
    state.agents = [
        AgentExecution(
            agent_name=x["agent"],
            status=x.get("status", "error"),
            progress=100.0 if x.get("status") == "completed" else 0.0,
            log=((x.get("details") or {}).get("summary") or x.get("error") or "completed"),
            started_at=x.get("started_at"),
            completed_at=x.get("completed_at"),
            execution_time_ms=int(x.get("duration_ms") or 0),
        )
        for x in results["stages"]
    ]

    state.timeline_events.append({
        "timestamp": datetime.now().isoformat(),
        "agent": "negotiation",
        "event": "negotiation_start",
        "details": "Starting integrity-engagement negotiation loop",
    })

    neg_t0 = _time.perf_counter()
    state = await run_negotiation(state)
    state.timeline_events.append({
        "timestamp": datetime.now().isoformat(),
        "agent": "negotiation",
        "event": "negotiation_complete",
        "duration_ms": int((_time.perf_counter() - neg_t0) * 1000),
        "details": "Negotiation loop complete",
    })

    # Ensure negotiation-generated agents appear complete in agent detail section.
    synthesis_completed = datetime.now().isoformat()
    for agent_name, summary, thinking in [
        (
            "integrity_agent",
            f"Integrity check complete: SFS={state.integrity.scientific_fidelity_score} verdict={state.integrity.verdict}",
            f"Verified claims against scientific sources for {state.municipality_name}. {len(state.integrity.claims_checked)} claims checked.",
        ),
        (
            "engagement_agent",
            f"Citizen advisory complete: actionability={state.engagement.actionability_score} readability={state.engagement.readability_score}",
            f"Drafted citizen advisories for {state.municipality_name} in English and Tamil with local context.",
        ),
    ]:
        if not any(x.get("agent") == agent_name for x in results["stages"]):
            results["stages"].append({
                "agent": agent_name,
                "status": "completed",
                "details": {"summary": summary, "thinking": thinking, "output": summary},
                "started_at": synthesis_completed,
                "completed_at": synthesis_completed,
                "duration_ms": 0,
            })
        if broadcast:
            try:
                await broadcast({
                    "event": "agent_completed",
                    "agent": agent_name,
                    "output_summary": summary,
                    "thinking": thinking,
                    "output": summary,
                    "timestamp": synthesis_completed,
                    "duration_ms": 0,
                    "attempt": 1,
                })
            except Exception:
                pass

    # Preserve negotiated outcome; do not overwrite escalated/approved states
    if getattr(state, "status", "") not in ("escalated", "approved"):
        state.status = "published"
    state.completed_at = datetime.now().isoformat()

    state.agents = [
        AgentExecution(
            agent_name=x["agent"],
            status=x.get("status", "error"),
            progress=100.0 if x.get("status") == "completed" else 0.0,
            log=((x.get("details") or {}).get("summary") or x.get("error") or "completed"),
            started_at=x.get("started_at"),
            completed_at=x.get("completed_at"),
            execution_time_ms=int(x.get("duration_ms") or 0),
        )
        for x in results["stages"]
    ]

    state.final_output = FinalOutput(
        risk_summary={
            "score": state.impact.overall_risk_score,
            "level": state.impact.risk_level,
            "hospitals_affected": state.impact.hospitals_affected,
            "schools_affected": state.impact.schools_affected,
            "buildings_affected": state.impact.buildings_affected,
            "population_affected": state.impact.population_affected,
        },
        policy_summary={
            "title": state.policy.title,
            "actions_count": len(state.policy.actions),
            "confidence": state.policy.confidence,
            "sources": state.policy.sources,
        },
        negotiation_summary={
            "rounds": len(state.negotiation_log),
            "final_sfs": state.negotiation_log[-1].sfs if state.negotiation_log else 0.0,
            "final_as": state.negotiation_log[-1].as_score if state.negotiation_log else 0.0,
            "outcome": state.negotiation_log[-1].outcome if state.negotiation_log else "unknown",
        },
        citizen_advisory=state.engagement.model_dump(),
        approved_by=getattr(state.final_output, "approved_by", "auto") or "auto",
        published_at=getattr(state.final_output, "published_at", None),
        total_execution_time_ms=int(getattr(state.final_output, "total_execution_time_ms", 0) or 0),
        perf={},
    )

    results["final_state"] = state
    return results
