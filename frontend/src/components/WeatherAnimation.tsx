import { motion } from 'framer-motion'

interface Props {
  type: 'rain' | 'cloud' | 'sun' | 'storm'
  intensity: number // 0-100
  active: boolean
}

export default function WeatherAnimation({ type, intensity, active }: Props) {
  if (!active) return null

  const cloudCount = Math.ceil(intensity / 20)
  const rainDrops = Math.ceil(intensity / 10)

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
      {/* Clouds */}
      {(type === 'rain' || type === 'cloud' || type === 'storm') && (
        <>
          {Array.from({ length: cloudCount }).map((_, i) => (
            <motion.div
              key={`cloud-${i}`}
              className="absolute"
              initial={{ x: -200, opacity: 0 }}
              animate={{
                x: ['-200%', '120%'],
                opacity: [0, 0.7, 0.7, 0],
              }}
              transition={{
                duration: 15 + i * 3,
                repeat: Infinity,
                delay: i * 2,
                ease: 'linear',
              }}
              style={{
                top: `${5 + i * 8}%`,
                left: `${10 + i * 15}%`,
              }}
            >
              <svg width="120" height="60" viewBox="0 0 120 60" fill="none">
                <ellipse cx="60" cy="35" rx="50" ry="20" fill={type === 'storm' ? '#4A5568' : '#94A3B8'} opacity="0.8" />
                <ellipse cx="45" cy="25" rx="30" ry="18" fill={type === 'storm' ? '#4A5568' : '#94A3B8'} opacity="0.9" />
                <ellipse cx="75" cy="28" rx="25" ry="15" fill={type === 'storm' ? '#4A5568' : '#94A3B8'} opacity="0.85" />
              </svg>
            </motion.div>
          ))}
        </>
      )}

      {/* Rain */}
      {(type === 'rain' || type === 'storm') && (
        <>
          {Array.from({ length: rainDrops }).map((_, i) => (
            <motion.div
              key={`rain-${i}`}
              className="absolute w-0.5 bg-blue-400/40"
              initial={{ y: -20, opacity: 0 }}
              animate={{
                y: ['-5%', '110%'],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 0.8 + Math.random() * 0.4,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: 'linear',
              }}
              style={{
                left: `${Math.random() * 100}%`,
                height: `${8 + Math.random() * 12}px`,
              }}
            />
          ))}
        </>
      )}

      {/* Lightning for storm */}
      {type === 'storm' && (
        <motion.div
          className="absolute inset-0 bg-acting/10"
          animate={{
            opacity: [0, 0, 0.3, 0, 0, 0, 0.2, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            repeatDelay: 3,
          }}
        />
      )}

      {/* Intensity indicator */}
      <motion.div
        className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            type === 'rain' ? 'bg-blue-400' :
            type === 'storm' ? 'bg-alert' :
            type === 'cloud' ? 'bg-idle' : 'bg-acting'
          }`} />
          <span className="text-xs font-mono text-text capitalize">{type}</span>
          <span className="text-xs text-idle">{intensity}%</span>
        </div>
      </motion.div>
    </div>
  )
}