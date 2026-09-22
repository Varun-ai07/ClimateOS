import { motion, AnimatePresence } from 'framer-motion'

interface NegotiationRound {
  round_number: number
  sfs: number
  as_score: number
  outcome: string
  integrity_feedback?: string
  claims_violated?: string[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  municipalityName: string
  negotiationLog: NegotiationRound[]
  advisory: {
    english: string
    tamil: string
    sms: string
  }
}

export default function NegotiationPopup({
  isOpen,
  onClose,
  onApprove,
  onReject,
  municipalityName,
  negotiationLog,
  advisory,
}: Props) {
  if (!isOpen) return null

  const lastRound = negotiationLog[negotiationLog.length - 1]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 2000 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Header */}
            <div className="p-6 border-b border-primary/20 bg-alert/5 animate-gradient-in">
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-11 h-11 rounded-xl bg-alert/10 flex items-center justify-center"
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--alert)" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </motion.div>
                <div>
                  <motion.h2 
                    className="text-xl font-display font-bold text-text"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    Negotiation Escalated
                  </motion.h2>
                  <p className="text-sm text-idle">
                    {municipalityName} — Human review required
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Negotiation Summary */}
              <div className="mb-6">
                <h3 className="text-sm font-mono uppercase tracking-wider text-idle mb-3">
                  Negotiation History
                </h3>
                <div className="space-y-2">
                  {negotiationLog.map((round, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        round.outcome === 'escalate'
                          ? 'bg-alert/5 border-alert/30'
                          : 'bg-neutral-light border-primary/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-text">
                          Round {round.round_number}
                        </span>
                        <span className={`text-xs font-semibold capitalize ${
                          round.outcome === 'approve' ? 'text-decided' :
                          round.outcome === 'escalate' ? 'text-alert' : 'text-primary-dark'
                        }`}>
                          {round.outcome}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-idle">SFS: </span>
                          <span className="font-mono text-text">{round.sfs.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-idle">AS: </span>
                          <span className="font-mono text-text">{round.as_score.toFixed(2)}</span>
                        </div>
                      </div>
                      {round.claims_violated && round.claims_violated.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-primary/10">
                          <div className="text-xs text-idle mb-1">Claims violated:</div>
                          {round.claims_violated.map((c, j) => (
                            <div key={j} className="text-xs text-alert">{c}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Advisory Preview */}
              <div>
                <h3 className="text-sm font-mono uppercase tracking-wider text-idle mb-3">
                  Generated Advisory
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-neutral-light rounded-lg">
                    <div className="text-xs text-idle mb-1">English</div>
                    <div className="text-sm text-text">{advisory.english}</div>
                  </div>
                  <div className="p-3 bg-neutral-light rounded-lg">
                    <div className="text-xs text-idle mb-1">Tamil</div>
                    <div className="text-sm text-text">{advisory.tamil}</div>
                  </div>
                  <div className="p-3 bg-neutral-light rounded-lg">
                    <div className="text-xs text-idle mb-1">SMS</div>
                    <div className="text-sm font-mono text-text">{advisory.sms}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-primary/20 bg-neutral-light/60">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-idle">
                  Review the advisory and approve or reject for publication.
                </p>
                <div className="flex gap-3">
                  <motion.button
                    onClick={onReject}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-alert/30 text-alert hover:bg-alert/5 transition-colors"
                    whileTap={{ scale: 0.97 }}
                  >
                    Reject
                  </motion.button>
                  <motion.button
                    onClick={onApprove}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-decided text-white hover:bg-decided/90 transition-colors shadow-lg shadow-decided/20"
                    whileTap={{ scale: 0.97 }}
                  >
                    Approve & Publish
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}