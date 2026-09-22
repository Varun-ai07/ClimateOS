import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface DemData {
  metadata: {
    city: string
    center: { lat: number; lon: number }
    base_elevation: number
    grid_size: number
    bounds: { south: number; north: number; west: number; east: number }
    elevation_range: { min: number; max: number; mean: number }
    features?: Record<string, any>
  }
  grid: number[][]
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

interface FeatureProps {
  name?: string
  lat?: number
  lon?: number
  risk_level?: string
  type?: string
  geometry?: any
}

interface Props {
  cities: City[]
  defaultCityKey?: string
  mode?: 'plain' | 'marked' | 'disaster'
  onBack?: () => void
}

function elevColor(t: number) {
  t = Math.max(0, Math.min(1, t))
  const r = Math.round(60 + 160 * t)
  const g = Math.round(140 - 80 * t)
  const b = Math.round(180 - 140 * t)
  return `rgb(${r}, ${g}, ${b})`
}

function shade(hex: string, amount: number) {
  const num = parseInt(hex.replace('#', ''), 16)
  let r = (num >> 16) + amount
  let g = ((num >> 8) & 0x00ff) + amount
  let b = (num & 0x0000ff) + amount
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return `rgb(${r}, ${g}, ${b})`
}

function riskGlow(risk?: string) {
  if (risk === 'high' || risk === 'very_high') return 'var(--alert)'
  if (risk === 'medium') return 'var(--acting)'
  return 'var(--decided)'
}

function projectBox(
  cx: number,
  cy: number,
  fov: number,
  x: number,
  z: number,
  h: number,
  w: number,
  d: number,
  rx: number,
  ry: number
) {
  const cosX = Math.cos(rx)
  const sinX = Math.sin(rx)
  const cosY = Math.cos(ry)
  const sinY = Math.sin(ry)

  const corners = [
    { x: x - w, z: z - d },
    { x: x + w, z: z - d },
    { x: x + w, z: z + d },
    { x: x - w, z: z + d },
  ]

  const toScreen = (px: number, pz: number, py: number) => {
    const x1 = px * cosY - pz * sinY
    const z1 = pz * cosY + px * sinY
    const y1 = py * cosX - z1 * sinX
    const z2 = z1 * cosX + py * sinX
    const scale = fov / (fov + z2)
    return { x: cx + x1 * scale, y: cy - y1 * scale, z: z2 }
  }

  const base = corners.map(c => toScreen(c.x, c.z, 0))
  const top = corners.map(c => toScreen(c.x, c.z, h))
  return { base, top }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  fill: string,
  stroke: string = 'rgba(0,0,0,0.25)'
) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawBox3D(
  ctx: CanvasRenderingContext2D,
  base: { x: number; y: number }[],
  top: { x: number; y: number }[],
  face: string,
  shadeColor: string
) {
  drawFace(ctx, [base[1], base[2], top[1], top[2]], shadeColor, 'rgba(0,0,0,0.35)')
  drawFace(ctx, [base[2], base[3], top[2], top[3]], shadeColor, 'rgba(0,0,0,0.25)')
  drawFace(ctx, top, '#ffffff1a')
  drawFace(ctx, [base[0], base[1], base[2], base[3]], shade(face, -10), 'rgba(0,0,0,0.4)')
  drawFace(ctx, [base[0], base[3], top[2], top[1]], face)
  drawFace(ctx, [base[0], base[1], top[1], top[0]], shade(face, 8), 'rgba(0,0,0,0.2)')
}

function projectToScreen(cx: number, cy: number, fov: number, x: number, z: number, h: number, rx: number, ry: number) {
  const cosX = Math.cos(rx)
  const sinX = Math.sin(rx)
  const cosY = Math.cos(ry)
  const sinY = Math.sin(ry)
  const x1 = x * cosY - z * sinY
  const z1 = z * cosY + x * sinY
  const y1 = h * cosX - z1 * sinX
  const z2 = z1 * cosX + h * sinX
  const scale = fov / (fov + z2)
  return { x: cx + x1 * scale, y: cy - y1 * scale }
}

function deriveWaterChannels(features: FeatureProps[], bounds: { north: number; south: number; west: number; east: number }, N: number) {
  const channels: { startJ: number; startI: number; endJ: number; endI: number }[] = []
  const latStep = (bounds.north - bounds.south) / N
  const lonStep = (bounds.east - bounds.west) / N

  for (const f of features) {
    const geom = f.geometry || {}
    if (!geom.type || !geom.coordinates) continue
    const coords = geom.coordinates

    const ring = (polygonCoords: number[][]) => {
      if (!Array.isArray(polygonCoords) || polygonCoords.length < 2) return
      const toIndex = (idx: number) => {
        const [lon, lat] = polygonCoords[idx]
        const j = Math.round((lon - bounds.west) / lonStep)
        const i = Math.round((bounds.north - lat) / latStep)
        return { j, i }
      }
      const a = toIndex(0)
      const b = toIndex(Math.floor(polygonCoords.length / 2))
      const c = toIndex(polygonCoords.length - 1)
      channels.push({ startJ: a.j, startI: a.i, endJ: b.j, endI: b.i })
      channels.push({ startJ: b.j, startI: b.i, endJ: c.j, endI: c.i })
    }

    if (geom.type === 'Polygon') {
      for (const ringCoords of coords) ring(ringCoords)
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of coords) {
        for (const ringCoords of polygon) ring(ringCoords)
      }
    }
  }
  return channels
}

function generateBuildingFootprints(demData: DemData | null, waterData: any, hospitals: FeatureProps[], schools: FeatureProps[]): FeatureProps[] {
  if (!demData) return []
  const features: FeatureProps[] = []
  const bounds = demData.metadata.bounds
  const N = demData.metadata.grid_size
  const latStep = (bounds.north - bounds.south) / N
  const lonStep = (bounds.east - bounds.west) / N

  const used = new Set<string>()
  const add = (lat: number, lon: number, kind: 'building' | 'hospital' | 'school', risk_level?: string) => {
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
    if (used.has(key)) return
    used.add(key)
    features.push({ lat, lon, type: kind, risk_level: risk_level || 'medium' })
  }

  const seeds = [
    ...hospitals.map(h => ({ lat: h.lat, lon: h.lon, risk: h.risk_level, kind: 'hospital' as const })),
    ...schools.map(s => ({ lat: s.lat, lon: s.lon, risk: s.risk_level, kind: 'school' as const })),
    ...((waterData?.features || []).slice(0, 8).map((w: any) => {
      const geom = w.geometry || {}
      const coords = geom.coordinates || []
      const first = Array.isArray(coords[0]) ? coords[0][0] : Array.isArray(coords[0]) ? coords[0] : []
      return { lat: first[1], lon: first[0], risk: 'high' as const, kind: 'building' as const }
    })),
  ]

  for (const s of seeds) {
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') continue
    add(s.lat, s.lon, s.kind, s.risk)
    for (let k = 0; k < 6; k++) {
      const lat = s.lat + (Math.random() - 0.5) * 0.012
      const lon = s.lon + (Math.random() - 0.5) * 0.012
      const i = Math.round((bounds.north - lat) / latStep)
      const j = Math.round((lon - bounds.west) / lonStep)
      const elev = (demData.grid[i] && demData.grid[i][j]) ?? demData.metadata.base_elevation
      add(lat, lon, 'building', elev < demData.metadata.base_elevation - demData.metadata.elevation_range.max * 0.1 ? 'high' : 'medium')
    }
  }

  return features
}

export default function Dem3DView({ cities, defaultCityKey, mode = 'plain', onBack }: Props) {
  const [cityKey, setCityKey] = useState<string>(defaultCityKey || cities[0]?.key || 'coimbatore')
  const [dem, setDem] = useState<DemData | null>(null)
  const [water, setWater] = useState<FeatureProps[]>([])
  const [hospitals, setHospitals] = useState<FeatureProps[]>([])
  const [schools, setSchools] = useState<FeatureProps[]>([])
  const [buildings, setBuildings] = useState<FeatureProps[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotRef = useRef({ x: 0.9, y: -0.7 })
  const draggingRef = useRef(false)
  const lastRef = useRef({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDem(null)
    setWater([])
    setHospitals([])
    setSchools([])
    setBuildings([])

    const promises: Promise<any>[] = [
      fetch(`/api/dem/${cityKey}`).then(res => res.json()),
    ]

    if (mode === 'marked' || mode === 'disaster') {
      promises.push(
        fetch(`/api/processed/${cityKey}/water.geojson`).then(res => res.json()).catch(() => ({ features: [] })),
        fetch(`/api/processed/${cityKey}/hospitals.geojson`).then(res => res.json()).catch(() => ({ features: [] })),
        fetch(`/api/processed/${cityKey}/schools.geojson`).then(res => res.json()).catch(() => ({ features: [] }))
      )
    }

    Promise.all(promises)
      .then((results) => {
        if (cancelled) return
        const demData = results[0]
        if (demData.error) throw new Error(demData.error)
        setDem(demData)

        if (mode === 'marked' || mode === 'disaster') {
          const waterData = results[1] || { features: [] }
          const hosData = results[2] || { features: [] }
          const schData = results[3] || { features: [] }
          setWater(waterData.features || [])
          setHospitals(hosData.features || [])
          setSchools(schData.features || [])
          setBuildings(generateBuildingFootprints(demData, waterData, hosData.features || [], schData.features || []))
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [cityKey, mode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let width = 0
    let height = 0

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      const newWidth = Math.floor(rect.width * dpr)
      const newHeight = Math.floor(rect.height * dpr)
      if (newWidth !== width || newHeight !== height) {
        width = newWidth
        height = newHeight
        canvas.width = width
        canvas.height = height
      }

      ctx.clearRect(0, 0, width, height)

      if (!dem) {
        raf = requestAnimationFrame(draw)
        return
      }

      const N = dem.metadata.grid_size
      const grid = dem.grid
      const meta = dem.metadata
      const min = meta.elevation_range.min
      const max = meta.elevation_range.max
      const range = max - min || 1
      const cx = width / 2
      const cy = height / 2
      const fov = 700
      const spacing = 14

      const rx = rotRef.current.x
      const ry = rotRef.current.y
      const cosX = Math.cos(rx)
      const sinX = Math.sin(rx)
      const cosY = Math.cos(ry)
      const sinY = Math.sin(ry)

      const verts: { sx: number; sy: number; depth: number; elev: number }[][] =
        Array.from({ length: N }, (_, i) =>
          Array.from({ length: N }, (_, j) => {
            const x = (j - N / 2) * spacing
            const z = (i - N / 2) * spacing
            const raw = grid[i] && grid[i][j] !== undefined ? grid[i][j] : meta.base_elevation
            const y = ((raw - min) / range) * 220

            const x1 = x * cosY - z * sinY
            const z1 = z * cosY + x * sinY
            const y1 = y * cosX - z1 * sinX
            const z2 = z1 * cosX + y * sinX

            const scale = fov / (fov + z2)
            return { sx: cx + x1 * scale, sy: cy - y1 * scale, depth: z2, elev: raw }
          })
        )

      const quads: { v: { sx: number; sy: number; depth: number; elev: number }[]; avgDepth: number; avgElev: number }[] = []
      for (let i = 0; i < N - 1; i++) {
        for (let j = 0; j < N - 1; j++) {
          const v0 = verts[i][j]
          const v1 = verts[i][j + 1]
          const v2 = verts[i + 1][j + 1]
          const v3 = verts[i + 1][j]
          quads.push({ v: [v0, v1, v2, v3], avgDepth: (v0.depth + v1.depth + v2.depth + v3.depth) / 4, avgElev: (v0.elev + v1.elev + v2.elev + v3.elev) / 4 })
        }
      }

      quads.sort((a, b) => b.avgDepth - a.avgDepth)

      ctx.lineWidth = 1
      for (const q of quads) {
        const t = (q.avgElev - min) / range
        ctx.beginPath()
        ctx.moveTo(q.v[0].sx, q.v[0].sy)
        ctx.lineTo(q.v[1].sx, q.v[1].sy)
        ctx.lineTo(q.v[2].sx, q.v[2].sy)
        ctx.lineTo(q.v[3].sx, q.v[3].sy)
        ctx.closePath()
        ctx.fillStyle = mode === 'plain' ? elevColor(t) : elevColor(t)
        ctx.fill()
        ctx.strokeStyle = mode === 'plain' ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.18)'
        ctx.stroke()
      }

      // MARKED MODE: colored 3D indicator pillars + labels
      if (mode === 'marked') {
        const markers = [
          ...hospitals.map(h => ({ lat: h.lat, lon: h.lon, kind: 'hospital' as const, risk_level: h.risk_level })),
          ...schools.map(s => ({ lat: s.lat, lon: s.lon, kind: 'school' as const, risk_level: s.risk_level })),
          ...water.slice(0, 12).map(w => {
            const lat = w.lat || w.geometry?.coordinates?.[0]?.[1] || w.geometry?.coordinates?.[0]?.[0]?.[1]
            const lon = w.lon || w.geometry?.coordinates?.[0]?.[0] || w.geometry?.coordinates?.[0]?.[0]?.[0]
            return { lat, lon, kind: 'water' as const, risk_level: 'medium' }
          }),
        ]

        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (const m of markers) {
          if (typeof m.lat !== 'number' || typeof m.lon !== 'number') continue
          const i = Math.round((meta.bounds.north - m.lat) / ((meta.bounds.north - meta.bounds.south) / N))
          const j = Math.round((m.lon - meta.bounds.west) / ((meta.bounds.east - meta.bounds.west) / N))
          if (i < 0 || i >= N || j < 0 || j >= N) continue
          const v = verts[i] && verts[i][j] ? verts[i][j] : null
          if (!v) continue

          const h = m.kind === 'hospital' ? 50 : m.kind === 'school' ? 42 : 34
          const w = 6
          const d = 6
          const x = (j - N / 2) * 14
          const z = (i - N / 2) * 14
          const color = m.kind === 'hospital' ? '#8B3A3A' : m.kind === 'school' ? '#735448' : '#2563eb'

          const pillar = projectBox(cx, cy, fov, x, z, h, w, d, rx, ry)
          if (pillar) {
            drawBox3D(ctx, pillar.base, pillar.top, color, shade(color, 25))
            ctx.beginPath()
            ctx.arc(pillar.top[2].x, pillar.top[2].y, 4, 0, Math.PI * 2)
            ctx.fillStyle = riskGlow(m.risk_level)
            ctx.fill()
          }

          const symbol = m.kind === 'hospital' ? 'H' : m.kind === 'school' ? 'S' : 'W'
          ctx.fillStyle = 'var(--ink)'
          ctx.fillText(symbol, v.sx, v.sy - h * 0.6)
        }
        ctx.textAlign = 'start'
      }

      // DISASTER MODE: exaggerated 3D hazard structures
      if (mode === 'disaster') {
        const infra = [
          ...hospitals.map(h => ({ lat: h.lat, lon: h.lon, kind: 'hospital' as const, risk_level: h.risk_level })),
          ...schools.map(s => ({ lat: s.lat, lon: s.lon, kind: 'school' as const, risk_level: s.risk_level })),
          ...buildings.map(b => ({ lat: b.lat, lon: b.lon, kind: 'building' as const, risk_level: b.risk_level })),
        ]
        const infraSpacing = 20
        for (const item of infra) {
          const lat = item.lat
          const lon = item.lon
          if (!lat || !lon) continue
          const i = Math.round((meta.bounds.north - lat) / ((meta.bounds.north - meta.bounds.south) / N))
          const j = Math.round((lon - meta.bounds.west) / ((meta.bounds.east - meta.bounds.west) / N))
          if (i < 0 || i >= N || j < 0 || j >= N) continue
          const v = verts[i][j]
          if (!v) continue
          const kind = item.kind
          const color = kind === 'hospital' ? '#8B3A3A' : '#735448'
          const baseH = kind === 'hospital' ? 22 : kind === 'school' ? 16 : 10
          const w = kind === 'hospital' ? 18 : kind === 'school' ? 20 : 12
          const d = kind === 'hospital' ? 18 : kind === 'school' ? 16 : 12
          const x = (j - N / 2) * infraSpacing
          const z = (i - N / 2) * infraSpacing

          const mainBox = projectBox(cx, cy, fov, x, z, baseH + 28, w, d, rx, ry)
          if (mainBox) drawBox3D(ctx, mainBox.base, mainBox.top, color, shade(color, 25))

          const roofBox = projectBox(cx, cy, fov, x, z, baseH + 40, w * 0.8, d * 0.8, rx, ry)
          if (roofBox) drawBox3D(ctx, roofBox.base, roofBox.top, '#8B3A3A', shade('#8B3A3A', 20))

          const ringCenter = projectToScreen(cx, cy, fov, x, z, baseH + 22, rx, ry)
          ctx.beginPath()
          ctx.arc(ringCenter.x, ringCenter.y, 6, 0, Math.PI * 2)
          ctx.fillStyle = riskGlow(item.risk_level)
          ctx.fill()
        }

        // flood-influenced water sheets
        ctx.globalAlpha = 0.85
        const waterBodies = water.slice(0, 12)
        for (const f of waterBodies) {
          const geom = f.geometry || {}
          const coords = geom.coordinates
          if (!coords || !coords.length) continue
          const first = coords[0]
          const lon0 = first?.[0]?.[0] ?? first?.[0]
          const lat0 = first?.[0]?.[1] ?? first?.[1]
          if (typeof lon0 !== 'number' || typeof lat0 !== 'number') continue
          const i = Math.round((meta.bounds.north - lat0) / ((meta.bounds.north - meta.bounds.south) / N))
          const j = Math.round((lon0 - meta.bounds.west) / ((meta.bounds.east - meta.bounds.west) / N))
          if (i < 0 || i >= N || j < 0 || j >= N) continue
          const x = (j - N / 2) * infraSpacing
          const z = (i - N / 2) * infraSpacing

          const wplat = projectBox(cx, cy, fov, x, z, 9, 28, 24, rx, ry)
          if (wplat) drawBox3D(ctx, wplat.base, wplat.top, '#2563eb', '#93c5fd')
          const channel = projectBox(cx, cy, fov, x, z - 18, 16, 9, 36, rx, ry)
          if (channel) drawBox3D(ctx, channel.base, channel.top, '#1d4ed8', '#60a5fa')
        }
        ctx.globalAlpha = 1

        // road strips
        const roadPoints = waterBodies.length ? waterBodies.slice(0, 6) : buildings.slice(0, 6)
        for (const item of roadPoints) {
          const lat = item.lat
          const lon = item.lon
          if (typeof lat !== 'number' || typeof lon !== 'number') continue
          const i = Math.round((meta.bounds.north - lat) / ((meta.bounds.north - meta.bounds.south) / N))
          const j = Math.round((lon - meta.bounds.west) / ((meta.bounds.east - meta.bounds.west) / N))
          if (i < 0 || i >= N || j < 0 || j >= N) continue
          const x = (j - N / 2) * infraSpacing
          const z = (i - N / 2) * infraSpacing

          const road = projectBox(cx, cy, fov, x, z + 26, 3, 6, 30, rx, ry)
          if (!road) continue
          ctx.beginPath()
          ctx.moveTo(road.base[0].x, road.base[0].y)
          ctx.lineTo(road.base[1].x, road.base[1].y)
          ctx.lineTo(road.base[2].x, road.base[2].y)
          ctx.lineTo(road.base[3].x, road.base[3].y)
          ctx.closePath()
          ctx.fillStyle = 'var(--idle)'
          ctx.fill()
          ctx.strokeStyle = 'var(--ink)'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
      ctx.fillText('drag to rotate', 18, 48)

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [dem, water, hospitals, schools, buildings, mode, cityKey])

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = true
    lastRef.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return
    const dx = e.clientX - lastRef.current.x
    const dy = e.clientY - lastRef.current.y
    rotRef.current = {
      x: Math.max(-1.4, Math.min(1.4, rotRef.current.x + dy * 0.008)),
      y: rotRef.current.y + dx * 0.008,
    }
    lastRef.current = { x: e.clientX, y: e.clientY }
  }
  const endDrag = () => {
    draggingRef.current = false
    setDragging(false)
  }

  const city = cities.find(c => c.key === cityKey)

  return (
    <div className="h-screen bg-white flex flex-col">
      <header className="h-16 border-b border-black/10 flex items-center justify-between px-6 shrink-0">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">
            {mode === 'plain' ? 'Delta Elevation Model' : mode === 'marked' ? '3D DEM + Markers' : 'Disaster View'}
          </h1>
          <p className="text-xs text-idle">
            {mode === 'plain' ? '3D terrain view • drag to rotate' : mode === 'marked' ? 'terrain + indicators' : 'terrain • buildings • rivers • roads'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-lg text-sm font-semibold border border-primary/30 bg-white hover:bg-neutral-light transition-colors"
          >
            Back
          </button>

          <select
            value={cityKey}
            onChange={e => setCityKey(e.target.value)}
            className="h-9 rounded-lg border border-black/10 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {cities.map(c => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
          <div className="text-xs text-idle">
            {dem && (
              <>
                Base: {dem.metadata.base_elevation}m | Range: {dem.metadata.elevation_range.min.toFixed(0)}-{dem.metadata.elevation_range.max.toFixed(0)}m
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <div className="text-sm text-idle">Loading…</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-sm text-alert">Failed: {error}</div>
          </div>
        )}
        {!loading && !error && !dem && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-sm text-idle">No terrain data available.</div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        />

        <motion.div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm border border-black/10 rounded-lg p-3 shadow-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="text-xs font-semibold mb-2">Legend</div>
          <div className="space-y-1.5">
            {mode !== 'plain' && <>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-alert" /><span className="text-xs text-text">Hospital</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[var(--thinking)]" /><span className="text-xs text-text">School</span></div>
            </>}
            {mode === 'disaster' && <>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[var(--thinking)]" /><span className="text-xs text-text">Building</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-alert" /><span className="text-xs text-text">High risk indicator</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-1 bg-[#2563eb]" /><span className="text-xs text-text">River</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-1 bg-[var(--idle)]" /><span className="text-xs text-text">Road</span></div>
            </>}
            {mode === 'marked' && <>
              <div className="flex items-center gap-2"><span className="text-xs">💧</span><span className="text-xs text-text">Water</span></div>
            </>}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
