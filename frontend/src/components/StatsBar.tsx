interface Props {
  state: any
}

export default function StatsBar({ state }: Props) {
  const i = state.impact || {}
  const d = state.downscaled || {}
  const intg = state.integrity || {}

  const stats = [
    { label: 'Status', value: state.status?.toUpperCase(), color: 'text-decided' },
    { label: 'Risk', value: `${i.overall_risk_score || 0}/100`, color: 'text-alert' },
    { label: 'Precip', value: `${d.corrected_precip_mm?.toFixed(0) || 0}mm`, color: 'text-primary-dark' },
    { label: 'Hospitals', value: i.hospitals_affected || 0, color: 'text-accent' },
    { label: 'Schools', value: i.schools_affected || 0, color: 'text-accent' },
    { label: 'SFS', value: `${((intg.scientific_fidelity_score || 0) * 100).toFixed(0)}%`, color: 'text-decided' },
  ]

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-primary/20">
      <div className="flex items-center px-6 py-3 gap-8">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-idle">{stat.label}</div>
            <div className={`text-sm font-mono font-semibold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}