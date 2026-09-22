import { useState, useRef, useEffect } from 'react'
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
  wards: Ward[]
  selectedWard: Ward | null
  onSelectWard: (ward: Ward | null) => void
  active: boolean
}

const RISK_COLORS: Record<string, string> = {
  high: 'var(--alert)',
  medium: 'var(--acting)',
  low: 'var(--decided)',
}

export default function GridWard({ wards, selectedWard, onSelectWard, active }: Props) {
  if (!active || wards.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
      {/* Grid overlay on map */}
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {wards.map((ward, i) => {
          const x = (i % 5) * 20 + 2
          const y = Math.floor(i / 5) * 20 + 2
          const color = RISK_COLORS[ward.risk_level] || RISK_COLORS.low
          const isSelected = selectedWard?.id === ward.id

          return (
            <motion.rect
              key={ward.id}
              x={x}
              y={y}
              width="16"
              height="16"
              rx="2"
              fill={color}
              fillOpacity={isSelected ? 0.4 : 0.15}
              stroke={color}
              strokeWidth={isSelected ? 2 : 0.5}
              strokeDasharray={isSelected ? 'none' : '4 2'}
              className="pointer-events-auto cursor-pointer"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelectWard(isSelected ? null : ward)}
              whileHover={{ fillOpacity: 0.3 }}
            />
          )
        })}
      </svg>

      {/* Ward info popup */}
      <AnimatePresence>
        {selectedWard && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl p-4 min-w-[280px] pointer-events-auto"
            style={{ zIndex: 20 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-display font-semibold text-text">
                Ward {selectedWard.id}
              </h3>
              <button
                onClick={() => onSelectWard(null)}
                className="text-idle hover:text-text"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="p-2 bg-neutral-light rounded">
                <div className="text-idle">Elevation</div>
                <div className="text-text font-mono font-semibold">{selectedWard.elevation}m</div>
              </div>
              <div className="p-2 bg-neutral-light rounded">
                <div className="text-idle">Risk Level</div>
                <div className="font-semibold" style={{ color: RISK_COLORS[selectedWard.risk_level] }}>
                  {selectedWard.risk_level.toUpperCase()}
                </div>
              </div>
              <div className="p-2 bg-neutral-light rounded">
                <div className="text-idle">Hospitals</div>
                <div className="text-text font-mono font-semibold">{selectedWard.hospitals}</div>
              </div>
              <div className="p-2 bg-neutral-light rounded">
                <div className="text-idle">Schools</div>
                <div className="text-text font-mono font-semibold">{selectedWard.schools}</div>
              </div>
            </div>

            <button
              onClick={() => {/* Open 3D view */}}
              className="w-full py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent/90 transition-colors"
            >
              View 3D Ward
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}