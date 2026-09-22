interface ScoreGaugesProps {
  sfs?: number
  actionability?: number
  citationCoverage?: number
  riskScore?: number
}

function Gauge({ label, value, max = 1, color }: { label: string; value: number; max?: number; color: string }) {
  const percentage = (value / max) * 100

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-idle">{label}</span>
        <span className="font-mono" style={{ color }}>
          {max === 1 ? `${(value * 100).toFixed(0)}%` : value.toFixed(0)}
        </span>
      </div>
      <div className="w-full bg-ink/20 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function ScoreGauges({ sfs = 0, actionability = 0, citationCoverage = 0, riskScore = 0 }: ScoreGaugesProps) {
  return (
    <div className="space-y-2">
      <Gauge
        label="Scientific Fidelity Score"
        value={sfs}
        color={sfs >= 0.8 ? 'var(--decided)' : sfs >= 0.6 ? 'var(--acting)' : 'var(--alert)'}
      />
      <Gauge
        label="Actionability Score"
        value={actionability}
        color={actionability >= 0.7 ? 'var(--decided)' : actionability >= 0.5 ? 'var(--acting)' : 'var(--alert)'}
      />
      <Gauge
        label="Citation Coverage"
        value={citationCoverage}
        max={100}
        color={citationCoverage >= 80 ? 'var(--decided)' : citationCoverage >= 50 ? 'var(--acting)' : 'var(--alert)'}
      />
      <Gauge
        label="Risk Score"
        value={riskScore}
        max={100}
        color={riskScore >= 70 ? 'var(--alert)' : riskScore >= 40 ? 'var(--acting)' : 'var(--decided)'}
      />
    </div>
  )
}
