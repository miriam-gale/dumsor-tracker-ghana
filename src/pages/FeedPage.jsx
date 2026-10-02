import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search, MapPin, Clock, Users, AlertTriangle, ChevronDown,
  Zap, X, SortAsc, Filter, CheckCircle, ThumbsUp,
} from 'lucide-react'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SeverityBadge } from '../components/ui/SeverityBadge'
import { timeAgo } from '../utils/formatters'
import { REGIONS } from '../data/outages'
import { supabase } from '../lib/supabase'
import { getToken, getDeviceId } from '../hooks/useOutages'

const SEV_COLOR  = { critical: '#EF4444', high: '#F97316', medium: '#FFB000', low: '#3B82F6' }
const SEV_ORDER  = { critical: 4, high: 3, medium: 2, low: 1 }

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest first' },
  { value: 'oldest',   label: 'Oldest first' },
  { value: 'severity', label: 'Severity' },
  { value: 'homes',    label: 'Most affected' },
]

/* ── small helpers ── */
function RegionSelect({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2.5 rounded-xl text-xs font-medium focus:outline-none border transition-all cursor-pointer"
        style={{
          background: 'var(--bg-input)',
          borderColor: 'var(--border)',
          color: value !== 'all' ? 'var(--text-1)' : 'var(--text-3)',
        }}
        onFocus={e => { e.target.style.borderColor = '#FFB000' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
      >
        <option value="all">All regions</option>
        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-3)' }} />
    </div>
  )
}

function SortSelect({ value, onChange }) {
  return (
    <div className="relative">
      <SortAsc className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-3)' }} />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-8 pr-8 py-2.5 rounded-xl text-xs font-medium focus:outline-none border transition-all cursor-pointer"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
        onFocus={e => { e.target.style.borderColor = '#FFB000' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-3)' }} />
    </div>
  )
}

/* ── confirmation dialog (restore) ── */
function ConfirmDialog({ outage, onCancel, onConfirm, resolving, resolveError }) {
  if (!outage) return null
  const sevColor = SEV_COLOR[outage.severity] || '#64748b'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Dialog header */}
        <div className="flex items-start gap-3.5 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)' }}
          >
            <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight" style={{ color: 'var(--text-1)' }}>
              Mark this outage as restored?
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Power has been restored to this area
            </p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto p-1 rounded-lg flex-shrink-0"
            style={{ color: 'var(--text-3)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Outage summary */}
        <div className="px-5 py-4">
          <div
            className="rounded-xl border-l-[3px] px-4 py-3 mb-4"
            style={{ background: 'var(--overlay-sm)', borderLeftColor: sevColor, borderColor: 'var(--border)' }}
          >
            <div className="font-bold text-sm mb-0.5" style={{ color: 'var(--text-1)' }}>
              {outage.town}{outage.area ? `, ${outage.area}` : ''}
            </div>
            <div className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>{outage.region}</div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={outage.severity} />
              <StatusBadge status={outage.status} />
            </div>
          </div>

          {resolveError && (
            <p className="flex items-center gap-1.5 text-xs mb-3 text-red-400">
              <AlertTriangle size={11} className="flex-shrink-0" />
              {resolveError}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={resolving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all hover:opacity-80"
              style={{
                background: 'var(--overlay-sm)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-1)',
                opacity: resolving ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={resolving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(34,197,94,0.28)',
                opacity: resolving ? 0.7 : 1,
              }}
            >
              {resolving ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"
                    aria-hidden="true"
                  />
                  Resolving…
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Mark as Restored
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── outage card ── */
function OutageCard({
  outage,
  isReporter,
  onResolve,
  confirmCount,
  hasConfirmed,
  isConfirming,
  onConfirm,
}) {
  const sevColor = SEV_COLOR[outage.severity] || '#64748b'
  const isActive = outage.status === 'active'

  return (
    <div
      className="group rounded-2xl border border-l-[3px] overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        borderLeftColor: sevColor,
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div className="p-4 sm:p-5">

        {/* Header: icon + location + time */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${sevColor}14`, border: `1px solid ${sevColor}22` }}
          >
            <MapPin size={15} style={{ color: sevColor }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-sm leading-snug" style={{ color: 'var(--text-1)' }}>
                  {outage.town}{outage.area ? `, ${outage.area}` : ''}
                </h3>
                <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-3)' }}>
                  {outage.region}
                </p>
              </div>
              <span className="text-xs flex-shrink-0 mt-0.5 tabular-nums" style={{ color: 'var(--text-3)' }}>
                {timeAgo(outage.timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {outage.description && (
          <p
            className="text-sm leading-relaxed line-clamp-2 mb-3"
            style={{ color: 'var(--text-2)', paddingLeft: '3rem' }}
          >
            {outage.description}
          </p>
        )}

        {/* Severity + status badges */}
        <div className="flex items-center gap-2 mb-0" style={{ paddingLeft: '3rem' }}>
          <SeverityBadge severity={outage.severity} />
          <StatusBadge status={outage.status} />
        </div>

        {/* Footer meta */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3.5 pt-3.5 border-t text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
        >
          <span className="flex items-center gap-1.5">
            <Clock size={10} className="flex-shrink-0" />
            {outage.duration || 'Unknown'}
          </span>
          {outage.affectedHomes > 0 && (
            <span className="flex items-center gap-1.5">
              <Users size={10} className="flex-shrink-0" />
              {outage.affectedHomes.toLocaleString()} homes
            </span>
          )}
          {outage.status === 'resolved' && outage.resolvedAt && (
            <span className="flex items-center gap-1.5" style={{ color: '#22c55e' }}>
              <CheckCircle size={10} className="flex-shrink-0" />
              Restored {timeAgo(outage.resolvedAt)}
            </span>
          )}
          {outage.reporter && (
            <span className="ml-auto">
              By <span style={{ color: 'var(--text-2)' }}>{outage.reporter}</span>
            </span>
          )}
        </div>

        {/* Bottom section — active outages only */}
        {isActive && (
          <div className="mt-3.5 pt-3.5 border-t" style={{ borderColor: 'var(--border)' }}>

            {/* Community confirmations row */}
            <div className="flex items-center justify-between">
              <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                <Users size={10} className="flex-shrink-0" />
                <span className="font-medium" style={{ color: 'var(--text-2)' }}>
                  {confirmCount}
                </span>
                {' '}community confirmation{confirmCount !== 1 ? 's' : ''}
              </span>

              {/* Non-reporters see the confirm button; reporters see nothing here */}
              {!isReporter && (
                hasConfirmed ? (
                  <span
                    className="text-xs font-semibold flex items-center gap-1.5"
                    style={{ color: '#22c55e' }}
                  >
                    <CheckCircle size={11} />
                    You confirmed this
                  </span>
                ) : (
                  <button
                    onClick={onConfirm}
                    disabled={isConfirming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:opacity-80"
                    style={{
                      background:  'var(--overlay-xs)',
                      borderColor: 'var(--border)',
                      color:       'var(--text-2)',
                      opacity:     isConfirming ? 0.6 : 1,
                      cursor:      isConfirming ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <ThumbsUp size={11} />
                    {isConfirming ? 'Confirming…' : "I'm experiencing this too"}
                  </button>
                )
              )}
            </div>

            {/* Reporter-only: Mark as Restored — security enforced at DB level via token */}
            {isReporter && (
              <div
                className="flex items-center justify-between mt-2.5 pt-2.5 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  Power restored in this area?
                </span>
                <button
                  onClick={() => onResolve(outage)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 hover:-translate-y-0.5"
                  style={{
                    background: 'rgba(34,197,94,0.09)',
                    border:     '1px solid rgba(34,197,94,0.25)',
                    color:      '#22c55e',
                  }}
                >
                  <CheckCircle size={11} />
                  Mark as Restored
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

/* ── main page ── */
export default function FeedPage({ outages, openModal, resolveOutage }) {
  const [search,        setSearch]        = useState('')
  const [quickFilter,   setQuickFilter]   = useState('all')
  const [regionFilter,  setRegionFilter]  = useState('all')
  const [sort,          setSort]          = useState('newest')
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [resolving,     setResolving]     = useState(false)
  const [resolveError,  setResolveError]  = useState(null)

  // Community confirmations state
  const [confirmations, setConfirmations] = useState([])   // [{ outage_id, device_id }]
  const [confirmingId,  setConfirmingId]  = useState(null) // outage ID being confirmed

  // Stable device ID for this browser
  const deviceId = useMemo(() => getDeviceId(), [])

  // Load confirmation metadata on mount (outage_id + device_id only, no personal data)
  useEffect(() => {
    supabase
      .from('community_confirmations')
      .select('outage_id, device_id')
      .then(({ data }) => {
        if (data) setConfirmations(data)
      })
  }, [])

  function openResolveDialog(outage) {
    setConfirmTarget(outage)
    setResolveError(null)
    setResolving(false)
  }

  // ── confirmation helpers ────────────────────────────────────────────────────
  const getConfirmCount = useCallback((outageId) =>
    confirmations.filter(c => String(c.outage_id) === String(outageId)).length,
    [confirmations]
  )
  const checkHasConfirmed = useCallback((outageId) =>
    confirmations.some(c => String(c.outage_id) === String(outageId) && c.device_id === deviceId),
    [confirmations, deviceId]
  )

  const handleConfirm = useCallback(async (outageId) => {
    setConfirmingId(outageId)
    const { error } = await supabase.from('community_confirmations').insert({
      outage_id: Number(outageId),
      device_id: deviceId,
    })
    if (!error) {
      // Successful new confirmation
      setConfirmations(prev => [...prev, { outage_id: Number(outageId), device_id: deviceId }])
    } else if (error.code === '23505') {
      // Unique violation: device already confirmed — sync local state
      setConfirmations(prev =>
        prev.some(c => String(c.outage_id) === String(outageId) && c.device_id === deviceId)
          ? prev
          : [...prev, { outage_id: Number(outageId), device_id: deviceId }]
      )
    } else {
      console.error('[confirm]', error.message)
    }
    setConfirmingId(null)
  }, [deviceId])

  // ── restore dialog handler ─────────────────────────────────────────────────
  const handleConfirmResolve = useCallback(async () => {
    if (!confirmTarget || resolving) return
    setResolveError(null)
    setResolving(true)
    try {
      await resolveOutage(confirmTarget.id)
      setConfirmTarget(null)
    } catch (err) {
      setResolveError(err.message || 'Failed to resolve outage. Please try again.')
    } finally {
      setResolving(false)
    }
  }, [confirmTarget, resolveOutage, resolving])

  /* quick-filter counts */
  const counts = useMemo(() => ({
    all:      outages.length,
    active:   outages.filter(o => o.status   === 'active').length,
    resolved: outages.filter(o => o.status   === 'resolved').length,
    critical: outages.filter(o => o.severity === 'critical').length,
  }), [outages])

  const QUICK_FILTERS = [
    { id: 'all',      label: 'All Reports', count: counts.all },
    { id: 'active',   label: 'Active',      count: counts.active },
    { id: 'resolved', label: 'Resolved',    count: counts.resolved },
    { id: 'critical', label: 'Critical',    count: counts.critical },
  ]

  /* filtering + sorting */
  const filtered = useMemo(() => {
    let r = [...outages]

    if (quickFilter === 'active')   r = r.filter(o => o.status   === 'active')
    if (quickFilter === 'resolved') r = r.filter(o => o.status   === 'resolved')
    if (quickFilter === 'critical') r = r.filter(o => o.severity === 'critical')

    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(o =>
        o.town.toLowerCase().includes(q) ||
        (o.area    || '').toLowerCase().includes(q) ||
        o.region.toLowerCase().includes(q) ||
        (o.description || '').toLowerCase().includes(q)
      )
    }

    if (regionFilter !== 'all') r = r.filter(o => o.region === regionFilter)

    r.sort((a, b) => {
      if (sort === 'newest')   return new Date(b.timestamp) - new Date(a.timestamp)
      if (sort === 'oldest')   return new Date(a.timestamp) - new Date(b.timestamp)
      if (sort === 'severity') return (SEV_ORDER[b.severity] || 0) - (SEV_ORDER[a.severity] || 0)
      if (sort === 'homes')    return (b.affectedHomes || 0) - (a.affectedHomes || 0)
      return 0
    })
    return r
  }, [outages, quickFilter, search, regionFilter, sort])

  const hasActiveFilters = search.trim() || regionFilter !== 'all'

  const clearAll = () => {
    setSearch('')
    setRegionFilter('all')
    setQuickFilter('all')
  }

  const activeCount   = counts.active
  const criticalCount = outages.filter(o => o.severity === 'critical' && o.status === 'active').length

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 min-h-full">

      {/* ── Restore confirmation dialog ── */}
      <ConfirmDialog
        outage={confirmTarget}
        onCancel={() => { if (!resolving) setConfirmTarget(null) }}
        onConfirm={handleConfirmResolve}
        resolving={resolving}
        resolveError={resolveError}
      />

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-1)' }}>
            Outage Feed
          </h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {activeCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 status-live" />
                {activeCount} active outage{activeCount !== 1 ? 's' : ''}
              </span>
            )}
            {criticalCount > 0 && (
              <span
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border"
                style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.22)', color: '#F87171' }}
              >
                <AlertTriangle size={10} />
                {criticalCount} critical
              </span>
            )}
            {activeCount === 0 && outages.length === 0 && (
              <span className="text-sm" style={{ color: 'var(--text-3)' }}>No reports submitted yet</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => openModal?.()}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#0F172A] transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 20px rgba(255,176,0,0.3)' }}
        >
          <AlertTriangle size={14} />
          Report Outage
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        {/* Search row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by town, area, region, or description..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-1)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'var(--overlay-md)', color: 'var(--text-3)' }}
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Quick filter pills + secondary controls */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {QUICK_FILTERS.map(({ id, label, count }) => {
              const active = quickFilter === id
              return (
                <button
                  key={id}
                  onClick={() => setQuickFilter(id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: active ? 'rgba(255,176,0,0.12)' : 'var(--overlay-sm)',
                    color:      active ? '#FFB000' : 'var(--text-3)',
                    border:     active ? '1px solid rgba(255,176,0,0.3)' : '1px solid var(--border)',
                  }}
                >
                  {label}
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums"
                    style={{
                      background: active ? 'rgba(255,176,0,0.18)' : 'var(--overlay-md)',
                      color: active ? '#FFB000' : 'var(--text-3)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <RegionSelect value={regionFilter} onChange={setRegionFilter} />
            <SortSelect   value={sort}         onChange={setSort} />
          </div>
        </div>

        {/* Results meta row */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t text-xs"
          style={{ background: 'var(--overlay-xs)', borderColor: 'var(--border)' }}
        >
          <span style={{ color: 'var(--text-3)' }}>
            Showing{' '}
            <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{filtered.length}</span>
            {' '}of{' '}
            <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{outages.length}</span>
            {' '}reports
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 font-semibold transition-opacity hover:opacity-70"
              style={{ color: '#FFB000' }}
            >
              <X size={11} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Feed ── */}
      {outages.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-strong)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border"
            style={{ background: 'rgba(255,176,0,0.08)', borderColor: 'rgba(255,176,0,0.15)' }}
          >
            <Zap className="w-8 h-8" style={{ color: '#FFB000', opacity: 0.6 }} />
          </div>
          <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-1)' }}>
            No outage reports available
          </h3>
          <p className="text-sm mb-6 max-w-xs text-center" style={{ color: 'var(--text-2)' }}>
            Be the first to report a power outage in your area and help your community.
          </p>
          <button
            type="button"
            onClick={() => openModal?.()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#0F172A] transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #FFB000 0%, #D99600 100%)', boxShadow: '0 4px 20px rgba(255,176,0,0.3)' }}
          >
            <AlertTriangle size={14} />
            Report an Outage
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-strong)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border"
            style={{ background: 'var(--overlay-md)', borderColor: 'var(--border)' }}
          >
            <Filter className="w-7 h-7" style={{ color: 'var(--text-3)' }} />
          </div>
          <h3 className="font-bold text-base mb-1.5" style={{ color: 'var(--text-1)' }}>
            No results found
          </h3>
          <p className="text-sm mb-4 text-center max-w-xs" style={{ color: 'var(--text-2)' }}>
            Try adjusting your search or changing the active filter.
          </p>
          <button
            onClick={clearAll}
            className="px-4 py-2 rounded-xl text-sm font-bold border transition-all"
            style={{ background: 'var(--overlay-sm)', borderColor: 'var(--border-strong)', color: 'var(--text-1)' }}
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(outage => (
            <OutageCard
              key={outage.id}
              outage={outage}
              isReporter={!!getToken(outage.id)}
              onResolve={openResolveDialog}
              confirmCount={getConfirmCount(outage.id)}
              hasConfirmed={checkHasConfirmed(outage.id)}
              isConfirming={confirmingId === outage.id}
              onConfirm={() => handleConfirm(outage.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
