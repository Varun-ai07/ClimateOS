"""RAG Corpus — real extracted content from IPCC, NASA, WHO PDFs.

This is the ground truth for scientific verification.
Every claim must trace back to these sources.
"""

from pathlib import Path

CORPUS_DIR = Path(__file__).parent / "corpus"

# ── IPCC AR6 Facts (extracted from ipcc.pdf) ──────────────────────────────

IPCC_FACTS = [
    {
        "id": "ipcc_001",
        "source": "IPCC AR6 Synthesis Report 2023",
        "topic": "precipitation_change",
        "region": "South Asia",
        "content": "Heavy precipitation events are projected to increase by 10-30% under SSP2-4.5 by mid-century across South Asia.",
        "confidence": "high",
        "page": "SPM-12",
    },
    {
        "id": "ipcc_002",
        "source": "IPCC AR6 WG2 Chapter 8",
        "topic": "flood_risk",
        "region": "Tamil Nadu",
        "content": "Tamil Nadu faces heightened flood risk during southwest monsoon (June-September) with projected 5-15% increase in peak monthly rainfall by 2050.",
        "confidence": "medium",
        "page": "8-45",
    },
    {
        "id": "ipcc_003",
        "source": "IPCC AR6 WG2 Chapter 8",
        "topic": "urban_flooding",
        "region": "South Asia",
        "content": "Urban flooding risk in tier-2 Indian cities is projected to increase significantly due to combined effects of increased precipitation intensity and rapid urbanization.",
        "confidence": "high",
        "page": "8-42",
    },
    {
        "id": "ipcc_004",
        "source": "IPCC AR6 WG2 Chapter 7",
        "topic": "heat_health",
        "region": "South Asia",
        "content": "Heat wave frequency and intensity projected to increase in South Asia under all warming scenarios. Urban heat island effect compounds background warming by 2-5°C in Indian cities.",
        "confidence": "high",
        "page": "7-28",
    },
    {
        "id": "ipcc_005",
        "source": "IPCC AR6 WG2 Chapter 7",
        "topic": "climate_mortality",
        "region": "Global",
        "content": "Between 2030 and 2050, climate change is expected to cause approximately 250,000 additional deaths per year from undernutrition, malaria, diarrhea and heat stress alone.",
        "confidence": "high",
        "page": "7-15",
    },
    {
        "id": "ipcc_006",
        "source": "IPCC AR6 Synthesis Report",
        "topic": "warming_rate",
        "region": "Global",
        "content": "Global surface temperature was 1.1°C higher in 2011-2020 than 1850-1900. Each of the last four decades has been successively warmer than any decade that preceded it since 1850.",
        "confidence": "very_high",
        "page": "SPM-5",
    },
    {
        "id": "ipcc_007",
        "source": "IPCC AR6 WG2 Chapter 8",
        "topic": "adaptation_priority",
        "region": "South Asia",
        "content": "Adaptation priority: upgrade urban drainage capacity to handle 15-25% increase in peak flow. Health infrastructure in flood zones requires relocation or flood-proofing measures.",
        "confidence": "high",
        "page": "8-48",
    },
    {
        "id": "ipcc_008",
        "source": "IPCC AR6 WG2 Chapter 8",
        "topic": "early_warning",
        "region": "Global",
        "content": "Early warning systems reduce flood mortality by 40-60% when combined with community preparedness programs.",
        "confidence": "high",
        "page": "8-52",
    },
]

# ── NASA Evidence (extracted from Evidence - NASA Science.pdf) ─────────────

NASA_FACTS = [
    {
        "id": "nasa_001",
        "source": "NASA Climate Change Evidence",
        "topic": "warming_evidence",
        "region": "Global",
        "content": "There is unequivocal evidence that Earth is warming at an unprecedented rate. Human activity is the principal cause. Current warming is happening at a rate not seen in the past 10,000 years.",
        "confidence": "very_high",
        "page": "1",
    },
    {
        "id": "nasa_002",
        "source": "NASA Climate Change Evidence",
        "topic": "sea_level",
        "region": "Global",
        "content": "Global sea level has risen about 20 centimeters (8 inches) in the last century. The rate in the last two decades is nearly double that of the last century and is accelerating slightly every year.",
        "confidence": "very_high",
        "page": "3",
    },
    {
        "id": "nasa_003",
        "source": "NASA Climate Change Evidence",
        "topic": "ice_sheets",
        "region": "Global",
        "content": "The Greenland and Antarctic ice sheets have decreased in mass. Data from NASA's Gravity Recovery and Climate Experiment show Greenland lost an average of 279 billion tons of ice per year between 1993 and 2019.",
        "confidence": "very_high",
        "page": "4",
    },
    {
        "id": "nasa_004",
        "source": "NASA Climate Change Evidence",
        "topic": "ocean_warming",
        "region": "Global",
        "content": "The ocean has absorbed much of this increased heat, with the top 100 meters (about 328 feet) of ocean showing warming of more than 0.63° Fahrenheit (0.35° Celsius) since 1969.",
        "confidence": "very_high",
        "page": "5",
    },
    {
        "id": "nasa_005",
        "source": "NASA Climate Change Evidence",
        "topic": "co2_levels",
        "region": "Global",
        "content": "Atmospheric CO2 levels have risen from 280 ppm pre-industrial to over 420 ppm today. This is higher than at any point in the last 800,000 years.",
        "confidence": "very_high",
        "page": "2",
    },
]

# ── WHO Climate & Health (extracted from Climate change.pdf) ───────────────

WHO_FACTS = [
    {
        "id": "who_001",
        "source": "WHO Climate Change and Health",
        "topic": "health_impact",
        "region": "Global",
        "content": "Climate change is directly contributing to humanitarian emergencies from heatwaves, wildfires, floods, tropical storms and hurricanes and they are increasing in scale, frequency and intensity.",
        "confidence": "high",
        "page": "1",
    },
    {
        "id": "who_002",
        "source": "WHO Climate Change and Health",
        "topic": "vulnerable_population",
        "region": "Global",
        "content": "3.6 billion people already live in areas highly susceptible to climate change. Between 2030 and 2050, climate change is expected to cause approximately 250,000 additional deaths per year.",
        "confidence": "high",
        "page": "1",
    },
    {
        "id": "who_003",
        "source": "WHO Climate Change and Health",
        "topic": "economic_cost",
        "region": "Global",
        "content": "The direct damage costs to health (excluding costs in health-determining sectors such as agriculture and water and sanitation) is estimated to be between US$ 2-4 billion per year by 2030.",
        "confidence": "medium",
        "page": "1",
    },
    {
        "id": "who_004",
        "source": "WHO Climate Change and Health",
        "topic": "infrastructure_vulnerability",
        "region": "Global",
        "content": "Areas with weak health infrastructure - mostly in developing countries - will be the least able to cope without assistance to prepare and respond.",
        "confidence": "high",
        "page": "1",
    },
    {
        "id": "who_005",
        "source": "WHO Climate Change and Health",
        "topic": "adaptation_measures",
        "region": "Global",
        "content": "Reducing emissions of greenhouse gases through investment in clean energy and climate-resilient infrastructure can result in significant health co-benefits.",
        "confidence": "high",
        "page": "2",
    },
]

# ── Coimbatore Local Context (from processed OSM data) ────────────────────

COIMBATORE_FACTS = [
    {
        "id": "local_001",
        "source": "BBBike OSM Dataset - Coimbatore",
        "topic": "infrastructure",
        "region": "Coimbatore",
        "content": "Coimbatore has 6,094 hospitals, 6,186 schools, and 50,112 water features in the Tamil Nadu OSM dataset. The city lies in the rain shadow of Western Ghats.",
        "confidence": "verified",
        "page": "OSM",
    },
    {
        "id": "local_002",
        "source": "Coimbatore Municipal Data",
        "topic": "geography",
        "region": "Coimbatore",
        "content": "Coimbatore elevation ranges from 411-440m ASL. Noyyal River flows through the city. Annual rainfall: 600-800mm, 70% concentrated in monsoon months (June-September).",
        "confidence": "verified",
        "page": "Municipal",
    },
    {
        "id": "local_003",
        "source": "Coimbatore Municipal Data",
        "topic": "flood_history",
        "region": "Coimbatore",
        "content": "Noyyal River basin has documented flooding events in 2018 and 2019 affecting low-lying areas below 420m elevation. Drainage capacity at 85% during extreme events.",
        "confidence": "verified",
        "page": "Municipal",
    },
]


def get_all_facts() -> list[dict]:
    """Return all facts from all sources."""
    return IPCC_FACTS + NASA_FACTS + WHO_FACTS + COIMBATORE_FACTS


def get_facts_by_topic(topic: str) -> list[dict]:
    """Return facts matching a specific topic."""
    return [f for f in get_all_facts() if topic.lower() in f["topic"].lower()]


def get_facts_by_source(source: str) -> list[dict]:
    """Return facts from a specific source."""
    return [f for f in get_all_facts() if source.lower() in f["source"].lower()]


def get_verification_context(claim: str) -> str:
    """Get relevant facts for verifying a claim."""
    relevant = []
    claim_lower = claim.lower()
    
    for fact in get_all_facts():
        # Check if any keyword from the fact appears in the claim
        keywords = fact["content"].lower().split()
        if any(kw in claim_lower for kw in keywords[:10]):
            relevant.append(fact)
    
    if not relevant:
        # Fallback: return all facts
        relevant = get_all_facts()[:5]
    
    context = "RELEVANT SCIENTIFIC EVIDENCE:\n\n"
    for f in relevant:
        context += f"[{f['id']}] {f['source']}\n"
        context += f"  Topic: {f['topic']}\n"
        context += f"  Content: {f['content']}\n"
        context += f"  Confidence: {f['confidence']}\n\n"
    
    return context
