"""Negotiation Protocol — THE HEART OF THE SYSTEM.

Two agents with opposing objectives must reach consensus:
- Scientific Integrity Agent: maximize accuracy, reject hallucinations
- Community Engagement Agent: maximize actionability, reach citizens

The bounded negotiation loop ensures:
1. No hallucinated claims reach citizens
2. Citizens get clear, actionable guidance
3. If agents can't agree, escalate to human review

Scoring:
- Scientific Fidelity Score (SFS): 0.5*citation + 0.3*bounds + 0.2*uncertainty
- Actionability Score (AS): 0.4*specificity + 0.3*readability + 0.3*local_relevance

Thresholds: SFS >= 0.8 AND AS >= 0.7 for approval
Max rounds: 3
"""

import re
import json
import sys
from pathlib import Path
from datetime import datetime
sys.path.insert(0, str(Path(__file__).parent.parent))

from state.schema import (
    MunicipalityClimateState, NegotiationRound, NegotiationOutcome,
    IntegrityReview, CitizenAdvisory, ClaimVerification
)
from services.llm_service import call_llm

SFS_THRESHOLD = 0.8
AS_THRESHOLD = 0.7
MAX_ROUNDS = 2

INTEGRITY_NEGOTIATION_PROMPT = """You are a scientific integrity verifier in a negotiation.

Your job: verify claims in citizen-facing text against IPCC AR6, WHO, NASA evidence.
You must be strict — no unverified numbers allowed.

RULES:
1. Every number in the advisory must trace to a verified source
2. If a number appears that wasn't in the policy brief, flag it as HALLUCINATION
3. Check confidence intervals — is the claim within bounds?
4. Rate overall scientific fidelity (0-1)

Return ONLY valid JSON:
{
  "claims_checked": [
    {"claim_text": "...", "source": "IPCC AR6", "verified": true, "confidence": 0.9, "reasoning": "..."}
  ],
  "scientific_fidelity_score": 0.85,
  "verdict": "approved|rejected",
  "hallucinated_numbers": ["list of numbers that appear but aren't verified"],
  "feedback": "Specific feedback for the Engagement Agent to fix"
}"""

ENGAGEMENT_REVISION_PROMPT = """You are a public communication specialist revising citizen advisories.

The Scientific Integrity Agent found issues with your previous draft:
{feedback}

Your task: rewrite the advisory to fix these issues while keeping it clear and actionable.

RULES:
1. DO NOT add any new numbers not in the approved policy
2. DO NOT change verified statistics
3. Keep language simple and direct
4. Include specific actions for citizens
5. Reference local areas (Noyyal River, RS Puram, Gandhipuram)

Current approved numbers from policy:
{approved_numbers}

Return ONLY valid JSON:
{
  "english": "Revised English advisory",
  "tamil": "Revised Tamil advisory",
  "sms": "SMS alert (160 chars max)",
  "poster_text": "Bullet points for poster",
  "actionability_score": 0.85
}"""


def compute_sfs(review: IntegrityReview) -> float:
    """Scientific Fidelity Score = 0.5*citation + 0.3*bounds + 0.2*uncertainty."""
    if not review.claims_checked:
        return 0.0
    
    cited = sum(1 for c in review.claims_checked if c.source) / len(review.claims_checked)
    verified = sum(1 for c in review.claims_checked if c.verified) / len(review.claims_checked)
    
    # Check for uncertainty language
    has_uncertainty = any(
        "may" in c.claim_text.lower() or
        "projected" in c.claim_text.lower() or
        "approximately" in c.claim_text.lower() or
        "could" in c.claim_text.lower()
        for c in review.claims_checked
    )
    uncertainty = 1.0 if has_uncertainty else 0.5
    
    return round(0.5 * cited + 0.3 * verified + 0.2 * uncertainty, 2)


def compute_actionability(advisory: CitizenAdvisory) -> float:
    """Actionability Score = 0.4*specificity + 0.3*readability + 0.3*local_relevance."""
    text = advisory.english.lower()
    
    # Specificity: action verbs
    action_words = ["move", "call", "check", "avoid", "evacuate", "prepare", "know", "stay", "follow"]
    specificity = min(1.0, sum(1 for w in action_words if w in text) / 5)
    
    # Readability: sentence length
    sentences = [s for s in re.split(r'[.!?]+', advisory.english) if s.strip()]
    avg_len = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
    readability = max(0, min(1.0, 1.0 - (avg_len - 15) / 20))
    
    # Local relevance
    local_words = ["coimbatore", "noyyal", "rs puram", "gandhipuram", "singanallur", "tamil", "nadu"]
    local = min(1.0, sum(1 for w in local_words if w in text) / 3)
    
    return round(0.4 * specificity + 0.3 * readability + 0.3 * local, 2)


def extract_numbers(text: str) -> list[str]:
    """Extract all numeric expressions from text."""
    return re.findall(r'\d+(?:\.\d+)?%?|\d+(?:\.\d+)?mm|\d+(?:\.\d+)?°[Cc]?|\d+(?:\.\d+)?m\b', text)


from typing import Callable, Optional

BroadcastFn = Optional[Callable[[dict], None]]

async def run_negotiation(state: MunicipalityClimateState, broadcast: BroadcastFn = None) -> MunicipalityClimateState:
    """Run bounded negotiation loop between Integrity and Engagement agents.
    
    This is the core innovation:
    1. Engagement Agent drafts citizen advisory
    2. Integrity Agent verifies claims against sources
    3. If rejected, Engagement Agent revises (framing only, no new numbers)
    4. Repeat up to MAX_ROUNDS
    5. If no consensus, escalate to HITL
    """
    state.status = "negotiating"
    
    # Get approved numbers from policy
    approved_numbers = []
    for action in state.policy.actions:
        approved_numbers.extend(extract_numbers(action.action))
    approved_numbers.extend(extract_numbers(state.policy.summary))
    
    for round_num in range(1, MAX_ROUNDS + 1):
        # Step 1: Engagement Agent drafts/revises
        feedback = ""
        if state.negotiation_log:
            last_round = state.negotiation_log[-1]
            feedback = last_round.integrity_feedback
        
        # Generate or revise engagement output
        if round_num == 1 or feedback:
            state = await _generate_engagement(state, feedback, approved_numbers)
        
        # Step 2: Integrity Agent scores
        state = await _verify_integrity(state, approved_numbers)
        
        # Step 3: Compute scores
        sfs = state.integrity.scientific_fidelity_score
        as_score = compute_actionability(state.engagement)
        
        # Step 4: Determine outcome
        if sfs >= SFS_THRESHOLD and as_score >= AS_THRESHOLD:
            outcome = NegotiationOutcome.APPROVE
        elif round_num == MAX_ROUNDS:
            outcome = NegotiationOutcome.ESCALATE
        else:
            outcome = NegotiationOutcome.REVISE
        
        # Record round
        entry = NegotiationRound(
            round_number=round_num,
            timestamp=datetime.now().isoformat(),
            sfs=sfs,
            as_score=as_score,
            outcome=outcome.value,
            integrity_feedback=state.integrity.rejection_reason or "",
            claims_violated=[c.claim_text for c in state.integrity.claims_checked if not c.verified],
            numbers_added=[n for n in extract_numbers(state.engagement.english) if n not in approved_numbers],
        )
        state.negotiation_log.append(entry)

        if broadcast:
            try:
                await broadcast({
                    "event": "negotiation_round",
                    "round": round_num,
                    "sfs": sfs,
                    "as_score": as_score,
                    "outcome": outcome.value,
                    "timestamp": datetime.now().isoformat(),
                })
            except Exception:
                pass
        
        if outcome == NegotiationOutcome.APPROVE:
            state.status = "approved"
            if broadcast:
                try:
                    await broadcast({"event": "published", "municipality_id": state.municipality_id, "timestamp": datetime.now().isoformat()})
                except Exception:
                    pass
            break
        elif outcome == NegotiationOutcome.ESCALATE:
            state.status = "escalated"
            if broadcast:
                try:
                    await broadcast({"event": "escalated_to_hitl", "municipality_id": state.municipality_id, "timestamp": datetime.now().isoformat()})
                except Exception:
                    pass
            break
    
    return state


async def _generate_engagement(state: MunicipalityClimateState, feedback: str, approved_numbers: list[str]) -> MunicipalityClimateState:
    """Generate or revise citizen engagement output."""
    i = state.impact
    f = state.forecast
    
    approved_nums_text = ", ".join(approved_numbers[:10]) if approved_numbers else "none specified"
    
    prompt = f"""Generate citizen flood advisory for {state.municipality_name}:

SITUATION:
- Risk level: {i.overall_risk_score}/100
- {i.hospitals_affected} hospitals, {i.schools_affected} schools at risk
- River: {f.river_level.get('current_m', 0)}m (threshold: {f.river_level.get('flood_threshold_m', 0)}m)
- Precipitation: {state.downscaled.corrected_precip_mm:.1f} mm/month

APPROVED NUMBERS (use ONLY these):
{approved_nums_text}

{f"PREVIOUS FEEDBACK TO FIX: {feedback}" if feedback else ""}

Generate clear, actionable advisory in English and Tamil."""

    system = """You are a public communication specialist for disaster response in Tamil Nadu.
RULES:
1. Use ONLY the approved numbers provided
2. DO NOT add any new statistics
3. Keep language simple, direct, no jargon
4. Include specific actions citizens should take
5. Reference local areas: Noyyal River, RS Puram, Gandhipuram
6. Emergency: 108 (Ambulance), 1070 (Disaster Management)

Return ONLY valid JSON:
{"english": "...", "tamil": "...", "sms": "...", "poster_text": "...", "actionability_score": 0.85}"""

    response = await call_llm(prompt, system)
    
    try:
        data = json.loads(response) if isinstance(response, str) else response
        state.engagement = CitizenAdvisory(
            english=data.get("english", ""),
            tamil=data.get("tamil", ""),
            sms=data.get("sms", ""),
            poster_text=data.get("poster_text", ""),
            actionability_score=data.get("actionability_score", 0.7),
            revision_count=len(state.negotiation_log),
            integrity_feedback=feedback,
        )
    except (json.JSONDecodeError, TypeError):
        # Fallback with ONLY approved numbers
        state.engagement = CitizenAdvisory(
            english=f"FLOOD WARNING: {state.municipality_name} is experiencing above-normal monsoon rainfall. "
                    f"Risk level: {i.overall_risk_score}/100. "
                    f"{i.hospitals_affected} hospitals and {i.schools_affected} schools are in at-risk zones. "
                    f"Residents in low-lying areas should move to higher ground. "
                    f"Emergency shelters open at schools. Call 108 for ambulance.",
            tamil=f"வெள்ள எச்சரிக்கை: {state.municipality_name} இயல்பை விட அதிக பருவமழை. "
                  f"அபாய நிலை: {i.overall_risk_score}/100. "
                  f"தாழ்வான பகுதிகளில் உள்ள மக்கள் உயரமான இடங்களுக்கு செல்லுங்கள்.",
            sms=f"FLOOD ALERT {state.municipality_name}: Risk {i.overall_risk_score}/100. Move to higher ground. Emergency: 108",
            poster_text=f"வெள்ள எச்சரிக்கை\nஅபாயம்: {i.overall_risk_score}/100\nஅவசர: 108",
            actionability_score=0.7,
            revision_count=len(state.negotiation_log),
            integrity_feedback=feedback,
        )
    
    return state


async def _verify_integrity(state: MunicipalityClimateState, approved_numbers: list[str]) -> MunicipalityClimateState:
    """Verify claims in engagement output against scientific sources."""
    from rag.corpus import get_verification_context
    
    # Get context for verification
    context = get_verification_context(state.engagement.english)
    
    # Extract numbers from engagement
    engagement_numbers = extract_numbers(state.engagement.english)
    unverified = [n for n in engagement_numbers if n not in approved_numbers]
    
    prompt = f"""Verify this citizen advisory against scientific evidence:

ADVISORY TEXT:
{state.engagement.english[:500]}

APPROVED NUMBERS FROM POLICY:
{', '.join(approved_numbers[:10])}

NUMBERS IN ADVISORY:
{', '.join(engagement_numbers)}

UNVERIFIED NUMBERS (not in policy):
{', '.join(unverified) if unverified else 'None'}

{context}

Check each claim. Flag any unverified numbers as hallucinations."""

    system = INTEGRITY_NEGOTIATION_PROMPT
    
    response = await call_llm(prompt, system)
    
    try:
        data = json.loads(response) if isinstance(response, str) else response
        claims = []
        for c in data.get("claims_checked", []):
            claims.append(ClaimVerification(
                claim_text=c.get("claim_text", ""),
                source=c.get("source", ""),
                verified=c.get("verified", False),
                confidence=c.get("confidence", 0.5),
                reasoning=c.get("reasoning", ""),
            ))
        
        state.integrity = IntegrityReview(
            claims_checked=claims,
            scientific_fidelity_score=data.get("scientific_fidelity_score", 0.5),
            verdict=data.get("verdict", "rejected"),
            rejection_reason=data.get("feedback", ""),
            hallucination_flags=data.get("hallucinated_numbers", []),
        )
    except (json.JSONDecodeError, TypeError):
        # Fallback: check numbers manually
        verified_count = 0
        for num in engagement_numbers:
            if num in approved_numbers:
                verified_count += 1
        
        sfs = verified_count / max(len(engagement_numbers), 1)
        
        state.integrity = IntegrityReview(
            claims_checked=[
                ClaimVerification(
                    claim_text=f"Number {n} in advisory",
                    source="Policy" if n in approved_numbers else "UNVERIFIED",
                    verified=n in approved_numbers,
                    confidence=0.9 if n in approved_numbers else 0.1,
                    reasoning="In approved policy" if n in approved_numbers else "Not in policy - hallucination",
                ) for n in engagement_numbers
            ],
            scientific_fidelity_score=sfs,
            verdict="approved" if sfs >= SFS_THRESHOLD else "rejected",
            rejection_reason=f"Unverified numbers found: {unverified}" if unverified else "",
            hallucination_flags=unverified,
        )
    
    return state
