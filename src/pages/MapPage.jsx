import { useState, useMemo, useRef, useCallback } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import {
  Zap, MapPin, X, Clock, Home, CheckCircle, AlertTriangle,
  TrendingUp, BarChart3, Activity, SlidersHorizontal,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SeverityBadge } from '../components/ui/SeverityBadge'
import { timeAgo } from '../utils/formatters'
import ghanaRegions from '../data/ghana-regions.json'
import lakeVoltaFeature from '../data/lake-volta.json'

// Lake Volta label — positioned inside the main body of the lake
const LAKE_LABEL_COORDS = [0.10, 7.55]

// Capital city coordinates [lng, lat] for each of Ghana's 16 regions
const REGION_CAPITALS = {
  'Greater Accra': [-0.20,  5.56],
  'Ashanti':       [-1.62,  6.69],
  'Central':       [-1.24,  5.11],
  'Eastern':       [-0.26,  6.09],
  'Western':       [-1.75,  4.93],
  'Western North': [-2.50,  6.20],
  'Bono':          [-2.33,  7.34],
  'Bono East':     [-1.91,  7.44],
  'Ahafo':         [-2.53,  6.95],
  'Volta':         [ 0.47,  6.60],
  'Oti':           [ 0.24,  8.10],
  'Northern':      [-0.84,  9.40],
  'Savannah':      [-1.82,  9.08],
  'North East':    [-0.37, 10.39],
  'Upper East':    [-0.85, 10.79],
  'Upper West':    [-2.50, 10.06],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pinColor(outage) {
  if (outage.status === 'active') {
    return (outage.severity === 'critical' || outage.severity === 'high') ? '#ef4444' : '#FFB000'
  }
  if (outage.status === 'resolved') return '#22c55e'
  return '#3b82f6'
}

function pinType(outage) {
  if (outage.status === 'active') {
    return (outage.severity === 'critical' || outage.severity === 'high') ? 'Full Outage' : 'Partial Outage'
  }
  if (outage.status === 'resolved') return 'Power Available'
  return 'Scheduled'
}

function getPinCoords(outage) {
  const base = REGION_CAPITALS[outage.region] || [-1.03, 7.95]
  const hash = String(outage.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return [
    base[0] + (hash % 11 - 5) * 0.06,
    base[1] + (hash % 7  - 3) * 0.045,
  ]
}

function parseDurationHours(str) {
  if (!str || str === 'Unknown' || str === 'Just started') return null
  let h = 0
  const d  = str.match(/(\d+)d/)
  const hr = str.match(/(\d+)h/)
  const mi = str.match(/(\d+)\s*m(?:ins?)?(?!\s*h)/i)
  if (d)  h += parseInt(d[1]) * 24
  if (hr) h += parseInt(hr[1])
  if (mi) h += parseInt(mi[1]) / 60
  return h > 0 ? h : null
}

function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
}

const abbrev = r => r
  .replace('Greater Accra', 'Gr. Accra')
  .replace('Western North', 'W. North')
  .replace('Bono East',     'Bono E.')
  .replace('North East',    'N. East')
  .replace('Upper East',    'U. East')
  .replace('Upper West',    'U. West')

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2.5 rounded-xl text-xs border" style={{
      background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)',
    }}>
      {label && <p className="mb-1.5 font-semibold" style={{ color: 'var(--text-2)' }}>{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span style={{ color: 'var(--text-3)' }}>{p.name}:</span>
          <span className="font-bold" style={{ color: 'var(--text-1)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function ChartEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-[190px] gap-2" style={{ color: 'var(--text-3)' }}>
      <Activity className="w-7 h-7 opacity-20" />
      <p className="text-xs text-center opacity-70">No outage data available yet</p>
    </div>
  )
}

function MiniStat({ label, value, sub, icon: Icon, color, pulse }) {
  return (
    <div className="rounded-xl border p-3.5 card-hover" style={{
      background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)',
    }}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{
          background: `${color}18`, border: `1px solid ${color}28`,
        }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        {pulse && <span className="w-2 h-2 mt-0.5 rounded-full status-live flex-shrink-0" style={{ background: color }} />}
      </div>
      <div className="stat-number text-2xl font-extrabold leading-none mb-1" style={{ color }}>{value}</div>
      <div className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{label}</div>
      {sub && <div className="text-xs mt-0.5 opacity-70" style={{ color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MapPage({ outages }) {
  const [selected, setSelected]           = useState(null)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [filter, setFilter]               = useState('all')
  const [hoveredRegion, setHoveredRegion] = useState(null)
  const [mousePos, setMousePos]           = useState({ x: 0, y: 0 })
  const mapCanvasRef                      = useRef(null)

  const handleRegionClick = useCallback((regionName) => {
    setSelectedRegion(prev => prev === regionName ? null : regionName)
    setSelected(null)
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!mapCanvasRef.current) return
    const rect = mapCanvasRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  // Filtered outages for the map
  const filtered = useMemo(() => {
    if (filter === 'all')     return outages
    if (filter === 'full')    return outages.filter(o =>
      o.status === 'active' && (o.severity === 'critical' || o.severity === 'high')
    )
    if (filter === 'partial') return outages.filter(o =>
      o.status === 'active' && (o.severity === 'medium' || o.severity === 'low')
    )
    return outages.filter(o => o.status === filter)
  }, [outages, filter])

  // Per-region stats for tooltip + fill tinting
  const regionStats = useMemo(() => {
    const s = {}
    outages.forEach(o => {
      if (!s[o.region]) s[o.region] = { active: 0, resolved: 0, total: 0 }
      s[o.region].total++
      if (o.status === 'active')   s[o.region].active++
      if (o.status === 'resolved') s[o.region].resolved++
    })
    return s
  }, [outages])

  // Analytics
  const today             = new Date().toDateString()
  const reportsToday      = useMemo(() => outages.filter(o => new Date(o.timestamp).toDateString() === today).length, [outages, today])
  const affectedAreas     = useMemo(() => new Set(outages.filter(o => o.status === 'active').map(o => o.region)).size, [outages])
  const restorationsToday = useMemo(() => outages.filter(o => o.status === 'resolved' && new Date(o.timestamp).toDateString() === today).length, [outages, today])

  const avgDuration = useMemo(() => {
    const resolved = outages.filter(o => o.status === 'resolved')
    const hours = resolved.map(o => parseDurationHours(o.duration)).filter(Boolean)
    if (!hours.length) return '—'
    const avg = hours.reduce((s, h) => s + h, 0) / hours.length
    return avg < 1 ? `${Math.round(avg * 60)}m` : `${avg.toFixed(1)}h`
  }, [outages])

  // Chart data
  const trendData = useMemo(() => last7Days().map(iso => {
    const day = outages.filter(o => (o.timestamp || '').startsWith(iso))
    return {
      day:      new Date(iso + 'T12:00:00').toLocaleDateString('en-GH', { weekday: 'short' }),
      outages:  day.length,
      resolved: day.filter(o => o.status === 'resolved').length,
    }
  }), [outages])

  const hasChartData = useMemo(() => trendData.some(d => d.outages > 0), [trendData])

  const regionData = useMemo(() => {
    const counts = outages.reduce((acc, o) => { acc[o.region] = (acc[o.region] || 0) + 1; return acc }, {})
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([r, count]) => ({ region: abbrev(r), count }))
  }, [outages])

  const restorationData = useMemo(() => [
    { name: 'Resolved',  value: outages.filter(o => o.status === 'resolved').length,  color: '#22c55e' },
    { name: 'Active',    value: outages.filter(o => o.status === 'active').length,    color: '#ef4444' },
    { name: 'Scheduled', value: outages.filter(o => o.status === 'scheduled').length, color: '#3b82f6' },
  ].filter(d => d.value > 0), [outages])

  const donutTotal   = restorationData.reduce((s, d) => s + d.value, 0) || 1
  const resolvedRate = Math.round((outages.filter(o => o.status === 'resolved').length / (outages.length || 1)) * 100)
  const BAR_COLORS   = ['#FFB000','#ef4444','#22c55e','#3b82f6','#8b5cf6','#f97316','#06b6d4']

  // d3-geo projection (static — no deps)
  const projection = useMemo(() =>
    geoMercator().center([-1.035, 7.955]).scale(5200).translate([250, 310])
  , [])

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection])

  // Sort filtered so selected pin renders on top in SVG order
  const sortedFiltered = useMemo(() => [...filtered].sort((a, b) => {
    if (a.id === selected?.id) return 1
    if (b.id === selected?.id) return -1
    return 0
  }), [filtered, selected])

  // Region fill based on outage status + hover
  const getRegionFill = useCallback((regionName) => {
    if (hoveredRegion === regionName) return 'rgba(255,176,0,0.28)'
    const stats = regionStats[regionName]
    if (stats?.active > 0) return 'rgba(239,68,68,0.22)'
    if (stats?.total  > 0) return 'rgba(34,197,94,0.18)'
    return '#162238'
  }, [hoveredRegion, regionStats])

  const getRegionStroke = useCallback((regionName) => (
    hoveredRegion === regionName ? 'rgba(255,176,0,0.90)' : 'rgba(80,150,220,0.65)'
  ), [hoveredRegion])

  return (
    <div style={{ background: 'var(--bg-page)' }} className="min-h-full">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
            <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: '#FFB000' }} />
            Live Map
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Real-time power outage monitoring across all 16 regions of Ghana
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border flex-shrink-0"
          style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)', color: '#22c55e' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-live" />
          Live
        </div>
      </div>

      {/* ── Map + Analytics Row ── */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 sm:p-5">

        {/* ── Map Panel ── */}
        <div
          className="flex-1 rounded-2xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)', minWidth: 0 }}
        >
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-3)' }}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
            </div>
            {[
              { key: 'all',       label: 'All' },
              { key: 'full',      label: '🔴 Full Outage' },
              { key: 'partial',   label: '🟡 Partial' },
              { key: 'resolved',  label: '🟢 Restored' },
              { key: 'scheduled', label: 'Scheduled' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                style={filter === key
                  ? { background: '#FFB000', color: '#0F172A', boxShadow: '0 2px 8px rgba(255,176,0,0.3)' }
                  : { background: 'var(--overlay-sm)', color: 'var(--text-3)', border: '1px solid var(--border)' }
                }
              >
                {label}
              </button>
            ))}
            <div className="hidden xl:flex items-center gap-4 ml-auto">
              {[['#ef4444','Full Outage'],['#FFB000','Partial'],['#22c55e','Restored'],['#3b82f6','Scheduled']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Map Canvas ── */}
          <div
            ref={mapCanvasRef}
            className="relative"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredRegion(null)}
            style={{
              background: 'linear-gradient(150deg, #081528 0%, #0d2040 55%, #081528 100%)',
            }}
          >
            <svg
              viewBox="0 0 500 620"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              aria-label="Ghana power outage map"
            >
              {/* ── 16 Ghana regions (real GADM boundaries via d3-geo) ── */}
              {ghanaRegions.features.map(feature => {
                const regionName = feature.properties.region
                return (
                  <path
                    key={regionName}
                    d={pathGenerator(feature)}
                    fill={getRegionFill(regionName)}
                    stroke={getRegionStroke(regionName)}
                    strokeWidth={0.85}
                    strokeLinejoin="round"
                    style={{ cursor: 'crosshair', transition: 'fill 0.14s ease, stroke 0.14s ease', outline: 'none' }}
                    onMouseEnter={() => setHoveredRegion(regionName)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    onClick={() => handleRegionClick(regionName)}
                  />
                )
              })}

              {/* ── Lake Volta water body (real OSM geometry, on top of regions) ── */}
              <path
                d={pathGenerator(lakeVoltaFeature)}
                fill="rgba(4,18,42,0.85)"
                stroke="none"
                style={{ pointerEvents: 'none' }}
              />

              {/* ── Lake Volta label ── */}
              {(() => {
                const [px, py] = projection(LAKE_LABEL_COORDS)
                return (
                  <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    <text x={px} y={py - 4} textAnchor="middle" fontSize={7} fill="#2d6ea0" fontWeight="600">Lake</text>
                    <text x={px} y={py + 5}  textAnchor="middle" fontSize={7} fill="#2d6ea0" fontWeight="600">Volta</text>
                  </g>
                )
              })()}

              {/* ── Region name labels ── */}
              {Object.entries(REGION_CAPITALS).map(([name, coords]) => {
                const [px, py] = projection(coords)
                const isHov = hoveredRegion === name
                return (
                  <text
                    key={name}
                    x={px}
                    y={py + 16}
                    textAnchor="middle"
                    fontSize={isHov ? 7.5 : 6.5}
                    fill={isHov ? '#FFB000' : '#6ea3cc'}
                    fontWeight={isHov ? '700' : '500'}
                    style={{ pointerEvents: 'none', userSelect: 'none', transition: 'fill 0.14s ease' }}
                  >
                    {abbrev(name)}
                  </text>
                )
              })}

              {/* ── Outage pins ── */}
              {sortedFiltered.map(outage => {
                const pt = projection(getPinCoords(outage))
                if (!pt) return null
                const [px, py]   = pt
                const color      = pinColor(outage)
                const isSelected = selected?.id === outage.id
                const isCritical = outage.severity === 'critical'
                const rOuter     = isCritical ? 9 : 7.5
                const rInner     = isCritical ? 5.5 : 4
                return (
                  <g
                    key={outage.id}
                    transform={`translate(${px},${py})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelected(isSelected ? null : outage)}
                    onMouseEnter={() => setHoveredRegion(null)}
                  >
                    {isCritical && <circle r={rOuter + 7} fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" className="pulse-ring" />}
                    {isSelected  && <circle r={rOuter + 5} fill="none" stroke={color} strokeWidth="2" opacity="0.5" />}
                    <circle r={rOuter} fill="#071422" stroke={color} strokeWidth={isCritical ? 2.5 : 2} />
                    <circle r={rInner} fill={color} />
                    {isCritical && <text textAnchor="middle" dy="0.35em" fontSize="9" fontWeight="bold" fill="white" style={{ pointerEvents: 'none', userSelect: 'none' }}>!</text>}
                  </g>
                )
              })}
            </svg>

            {/* ── Region hover tooltip ── */}
            {hoveredRegion && (() => {
              const stats = regionStats[hoveredRegion] || { active: 0, resolved: 0, total: 0 }
              return (
                <div
                  className="absolute z-30 pointer-events-none px-3 py-2.5 rounded-xl border text-xs"
                  style={{
                    left:           mousePos.x,
                    top:            mousePos.y,
                    transform:      'translate(-50%, -115%)',
                    background:     'rgba(4,12,28,0.96)',
                    borderColor:    'rgba(255,176,0,0.38)',
                    backdropFilter: 'blur(12px)',
                    boxShadow:      '0 4px 20px rgba(0,0,0,0.6)',
                    minWidth:       130,
                  }}
                >
                  <div className="font-bold mb-2" style={{ color: '#FFB000', fontSize: 11 }}>{hoveredRegion}</div>
                  <div className="space-y-1" style={{ color: 'var(--text-3)' }}>
                    <div className="flex justify-between gap-4">
                      <span>Active</span>
                      <span className="font-semibold" style={{ color: '#ef4444' }}>{stats.active}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Resolved</span>
                      <span className="font-semibold" style={{ color: '#22c55e' }}>{stats.resolved}</span>
                    </div>
                    <div className="flex justify-between gap-4 pt-1.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                      <span>Total</span>
                      <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{stats.total}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── Region stats panel (click a region) ── */}
            {selectedRegion && (() => {
              const stats = regionStats[selectedRegion] || { active: 0, resolved: 0, total: 0 }
              return (
                <div
                  className="absolute top-3 left-3 w-52 rounded-2xl border overflow-hidden z-20"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
                >
                  <div className="flex items-start justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <div className="font-bold text-sm" style={{ color: '#FFB000' }}>{selectedRegion}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Region statistics</div>
                    </div>
                    <button onClick={() => setSelectedRegion(null)} className="p-1 rounded-lg flex-shrink-0 transition-colors" style={{ color: 'var(--text-3)' }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Active Outages</span>
                      <span className="text-sm font-bold" style={{ color: stats.active > 0 ? '#ef4444' : 'var(--text-3)' }}>{stats.active}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>Resolved</span>
                      <span className="text-sm font-bold" style={{ color: stats.resolved > 0 ? '#22c55e' : 'var(--text-3)' }}>{stats.resolved}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Total Reports</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{stats.total}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* ── Selected outage detail popup ── */}
            {selected && (
              <div
                className="absolute top-3 right-3 w-72 sm:w-80 rounded-2xl border overflow-hidden z-20"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
              >
                <div className="flex items-start justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pinColor(selected) }} />
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: pinColor(selected) }}>
                        {pinType(selected)}
                      </span>
                    </div>
                    <div className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>
                      {selected.town}{selected.area ? `, ${selected.area}` : ''}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{selected.region}</div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg transition-colors flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <StatusBadge status={selected.status} />
                    <SeverityBadge severity={selected.severity} />
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>{selected.description}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2.5" style={{ background: 'var(--overlay-sm)' }}>
                      <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--text-3)' }}><Clock className="w-3 h-3" /> Duration</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{selected.duration}</div>
                    </div>
                    <div className="rounded-lg p-2.5" style={{ background: 'var(--overlay-sm)' }}>
                      <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--text-3)' }}><Home className="w-3 h-3" /> Homes</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{selected.affectedHomes?.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                    <span>
                      {selected.reporter
                        ? <>By <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{selected.reporter}</span></>
                        : 'Anonymous report'}
                    </span>
                    <span>{timeAgo(selected.timestamp)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom summary bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-full text-xs font-semibold border"
                style={{
                  background:     'rgba(4,12,28,0.88)',
                  borderColor:    'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(12px)',
                  boxShadow:      '0 4px 20px rgba(0,0,0,0.5)',
                }}
              >
                <span className="flex items-center gap-1.5" style={{ color: '#ef4444' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 status-live" />
                  {outages.filter(o => o.status === 'active').length} Active
                </span>
                <span className="w-px h-3.5" style={{ background: 'rgba(255,255,255,0.15)' }} />
                <span className="flex items-center gap-1.5" style={{ color: '#22c55e' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {outages.filter(o => o.status === 'resolved').length} Restored
                </span>
                <span className="w-px h-3.5" style={{ background: 'rgba(255,255,255,0.15)' }} />
                <span className="flex items-center gap-1.5" style={{ color: '#FFB000' }}>
                  <Zap className="w-3 h-3" />
                  {outages.length} Total
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Analytics Panel ── */}
        <div className="lg:w-72 xl:w-80 flex flex-col gap-4 flex-shrink-0">

          <div className="rounded-2xl border px-4 py-3.5" style={{
            background:  'linear-gradient(135deg, rgba(255,176,0,0.07) 0%, rgba(255,176,0,0.02) 100%)',
            borderColor: 'rgba(255,176,0,0.2)',
          }}>
            <div className="flex items-center gap-2 mb-0.5">
              <Zap className="w-4 h-4" style={{ color: '#FFB000' }} />
              <span className="text-sm font-extrabold" style={{ color: 'var(--text-1)' }}>Analytics</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Today's outage intelligence</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Reports Today"  value={reportsToday}      icon={AlertTriangle} color="#FFB000" pulse={reportsToday > 0} />
            <MiniStat label="Affected Areas" value={affectedAreas}     sub={`region${affectedAreas !== 1 ? 's' : ''}`} icon={MapPin} color="#ef4444" />
            <MiniStat label="Restorations"   value={restorationsToday} sub="today"          icon={CheckCircle} color="#22c55e" />
            <MiniStat label="Avg Duration"   value={avgDuration}       sub="per outage"     icon={Clock}       color="#8b5cf6" />
          </div>

          {/* Recent outages list */}
          <div className="rounded-2xl border overflow-hidden flex-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Recent Outages</span>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>{outages.length} total</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
              {outages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <MapPin className="w-8 h-8 mb-3 opacity-20" style={{ color: 'var(--text-3)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>No outage reports available.</p>
                  <p className="text-xs mt-1.5 leading-relaxed opacity-60" style={{ color: 'var(--text-3)' }}>Submit a report to see data here.</p>
                </div>
              ) : (
                outages.slice(0, 12).map(o => (
                  <button
                    key={o.id}
                    onClick={() => setSelected(selected?.id === o.id ? null : o)}
                    className="w-full text-left px-4 py-2.5 border-b last:border-b-0 transition-all"
                    style={{
                      borderColor: 'var(--border)',
                      background:  selected?.id === o.id ? 'rgba(255,176,0,0.05)' : 'transparent',
                      borderLeft:  selected?.id === o.id ? '2px solid #FFB000' : '2px solid transparent',
                      paddingLeft: selected?.id === o.id ? '14px' : '16px',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pinColor(o) }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                          {o.town}{o.area ? `, ${o.area}` : ''}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                          {o.region} · {timeAgo(o.timestamp)}
                        </div>
                      </div>
                      <SeverityBadge severity={o.severity} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 sm:px-5 pb-6">

        {/* 1. Outages Over Time */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,176,0,0.1)', border: '1px solid rgba(255,176,0,0.2)' }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#FFB000' }} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Outages Over Time</div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>Last 7 days</div>
            </div>
          </div>
          <div className="p-4">
            {!hasChartData ? <ChartEmpty /> : (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <LineChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="outages"  name="Reports"  stroke="#FFB000" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#FFB000', strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={2}   dot={false} activeDot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  {[['#FFB000','Reports'],['#22c55e','Resolved']].map(([c, l]) => (
                    <div key={l} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                      <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: c }} />{l}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 2. Most Affected Regions */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <BarChart3 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Most Affected Regions</div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>Reports by region</div>
            </div>
          </div>
          <div className="p-4">
            {regionData.length === 0 ? <ChartEmpty /> : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={regionData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="region" tick={{ fontSize: 9.5, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Reports" radius={[0, 4, 4, 0]}>
                    {regionData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 3. Restoration Performance */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <Activity className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>Restoration Performance</div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>Status breakdown</div>
            </div>
          </div>
          <div className="p-4">
            {restorationData.length === 0 ? <ChartEmpty /> : (
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={restorationData} cx="50%" cy="50%" innerRadius={36} outerRadius={56} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                        {restorationData.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="stat-number text-xl font-extrabold leading-none" style={{ color: '#22c55e' }}>{resolvedRate}%</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>resolved</div>
                  </div>
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  {restorationData.map(({ name, value, color }) => (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-xs" style={{ color: 'var(--text-2)' }}>{name}</span>
                        </div>
                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{value}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--overlay-md)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(value / donutTotal) * 100}%`, background: color }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                    {outages.length} total report{outages.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
