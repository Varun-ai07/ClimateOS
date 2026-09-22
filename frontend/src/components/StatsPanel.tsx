interface Props {
  state: any
}

export default function StatsPanel({ state }: Props) {
  const i = state.impact || {}
  const d = state.downscaled || {}
  const intg = state.integrity || {}
  const f = state.forecast || {}

  const stats = [
    { label: 'Mission', value: state.status?.toUpperCase() || '—', color: state.status === 'published' ? 'text-decided' : 'text-acting' },
    { label: 'Risk Score', value: `${i.overall_risk_score || 0}/100`, color: 'text-alert' },
    { label: 'Precipitation', value: `${d.corrected_precip_mm?.toFixed(0) || 0}mm`, color: 'text-primary' },
    { label: 'Hospitals', value: i.hospitals_affected || 0, color: 'text-alert' },
    { label: 'Schools', value: i.schools_affected || 0, color: 'text-acting' },
    { label: 'Buildings', value: i.buildings_affected || 0, color: 'text-primary' },
    { label: 'Population', value: i.population_affected?.toLocaleString() || '0', color: 'text-alert' },
    { label: 'Confidence', value: `${((intg.scientific_fidelity_score || 0) * 100).toFixed(0)}%`, color: 'text-decided' },
  ]

  return (
    <div className="h-14 bg-white/95 backdrop-blur-sm border-t border-primary/20 flex items-center px-4 gap-6 shrink-0 overflow-x-auto">
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-2 shrink-0">
          <div className="text-[10px] text-idle/70 uppercase">{s.label}</div>
          <div className={`text-sm font-semibold ${s.color}`}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}
