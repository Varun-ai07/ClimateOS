interface Round {
  round: number
  sfs: number
  as_score: number
  outcome: string
}

interface NegotiationTrackerProps {
  rounds: Round[]
}

export default function NegotiationTracker({ rounds }: NegotiationTrackerProps) {
  if (rounds.length === 0) {
    return (
      <div className="text-idle/70 text-sm italic">
        No negotiation rounds yet. Run the pipeline to start.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rounds.map((round) => (
        <div
          key={round.round}
          className={`p-3 rounded-lg border ${
            round.outcome === 'approve'
              ? 'border-decided bg-decided/10'
              : round.outcome === 'escalate'
              ? 'border-alert bg-alert/10'
              : 'border-acting bg-acting/10'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-sm">Round {round.round}</span>
            <span
              className={`text-xs px-2 py-1 rounded ${
                round.outcome === 'approve'
                  ? 'bg-decided text-white'
                  : round.outcome === 'escalate'
                  ? 'bg-alert text-white'
                  : 'bg-acting text-ink'
              }`}
            >
              {round.outcome.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-idle">SFS: </span>
              <span className={round.sfs >= 0.8 ? 'text-decided' : 'text-acting'}>
                {(round.sfs * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="text-idle">AS: </span>
              <span className={round.as_score >= 0.7 ? 'text-decided' : 'text-acting'}>
                {(round.as_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Visual flow */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {rounds.map((round, i) => (
          <div key={round.round} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                round.outcome === 'approve'
                  ? 'bg-decided'
                  : round.outcome === 'escalate'
                  ? 'bg-alert'
                  : 'bg-acting'
              }`}
            >
              {round.round}
            </div>
            {i < rounds.length - 1 && (
              <div className="w-8 h-1 bg-idle" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}