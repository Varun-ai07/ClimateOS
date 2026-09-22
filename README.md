# Climate Narrative

AI-powered climate risk intelligence for urban planning — forecasts, downscaling, agent negotiation, and human-in-the-loop verification.

## System Overview

A multi-agent pipeline that ingests climate/geospatial data, generates narrative assessments of flood and heat risk, and verifies claims against scientific sources.

```
┌─────────────┐    ┌──────────┐    ┌────────────┐    ┌───────┐    ┌────────┐
│  Forecast   │──▶│ Downscale│──▶│   Impact   │──▶│ Policy│──▶│Human   │
│  Agent      │    │  Agent   │    │   Agent    │    │ Agent │    │Review  │
└─────────────┘    └──────────┘    └────────────┘    └───────┘    └────────┘
                                             │                         │
                                             ▼                         ▼
                                      ┌────────────┐          ┌────────────┐
                                      │Integrity   │          │Engagement  │
                                      │Agent       │          │Agent       │
                                      └────────────┘          └────────────┘
                                             │
                                             ▼
                                      ┌────────────┐
                                      │Negotiation │
                                      │Protocol    │
                                      └────────────┘
                                             │
                                             ▼
                                  ┌──────────────────┐
                                  │  API + WebSocket │
                                  │  (FastAPI)       │
                                  └──────────────────┘
                                             │
                              ┌─────────────┴──────────────┐
                              ▼                              ▼
                   ┌──────────────────┐          ┌──────────────────┐
                   │   LLM Service    │          │     RAG Layer    │
                   │ (7-provider      │          │ (Vector Store +  │
                   │  fallback)       │          │ Fact Verification│
                   └──────────────────┘          └──────────────────┘
```

## Architecture

Six specialized agents negotiate climate risk priorities through a weighted voting protocol. Each agent contributes evidence, and the negotiation layer converges on a single recommended action set.

| Agent | Responsibility |
|---|---|
| Forecast | Downscaled climate projections (precipitation, temperature) |
| Downscaling | High-resolution terrain → local risk mapping |
| Impact | Flood/heat exposure scoring for infrastructure |
| Policy | Prioritized interventions ranked by cost-benefit |
| Integrity | Scientific claim verification against IPCC/NASA/WHO |
| Engagement | Summarizes recommendations for stakeholder review |

### LLM Provider Fallback Chain

Strict priority order (never fabricate — degrade gracefully):

1. OpenAI (gpt-4.1)
2. Groq
3. Gemini (3.7 → 3.6 → 3.5 → 3.5-lite)
4. Bytez
5. OpenRouter
6. Deterministic fallback (keyword-based extraction)

### RAG Verification

Claims are verified against a corpus of IPCC AR6, NASA, and WHO evidence. The vector store auto-indexes on first query. Each claim is checked against confidence interval bounds and cited with source metadata.

## Project Structure

```
climate-narrative/
├── api/                    # FastAPI backend (WebSocket + REST endpoints)
├── services/
│   ├── llm_service.py      # LLM provider fallback chain
│   └── prompts/
│       └── system.py       # System prompts per agent
├── agents/                 # 6 specialized agents + negotiation protocol
├── state/
│   └── schema.py           # Pydantic models (20 schemas)
├── rag/
│   ├── corpus.py           # Scientific facts (IPCC/NASA/WHO)
│   ├── vector_store.py     # ChromaDB + sentence-transformers
│   └── fact_check.py       # Claim extraction & verification pipeline
├── data/
│   ├── preprocess.py       # GeoJSON preprocessing pipeline
│   ├── downscale.py        # Climate downscaling
│   ├── dem_generator.py    # DEM generation for 3D terrain
│   ├── corpus/             # Source .txt files for RAG indexing
│   └── processed/          # Output GeoJSON files
├── frontend/               # React + TypeScript + Tailwind + Vite
│   └── src/
│       ├── components/     # MapView, Dem3DView, AgentRoster, etc.
│       ├── ThemeProvider.tsx   # Semantic theme (CSS variables)
│       └── App.tsx
├── requirements.txt        # Python dependencies
└── .gitignore
```

## Getting Started

### Prerequisites

- Python 3.14+ with `venv`
- Node.js 20+ with `npm`

### Backend

```bash
cd /home/vxrun/Projects/ClimateNarrative/climate-narrative
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Development

### Running Data Preprocessing

```bash
python data/preprocess.py /path/to/tamilnadu.osm.geojson
```

Outputs processed GeoJSON files to `data/processed/`.

### Frontend Build

```bash
cd frontend
npm run build    # production build
npx tsc --noEmit # type checking
```

## Environment

See `.env.example` for required environment variables:

- **API keys**: OpenAI, Groq, Gemini, Bytez, OpenRouter (in fallback order)
- **Database**: Supabase URL + anon key (Postgres in production)
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

## License

Proprietary — Climate Narrative Intelligence.
