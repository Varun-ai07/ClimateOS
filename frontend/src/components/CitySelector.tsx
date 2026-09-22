import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface City {
  id: string
  key: string
  name: string
  lat: number
  lon: number
  elevation_m: number
  flood_risk: string
  hospital_count: number
  school_count: number
}

interface Props {
  cities: City[]
  selectedCity: City | null
  onSelect: (city: City) => void
}

export default function CitySelector({ cities, selectedCity, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = cities.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'very_high': return 'text-alert'
      case 'high': return 'text-primary-dark'
      case 'medium': return 'text-accent'
      default: return 'text-idle'
    }
  }

  return (
    <div ref={ref} className="relative max-w-lg mx-auto" style={{ zIndex: 10001 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white border border-primary/30 rounded-xl px-4 py-3 text-sm hover:border-primary-dark/50 transition-smooth shadow-sm"
      >
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-idle">
            <path d="M12 2a8 8 0 100 16 8 8 0 000-16z"/>
            <path d="M12 8v6M9 11h6"/>
          </svg>
          <span className={selectedCity ? 'text-text font-medium' : 'text-idle'}>
            {selectedCity ? selectedCity.name : 'Select a city...'}
          </span>
        </span>
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--idle)"
          strokeWidth="2"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-white/90 border border-primary/30 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md"
            style={{ zIndex: 10000 }}
          >
            <div className="p-3 border-b border-primary/10">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search cities..."
                className="w-full bg-neutral-light text-sm text-text placeholder-idle outline-none px-3 py-2 rounded-lg"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto">
              {filtered.map(city => {
                const selected = selectedCity?.id === city.id
                return (
                  <motion.button
                    key={city.id}
                    onClick={() => {
                      onSelect(city)
                      setIsOpen(false)
                      setSearch('')
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-smooth ${
                      selected ? 'bg-primary/10 border-l-2 border-primary-dark' : 'hover:bg-neutral-light border-l-2 border-transparent'
                    }`}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="text-left">
                      <div className="text-sm font-semibold text-text flex items-center gap-2">
                        {city.name}
                        {selected && (
                          <motion.span
                            className="inline-flex items-center justify-center rounded-full bg-decided/10 text-decided"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </motion.span>
                        )}
                      </div>
                      <div className="text-xs text-idle mt-0.5">
                        {city.elevation_m}m elevation · {city.hospital_count} hospitals
                      </div>
                    </div>
                    <div className={`text-xs font-semibold capitalize ${getRiskColor(city.flood_risk)}`}>
                      {city.flood_risk.replace('_', ' ')}
                    </div>
                  </motion.button>
                )
              })}
              {filtered.length === 0 && (
                <div className="px-4 py-3 text-sm text-idle">No cities found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}