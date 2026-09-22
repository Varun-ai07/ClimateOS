import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AgentChat from './AgentChat'

interface AgentExec {
  agent_name: string
  status: string
  log: string
  started_at?: string
  completed_at?: string
}

interface Props {
  agents: AgentExec[]
  selectedAgent: string | null
  onSelectAgent: (name: string | null) => void
  state: any
  selectedAgentOutput?: { log?: string; output?: string; thinking?: string; timestamp?: string } | null
}

function tryParseJson(value: string | undefined) {
  if (!value) return null
  try { return JSON.parse(value) } catch { return null }
}

const ForecastStructured = ({ data }: { data: any }) => {
  if (!data || typeof data !== 'object') return null
  const p = data.precipitation || {}
  const t = data.temperature || {}
  const r = data.river_level || {}
  const h = data.humidity || {}
  const w = data.wind || {}
  const m = data.monsoon || {}
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between p-2 bg-neutral-light rounded">
      <span className="text-xs text-idle">{label}</span>
      <span className="text-sm font-mono text-text">{value}</span>
    </div>
  )
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono uppercase tracking-wider text-idle">Forecast Data</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-neutral-light rounded-lg">
          <div className="text-xs text-idle mb-1">Peak Precipitation</div>
          <div className="text-xl font-mono text-text">{p.monthly_peak_mm ?? '—'}<span className="text-sm text-idle ml-1">mm</span></div>
          <div className="text-xs text-idle mt-1">Annual: {p.annual_mm ?? '—'} mm</div>
        </div>
        <div className="p-3 bg-neutral-light rounded-lg">
          <div className="text-xs text-idle mb-1">Max Temp</div>
          <div className="text-xl font-mono text-text">{t.max_c ?? '—'}<span className="text-sm text-idle ml-1">C</span></div>
          <div className="text-xs text-idle mt-1">Change: +{(t.change_c ?? 0)} C</div>
        </div>
        <div className="p-3 bg-neutral-light rounded-lg">
          <div className="text-xs text-idle mb-1">River Level</div>
          <div className="text-xl font-mono text-text">{r.current_m ?? '—'}<span className="text-sm text-idle ml-1">m</span></div>
          <div className="text-xs text-idle mt-1">Threshold: {r.flood_threshold_m ?? '—'} m</div>
        </div>
        <div className="p-3 bg-neutral-light rounded-lg">
          <div className="text-xs text-idle mb-1">Humidity</div>
          <div className="text-xl font-mono text-text">{h.current_pct ?? '—'}<span className="text-sm text-idle ml-1">%</span></div>
          <div className="text-xs text-idle mt-1">Projected: {h.projected_pct ?? '—'}%</div>
        </div>
      </div>

      <div className="space-y-2">
        {row('Precip Change %', `${p.change_pct ?? '—'}%`)}
        {row('Mean Temp', `${t.mean_c ?? '—'} C`)}
        {row('River Status', r.status ? r.status.toUpperCase() : '—')}
        {row('Wind', `${w.speed_kmh ?? '—'} km/h ${w.direction ? `(${w.direction})` : ''}`)}
        {row('Monsoon Phase', m.phase ? m.phase.toUpperCase() : '—')}
        {row('Monsoon Intensity', m.intensity ? m.intensity.toUpperCase() : '—')}
        {row('Monsoon Onset', m.onset_date || '—')}
      </div>
    </div>
  )
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  forecast_agent: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
  downscaling_agent: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  impact_agent: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  policy_agent: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  integrity_agent: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  engagement_agent: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
}

const AGENT_LABELS: Record<string, string> = {
  forecast_agent: 'Forecast',
  downscaling_agent: 'Downscaling',
  impact_agent: 'Impact',
  policy_agent: 'Policy',
  integrity_agent: 'Integrity',
  engagement_agent: 'Community',
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  forecast_agent: 'Loading climate projection data for the selected city',
  downscaling_agent: 'Applying Quantile Delta Mapping to bias-correct coarse projections',
  impact_agent: 'Mapping climate risks onto local infrastructure using OSM data',
  policy_agent: 'Generating municipal adaptation brief using verified climate data',
  integrity_agent: 'Verifying claims against IPCC, WHO, NASA scientific sources',
  engagement_agent: 'Generating citizen advisories in English and Tamil',
}

export default function ThinkingPanel({ agents, selectedAgent, state, onSelectAgent, selectedAgentOutput }: Props) {
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set())

  const toggleRound = (round: number) => {
    const next = new Set(expandedRounds)
    if (next.has(round)) next.delete(round)
    else next.add(round)
    setExpandedRounds(next)
  }

  const agentData = selectedAgent ? agents.find(a => a.agent_name === selectedAgent) : null
  const output = (state?.final_output && selectedAgent && typeof state.final_output === 'object' ? state.final_output : {}) as any || {}

  // Generate chat messages for integrity agent
  const integrityMessages = useMemo(() => {
    if (!state?.integrity) return []
    const msgs: any[] = []
    state.integrity.claims_checked?.forEach((c: any, i: number) => {
      msgs.push({
        id: `claim-${i}`,
        agent: 'integrity_agent',
        content: `Checking claim: "${c.claim_text?.substring(0, 80)}..."`,
        type: c.verified ? 'success' : 'error',
        timestamp: new Date(),
      })
      if (c.reasoning) {
        msgs.push({
          id: `reason-${i}`,
          agent: 'integrity_agent',
          content: c.reasoning,
          type: 'info',
          timestamp: new Date(),
        })
      }
    })
    return msgs
  }, [state?.integrity])

  // Generate chat messages for engagement agent
  const engagementMessages = useMemo(() => {
    if (!state?.engagement) return []
    const msgs: any[] = []
    if (state.engagement.english) {
      msgs.push({
        id: 'en',
        agent: 'engagement_agent',
        content: `English advisory generated: "${state.engagement.english.substring(0, 100)}..."`,
        type: 'info',
        timestamp: new Date(),
      })
    }
    if (state.engagement.tamil) {
      msgs.push({
        id: 'ta',
        agent: 'engagement_agent',
        content: `Tamil advisory generated: "${state.engagement.tamil.substring(0, 100)}..."`,
        type: 'info',
        timestamp: new Date(),
      })
    }
    if (state.engagement.sms) {
      msgs.push({
        id: 'sms',
        agent: 'engagement_agent',
        content: `SMS alert: ${state.engagement.sms}`,
        type: 'success',
        timestamp: new Date(),
      })
    }
    return msgs
  }, [state?.engagement])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-primary/20">
        <h2 className="text-xs font-mono uppercase tracking-wider text-idle mb-1">
          {selectedAgent ? 'Agent Detail' : 'Thinking Transparency'}
        </h2>
        {selectedAgent && (
          <div className="flex items-center gap-2 text-sm text-text">
            <span className="text-primary-dark">{AGENT_ICONS[selectedAgent]}</span>
            <span className="font-semibold">{AGENT_LABELS[selectedAgent]}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedAgent ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-idle">Thinking</div>
              <div className="text-sm text-text bg-neutral-light p-3 rounded-lg">{selectedAgentOutput?.thinking || agentData?.log || AGENT_DESCRIPTIONS[selectedAgent] || ''}</div>

              <div className="text-xs font-mono uppercase tracking-wider text-idle mt-2">Output</div>
              <pre className="text-xs text-text bg-neutral-light p-3 rounded-lg whitespace-pre-wrap break-words">{selectedAgentOutput?.output || 'No captured output yet.'}</pre>
            </div>

            {/* Forecast agent */}
            {selectedAgent === 'forecast_agent' && state?.forecast && (
              <ForecastStructured data={state.forecast} />
            )}

            {/* Downscaling agent */}
            {selectedAgent === 'downscaling_agent' && state?.downscaled && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-idle">Downscaled Values</h3>
                <div className="p-4 bg-neutral-light rounded-lg">
                  <div className="text-xs text-idle mb-1">Corrected Precipitation</div>
                  <div className="text-2xl font-mono text-text">{state.downscaled.corrected_precip_mm?.toFixed(1)}<span className="text-sm text-idle ml-1">mm/month</span></div>
                  <div className="mt-3 text-xs text-idle">
                    90% CI: [{state.downscaled.confidence_interval?.lower?.toFixed(1)} - {state.downscaled.confidence_interval?.upper?.toFixed(1)}] mm
                  </div>
                </div>
              </div>
            )}

            {/* Impact agent */}
            {selectedAgent === 'impact_agent' && state?.impact && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-idle">Impact Assessment</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-neutral-light rounded-lg text-center">
                    <div className="text-xs text-idle mb-1">Risk</div>
                    <div className="text-lg font-mono text-alert font-semibold">{state.impact.overall_risk_score}</div>
                  </div>
                  <div className="p-3 bg-neutral-light rounded-lg text-center">
                    <div className="text-xs text-idle mb-1">Hospitals</div>
                    <div className="text-lg font-mono text-primary-dark font-semibold">{state.impact.hospitals_affected}</div>
                  </div>
                  <div className="p-3 bg-neutral-light rounded-lg text-center">
                    <div className="text-xs text-idle mb-1">Schools</div>
                    <div className="text-lg font-mono text-accent font-semibold">{state.impact.schools_affected}</div>
                  </div>
                </div>
                {state.impact.affected_hospitals?.slice(0, 5).map((h: any, i: number) => (
                  <div key={i} className="p-2 bg-neutral-light rounded text-xs flex items-center justify-between">
                    <span className="text-text">{h.name}</span>
                    <span className={`font-medium ${h.risk_level === 'high' ? 'text-alert' : 'text-acting'}`}>{h.risk_level}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Policy agent */}
            {selectedAgent === 'policy_agent' && state?.policy && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-idle">Policy Brief</h3>
                <div className="text-sm font-semibold text-text">{state.policy.title}</div>
                <div className="text-xs text-idle">Confidence: <span className="font-semibold text-accent">{(state.policy.confidence * 100).toFixed(0)}%</span></div>
                {state.policy.actions?.map((a: any, i: number) => (
                  <div key={i} className="p-3 bg-neutral-light rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-mono text-primary-dark font-semibold">[{a.priority}]</span>
                      <div>
                        <div className="text-sm text-text">{a.action}</div>
                        <div className="text-xs text-idle mt-1">{a.timeline}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Integrity agent - with chat animation */}
            {selectedAgent === 'integrity_agent' && state?.integrity && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-idle">Integrity Verification</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="p-3 bg-neutral-light rounded-lg">
                    <div className="text-xs text-idle mb-1">SFS Score</div>
                    <div className="text-2xl font-mono text-text font-semibold">{state.integrity.scientific_fidelity_score?.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-neutral-light rounded-lg">
                    <div className="text-xs text-idle mb-1">Verdict</div>
                    <div className={`text-lg font-semibold ${state.integrity.verdict === 'approved' ? 'text-decided' : 'text-alert'}`}>
                      {state.integrity.verdict?.toUpperCase()}
                    </div>
                  </div>
                </div>
                {/* Chat-style claim verification */}
                <AgentChat
                  agent="integrity_agent"
                  messages={integrityMessages}
                  isTyping={agentData?.status === 'running'}
                />
              </div>
            )}

            {/* Engagement agent - with chat animation */}
            {selectedAgent === 'engagement_agent' && state?.engagement && (
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-idle">Citizen Advisory</h3>
                {/* Chat-style advisory generation */}
                <AgentChat
                  agent="engagement_agent"
                  messages={engagementMessages}
                  isTyping={agentData?.status === 'running'}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {state?.negotiation_log?.length > 0 ? (
              <>
                <h3 className="text-xs font-mono uppercase tracking-wider text-idle">Negotiation Protocol</h3>
                <div className="p-3 bg-neutral-light rounded-lg">
                  <div className="text-sm text-text mb-2 font-medium">
                    {state.negotiation_log.length} rounds completed
                  </div>
                  <div className="text-xs text-idle">
                    Final: <span className="font-semibold text-accent">{state.negotiation_log[state.negotiation_log.length - 1]?.outcome}</span>
                  </div>
                </div>

                {state.negotiation_log.map((round: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-3 bg-neutral-light rounded-xl border border-primary/10 hover:border-primary/30 transition-smooth cursor-pointer"
                    onClick={() => toggleRound(i)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          round.outcome === 'approve' ? 'bg-decided' :
                          round.outcome === 'escalate' ? 'bg-alert' : 'bg-primary-dark'
                        }`} />
                        <span className="text-sm font-semibold text-text">Round {round.round_number}</span>
                      </div>
                      <span className={`text-xs font-semibold capitalize ${
                        round.outcome === 'approve' ? 'text-decided' :
                        round.outcome === 'escalate' ? 'text-alert' : 'text-primary-dark'
                      }`}>{round.outcome}</span>
                    </div>

                    <AnimatePresence>
                      {expandedRounds.has(i) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 pt-3 border-t border-primary/20"
                        >
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="p-2 bg-white/60 rounded-lg border border-primary/10">
                              <div className="text-xs text-idle">SFS</div>
                              <div className="text-sm font-mono text-text font-semibold">{round.sfs?.toFixed(2)}</div>
                            </div>
                            <div className="p-2 bg-white/60 rounded-lg border border-primary/10">
                              <div className="text-xs text-idle">AS</div>
                              <div className="text-sm font-mono text-text font-semibold">{round.as_score?.toFixed(2)}</div>
                            </div>
                          </div>
                          {round.claims_violated?.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs text-idle mb-1">Claims violated:</div>
                              {round.claims_violated.map((c: string, j: number) => (
                                <div key={j} className="text-xs text-alert">{c}</div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </>
            ) : (
              <div className="text-center py-12">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--idle)" strokeWidth="1" className="mx-auto mb-4">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <div className="text-idle text-sm">Select an agent to view its reasoning</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}