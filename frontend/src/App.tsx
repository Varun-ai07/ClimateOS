import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Dem3DView from './components/Dem3DView'
import MapView from './components/MapView'
import AgentRoster from './components/AgentRoster'
import ThinkingPanel from './components/ThinkingPanel'
import StatsBar from './components/StatsBar'
import AdvisoryPanel from './components/AdvisoryPanel'
import CitySelector from './components/CitySelector'
import SkeletonLoader from './components/SkeletonLoader'
import NegotiationPopup from './components/NegotiationPopup'
import ScoreGauges from './components/ScoreGauges'
import NegotiationTracker from './components/NegotiationTracker'
import HitlQueue from './components/HitlQueue'
import AgentLog from './components/AgentLog'

const API = ''

interface City {
  id: string
  key: string
  name: string
  lat: number
  lon: number
  elevation_m: number
  flood_risk: string
  hospital_count: number
  school_count: number
}

interface AgentExec {
  agent_name: string
  status: string
  progress: number
  log: string
  started_at?: string
  completed_at?: string
}

const AGENT_ORDER = [
  'forecast_agent',
  'downscaling_agent',
  'impact_agent',
  'policy_agent',
  'integrity_agent',
  'engagement_agent',
]

const AGENT_PHASE_LABEL: Record<string, string> = {
  forecast_agent: 'Forecast',
  downscaling_agent: 'Downscaling',
  impact_agent: 'Impact',
  policy_agent: 'Policy',
  integrity_agent: 'Integrity',
  engagement_agent: 'Community',
}

interface MissionState {
  status: string
  municipality_id: string
  municipality_name: string
  forecast: any
  downscaled: any
  impact: any
  policy: any
  integrity: any
  engagement: any
  negotiation_log: any[]
  agents: AgentExec[]
  map_updates: any[]
  timeline_events: any[]
  final_output: any
}

const useLiveAgentStatus = (wsEvents: any[], running: boolean) => {
  const [statuses, setStatuses] = useState<Record<string, 'pending' | 'running' | 'completed'>>({})
  const timersRef = useRef<Record<string, number>>({})
  const currentRef = useRef<Record<string, 'pending' | 'running' | 'completed'>>({})
  const lastKnownRef = useRef<Record<string, 'pending' | 'running' | 'completed'>>({})

  // Initialize from last known/background agents when reloading
  useEffect(() => {
    const init: Record<string, 'pending' | 'running' | 'completed'> = {}
    AGENT_ORDER.forEach(n => init[n] = lastKnownRef.current[n] || 'pending')
    setStatuses(init)
  }, [])

  // Reset live timers and state when starting/stopping
  useEffect(() => {
    if (!running) {
      Object.values(timersRef.current).forEach(clearTimeout)
      timersRef.current = {}
      const snapshot = { ...currentRef.current }
      const init: Record<string, 'pending' | 'running' | 'completed'> = {}
      AGENT_ORDER.forEach(n => init[n] = snapshot[n] || lastKnownRef.current[n] || 'pending')
      lastKnownRef.current = { ...init }
      // keep currentRef so UI remains in final state until explicit new run
    } else {
      // Fresh run: clear all tracked state so previous completed flags don't leak
      Object.values(timersRef.current).forEach(clearTimeout)
      timersRef.current = {}
      const fresh: Record<string, 'pending' | 'running' | 'completed'> = {}
      AGENT_ORDER.forEach(n => fresh[n] = 'pending')
      currentRef.current = { ...fresh }
      lastKnownRef.current = { ...fresh }
      setStatuses(fresh)
    }
  }, [running])

  useEffect(() => {
    if (!running) return
    const target: Record<string, 'pending' | 'running' | 'completed'> = {}
    for (const msg of wsEvents) {
      if (msg.event === 'agent_started' && msg.agent) target[msg.agent] = 'running'
      if (msg.event === 'agent_completed' && msg.agent) target[msg.agent] = 'completed'
    }
    AGENT_ORDER.forEach(name => {
      const desired = target[name]
      if (!desired) return
      const current = currentRef.current[name]
      if (desired === current) return
      if (desired === 'completed' && current !== 'completed') {
        const idx = AGENT_ORDER.indexOf(name)
        const delay = idx * 700
        const tid = window.setTimeout(() => {
          currentRef.current = { ...currentRef.current, [name]: 'completed' }
          lastKnownRef.current = { ...lastKnownRef.current, [name]: 'completed' }
          setStatuses(prev => ({ ...prev, [name]: 'completed' }))
          delete timersRef.current[name]
        }, delay)
        timersRef.current[name] = tid
      } else {
        if (timersRef.current[name] != null) {
          clearTimeout(timersRef.current[name])
          delete timersRef.current[name]
        }
        currentRef.current = { ...currentRef.current, [name]: desired }
        lastKnownRef.current = { ...lastKnownRef.current, [name]: desired }
        setStatuses(prev => ({ ...prev, [name]: desired }))
      }
    })
  }, [wsEvents, running])

  // cleanup
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [])

  // Initialize from last known when reloading
  useEffect(() => {
    if (!running) {
      setStatuses(prev => {
        const next = { ...prev }
        AGENT_ORDER.forEach(n => {
          next[n] = lastKnownRef.current[n] || prev[n] || 'pending'
        })
        return next
      })
    }
  }, [])

  const derived = AGENT_ORDER.map(name => ({
    agent_name: name,
    status: statuses[name] || lastKnownRef.current[name] || 'pending',
    progress: statuses[name] === 'completed' || lastKnownRef.current[name] === 'completed' ? 100 : statuses[name] === 'running' || lastKnownRef.current[name] === 'running' ? 40 : 0,
    log: statuses[name] === 'completed' || lastKnownRef.current[name] === 'completed' ? 'completed' : statuses[name] === 'running' || lastKnownRef.current[name] === 'running' ? AGENT_PHASE_LABEL[name] || name : '',
    started_at: statuses[name] === 'completed' || lastKnownRef.current[name] === 'completed' || statuses[name] === 'running' || lastKnownRef.current[name] === 'running' ? new Date().toISOString() : undefined,
    completed_at: statuses[name] === 'completed' || lastKnownRef.current[name] === 'completed' ? new Date().toISOString() : undefined,
  }))
  return { map: statuses, derived }
}

export default function App() {
  const [state, setState] = useState<MissionState | null>(null)
  const [running, setRunning] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([10.8, 78.5])
  const [mapZoom, setMapZoom] = useState(7)
  const [cities, setCities] = useState<City[]>([])
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [showNegotiationPopup, setShowNegotiationPopup] = useState(false)
  const [activeSkeleton, setActiveSkeleton] = useState<string | null>(null)
  const [showWeather, setShowWeather] = useState(false)
  const [view, setView] = useState<'mission' | 'disaster'>('mission')
  const [wsEvents, setWsEvents] = useState<any[]>([])
  const [hitlQueue, setHitlQueue] = useState<any[]>([])
  const [approval, setApproval] = useState<{ status?: string; decision?: string; email_note?: any; error?: string } | null>(null)
  const [agentOutputs, setAgentOutputs] = useState<Record<string, { log: string; output: string; thinking: string; timestamp?: string }>>({})

  const getAgentOutput = useCallback((key: string) => agentOutputs[key] || null, [agentOutputs])
  const selectedAgentOutput = selectedAgent ? agentOutputs[selectedAgent] : null

  // Backfill selected agent outputs from mission state when state arrives/reloads
  useEffect(() => {
    if (!state) return
    const next: Record<string, { log: string; output: string; thinking: string; timestamp?: string }> = { ...agentOutputs }
    if (Array.isArray(state?.agents)) {
      for (const a of state.agents as any[]) {
        if (!next[a.agent_name]) {
          next[a.agent_name] = { log: a.log || 'completed', output: a.log || 'completed', thinking: '', timestamp: a.completed_at }
        }
      }
    }
    if (state?.timeline_events?.length) {
      for (const ev of state.timeline_events) {
        if (ev?.event === 'agent_started' && ev?.agent && !next[ev.agent]?.thinking) {
          next[ev.agent] = next[ev.agent] || { log: '', output: '', thinking: '', timestamp: ev.timestamp }
          next[ev.agent].thinking = (next[ev.agent].thinking || '') + (next[ev.agent].thinking ? '\n' : '') + `Started: ${ev.details || ev.agent}`
        }
        if (ev?.event === 'agent_completed' && ev?.agent) {
          next[ev.agent] = next[ev.agent] || { log: '', output: '', thinking: '', timestamp: ev.timestamp }
          next[ev.agent].log = ev.details || next[ev.agent].log || 'completed'
          next[ev.agent].output = next[ev.agent].output || next[ev.agent].log
          if (ev.thinking && !next[ev.agent].thinking) {
            next[ev.agent].thinking = ev.thinking
          }
        }
      }
    }
    if (Object.keys(next).length) setAgentOutputs(next)
  }, [state, agentOutputs])
  const live = useLiveAgentStatus(wsEvents, running)
  const liveAgentStatus: Record<string, 'pending' | 'running' | 'completed'> = live?.map || {}
  const liveAgents: AgentExec[] = live?.derived || (running ? AGENT_ORDER.map(name => ({ agent_name: name, status: 'pending', progress: 0, log: '' })) : [])

  // Load cities
  useEffect(() => {
    fetch(`${API}/api/cities`)
      .then(res => res.json())
      .then(data => setCities(data.cities || []))
      .catch(console.error)
  }, [])

  const handleCitySelect = useCallback((city: City) => {
    setSelectedCity(city)
    setState(null)
    setShowWeather(false)
    setView('mission')
    setWsEvents([])
    setAgentOutputs({})
    if (city?.lat && city?.lon) {
      setMapCenter([city.lat, city.lon])
      setMapZoom(10)
    }
  }, [])

  const loadHitlQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/hitl-queue`)
      const data = await res.json()
      setHitlQueue(data.queue || [])
    } catch (e) {
      console.error('Failed to load HITL queue', e)
    }
  }, [])

  useEffect(() => {
    loadHitlQueue()
    const t = setInterval(loadHitlQueue, 15000)
    return () => clearInterval(t)
  }, [loadHitlQueue])

  const handleHitlDecision = useCallback(async (municipalityId: string, decision: string) => {
    try {
      await fetch(`${API}/api/hitl-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ municipality_id: municipalityId, decision, reviewer_id: 'human' }),
      })
      await loadHitlQueue()
    } catch (e) {
      console.error('HITL decision failed', e)
    }
  }, [loadHitlQueue])

  const connectWs = useCallback((municipalityId: string) => {
    if (!municipalityId) {
      return () => {}
    }

    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/mission`)
    let closed = false

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'start_mission', municipality_id: municipalityId, hazard_type: 'flood' }))
    }
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        setWsEvents((prev) => [...prev.slice(-200), msg])
        if (msg.event === 'agent_completed' && msg.agent) {
          const summary = typeof msg.output_summary === 'string' ? msg.output_summary : ''
          const thinking = typeof msg.thinking === 'string' ? msg.thinking : ''
          const output = typeof msg.output === 'string' ? msg.output : ''
          setAgentOutputs((prev) => ({
            ...prev,
            [msg.agent]: {
              log: summary || 'completed',
              output: output || summary || '',
              thinking: thinking || '',
              timestamp: msg.timestamp,
            },
          }))
        }
        if (msg.event === 'agent_error' && msg.agent) {
          setAgentOutputs((prev) => ({
            ...prev,
            [msg.agent]: {
              log: msg.error || 'error',
              output: '',
              thinking: msg.error || '',
              timestamp: msg.timestamp,
            },
          }))
        }
        if (msg.event === 'mission_complete') {
          setState(msg.state)
          setRunning(false)
          closed = true
        }
        if (msg.event === 'escalated_to_hitl') {
          loadHitlQueue()
          if (!showNegotiationPopup) setShowNegotiationPopup(true)
        }
        if (msg.event === 'published') {
          loadHitlQueue()
          setShowNegotiationPopup(false)
        }
        if (msg.event === 'hitl_decision') {
          setApproval({ decision: msg.decision, status: msg.municipality_id ? 'resolved' : 'unknown', email_note: msg.email_note || null })
          loadHitlQueue().catch(console.error)
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    ws.onclose = () => {
      if (!closed) setRunning(false)
    }
    ws.onerror = () => {
      if (!closed) setRunning(false)
    }

    return () => {
      closed = true
      try {
        ws.close()
      } catch {}
    }
  }, [loadHitlQueue, showNegotiationPopup])

  const runningAgent = useMemo(() => {
    const active = liveAgents.find(a => a.status === 'running')
    return active?.agent_name || null
  }, [liveAgents])

  const buttonLabel = running
    ? runningAgent
      ? `Running ${AGENT_PHASE_LABEL[runningAgent] || runningAgent}...`
      : 'Starting...'
    : 'Start Mission'

  const startMission = useCallback(async () => {
    if (!selectedCity) return
    setRunning(true)
    setState(null)
    setSelectedAgent(null)
    setShowWeather(false)
    setWsEvents([])
    setAgentOutputs({})
    const cleanupWs = connectWs(selectedCity.id)
    // Fire-and-forget: WebSocket will set running=false on mission_complete / hitl_decision or error.
    // Frontend will keep the connection open until those terminal events arrive.
  }, [selectedCity, connectWs])

  const handleApproveNegotiation = useCallback(async () => {
    setShowNegotiationPopup(false)
    if (!state) return
    const updated = { ...state, status: 'published' }
    setState(updated)
    try {
      const res = await fetch(`${API}/api/hitl-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ municipality_id: state.municipality_id, decision: 'approve', reviewer_id: 'human' }),
      })
      if (!res.ok) throw new Error(`hitl-decision ${res.status}`)
      const payload = await res.json().catch(() => ({}))
      if (payload.state) setState(payload.state)
      await loadHitlQueue()
    } catch (e) {
      console.error('HITL approve failed', e)
    }
  }, [state, loadHitlQueue])

  const handleRejectNegotiation = useCallback(async () => {
    setShowNegotiationPopup(false)
    if (!state) return
    const updated = { ...state, status: 'rejected' }
    setState(updated)
    try {
      const res = await fetch(`${API}/api/hitl-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ municipality_id: state.municipality_id, decision: 'reject', reviewer_id: 'human' }),
      })
      if (!res.ok) throw new Error(`hitl-decision ${res.status}`)
      const payload = await res.json().catch(() => ({}))
      if (payload.state) setState(payload.state)
      await loadHitlQueue()
    } catch (e) {
      console.error('HITL reject failed', e)
    }
  }, [state, loadHitlQueue])

  const latestMapUpdate = state?.map_updates?.[state.map_updates.length - 1]
  const riskZones = state?.impact?.risk_zones || []
  const hospitals = state?.impact?.affected_hospitals || []
  const schools = state?.impact?.affected_schools || []

  // Water features for the selected city
  const [waterGeoJSON, setWaterGeoJSON] = useState<any>(null)
  useEffect(() => {
    const key = selectedCity?.key
    if (!key) {
      setWaterGeoJSON(null)
      return
    }
    let cancelled = false
    fetch(`/api/processed/${key}/water.geojson`)
      .then(r => r.ok ? r.json() : { features: [] })
      .then(data => {
        if (!cancelled) setWaterGeoJSON(data)
      })
      .catch(() => {
        if (!cancelled) setWaterGeoJSON({ features: [] })
      })
    return () => { cancelled = true }
  }, [selectedCity?.key])

  // Weather type from forecast
  const weatherType = state?.forecast?.precipitation?.monthly_peak_mm > 300 ? 'storm' :
                      state?.forecast?.precipitation?.monthly_peak_mm > 200 ? 'rain' :
                      state?.forecast?.temperature?.max_c > 35 ? 'sun' : 'cloud'
  const weatherIntensity = Math.min(100, (state?.forecast?.precipitation?.monthly_peak_mm || 0) / 4)

  const agents = state?.agents?.length ? state.agents : liveAgents

  if (view === 'disaster' && selectedCity) {
    return (
      <Dem3DView
        defaultCityKey={selectedCity.key}
        cities={cities}
        mode={view}
        onBack={() => setView('mission')}
      />
    )
  }

  return (
    <div className="h-screen bg-neutral-light flex flex-col overflow-hidden">
      {/* Negotiation popup */}
      <NegotiationPopup
        isOpen={showNegotiationPopup}
        onClose={() => setShowNegotiationPopup(false)}
        onApprove={handleApproveNegotiation}
        onReject={handleRejectNegotiation}
        municipalityName={state?.municipality_name || ''}
        negotiationLog={state?.negotiation_log || []}
        advisory={{
          english: state?.engagement?.english || '',
          tamil: state?.engagement?.tamil || '',
          sms: state?.engagement?.sms || '',
        }}
      />

      {/* Header */}
      <header className="h-16 bg-white/80 border-b border-primary/20 flex items-center px-6 shrink-0 relative backdrop-blur-md" style={{ zIndex: 9999 }}>
        <div className="flex items-center gap-4">
          <motion.div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--logo-bg)' }}
            animate={{ y: [0,-2,0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--logo-mark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 18a5 5 0 0 0-10 0" />
              <path d="M12 2v3" />
              <path d="M4.5 7.5A9 9 0 0 1 19.5 18" />
              <path d="M8 22a2 2 0 0 1-4 0" />
              <path d="M18 22a2 2 0 0 1 4 0" />
              <path d="M3 12a9 9 0 0 1 18 0" />
            </svg>
          </motion.div>
          <div>
            <h1 className="font-display text-xl text-text font-bold tracking-tight animate-glow-text">ClimateOS</h1>
            <p className="text-[11px] text-idle tracking-wide">Tamil Nadu Climate Intelligence Platform</p>
          </div>
        </div>

        <div className="flex-1 mx-12">
          <CitySelector
            cities={cities}
            selectedCity={selectedCity}
            onSelect={handleCitySelect}
          />
        </div>

        <motion.button
          onClick={startMission}
          disabled={running || !selectedCity}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all border mission-btn-glow ${
            running || !selectedCity
              ? 'bg-neutral text-idle border-transparent cursor-not-allowed'
              : 'bg-accent text-white border-accent/40'
          }`}
          whileHover={running || !selectedCity ? {} : { scale: 1.02 }}
          whileTap={running || !selectedCity ? {} : { scale: 0.98 }}
        >
          {running ? (
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/70 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              {buttonLabel}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
              {buttonLabel}
            </span>
          )}
        </motion.button>

        <motion.button
          onClick={() => setView('disaster')}
          className="ml-3 px-4 py-2.5 rounded-xl text-sm font-semibold border border-primary/25 bg-white/70 hover:bg-white transition-colors backdrop-blur-sm"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          Disaster View
        </motion.button>
      </header>

      {/* Intro animation */}
      {!state && !running && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center bg-white/80 backdrop-blur-md"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 1.2, duration: 0.9 }}
        >
          <motion.div
            className="text-center"
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 14 }}
          >
            <div className="w-24 h-24 mx-auto mb-5 rounded-3xl border border-primary/20 shadow-sm flex items-center justify-center" style={{ background: 'var(--logo-bg)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--logo-mark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 18a5 5 0 0 0-10 0" />
                <path d="M12 2v3" />
                <path d="M4.5 7.5A9 9 0 0 1 19.5 18" />
                <path d="M8 22a2 2 0 0 1-4 0" />
                <path d="M18 22a2 2 0 0 1 4 0" />
                <path d="M3 12a9 9 0 0 1 18 0" />
              </svg>
            </div>
            <div className="font-display text-2xl text-text font-bold animate-gradient-in">ClimateOS</div>
            <div className="text-sm text-idle mt-2">Tamil Nadu Climate Intelligence</div>
          </motion.div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden bg-gradient-to-br from-neutral-light/70 to-neutral-light">
        {/* Left: Agent Roster */}
        <div className="w-72 bg-white/70 border-r border-primary/20 flex flex-col shrink-0 backdrop-blur-sm">
          <div className="p-4 border-b border-primary/10">
            <h2 className="text-xs font-mono uppercase tracking-wider text-idle mb-3">Agent Roster</h2>
            <AgentRoster
              agents={agents}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              running={running}
              timelineEvents={state?.timeline_events || []}
              negotiationLog={state?.negotiation_log || []}
              liveAgentStatus={liveAgentStatus}
              getAgentOutput={getAgentOutput}
            />
          </div>

          {/* Skeleton loaders */}
          <div className="p-4 space-y-2 flex-1 overflow-y-auto">
            <AnimatePresence>
              {activeSkeleton === 'forecast_agent' && <SkeletonLoader type="forecast" active />}
              {activeSkeleton === 'downscaling_agent' && <SkeletonLoader type="downscaling" active />}
              {activeSkeleton === 'impact_agent' && <SkeletonLoader type="impact" active />}
              {activeSkeleton === 'policy_agent' && <SkeletonLoader type="policy" active />}
              {activeSkeleton === 'integrity_agent' && <SkeletonLoader type="integrity" active />}
              {activeSkeleton === 'engagement_agent' && <SkeletonLoader type="engagement" active />}
            </AnimatePresence>
          </div>
        </div>

        {/* Center: Map */}
        <div className="flex-1 relative">
          <MapView
            center={mapCenter}
            zoom={mapZoom}
            riskZones={riskZones}
            hospitals={hospitals}
            schools={schools}
            rivers={waterGeoJSON?.features || []}
            mapUpdate={latestMapUpdate}
            weatherType={weatherType}
            weatherIntensity={weatherIntensity}
            showWeather={showWeather}
            showRiskHighlight={state?.status === 'published'}
            cities={cities}
            onCityClick={(city) => {
              setSelectedCity(city)
              if (city?.lat && city?.lon) {
                setMapCenter([city.lat, city.lon])
                setMapZoom(10)
              }
            }}
          />

          {/* Empty state */}
          {!state && !running && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-neutral-light/80 backdrop-blur-sm"
            >
              <div className="text-center max-w-md">
                <motion.div
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white border border-primary/20 shadow-sm flex items-center justify-center"
                  animate={{ y: [0,-4,0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </motion.div>
                <h2 className="font-display text-2xl text-text mb-3 animate-gradient-in">Tamil Nadu Climate Intelligence</h2>
                <p className="text-sm text-idle mb-8 leading-relaxed">
                  {selectedCity
                    ? `Ready to analyze ${selectedCity.name}. Press Start Mission to begin climate risk assessment.`
                    : 'Select a city from the dropdown to begin climate analysis.'
                  }
                </p>
                {selectedCity && (
                  <motion.button
                    onClick={startMission}
                    className="px-8 py-3 bg-accent text-white rounded-xl text-sm font-semibold border border-accent/40 mission-btn-glow"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 3l14 9-14 9V3z" />
                      </svg>
                      Start Mission
                    </span>
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {/* Running state */}
          {running && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 border border-primary/20 rounded-xl px-5 py-3 shadow-lg backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-dark/70 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-dark" />
                </div>
                <span className="text-sm text-text font-medium">
                  {buttonLabel === 'Starting...'
                    ? `Starting analysis for ${selectedCity?.name}...`
                    : `${buttonLabel.replace('Running ', '')} for ${selectedCity?.name}`}
                </span>
              </div>
            </motion.div>
          )}

          {/* City info overlay */}
          {selectedCity && !state && !running && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-24 left-4 bg-white/90 border border-primary/20 rounded-xl p-4 shadow-lg backdrop-blur-md"
            >
              <h3 className="text-sm font-semibold text-text mb-3 animate-underline inline-block">{selectedCity.name}</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-neutral-light/70 rounded-lg p-2">
                  <div className="text-idle mb-1">Elevation</div>
                  <div className="text-text font-mono font-medium">{selectedCity.elevation_m}m</div>
                </div>
                <div className="bg-neutral-light/70 rounded-lg p-2">
                  <div className="text-idle mb-1">Flood Risk</div>
                  <div className={`flex items-center gap-2 font-medium ${
                    selectedCity.flood_risk === 'very_high' ? 'text-alert' :
                    selectedCity.flood_risk === 'high' ? 'text-primary-dark' : 'text-idle'
                  }`}>{selectedCity.flood_risk.replace('_', ' ')}</div>
                </div>
                <div className="bg-neutral-light/70 rounded-lg p-2">
                  <div className="text-idle mb-1">Hospitals</div>
                  <div className="text-text font-mono font-medium">{selectedCity.hospital_count}</div>
                </div>
                <div className="bg-neutral-light/70 rounded-lg p-2">
                  <div className="text-idle mb-1">Schools</div>
                  <div className="text-text font-mono font-medium">{selectedCity.school_count}</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Stats Bar */}
          {state && <StatsBar state={state} />}
        </div>

        {/* Right: Thinking Panel */}
        <div className="w-96 bg-white/70 border-l border-primary/20 flex flex-col shrink-0 backdrop-blur-sm">
          <ThinkingPanel
            agents={agents}
            selectedAgent={selectedAgent}
            state={state}
            onSelectAgent={setSelectedAgent}
            selectedAgentOutput={selectedAgentOutput}
          />

          {state?.engagement && (
            <AdvisoryPanel engagement={state.engagement} />
          )}

          <div className="p-4 border-t border-primary/10">
            <h2 className="text-xs font-mono uppercase tracking-wider text-idle mb-3">Score Gauges</h2>
            {state?.integrity || state?.engagement ? (
              <ScoreGauges
                sfs={state?.integrity?.scientific_fidelity_score}
                actionability={state?.engagement?.actionability_score}
                riskScore={state?.impact?.overall_risk_score}
              />
            ) : (
              <div className="text-xs text-idle italic">Run a mission to view scores.</div>
            )}
          </div>

          <div className="p-4 border-t border-primary/10">
            <h2 className="text-xs font-mono uppercase tracking-wider text-idle mb-3">Negotiation</h2>
            <NegotiationTracker rounds={state?.negotiation_log || []} />
          </div>

          <div className="p-4 border-t border-primary/10">
            <h2 className="text-xs font-mono uppercase tracking-wider text-idle mb-3">Agent Log</h2>
            <AgentLog events={wsEvents} />
          </div>

          <div className="p-4 border-t border-primary/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-idle">HITL Queue</h2>
              <motion.button
                onClick={loadHitlQueue}
                className="text-xs px-2 py-1 rounded border border-primary/20 bg-white hover:bg-neutral-light transition-colors"
                whileTap={{ scale: 0.97 }}
              >
                Refresh
              </motion.button>
            </div>
            <HitlQueue
              queue={hitlQueue}
              onDecision={handleHitlDecision}
              onRefresh={loadHitlQueue}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
