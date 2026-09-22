import { motion, AnimatePresence } from 'framer-motion'

interface Ward {
  id: string
  lat: number
  lon: number
  risk_level: string
  elevation: number
  hospitals: number
  schools: number
  buildings: number
}

interface Props {
  ward: Ward | null
  onClose: () => void
}

const RISK_COLORS: Record<string, string> = {
  high: 'var(--alert)',
  medium: 'var(--acting)',
  low: 'var(--decided)',
}

// Simulated 3D buildings for the ward
const MOCK_BUILDINGS = [
  { id: 'b1', x: 20, y: 30, w: 15, h: 25, type: 'hospital', risk: 'high' },
  { id: 'b2', x: 50, y: 20, w: 12, h: 18, type: 'school', risk: 'medium' },
  { id: 'b3', x: 35, y: 55, w: 20, h: 15, type: 'residential', risk: 'low' },
  { id: 'b4', x: 70, y: 40, w: 10, h: 30, type: 'commercial', risk: 'medium' },
  { id: 'b5', x: 15, y: 65, w: 25, h: 20, type: 'residential', risk: 'high' },
]

const MOCK_ROADS = [
  { id: 'r1', points: '0,50 30,50 60,50 100,50', risk: 'high' },
  { id: 'r2', points: '50,0 50,30 50,60 50,100', risk: 'medium' },
]

const MOCK_RIVERS = [
  { id: 'rv1', points: '0,70 20,65 40,75 60,70 80,80 100,75', risk: 'high' },
]

export default function Ward3DView({ ward, onClose }: Props) {
  if (!ward) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        style={{ zIndex: 3000 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 30 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Header */}
          <div className="p-4 border-b border-primary/20 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-bold text-text">
                Ward {ward.id} — 3D View
              </h2>
              <p className="text-xs text-idle">
                Elevation: {ward.elevation}m | Risk: {ward.risk_level.toUpperCase()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-light rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* 3D View */}
          <div className="p-6 bg-gradient-to-b from-neutral-light to-white">
            <div className="relative w-full h-[400px] bg-neutral-light rounded-xl overflow-hidden" style={{ perspective: '1000px' }}>
              {/* Grid floor */}
              <div className="absolute inset-0" style={{ transform: 'rotateX(60deg) rotateZ(-30deg)', transformOrigin: 'center center' }}>
                <svg width="100%" height="100%" viewBox="0 0 100 100">
                  {/* Grid lines */}
                  {Array.from({ length: 11 }).map((_, i) => (
                    <g key={i}>
                      <line x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="var(--primary)" strokeWidth="0.5" />
                      <line x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="var(--primary)" strokeWidth="0.5" />
                    </g>
                  ))}

                  {/* Rivers */}
                  {MOCK_RIVERS.map(river => (
                    <motion.polyline
                      key={river.id}
                      points={river.points}
                      fill="none"
                      stroke="#4A90D9"
                      strokeWidth="3"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2 }}
                    />
                  ))}

                  {/* Roads */}
                  {MOCK_ROADS.map(road => (
                    <motion.polyline
                      key={road.id}
                      points={road.points}
                      fill="none"
                      stroke={RISK_COLORS[road.risk]}
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.5, delay: 0.5 }}
                    />
                  ))}

                  {/* Buildings */}
                  {MOCK_BUILDINGS.map((building, i) => (
                    <motion.g key={building.id}>
                      {/* Building shadow */}
                      <rect
                        x={building.x + 2}
                        y={building.y + 2}
                        width={building.w}
                        height={building.h}
                        fill="rgba(0,0,0,0.2)"
                        rx="1"
                      />
                      {/* Building base */}
                      <motion.rect
                        x={building.x}
                        y={building.y}
                        width={building.w}
                        height={building.h}
                        fill={RISK_COLORS[building.risk]}
                        fillOpacity={0.8}
                        rx="1"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                        style={{ transformOrigin: `${building.x + building.w/2}px ${building.y + building.h}px` }}
                      />
                      {/* Building label */}
                      <text
                        x={building.x + building.w/2}
                        y={building.y + building.h/2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="4"
                        fontWeight="bold"
                      >
                        {building.type === 'hospital' ? 'H' : building.type === 'school' ? 'S' : 'B'}
                      </text>
                    </motion.g>
                  ))}
                </svg>
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                <div className="text-xs font-semibold text-text mb-2">Legend</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-alert" />
                    <span className="text-xs text-text">High Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-acting" />
                    <span className="text-xs text-text">Medium Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-decided" />
                    <span className="text-xs text-text">Low Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-1 bg-[#4A90D9]" />
                    <span className="text-xs text-text">River</span>
                  </div>
                </div>
              </div>

              {/* Building count */}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xs text-idle">Hospitals</div>
                    <div className="text-lg font-mono font-bold text-alert">{ward.hospitals}</div>
                  </div>
                  <div>
                    <div className="text-xs text-idle">Schools</div>
                    <div className="text-lg font-mono font-bold text-primary-dark">{ward.schools}</div>
                  </div>
                  <div>
                    <div className="text-xs text-idle">Buildings</div>
                    <div className="text-lg font-mono font-bold text-accent">{ward.buildings}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-primary/20 bg-neutral-light/50">
            <div className="flex items-center justify-between text-xs text-idle">
              <span>Ward ID: {ward.id}</span>
              <span>Coordinates: {ward.lat.toFixed(4)}, {ward.lon.toFixed(4)}</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}