import { useEffect, useRef } from 'react'
import L from 'leaflet'

interface AffectedItem {
  name: string
  type: string
  risk_level: string
  lat: number
  lon: number
  distance_to_water_m?: number
}

interface Props {
  map: L.Map | null
  hospitals: AffectedItem[]
  schools: AffectedItem[]
  buildings: AffectedItem[]
  roads: AffectedItem[]
  active: boolean
}

const RISK_COLORS: Record<string, string> = {
  high: 'var(--alert)',
  medium: 'var(--acting)',
  low: 'var(--decided)',
}

const TYPE_ICONS: Record<string, (color: string) => L.DivIcon> = {
  hospital: (color) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 32px; height: 32px; 
      background: ${color}; 
      border-radius: 8px; 
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid white;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M12 2v8m0 0v8m0-8h8m-8 0H4"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  school: (color) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 28px; height: 28px; 
      background: ${color}; 
      border-radius: 6px; 
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid white;
    ">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  }),
  building: (color) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 24px; height: 24px; 
      background: ${color}; 
      border-radius: 4px; 
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      border: 2px solid white;
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
        <line x1="15" y1="3" x2="15" y2="21"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
      </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  }),
  road: (color) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 20px; height: 20px; 
      background: ${color}; 
      border-radius: 50%; 
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      border: 2px solid white;
    ">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <line x1="12" y1="2" x2="12" y2="22"/>
        <line x1="4" y1="12" x2="20" y2="12"/>
      </svg>
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  }),
}

export default function RiskHighlight({ map, hospitals, schools, buildings, roads, active }: Props) {
  const layersRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!map || !active) {
      if (layersRef.current) {
        map?.removeLayer(layersRef.current)
        layersRef.current = null
      }
      return
    }

    // Clear previous layers
    if (layersRef.current) {
      map.removeLayer(layersRef.current)
    }

    const layerGroup = L.layerGroup()

    // Add hospitals
    hospitals.forEach(h => {
      if (!h.lat || !h.lon) return
      const color = RISK_COLORS[h.risk_level] || RISK_COLORS.low
      const icon = TYPE_ICONS.hospital(color)
      const marker = L.marker([h.lat, h.lon], { icon })
        .bindPopup(`
          <div style="font-family: Georgia, serif; min-width: 200px;">
            <div style="font-weight: bold; color: var(--ink); margin-bottom: 8px;">${h.name}</div>
            <div style="display: flex; gap: 8px; margin-bottom: 4px;">
              <span style="color: var(--idle); font-size: 12px;">Type:</span>
              <span style="color: var(--ink); font-size: 12px;">Hospital</span>
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 4px;">
              <span style="color: var(--idle); font-size: 12px;">Risk:</span>
              <span style="color: ${color}; font-size: 12px; font-weight: 600;">${h.risk_level.toUpperCase()}</span>
            </div>
            ${h.distance_to_water_m ? `
              <div style="display: flex; gap: 8px;">
                <span style="color: var(--idle); font-size: 12px;">Water proximity:</span>
                <span style="color: var(--ink); font-size: 12px;">${h.distance_to_water_m.toFixed(0)}m</span>
              </div>
            ` : ''}
          </div>
        `)
      layerGroup.addLayer(marker)
    })

    // Add schools
    schools.forEach(s => {
      if (!s.lat || !s.lon) return
      const color = RISK_COLORS[s.risk_level] || RISK_COLORS.low
      const icon = TYPE_ICONS.school(color)
      const marker = L.marker([s.lat, s.lon], { icon })
        .bindPopup(`
          <div style="font-family: Georgia, serif; min-width: 200px;">
            <div style="font-weight: bold; color: var(--ink); margin-bottom: 8px;">${s.name}</div>
            <div style="display: flex; gap: 8px; margin-bottom: 4px;">
              <span style="color: var(--idle); font-size: 12px;">Type:</span>
              <span style="color: var(--ink); font-size: 12px;">School</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <span style="color: var(--idle); font-size: 12px;">Risk:</span>
              <span style="color: ${color}; font-size: 12px; font-weight: 600;">${s.risk_level.toUpperCase()}</span>
            </div>
          </div>
        `)
      layerGroup.addLayer(marker)
    })

    // Add buildings with pulsing effect for high risk
    buildings.forEach(b => {
      if (!b.lat || !b.lon) return
      const color = RISK_COLORS[b.risk_level] || RISK_COLORS.low
      const icon = TYPE_ICONS.building(color)
      const marker = L.marker([b.lat, b.lon], { icon })
        .bindPopup(`
          <div style="font-family: Georgia, serif; min-width: 180px;">
            <div style="font-weight: bold; color: var(--ink); margin-bottom: 8px;">${b.name}</div>
            <div style="display: flex; gap: 8px;">
              <span style="color: var(--idle); font-size: 12px;">Risk:</span>
              <span style="color: ${color}; font-size: 12px; font-weight: 600;">${b.risk_level.toUpperCase()}</span>
            </div>
          </div>
        `)
      layerGroup.addLayer(marker)
    })

    // Add road markers
    roads.forEach(r => {
      if (!r.lat || !r.lon) return
      const color = RISK_COLORS[r.risk_level] || RISK_COLORS.low
      const icon = TYPE_ICONS.road(color)
      const marker = L.marker([r.lat, r.lon], { icon })
        .bindPopup(`
          <div style="font-family: Georgia, serif; min-width: 180px;">
            <div style="font-weight: bold; color: var(--ink); margin-bottom: 8px;">${r.name}</div>
            <div style="display: flex; gap: 8px;">
              <span style="color: var(--idle); font-size: 12px;">Risk:</span>
              <span style="color: ${color}; font-size: 12px; font-weight: 600;">${r.risk_level.toUpperCase()}</span>
            </div>
          </div>
        `)
      layerGroup.addLayer(marker)
    })

    layerGroup.addTo(map)
    layersRef.current = layerGroup

    return () => {
      if (layersRef.current && map) {
        map.removeLayer(layersRef.current)
        layersRef.current = null
      }
    }
  }, [map, hospitals, schools, buildings, roads, active])

  return null
}