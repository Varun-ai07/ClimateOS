import { motion } from 'framer-motion'

interface HitlItem {
  municipality_id: string
  state: any
  events: any[]
}

interface HitlQueueProps {
  queue: HitlItem[]
  onDecision: (municipalityId: string, decision: string) => void
  onRefresh: () => void
}

export default function HitlQueue({ queue, onDecision, onRefresh }: HitlQueueProps) {
  if (queue.length === 0) {
    return (
      <div className="text-idle/70 text-sm italic">
        No cases awaiting human review.
        <button
          onClick={onRefresh}
          className="ml-2 text-primary hover:text-primary/80"
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {queue.map((item) => {
        const state = item.state
        const lastRound = state.negotiation_log?.[state.negotiation_log.length - 1]

        return (
          <div
            key={item.municipality_id}
            className="p-3 rounded-xl border border-alert/40 bg-alert/10 animate-border-shimmer"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-sm text-text tracking-tight">{item.municipality_id}</span>
              <motion.span 
                className="text-xs px-2 py-1 rounded bg-alert text-white"
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                ESCALATED
              </motion.span>
            </div>

            {/* Agent positions */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="bg-white/60 border border-primary/10 rounded-lg p-2 backdrop-blur-sm">
                <div className="text-idle mb-1">Scientific Integrity</div>
                <div>SFS: {((lastRound?.sfs || 0) * 100).toFixed(0)}%</div>
                <div className="text-idle line-clamp-2">{state.integrity_review?.rejection_reason || 'Concerns about accuracy'}</div>
              </div>
              <div className="bg-white/60 border border-primary/10 rounded-lg p-2 backdrop-blur-sm">
                <div className="text-idle mb-1">Community Engagement</div>
                <div>AS: {((lastRound?.as_score || 0) * 100).toFixed(0)}%</div>
                <div className="text-idle line-clamp-2">Focus on accessibility & urgency</div>
              </div>
            </div>

            {/* Decision buttons */}
            <div className="flex gap-2">
              <motion.button
                onClick={() => onDecision(item.municipality_id, 'approve')}
                className="flex-1 bg-decided/90 hover:bg-decided text-white text-xs py-2 rounded-lg font-semibold transition-colors"
                whileTap={{ scale: 0.97 }}
              >
                Approve (Human)
              </motion.button>
              <motion.button
                onClick={() => onDecision(item.municipality_id, 'reject')}
                className="flex-1 bg-alert/90 hover:bg-alert text-white text-xs py-2 rounded-lg font-semibold transition-colors"
                whileTap={{ scale: 0.97 }}
              >
                Reject
              </motion.button>
            </div>
          </div>
        )
      })}

      <button
        onClick={onRefresh}
        className="w-full text-center text-primary hover:text-primary/80 text-xs"
      >
        Refresh Queue
      </button>
    </div>
  )
}