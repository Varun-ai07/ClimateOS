import { motion } from 'framer-motion'

interface TimelineEvent {
  agent: string
  event: string
  details: string
  timestamp: string
}

interface Props {
  events: TimelineEvent[]
  currentTime: Date
}

const AGENT_COLORS: Record<string, string> = {
  forecast_agent: 'var(--acting)',
  downscaling_agent: 'var(--thinking)',
  impact_agent: 'var(--decided)',
  policy_agent: 'var(--alert)',
  integrity_agent: 'var(--decided)',
  engagement_agent: 'var(--thinking)',
}

const AGENT_LABELS: Record<string, string> = {
  forecast_agent: 'Forecast',
  downscaling_agent: 'Downscaling',
  impact_agent: 'Impact',
  policy_agent: 'Policy',
  integrity_agent: 'Integrity',
  engagement_agent: 'Engagement',
}

export default function Timeline({ events, currentTime }: Props) {
  if (events.length === 0) return null

  // Group events by agent
  const groupedEvents: Record<string, TimelineEvent[]> = {}
  events.forEach(event => {
    if (!groupedEvents[event.agent]) {
      groupedEvents[event.agent] = []
    }
    groupedEvents[event.agent].push(event)
  })

  return (
    <div className="bg-white rounded-xl border border-primary/20 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-semibold text-text">Real-Time Timeline</h3>
        <div className="text-xs font-mono text-idle">
          {currentTime.toLocaleTimeString()}
        </div>
      </div>

      {/* Timeline track */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary/20" />

        {/* Events */}
        <div className="space-y-4">
          {Object.entries(groupedEvents).map(([agent, agentEvents]) => (
            <motion.div
              key={agent}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative pl-10"
            >
              {/* Agent dot */}
              <div
                className="absolute left-2.5 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: AGENT_COLORS[agent] || 'var(--idle)' }}
              />

              {/* Agent label */}
              <div className="text-xs font-semibold text-text mb-1">
                {AGENT_LABELS[agent] || agent}
              </div>

              {/* Events */}
              <div className="space-y-1">
                {agentEvents.map((event, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-2 text-xs"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-idle" />
                    <span className="text-idle">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-text">{event.event.replace(/_/g, ' ')}</span>
                    {event.details && (
                      <span className="text-idle truncate">— {event.details}</span>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mt-4 pt-4 border-t border-primary/10">
        <div className="flex items-center justify-between text-xs text-idle">
          <span>Events logged: {events.length}</span>
          <span>Duration: {Math.round((new Date(events[events.length-1]?.timestamp).getTime() - new Date(events[0]?.timestamp).getTime()) / 1000)}s</span>
        </div>
      </div>
    </div>
  )
}