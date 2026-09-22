import { motion, AnimatePresence } from 'framer-motion'
import React from 'react'

interface AgentExec {
  agent_name: string
  status: string
  progress: number
  log: string
  started_at?: string
  completed_at?: string
}

interface TimelineEvent {
  agent: string
  event: string
  details: string
  timestamp: string
}

interface NegotiationRound {
  round_number: number
  sfs: number
  as_score: number
  outcome: string
}

interface Props {
  agents: AgentExec[]
  selectedAgent: string | null
  onSelectAgent: (name: string | null) => void
  running: boolean
  timelineEvents: TimelineEvent[]
  negotiationLog?: NegotiationRound[]
  liveAgentStatus?: Record<string, 'pending' | 'running' | 'completed'>
  getAgentOutput?: (key: string) => { log: string; output: string; thinking: string; timestamp?: string } | null
}

const AGENT_META: Record<string, { label: string; icon: React.ReactNode }> = {
  forecast_agent: {
    label: 'Forecast',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
        <path d="M2 12h20"/>
      </svg>
    ),
  },
  downscaling_agent: {
    label: 'Downscaling',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  impact_agent: {
    label: 'Impact',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
        <line x1="8" y1="2" x2="8" y2="18"/>
        <line x1="16" y1="6" x2="16" y2="22"/>
      </svg>
    ),
  },
  policy_agent: {
    label: 'Policy',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  integrity_agent: {
    label: 'Integrity',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  engagement_agent: {
    label: 'Community',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
}

const STATUS_STYLES: Record<string, { bg: string; dot: string; text: string }> = {
  completed: { bg: 'bg-decided/10', dot: 'bg-decided', text: 'text-decided' },
  running: { bg: 'bg-primary/10', dot: 'bg-primary-dark', text: 'text-primary-dark' },
  error: { bg: 'bg-alert/10', dot: 'bg-alert', text: 'text-alert' },
  pending: { bg: 'bg-alert/10', dot: 'bg-alert', text: 'text-alert' },
}

export default function AgentRoster({ agents, selectedAgent, onSelectAgent, running, timelineEvents, negotiationLog = [], liveAgentStatus = {}, getAgentOutput }: Props) {
  const getAgentStatus = (key: string) => {
    const fromAgents = agents.find(a => a.agent_name === key)
    if (fromAgents && fromAgents.status === 'completed') return 'completed'
    return liveAgentStatus[key] || fromAgents?.status || 'pending'
  }
  const getLatestEvent = (key: string) => {
    const events = timelineEvents.filter(e => e.agent === key)
    return events.length > 0 ? events[events.length - 1] : null
  }

  // Get negotiation status
  const getNegotiationStatus = () => {
    if (negotiationLog.length === 0) return 'pending'
    const last = negotiationLog[negotiationLog.length - 1]
    return last.outcome === 'approve' ? 'completed' : last.outcome === 'escalate' ? 'error' : 'completed'
  }

  const anyLive = Object.values(liveAgentStatus).some(s => s === 'running' || s === 'completed')

  return (
    <div className="space-y-0">
      {/* Agent cards */}
      {Object.entries(AGENT_META).map(([key, meta], idx, arr) => {
        const status = getAgentStatus(key)
        const latestEvent = getLatestEvent(key)
        const isActive = selectedAgent === key
        const isRunning = status === 'running'
        const effectiveStatus = running && !anyLive && status === 'pending' ? 'running' : status
        const styles = STATUS_STYLES[effectiveStatus]
        const output = getAgentOutput?.(key)
        const showCompletedDetails = status === 'completed' && !!output

        const borderAnimation =
          effectiveStatus === 'running'
            ? { borderColor: ['var(--acting)', 'var(--surface)', 'var(--acting)'] }
            : effectiveStatus === 'pending'
            ? { borderColor: ['var(--alert)', 'var(--surface)', 'var(--alert)'] }
            : { borderColor: 'var(--decided)' }

        const borderTransition =
          effectiveStatus === 'running' || effectiveStatus === 'pending'
            ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const }
            : { duration: 0 }

        return (
          <React.Fragment key={key}>
            <motion.button
              onClick={() => onSelectAgent(isActive ? null : key)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all ${isActive ? 'ring-2 ring-primary-dark/40' : ''} ${styles.bg}`}
              animate={borderAnimation}
              transition={borderTransition}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="relative mt-0.5">
                <div className={`w-3 h-3 rounded-full ${styles.dot}`} />
                {isRunning && (
                  <motion.div
                    className="absolute inset-0 w-3 h-3 rounded-full bg-primary-dark"
                    animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                {effectiveStatus === 'pending' && (
                  <motion.div
                    className="absolute inset-0 w-3 h-3 rounded-full bg-alert"
                    animate={{ scale: [1, 1.9, 1], opacity: [0.35, 0, 0.35] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
                  />
                )}
              </div>

              <div className={`${styles.text} mt-0.5`}>{meta.icon}</div>

              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-text">{meta.label}</div>
                  <motion.div className={`text-xs font-mono ${styles.text} capitalize`}>
                    {status}
                    {effectiveStatus === 'pending' && (
                      <motion.span
                        className="ml-1 inline-block"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' as const }}
                      />
                    )}
                  </motion.div>
                </div>

                <AnimatePresence>
                  {isRunning && latestEvent && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-1.5"
                    >
                      <div className="text-xs text-primary-dark font-medium truncate">
                        {latestEvent.event.replace(/_/g, ' ')}
                      </div>
                      {latestEvent.details && (
                        <div className="text-xs text-idle truncate mt-0.5">
                          {latestEvent.details}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {showCompletedDetails && (
                  <div className="mt-1.5 space-y-1">
                    {output.thinking && (
                      <div className="text-xs text-thinking truncate">
                        <span className="font-semibold">Thinking:</span> {output.thinking}
                      </div>
                    )}
                    <div className="text-xs text-idle truncate">
                      {output.log || output.output || 'completed'}
                    </div>
                  </div>
                )}

                {!showCompletedDetails && status === 'completed' && latestEvent && (
                  <div className="text-xs text-idle truncate mt-1.5">
                    {latestEvent.details}
                  </div>
                )}
              </div>
            </motion.button>
            {idx < arr.length - 1 && (
              <div className="flex justify-center h-6 -my-1">
                <svg width="12" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={(() => {
                  const c = effectiveStatus === 'completed' ? 'text-decided' : effectiveStatus === 'running' ? 'text-primary-dark' : 'text-alert';
                  return c;
                })()}>
                  <path d="M12 6v12M5 12l7 7 7-7" />
                  {effectiveStatus === 'running' && (
                    <motion.path
                      d="M12 6v12M5 12l7 7 7-7"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const }}
                    />
                  )}
                </svg>
              </div>
            )}
          </React.Fragment>
        )
      })}

      {/* Negotiation status */}
      {negotiationLog.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-lg border ${
            getNegotiationStatus() === 'completed' ? 'bg-decided/10 border-decided/30' :
            getNegotiationStatus() === 'error' ? 'bg-alert/10 border-alert/30' :
            'bg-neutral-light border-primary/20'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="text-sm font-semibold text-text">Negotiation</span>
            <span className={`text-xs font-mono capitalize ${
              getNegotiationStatus() === 'completed' ? 'text-decided' :
              getNegotiationStatus() === 'error' ? 'text-alert' : 'text-idle'
            }`}>
              {getNegotiationStatus()}
            </span>
          </div>
          <div className="space-y-1">
            {negotiationLog.map((round, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${
                  round.outcome === 'approve' ? 'bg-decided' :
                  round.outcome === 'escalate' ? 'bg-alert' : 'bg-primary-dark'
                }`} />
                <span className="text-text">Round {round.round_number}</span>
                <span className="text-idle">SFS: {round.sfs.toFixed(2)}</span>
                <span className="text-idle">AS: {round.as_score.toFixed(2)}</span>
                <span className={`ml-auto font-medium capitalize ${
                  round.outcome === 'approve' ? 'text-decided' :
                  round.outcome === 'escalate' ? 'text-alert' : 'text-primary-dark'
                }`}>{round.outcome}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
