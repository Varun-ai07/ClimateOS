import { motion } from 'framer-motion'

interface Props {
  type: 'forecast' | 'downscaling' | 'impact' | 'policy' | 'integrity' | 'engagement'
  active: boolean
}

const SKELETON_CONFIGS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  forecast: {
    label: 'Forecast',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
    color: 'var(--acting)',
  },
  downscaling: {
    label: 'Downscaling',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    color: 'var(--thinking)',
  },
  impact: {
    label: 'Impact',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
    color: 'var(--decided)',
  },
  policy: {
    label: 'Policy',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    color: 'var(--alert)',
  },
  integrity: {
    label: 'Integrity',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    color: 'var(--decided)',
  },
  engagement: {
    label: 'Engagement',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    color: 'var(--thinking)',
  },
}

export default function SkeletonLoader({ type, active }: Props) {
  if (!active) return null

  const config = SKELETON_CONFIGS[type]

  return (
    <motion.div
      className="p-3 rounded-lg border border-primary/20 bg-neutral-light"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="flex items-center gap-3">
        {/* Animated icon */}
        <motion.div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${config.color}20` }}
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <span style={{ color: config.color }}>{config.icon}</span>
        </motion.div>

        {/* Skeleton content */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-text">{config.label}</div>
            <motion.div
              className="w-16 h-4 rounded bg-primary/20"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
          
          {/* Skeleton bars */}
          <div className="space-y-1.5">
            <motion.div
              className="h-3 rounded bg-primary/10"
              style={{ width: '80%' }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.1 }}
            />
            <motion.div
              className="h-3 rounded bg-primary/10"
              style={{ width: '60%' }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
            />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 w-full bg-primary/10 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: config.color }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  )
}