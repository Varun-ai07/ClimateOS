"""FastAPI backend — REST + WebSocket for ClimateNarrative."""

import json
import asyncio
from pathlib import Path
from datetime import datetime
import smtplib
from email.message import EmailMessage
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from state.schema import MunicipalityClimateState, FinalOutput
from agents.orchestrator import run_mission as _run_mission
from agents.impact_agent import CITY_DATA

RUN_DECISION_TIMEOUT_SECONDS = int(__import__('os').environ.get('RUN_TIMEOUT_SECONDS', '240'))
_TRACE_LOG: list[dict] = []

def _trace(event: str, **kwargs: object) -> None:
    _TRACE_LOG.append({"event": event, **kwargs})

async def run_mission(
    municipality_id: str = "coimbatore_in",
    hazard_type: str = "flood",
    broadcast=None,
) -> dict:
    _trace("mission_start", municipality_id=municipality_id, hazard_type=hazard_type)
    try:
        result = await _run_mission(municipality_id, hazard_type, broadcast)
        _trace("mission_complete", municipality_id=municipality_id)
        return result
    except BaseException as exc:  # noqa: BLE001
        try:
            state_snapshot = {}
            final = {}
            stages = []
            if isinstance(result, dict):
                final = result.get("final_state") or {}
                stages = result.get("stages", [])
                if hasattr(final, "model_dump"):
                    try:
                        state_snapshot = final.model_dump()
                    except Exception:  # noqa: BLE001
                        state_snapshot = {"_serialize_error": True}
                else:
                    state_snapshot = final if isinstance(final, dict) else {"_not_dict": True}
            _trace("mission_error", municipality_id=municipality_id, error=repr(exc), stages=stages, state_keys=list((state_snapshot or {}).keys())[:50])
        except Exception:  # noqa: BLE001
            pass
        raise

app = FastAPI(title="ClimateNarrative API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# In-memory state
state_store = {}
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"


class MissionRequest(BaseModel):
    municipality_id: str = "coimbatore_in"
    hazard_type: str = "flood"


@app.get("/api/cities")
async def list_cities():
    """List available Tamil Nadu cities and districts."""
    cities = []
    try:
        from data.tn_places import TN_PLACES
        extra = TN_PLACES or []
    except Exception:
        extra = []
    known = dict(CITY_DATA)
    if isinstance(extra, list):
        for item in extra:
            try:
                key = item.get("key") or item.get("name")
                if not key:
                    continue
                key = str(key).strip().lower().replace(" ", "_")
                known[key] = {
                    "name": item.get("name", key),
                    "lat": float(item.get("lat", 0) or 0),
                    "lon": float(item.get("lon", 0) or 0),
                    "elevation_m": float(item.get("elevation_m", 0) or 0),
                    "flood_risk": item.get("flood_risk", "medium"),
                }
            except Exception:
                continue
    for key, info in known.items():
        city_dir = PROCESSED_DIR / key
        meta_path = city_dir / "metadata.json"
        meta = {}
        if meta_path.exists():
            try:
                with open(meta_path) as f:
                    meta = json.load(f)
            except Exception:
                meta = {}
        cities.append({
            "id": f"{key}_in",
            "key": key,
            "name": info["name"],
            "lat": info["lat"],
            "lon": info["lon"],
            "elevation_m": info["elevation_m"],
            "flood_risk": info["flood_risk"],
            "hospital_count": meta.get("hospital_count", 0),
            "school_count": meta.get("school_count", 0),
        })
    return {"cities": cities}


@app.post("/api/mission/start")
async def start_mission(request: MissionRequest):
    """Start a climate mission — returns full state with animation data."""
    result = await run_mission(request.municipality_id, request.hazard_type)
    state = result["final_state"]
    state_store[request.municipality_id] = state
    return {
        "status": "success",
        "municipality": request.municipality_id,
        "state": state.model_dump(),
        "stages": result["stages"],
    }


@app.post("/api/run")
async def run_endpoint(request: MissionRequest):
    """Run endpoint per Build_Spec — delegates to mission start."""
    try:
        result = await asyncio.wait_for(run_mission(request.municipality_id, request.hazard_type), timeout=RUN_DECISION_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        return {"status": "timeout", "seconds": RUN_DECISION_TIMEOUT_SECONDS}
    state = result["final_state"]
    state_store[request.municipality_id] = state
    return {
        "status": "success",
        "municipality": request.municipality_id,
        "state": state.model_dump(),
        "stages": result["stages"],
    }


@app.get("/api/hitl-queue")
async def hitl_queue():
    """Escalated states awaiting human review."""
    queue = []
    for mid, state in state_store.items():
        if getattr(state, "status", None) == "escalated":
            queue.append({
                "municipality_id": mid,
                "state": state.model_dump(),
                "events": state.timeline_events[-10:],
            })
    return {"queue": queue}


@app.get("/api/state/{municipality_id}")
async def get_state(municipality_id: str):
    """Get current state for a municipality."""
    if municipality_id in state_store:
        return {"status": "success", "state": state_store[municipality_id].model_dump()}
    return {"status": "not_found"}


@app.get("/api/processed/{city}/{filename}")
async def get_city_file(city: str, filename: str):
    """Serve city-specific GeoJSON files with global fallbacks."""
    path = PROCESSED_DIR / city / filename
    if path.exists():
        with open(path) as f:
            return json.load(f)
    fallback = PROCESSED_DIR / filename
    if fallback.exists():
        with open(fallback) as f:
            return json.load(f)
    if filename.endswith('.geojson'):
        return {"type": "FeatureCollection", "features": []}
    return {"error": "File not found"}


@app.post("/api/hitl-decision")
async def hitl_decision(payload: dict):
    """Human reviewer decision on escalated case."""
    municipality_id = payload.get("municipality_id", "")
    decision = payload.get("decision", "")
    reviewer_id = payload.get("reviewer_id", "human")

    state = state_store.get(municipality_id)
    if not state:
        return {"status": "not_found"}

    state.status = "published" if decision == "approve" else "rejected"

    final_output = state.final_output
    if isinstance(final_output, dict):
        final_output["approved_by"] = reviewer_id
        final_output["published_at"] = datetime.now().isoformat()
        try:
            state.final_output = FinalOutput(**final_output)
        except Exception:
            state.final_output = FinalOutput.model_validate(final_output)
    else:
        final_output.approved_by = reviewer_id
        final_output.published_at = datetime.now().isoformat()

    state.timeline_events.append({
        "timestamp": datetime.now().isoformat(),
        "agent": "hitl",
        "event": "decision",
        "details": f"{reviewer_id} {decision}",
    })
    
    # Email only on explicit approve so HITL email is not sent before approval
    email_note = {"sent": False, "reason": "skipped"}
    if decision == "approve":
        email_note = await notify_officials_draft(
            getattr(state, "municipality_name", municipality_id),
            getattr(state, "final_output", {}),
        )
    await manager.broadcast({
        "event": "hitl_decision",
        "municipality_id": municipality_id,
        "decision": decision,
        "reviewer_id": reviewer_id,
        "email_note": email_note,
    })
    return {"status": "success", "state": state.model_dump(), "email_note": email_note}


@app.get("/api/processed/list")
async def list_processed_files():
    """List available processed files and cities."""
    files = []
    cities = []
    if PROCESSED_DIR.exists():
        for f in PROCESSED_DIR.glob("*.geojson"):
            files.append(f.name)
        for d in PROCESSED_DIR.iterdir():
            if d.is_dir() and d.name != "__pycache__":
                cities.append(d.name)
    return {"files": files, "cities": cities, "dir": str(PROCESSED_DIR)}


@app.get("/api/dem/{city}")
async def get_dem(city: str):
    """Get DEM data for a city. Auto-generates deterministic synthetic DEM if missing."""
    dem_path = PROCESSED_DIR / "dem" / f"{city}_dem.json"
    if dem_path.exists():
        with open(dem_path) as f:
            return json.load(f)
    # Synthetic fallback for cities without prebuilt DEMs
    city_info = CITY_DATA.get(city) or {}
    if not city_info:
        try:
            with open(PROCESSED_DIR.parent / "tn_places.json") as reg:
                for item in json.load(reg):
                    if item.get("key") == city:
                        city_info = {
                            "lat": float(item.get("lat", 0) or 0),
                            "lon": float(item.get("lon", 0) or 0),
                            "elevation_m": float(item.get("elevation_m", 0) or 0),
                        }
                        break
        except Exception:
            pass
    base = float(city_info.get("elevation_m", 100))
    center = {"lat": city_info.get("lat", 10.0), "lon": city_info.get("lon", 78.0)}
    grid_size = 50
    lat_span = 0.08
    lon_span = 0.10
    bounds = {
        "south": center["lat"] - lat_span / 2,
        "north": center["lat"] + lat_span / 2,
        "west": center["lon"] - lon_span / 2,
        "east": center["lon"] + lon_span / 2,
    }
    elevs = []
    min_e = max_e = base
    for i in range(grid_size):
        row = []
        for j in range(grid_size):
            lat = bounds["north"] - (i / (grid_size - 1)) * lat_span
            lon = bounds["west"] + (j / (grid_size - 1)) * lon_span
            val = base + 18 * (lat - bounds["south"]) / lat_span - 12 * (lon - bounds["west"]) / lon_span
            val = round(val, 1)
            min_e = min(min_e, val)
            max_e = max(max_e, val)
            row.append(val)
        elevs.append(row)
    return {
        "metadata": {
            "city": city,
            "center": center,
            "base_elevation": base,
            "grid_size": grid_size,
            "bounds": bounds,
            "elevation_range": {"min": min_e, "max": max_e, "mean": round(sum(sum(r) for r in elevs) / (grid_size * grid_size), 1)},
            "features": {},
        },
        "grid": elevs,
    }


@app.get("/api/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}


@app.get("/api/email/preview")
async def email_preview(municipality_id: str = ""):
    state = state_store.get(municipality_id) if municipality_id else None
    final_output = getattr(state, "final_output", {}) if state else {}
    municipality_name = getattr(state, "municipality_name", municipality_id) if state else municipality_id
    msg = _build_draft_email(municipality_name or municipality_id or "Unknown", final_output)
    html_payload = None
    for part in msg.walk():
        if part.get_content_type() == "text/html":
            try:
                html_payload = part.get_content()
            except Exception:
                html_payload = str(part.get_payload())
            break
    return {
        "to": msg["To"],
        "from": msg["From"],
        "subject": msg["Subject"],
        "html": html_payload or msg.get_content(),
    }


SMTP_HOST = __import__('os').environ.get('SMTP_HOST', '')
SMTP_PORT = int(__import__('os').environ.get('SMTP_PORT', '0') or '0')
SMTP_USER = __import__('os').environ.get('SMTP_USER', '')
SMTP_PASS = __import__('os').environ.get('SMTP_PASS', '')
MAIL_FROM = __import__('os').environ.get('MAIL_FROM', SMTP_USER or 'climate@demo.local')
MAIL_TO = __import__('os').environ.get('MAIL_TO', 'officials@demo.local')
DEMO_EMAIL = bool(__import__('os').environ.get('DEMO_EMAIL', '0') == '1')

RISK_COLORS = {
  'low': '#1F4D3A',
  'medium': '#A8712B',
  'high': '#A13D2E',
  'unknown': '#9FAD9C',
}
RISK_BG = {
  'low': '#E9F6EE',
  'medium': '#FDF3E7',
  'high': '#F9E4DF',
  'unknown': '#F4F5F2',
}


def _pct(value):
  try:
    return f"{round(float(value) * 100)}%"
  except Exception:
    return "N/A"


def _risk_color(level: str) -> str:
  return RISK_COLORS.get((level or 'unknown').lower(), RISK_COLORS['unknown'])


def _risk_bg(level: str) -> str:
  return RISK_BG.get((level or 'unknown').lower(), RISK_BG['unknown'])


def _final_output_to_dict(final_output: any) -> dict:
  if isinstance(final_output, dict):
    return final_output
  if hasattr(final_output, 'model_dump'):
    try:
      return final_output.model_dump()
    except Exception:
      pass
  try:
    return dict(final_output or {})
  except Exception:
    return {}


def _build_draft_email(municipality_name: str, final_output_raw: any) -> EmailMessage:
  final_output = _final_output_to_dict(final_output_raw)
  risk = ((final_output.get('risk_summary') or {}).get('level') or 'unknown').lower()
  score = (final_output.get('risk_summary') or {}).get('score') if isinstance(final_output.get('risk_summary'), dict) else None
  score_str = f"{score}/100" if score is not None else "N/A"
  policy_summary = final_output.get('policy_summary') or {}
  policy = policy_summary.get('title') if isinstance(policy_summary, dict) else None
  policy_actions = policy_summary.get('actions_count') if isinstance(policy_summary, dict) else None
  approved = final_output.get('approved_by', 'auto') or 'auto'
  published = final_output.get('published_at', '') or 'N/A'
  advisory = ((final_output.get('citizen_advisory') or {}).get('english', '') if isinstance(final_output.get('citizen_advisory'), dict) else '')
  negotiation = final_output.get('negotiation_summary') or {}
  ci = ((final_output.get('risk_summary') or {}).get('confidence_interval') if isinstance(final_output.get('risk_summary'), dict) else None)

  subject = f"Action Required: {municipality_name} Climate Mission Output — Risk level {risk} pending review"
  accent = _risk_color(risk)
  bg = _risk_bg(risk)
  border = accent

  rows = []
  rows.append('<tr><td style="color:#6b6b6b;font-size:12px;padding-right:8px;">Risk level</td><td><span style="background:{bg};color:{accent};border:1px solid {border};padding:3px 8px;border-radius:999px;font-size:12px;font-weight:700;">{risk}</span></td></tr>'.replace('{risk}', risk).replace('{accent}', accent).replace('{bg}', bg).replace('{border}', border))
  rows.append('<tr><td style="color:#6b6b6b;font-size:12px;padding-right:8px;">Risk score</td><td style="font-size:14px;font-weight:700;color:#1f1f1f;">' + score_str + '</td></tr>')
  if ci:
    ci_text = f"{ci.get('lower')}–{ci.get('upper')} ({_pct(ci.get('confidence_pct', 0.9))})"
  else:
    ci_text = "N/A"

  policy_text = policy or "Municipal Adaptation Brief"
  actions_text = str(policy_actions) if policy_actions is not None else "N/A"

  negotiation_text = "\n".join([
    f"- {key}: {negotiation.get(key)}" for key in ['rounds', 'final_sfs', 'final_as', 'outcome', 'hallucinations_caught'] if key in negotiation
  ]) or "N/A"

  advisory_text = advisory or "(none)"

  html = f"""<!doctype html>
<html>
  <body style="background:#f5f5f5;font-family:'Inter',Arial,Helvetica,sans-serif;color:#111;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
            <tr>
              <td style="background:#0b1b14;padding:24px 28px;">
                <div style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Climate Intelligence Platform</div>
                <div style="color:#cfe8d8;font-size:12px;margin-top:4px;">Tamil Nadu — Municipal Risk Brief</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="font-size:16px;font-weight:700;color:#0f1f18;">{municipality_name}</div>
                      <div style="color:#6b6b6b;font-size:12px;margin-top:6px;">Published: {published} &nbsp;|&nbsp; Publisher: {approved}</div>
                    </td>
                    <td align="right" valign="middle">
                      <span style="background:{bg};color:{accent};border:1px solid {border};padding:8px 12px;border-radius:999px;font-size:12px;font-weight:700;">{risk.upper()} RISK</span>
                    </td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                  {rows[0]}
                  {rows[1]}
                  <tr><td colspan="2" style="height:8px;"></td></tr>
                  <tr><td style="color:#6b6b6b;font-size:12px;margin-right:8px;vertical-align:top;">Policy brief</td><td><div style="font-size:14px;font-weight:600;color:#1f1f1f;">{policy_text}</div><div style="font-size:12px;color:#6b6b6b;margin-top:4px;">Actions count: {actions_text}</div></td></tr>
                  <tr><td colspan="2" style="height:8px;"></td></tr>
                  <tr><td style="color:#6b6b6b;font-size:12px;margin-right:8px;vertical-align:top;">Confidence interval</td><td style="font-size:14px;font-weight:600;color:#1f1f1f;">90% CI [{ci_text}]</td></tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f7f7f5;border:1px solid #e5e5e5;border-radius:10px;">
                  <tr><td style="padding:12px 14px;font-size:12px;font-weight:700;color:#3e3654;text-transform:uppercase;letter-spacing:0.08em;">Negotiation Outcome</td></tr>
                  <tr><td style="padding:0 14px 14px 14px;color:#1f1f1f;font-size:13px;white-space:pre-wrap;">{negotiation_text}</td></tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f7f7f5;border:1px solid #e5e5e5;border-radius:10px;">
                  <tr><td style="padding:12px 14px;font-size:12px;font-weight:700;color:#3e3654;text-transform:uppercase;letter-spacing:0.08em;">Citizen Advisory</td></tr>
                  <tr><td style="padding:0 14px 14px 14px;color:#1f1f1f;font-size:13px;white-space:pre-wrap;">{advisory_text}</td></tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                  <tr><td style="font-size:12px;font-weight:700;color:#3e3654;text-transform:uppercase;letter-spacing:0.08em;">Recommended Next Steps</td></tr>
                  <tr><td style="padding-top:8px;color:#1f1f1f;font-size:13px;">
                    <div style="margin-bottom:6px;">1. Review the attachments and city-specific risk details.</div>
                    <div style="margin-bottom:6px;">2. Confirm circulation through official channels.</div>
                    <div>3. If required, reply with HOT/ESCL for escalation.</div>
                  </td></tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                  <tr><td style="font-size:11px;color:#6b6b6b;line-height:1.5;">This draft can be forwarded to higher official authorities for approval and publication.</td></tr>
                  <tr><td style="font-size:11px;color:#6b6b6b;margin-top:10px;">Regards,<br/>Climate Intelligence Team</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

  plain = "\n".join([
    f"Climate Intelligence Platform",
    f"Tamil Nadu — Municipal Risk Brief",
    "-" * 48,
    "",
    f"Municipality: {municipality_name}",
    f"Published by: {approved}",
    f"Published at: {published}",
    f"Hazard type: Flood",
    "",
    "Summary",
    "-" * 48,
    f"- Risk level: {risk}",
    f"- Risk score: {score_str}",
    f"- Confidence interval: 90% CI [{ci_text}]",
    f"- Policy brief: {policy_text}",
    f"- Actions count: {actions_text}",
    "",
    "Negotiation Outcome",
    "-" * 48,
    negotiation_text,
    "",
    "Citizen Advisory (English)",
    "-" * 48,
    advisory_text,
    "",
    "Recommended Next Steps",
    "-" * 48,
    "1. Review the attachments and city-specific risk details.",
    "2. Confirm circulation through official channels.",
    "3. If required, reply with HOT/ESCL for escalation.",
    "",
    "Note",
    "-" * 48,
    "This draft can be forwarded to higher official authorities for approval and publication.",
    "",
    "Regards,",
    "Climate Intelligence Team",
  ])

  msg = EmailMessage()
  msg['Subject'] = subject
  msg['From'] = MAIL_FROM
  msg['To'] = MAIL_TO
  msg.set_content(plain)
  msg.add_alternative(html, subtype='html')
  return msg


def _send_email(msg: EmailMessage) -> bool:
    if not SMTP_HOST or not SMTP_PORT or not MAIL_TO:
        return False
    try:
        with smtplib.SMTP(SMTP_HOST, int(SMTP_PORT), timeout=10) as s:
            s.starttls() if int(SMTP_PORT) in (587, 25) else None
            if SMTP_USER and SMTP_PASS:
                s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[email] send failed: {exc}")
        return False


async def notify_officials_draft(municipality_name: str, final_output: dict) -> dict:
    msg = _build_draft_email(municipality_name, final_output)
    if not DEMO_EMAIL:
        print("[email] skipped — set DEMO_EMAIL=1 and SMTP_* to send")
        return {"sent": False, "reason": "demo_email_disabled"}
    sent = _send_email(msg)
    return {"sent": sent, "reason": "sent" if sent else "send_failed"}


# WebSocket
class ConnectionManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        try:
            self.connections.remove(ws)
        except ValueError:
            pass

    async def broadcast(self, msg: dict):
        dead = []
        for conn in self.connections:
            try:
                await conn.send_json(msg)
            except Exception:
                dead.append(conn)
        for conn in dead:
            try:
                self.connections.remove(conn)
            except ValueError:
                pass


manager = ConnectionManager()


@app.websocket("/ws/mission")
async def websocket_mission(websocket: WebSocket):
    """WebSocket for streaming mission updates."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("action") == "start_mission":
                municipality = data.get("municipality_id", "coimbatore_in")
                hazard_type = data.get("hazard_type", "flood")
                result = await run_mission(municipality, hazard_type, broadcast=manager.broadcast)
                state = result["final_state"]
                state_store[municipality] = state
                await websocket.send_json({"event": "mission_complete", "state": state.model_dump()})
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.websocket("/ws/agent-log")
async def websocket_agent_log(websocket: WebSocket):
    """WebSocket for agent activity log."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"event": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


@app.get("/api/debug/trace")
async def debug_trace():
    return {"trace": _TRACE_LOG[-50:]}
