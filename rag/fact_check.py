"""Claim extraction and verification against RAG corpus + confidence bounds."""

import re
from rag.vector_store import retrieve

CLAIM_PATTERNS = [r"(\d+(?:\.\d+)?)\s*%", r"(\d+(?:\.\d+)?)\s*mm", r"(\d+(?:\.\d+)?)\s*°[Cc]"]
CLAIM_KEYWORDS = ["increase", "decrease", "projected", "could", "risk", "capacity", "rainfall"]


def extract_claims(text: str) -> list[str]:
    """Extract sentences with numeric claims or causal assertions."""
    claims = []
    sents = re.split(r'(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])$', text)
    for sent in sents:
        sent = sent.strip()
        if len(sent) < 20:
            continue
        if any(re.search(p, sent) for p in CLAIM_PATTERNS) or any(kw in sent.lower() for kw in CLAIM_KEYWORDS):
            claims.append(sent)
    return claims


def verify_claim(claim: str, downscaled_data: dict, confidence_interval: dict) -> dict:
    """Verify claim against data bounds + retrieve citation."""
    within_bounds = True
    reason = None

    # Check mm claims against confidence interval bounds
    m = re.search(r'(\d+(?:\.\d+)?)\s*mm', claim)
    if m:
        val = float(m.group(1))
        lo, hi = confidence_interval.get("lower", 0), confidence_interval.get("upper", 1000)
        if not (lo <= val <= hi):
            within_bounds = False
            reason = f"{val}mm outside CI [{lo}-{hi}]"

    # Check percentage claims against CI percentage bounds if provided
    m = re.search(r'(\d+(?:\.\d+)?)\s*%', claim)
    if m and confidence_interval:
        val = float(m.group(1))
        lo, hi = confidence_interval.get("lower_pct", 0), confidence_interval.get("upper_pct", 100)
        if not (lo <= val <= hi):
            within_bounds = False
            if reason is None:
                reason = f"{val}% outside expected range [{lo}-{hi}%]"

    # Retrieve citation from RAG corpus
    results = retrieve(claim, top_k=1)
    citation = results[0]["source"] if results else None
    corpus_supported = results and results[0]["score"] > 0.7

    # A claim is verified only if within bounds AND supported by corpus evidence
    verified = within_bounds and corpus_supported

    return {"verified": verified, "citation": citation, "within_confidence_bounds": within_bounds, "reason": reason}


def fact_check_text(text: str, downscaled_data: dict, confidence_interval: dict) -> dict:
    """Full fact-check pipeline: extract claims, verify each."""
    claims = extract_claims(text)
    checked = []
    for claim in claims:
        result = verify_claim(claim, downscaled_data, confidence_interval)
        checked.append({"claim_text": claim, **result})

    if not checked:
        return {"claims_checked": [], "scientific_fidelity_score": 0.0, "citation_coverage_pct": 0.0}

    cited = sum(1 for c in checked if c["citation"]) / len(checked)
    bounds = sum(1 for c in checked if c["within_confidence_bounds"]) / len(checked)
    uncertainty = 1.0 if any(kw in c["claim_text"].lower() for c in checked
                            for kw in ["may", "projected", "approximately", "could"]) else 0.5

    return {
        "claims_checked": checked,
        "scientific_fidelity_score": round(0.5 * cited + 0.3 * bounds + 0.2 * uncertainty, 2),
        "citation_coverage_pct": round(cited * 100, 1),
    }
