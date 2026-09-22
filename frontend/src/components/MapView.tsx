import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import WeatherAnimation from './WeatherAnimation'

interface Props {
  center: [number, number]
  zoom: number
  riskZones: any[]
  hospitals: any[]
  schools: any[]
  rivers?: any[]
  demData?: any
  mapUpdate?: any
  weatherType?: 'rain' | 'cloud' | 'sun' | 'storm'
  weatherIntensity?: number
  showWeather?: boolean
  showRiskHighlight?: boolean
  cities?: City[]
  onCityClick?: (city: City) => void
}

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

// Custom marker icons
const createIcon = (color: string, type: string) => {
  const iconSvg = type === 'hospital'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2v8m0 0v8m0-8h8m-8 0H4"/></svg>`
    : type === 'school'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 28px; height: 28px;
      background: ${color};
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid white;
    ">${iconSvg}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

const createCityIcon = (city: City) => {
  const label = city.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return L.divIcon({
    className: 'custom-city-marker',
    html: `<div style="
      width: 32px; height: 32px;
      background: var(--thinking);
      color: white;
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      border: 2px solid white;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer;
    ">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}
export default function MapView({
  center,
  zoom,
  riskZones,
  hospitals,
  schools,
  rivers = [],
  demData,
  mapUpdate,
  weatherType = 'rain',
  weatherIntensity = 50,
  showWeather = false,
  showRiskHighlight = false,
  cities,
  onCityClick,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<{ [key: string]: L.Layer }>({})
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!mapRef.current || map.current) return
    map.current = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map.current)
    L.control.zoom({ position: 'bottomright' }).addTo(map.current)
    setMapReady(true)
  }, [])

  useEffect(() => {
    if (map.current) {
      map.current.flyTo(center, zoom, { duration: 1.5 })
    }
  }, [center, zoom])

  // Risk zones
  useEffect(() => {
    if (!map.current) return
    if (layers.current['risk']) map.current.removeLayer(layers.current['risk'])
    if (!riskZones.length) return

    const features = riskZones.map(z => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [z.center_lon - 0.025, z.center_lat - 0.025],
          [z.center_lon + 0.025, z.center_lat - 0.025],
          [z.center_lon + 0.025, z.center_lat + 0.025],
          [z.center_lon - 0.025, z.center_lat + 0.025],
          [z.center_lon - 0.025, z.center_lat - 0.025],
        ]]
      },
      properties: z,
    }))

    const geojsonPayload = {
      type: 'FeatureCollection',
      features,
    } as any

    const geojson = L.geoJSON(geojsonPayload, {
      style: (f: any) => ({
        color: f?.properties?.risk_level === 'high' ? 'var(--alert)' :
               f?.properties?.risk_level === 'medium' ? 'var(--acting)' : 'var(--decided)',
        fillColor: f?.properties?.risk_level === 'high' ? 'var(--alert)' :
                   f?.properties?.risk_level === 'medium' ? 'var(--acting)' : 'var(--decided)',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '5 5',
      }),
    }).addTo(map.current)
    layers.current['risk'] = geojson
  }, [riskZones])

  // Hospitals
  useEffect(() => {
    if (!map.current) return
    if (layers.current['hospitals']) map.current.removeLayer(layers.current['hospitals'])
    if (!hospitals.length) return

    const group = L.layerGroup()
    hospitals.forEach(h => {
      if (!h.lat || !h.lon) return
      const color = h.risk_level === 'high' ? 'var(--alert)' : h.risk_level === 'medium' ? 'var(--acting)' : 'var(--decided)'
      const icon = createIcon(color, 'hospital')
      L.marker([h.lat, h.lon], { icon })
        .bindPopup(`
          <div style="font-family: Georgia, serif; min-width: 200px;">
            <div style="font-weight: bold; color: var(--ink); margin-bottom: 8px;">${h.name}</div>
            <div style="display: flex; gap: 8px; margin-bottom: 4px;">
              <span style="color: var(--idle); font-size: 12px;">Type:</span>
              <span style="color: var(--ink); font-size: 12px;">Hospital</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <span style="color: var(--idle); font-size: 12px;">Risk:</span>
              <span style="color: ${color}; font-size: 12px; font-weight: 600;">${h.risk_level.toUpperCase()}</span>
            </div>
          </div>
        `)
        .addTo(group)
    })
    group.addTo(map.current)
    layers.current['hospitals'] = group
  }, [hospitals])

  // Schools
  useEffect(() => {
    if (!map.current) return
    if (layers.current['schools']) map.current.removeLayer(layers.current['schools'])
    if (!schools.length) return

    const group = L.layerGroup()
    schools.forEach(s => {
      if (!s.lat || !s.lon) return
      const color = s.risk_level === 'high' ? 'var(--alert)' : s.risk_level === 'medium' ? 'var(--acting)' : 'var(--decided)'
      const icon = createIcon(color, 'school')
      L.marker([s.lat, s.lon], { icon })
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
        .addTo(group)
    })
    group.addTo(map.current)
    layers.current['schools'] = group
  }, [schools])

  // Rivers / water features
  useEffect(() => {
    if (!map.current) return
    if (layers.current['rivers']) map.current.removeLayer(layers.current['rivers'])
    if (!rivers?.length) return

    const group = L.layerGroup()
    rivers.forEach((river: any) => {
      const coords = river.coordinates
      const name = river.name || 'Water'
      const type = river.type || 'water'

      if (Array.isArray(coords) && coords.length >= 2) {
        const color = type === 'river' ? '#2563eb' : '#3b82f6'
        const weight = type === 'river' ? 5 : 3
        L.polyline(coords, {
          color,
          weight,
          opacity: 0.95,
        })
        .bindPopup(`
          <div style="font-family: Georgia, serif;">
            <div style="font-weight: bold; color: var(--ink);">${name}</div>
            <div style="color: var(--idle); font-size: 12px;">${type}</div>
          </div>
        `)
        .addTo(group)
        return
      }

      const geom = river.geometry || {}
      const geomType = geom.type
      const geomCoords = geom.coordinates || []

      if (geomType === 'LineString' && Array.isArray(geomCoords) && geomCoords.length >= 2) {
        L.polyline(geomCoords, {
          color: '#2563eb',
          weight: 5,
          opacity: 0.95,
        })
        .bindPopup(`
          <div style="font-family: Georgia, serif;">
            <div style="font-weight: bold; color: var(--ink);">${name}</div>
            <div style="color: var(--idle); font-size: 12px;">river</div>
          </div>
        `)
        .addTo(group)
        return
      }

      if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
        L.geoJSON(geom, {
          style: {
            color: '#2563eb',
            weight: 3,
            opacity: 0.85,
            fillColor: '#93c5fd',
            fillOpacity: 0.45,
          },
        })
        .bindPopup(`
          <div style="font-family: Georgia, serif;">
            <div style="font-weight: bold; color: var(--ink);">${name}</div>
            <div style="color: var(--idle); font-size: 12px;">${type}</div>
          </div>
        `)
        .addTo(group)
        return
      }

      const lat = river.lat || river.center_lat || geomCoords[0]?.[1]
      const lon = river.lon || river.center_lon || geomCoords[0]?.[0]
      if (typeof lat !== 'number' || typeof lon !== 'number') return

      L.circleMarker([lat, lon], {
        radius: 7,
        color: '#1e40af',
        fillColor: '#3b82f6',
        fillOpacity: 0.9,
        weight: 2,
      })
        .bindPopup(`
          <div style="font-family: Georgia, serif;">
            <div style="font-weight: bold; color: var(--ink);">${name}</div>
            <div style="color: var(--idle); font-size: 12px;">${type}</div>
          </div>
        `)
        .addTo(group)
    })

    group.addTo(map.current)
    layers.current['rivers'] = group
  }, [rivers])

  // DEM heatmap overlay
  useEffect(() => {
    if (!map.current || !demData) return
    if (layers.current['dem']) map.current.removeLayer(layers.current['dem'])

    // Simple DEM visualization using colored circles
    const group = L.layerGroup()
    const grid = demData.grid
    const metadata = demData.metadata
    const gridSize = metadata.grid_size
    
    const latStep = (metadata.bounds.north - metadata.bounds.south) / gridSize
    const lonStep = (metadata.bounds.east - metadata.bounds.west) / gridSize

    // Sample every 5th cell to avoid too many markers
    for (let y = 0; y < gridSize; y += 5) {
      for (let x = 0; x < gridSize; x += 5) {
        const elev = grid[y][x]
        const lat = metadata.bounds.south + y * latStep
        const lon = metadata.bounds.west + x * lonStep
        
        // Color based on elevation relative to base
        const base = metadata.base_elevation
        const variation = metadata.elevation_range.max - metadata.elevation_range.min
        const ratio = (elev - metadata.elevation_range.min) / variation
        
        // Red = low, Green = high
        const r = Math.round(255 * (1 - ratio))
        const g = Math.round(200 * ratio)
        const b = 50
        
        L.circleMarker([lat, lon], {
          radius: 8,
          fillColor: `rgb(${r}, ${g}, ${b})`,
          fillOpacity: 0.4,
          stroke: false,
        })
          .bindPopup(`
            <div style="font-family: Georgia, serif;">
              <div style="font-weight: bold; color: var(--ink);">Elevation</div>
              <div style="color: var(--thinking); font-size: 14px; font-weight: 600;">${elev.toFixed(1)}m</div>
            </div>
          `)
          .addTo(group)
      }
    }
    
    group.addTo(map.current)
    layers.current['dem'] = group
  }, [demData])

  // City markers
  useEffect(() => {
    if (!map.current || !cities?.length) return
    if (layers.current['cities']) {
      map.current.removeLayer(layers.current['cities'])
      layers.current['cities'] = undefined as any
    }

    const group = L.layerGroup()
    cities.forEach(city => {
      const marker = L.marker([city.lat, city.lon], {
        icon: createCityIcon(city),
        title: city.name,
      })

      marker.bindPopup(
        `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 160px;">
          <div style="font-weight: 700; color: var(--ink); margin-bottom: 6px;">${city.name}</div>
          <div style="color: var(--idle); font-size: 12px;">${city.elevation_m}m elevation · ${city.hospital_count} hospitals</div>
          <div style="color: var(--thinking); font-size: 12px; margin-top: 6px;">Click to view 3D DEM</div>
        </div>`,
        { closeButton: false }
      )

      marker.on('click', () => {
        onCityClick?.(city)
      })

      marker.addTo(group)
    })

    group.addTo(map.current)
    layers.current['cities'] = group
  }, [cities, onCityClick])

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Weather animation overlay */}
      <WeatherAnimation
        type={weatherType}
        intensity={weatherIntensity}
        active={showWeather}
      />
    </div>
  )
}