import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  engagement: {
    english: string
    tamil: string
    sms: string
    poster_text: string
    actionability_score: number
  }
}

export default function AdvisoryPanel({ engagement }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-t border-primary/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-light transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--thinking)" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-sm font-semibold text-text">Citizen Advisory</span>
        </div>
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--idle)"
          strokeWidth="2"
          animate={{ rotate: expanded ? 180 : 0 }}
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4 space-y-3"
          >
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-idle mb-1">English</div>
              <div className="text-sm text-text bg-neutral-light p-3 rounded-lg leading-relaxed">
                {engagement.english}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-idle mb-1">Tamil</div>
              <div className="text-sm text-text bg-neutral-light p-3 rounded-lg leading-relaxed">
                {engagement.tamil}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-idle mb-1">SMS Alert</div>
              <div className="text-sm font-mono text-text bg-neutral-light p-3 rounded-lg">
                {engagement.sms}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-idle pt-1">
              <span>Actionability: <span className="font-semibold text-accent">{(engagement.actionability_score * 100).toFixed(0)}%</span></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}