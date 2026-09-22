"""MunicipalityClimateState — single data object flowing through the pipeline.

Every agent reads from and writes to this state.
The negotiation loop between Integrity and Engagement agents is the core innovation.
"""

from __future__ import annotations
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ── Enums ──────────────────────────────────────────────────────────────────

class PipelineStatus(str, Enum):
    DRAFT = "draft"
    FORECAST_RECEIVED = "forecast_received"
    DOWNSCALING = "downscaling"
    IMPACT_MAPPING = "impact_mapping"
    POLICY_DRAFTING = "policy_drafting"
    INTEGRITY_CHECK = "integrity_check"
    ENGAGEMENT = "engagement"
    NEGOTIATING = "negotiating"
    ESCALATED = "escalated"
    APPROVED = "approved"
    PUBLISHED = "published"
    ERROR = "error"


class HazardType(str, Enum):
    FLOOD = "flood"
    HEAT_WAVE = "heat_wave"
    CYCLONE = "cyclone"
    DROUGHT = "drought"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Verdict(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_NEEDED = "revision_needed"


class NegotiationOutcome(str, Enum):
    APPROVE = "approve"
    REVISE = "revise"
    ESCALATE = "escalate"


# ── Core Data Models ───────────────────────────────────────────────────────

class ForecastData(BaseModel):
    source: str = "synthetic"
    scenario: str = "ssp2-4.5"
    grid_cell: dict = Field(default_factory=lambda: {"lat": 11.0168, "lon": 76.9558})
    precipitation: dict = Field(default_factory=lambda: {"monthly_peak_mm": 0.0, "change_pct": 0.0, "annual_mm": 0.0})
    temperature: dict = Field(default_factory=lambda: {"max_c": 0.0, "mean_c": 0.0, "change_c": 0.0})
    river_level: dict = Field(default_factory=lambda: {"current_m": 0.0, "flood_threshold_m": 0.0, "status": "normal"})
    humidity: dict = Field(default_factory=lambda: {"current_pct": 0.0, "projected_pct": 0.0})
    wind: dict = Field(default_factory=lambda: {"speed_kmh": 0.0, "direction": ""})
    monsoon: dict = Field(default_factory=lambda: {"phase": "", "intensity": "", "onset_date": ""})
    confidence_interval: dict = Field(default_factory=lambda: {"lower": 0.0, "upper": 0.0, "confidence_pct": 90})


class DownscaledData(BaseModel):
    method: str = "quantile_delta_mapping"
    corrected_precip_mm: float = 0.0
    corrected_temp_c: float = 0.0
    corrected_humidity_pct: float = 0.0
    confidence_interval: dict = Field(default_factory=lambda: {"lower": 0.0, "upper": 0.0})
    risk_score: float = 0.0
    historical_baseline: dict = Field(default_factory=lambda: {"precip_mm": 0.0, "temp_c": 0.0})


class AffectedInfrastructure(BaseModel):
    name: str = ""
    type: str = "building"
    risk_level: str = "low"
    lat: float = 0.0
    lon: float = 0.0
    distance_to_water_m: float = 0.0
    elevation_m: float = 0.0
    capacity: int = 0
    vulnerable_population: int = 0


class RiskZone(BaseModel):
    zone_id: str = ""
    risk_level: str = "low"
    center_lat: float = 0.0
    center_lon: float = 0.0
    area_km2: float = 0.0
    water_proximity_count: int = 0
    affected_population: int = 0


class ImpactAssessment(BaseModel):
    risk_polygons: list[dict] = Field(default_factory=list)
    affected_hospitals: list[AffectedInfrastructure] = Field(default_factory=list)
    affected_schools: list[AffectedInfrastructure] = Field(default_factory=list)
    affected_buildings: list[AffectedInfrastructure] = Field(default_factory=list)
    affected_roads: list[AffectedInfrastructure] = Field(default_factory=list)
    risk_zones: list[RiskZone] = Field(default_factory=list)
    overall_risk_score: int = 0
    risk_level: str = "low"
    population_affected: int = 0
    buildings_affected: int = 0
    hospitals_affected: int = 0
    schools_affected: int = 0
    critical_infrastructure_count: int = 0
    estimated经济损失: float = 0.0  # in INR lakhs


class PolicyAction(BaseModel):
    priority: int = 0
    action: str = ""
    timeline: str = ""
    target: str = ""
    responsible_agency: str = ""
    estimated_cost: str = ""
    reference: str = ""  # IPCC/WHO citation


class PolicyBrief(BaseModel):
    title: str = ""
    summary: str = ""
    actions: list[PolicyAction] = Field(default_factory=list)
    confidence: float = 0.0
    sources: list[str] = Field(default_factory=list)
    total_estimated_cost: str = ""


# ── Negotiation Models (THE HEART) ────────────────────────────────────────

class ClaimVerification(BaseModel):
    claim_text: str = ""
    source: str = ""
    verified: bool = False
    confidence: float = 0.0
    reasoning: str = ""
    citation_url: str = ""


class IntegrityReview(BaseModel):
    claims_checked: list[ClaimVerification] = Field(default_factory=list)
    scientific_fidelity_score: float = 0.0
    verdict: str = "pending"
    rejection_reason: Optional[str] = None
    sources_used: list[str] = Field(default_factory=list)
    hallucination_flags: list[str] = Field(default_factory=list)


class CitizenAdvisory(BaseModel):
    english: str = ""
    tamil: str = ""
    sms: str = ""
    poster_text: str = ""
    actionability_score: float = 0.0
    readability_score: float = 0.0
    local_relevance_score: float = 0.0
    revision_count: int = 0
    integrity_feedback: str = ""


class NegotiationRound(BaseModel):
    round_number: int = 0
    timestamp: str = ""
    sfs: float = 0.0  # Scientific Fidelity Score
    as_score: float = 0.0  # Actionability Score
    outcome: str = "revise"
    integrity_feedback: str = ""
    engagement_revision: str = ""
    claims_violated: list[str] = Field(default_factory=list)
    numbers_added: list[str] = Field(default_factory=list)
    numbers_removed: list[str] = Field(default_factory=list)


# ── Agent Execution Tracking ───────────────────────────────────────────────

class AgentExecution(BaseModel):
    agent_name: str = ""
    status: str = "pending"
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: float = 0.0
    log: str = ""
    llm_model_used: str = ""
    llm_tokens_used: int = 0
    execution_time_ms: int = 0


class FinalOutput(BaseModel):
    risk_summary: dict = Field(default_factory=dict)
    policy_summary: dict = Field(default_factory=dict)
    citizen_advisory: dict = Field(default_factory=dict)
    negotiation_summary: dict = Field(default_factory=dict)
    approved_by: str = "auto"
    published_at: Optional[str] = None
    total_execution_time_ms: int = 0
    perf: dict = Field(default_factory=dict)


# ── Root State ─────────────────────────────────────────────────────────────

class MunicipalityClimateState(BaseModel):
    """Single object flowing through the entire pipeline.
    
    Every agent reads from and writes to this state.
    The negotiation loop between Integrity and Engagement agents
    ensures no hallucinated claims reach citizens.
    """
    municipality_id: str = "coimbatore_in"
    municipality_name: str = "Coimbatore"
    district: str = "Coimbatore"
    state: str = "Tamil Nadu"
    status: str = "draft"
    hazard_type: str = "flood"

    forecast: ForecastData = Field(default_factory=ForecastData)
    downscaled: DownscaledData = Field(default_factory=DownscaledData)
    impact: ImpactAssessment = Field(default_factory=ImpactAssessment)
    policy: PolicyBrief = Field(default_factory=PolicyBrief)
    integrity: IntegrityReview = Field(default_factory=IntegrityReview)
    engagement: CitizenAdvisory = Field(default_factory=CitizenAdvisory)
    negotiation_log: list[NegotiationRound] = Field(default_factory=list)
    agents: list[AgentExecution] = Field(default_factory=list)
    final_output: FinalOutput = Field(default_factory=FinalOutput)

    # Animation support
    map_updates: list[dict] = Field(default_factory=list)
    timeline_events: list[dict] = Field(default_factory=list)
    
    # Metadata
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
    version: str = "2.0"
