import { useEffect, useRef } from 'react'

interface AgentEvent {
  event: string
  agent?: string
  output_summary?: string
  round?: number
  sfs?: number
  as_score?: number
  outcome?: string
}

interface AgentLogProps {
  events: AgentEvent[]
}

export default function AgentLog({ events }: AgentLogProps) {
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [events])

  const getEventColor = (event: string) => {
    if (event === 'agent_completed') return 'text-decided'
    if (event === 'agent_started') return 'text-primary'
    if (event === 'negotiation_round') return 'text-acting'
    if (event === 'escalated_to_hitl') return 'text-alert'
    if (event === 'published') return 'text-decided'
    return 'text-idle'
  }

  const formatEvent = (event: AgentEvent) => {
    switch (event.event) {
      case 'agent_started':
        return `[${event.agent}] Starting...`
      case 'agent_completed':
        return `[${event.agent}] ${event.output_summary}`
      case 'negotiation_round':
        return `Round ${event.round}: SFS=${(event.sfs! * 100).toFixed(0)}% AS=${(event.as_score! * 100).toFixed(0)}% → ${event.outcome}`
      case 'escalated_to_hitl':
        return `⚠️ Escalated to HITL: ${event.agent}`
      case 'published':
        return `✅ Published: ${event.agent}`
      default:
        return event.event
    }
  }

  if (events.length === 0) {
    return (
      <div className="text-idle text-sm italic h-32 flex items-center justify-center">
        No activity yet. Click "Run Pipeline" to start.
      </div>
    )
  }

  return (
    <div
      ref={logRef}
      className="h-48 overflow-y-auto font-mono text-xs space-y-1 bg-neutral-light p-2 rounded"
    >
      {events.map((event, i) => (
        <div key={i} className={getEventColor(event.event)}>
          {formatEvent(event)}
        </div>
      ))}
    </div>
  )
}