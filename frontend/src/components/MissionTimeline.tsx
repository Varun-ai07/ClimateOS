interface Props {
  events: any[]
}

const AGENT_ICONS: Record<string, string> = {
  forecast_agent: '🛰️',
  downscaling_agent: '🔬',
  impact_agent: '🗺️',
  policy_agent: '📋',
  integrity_agent: '🛡️',
  engagement_agent: '📢',
}

export default function MissionTimeline({ events }: Props) {
  if (!events?.length) return (
    <div className="p-4 text-idle/70 text-sm text-center py-8">No events yet</div>
  )

  return (
    <div className="p-3">
      <div className="text-xs font-medium text-idle mb-3 uppercase tracking-wider">Mission Timeline</div>
      <div className="space-y-1">
        {events.map((e, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <div className="mt-0.5 w-5 text-center shrink-0">
              {AGENT_ICONS[e.agent] || '•'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-idle/80 truncate">{e.event.replace(/_/g, ' ')}</div>
              {e.details && <div className="text-idle/70 truncate">{e.details}</div>}
            </div>
            <div className="text-idle/60 text-[10px] shrink-0">
              {e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}