import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS, SEVERITY } from '../data/outages'

// ── Storage keys ──────────────────────────────────────────────────────────────
const LEGACY_KEY    = 'dumsor_outages_v1'   // old single-user localStorage data
const MIGRATION_KEY = 'dumsor_migrated_v1'  // fence: 'done' | 'error' | absent
const TOKENS_KEY    = 'dumsor_tokens_v1'    // { [outageId: string]: uuid string }
const DEVICE_KEY    = 'dumsor_device_id'    // stable anonymous device UUID

// ── Reporter token helpers ────────────────────────────────────────────────────
// Exported so FeedPage can check whether the current device is the reporter.
function _getTokenMap() {
  try { return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}') }
  catch { return {} }
}

function _saveToken(outageId, token) {
  const map = _getTokenMap()
  map[String(outageId)] = token
  localStorage.setItem(TOKENS_KEY, JSON.stringify(map))
}

export function getToken(outageId) {
  return _getTokenMap()[String(outageId)] ?? null
}

// ── Device ID ─────────────────────────────────────────────────────────────────
// Stable anonymous UUID per browser; used for community confirmations.
// Exported so FeedPage can pass it when inserting a confirmation.
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

// ── Duration ──────────────────────────────────────────────────────────────────
// endAt: for resolved outages pass resolvedAt to freeze the value.
//        for active outages pass null to compute against Date.now() (live).
function computeDuration(startedAt, endAt = null) {
  if (!startedAt) return 'Unknown'
  const end = endAt ? new Date(endAt).getTime() : Date.now()
  const diff = end - new Date(startedAt).getTime()
  if (diff <= 0) return 'Just started'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h === 0) return m <= 1 ? 'Just started' : `${m} mins`
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh === 0 ? `${d}d` : `${d}d ${rh}h`
}

// ── DB row → app outage shape ─────────────────────────────────────────────────
// Maps snake_case DB columns to the camelCase shape the rest of the app uses.
// No page component needs to change — they receive the same object shape as before.
function mapRow(row) {
  return {
    id:            String(row.id),
    region:        row.region,
    town:          row.town,
    area:          row.area            ?? '',
    severity:      row.severity,
    description:   row.description,
    reporter:      row.reporter        ?? '',
    phone:         row.phone           ?? '',
    email:         row.email           ?? '',
    startedAt:     row.started_at,
    resolvedAt:    row.resolved_at     ?? null,
    status:        row.status,
    timestamp:     row.timestamp,
    lat:           row.lat             ?? null,
    lng:           row.lng             ?? null,
    affectedHomes: row.affected_homes  ?? 0,
    duration:      computeDuration(row.started_at, row.resolved_at ?? null),
  }
}

// ── One-time localStorage → Supabase migration ───────────────────────────────
// Runs once per device on first load after the Supabase backend is added.
// If ALL uploads succeed: sets fence to 'done', removes legacy data.
// If any upload fails: sets fence to 'error', preserves legacy data, logs error.
// Fence key prevents re-running on refresh.
async function migrateFromLocalStorage() {
  try {
    if (localStorage.getItem(MIGRATION_KEY)) return

    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) {
      localStorage.setItem(MIGRATION_KEY, 'done')
      return
    }

    let saved
    try { saved = JSON.parse(raw) }
    catch {
      localStorage.setItem(MIGRATION_KEY, 'error')
      return
    }

    if (!Array.isArray(saved) || saved.length === 0) {
      localStorage.setItem(MIGRATION_KEY, 'done')
      localStorage.removeItem(LEGACY_KEY)
      return
    }

    // create_outage() only accepts 'active' or 'scheduled'; skip resolved legacy data
    const toMigrate = saved.filter(
      o => o.status === STATUS.ACTIVE || o.status === STATUS.SCHEDULED
    )

    let allOk = true
    for (const o of toMigrate) {
      const token = crypto.randomUUID()
      const desc  = (o.description || '').trim()
      const safeDesc = desc.length >= 10 ? desc : desc + ' (migrated report)'

      const { data, error } = await supabase.rpc('create_outage', {
        p_region:         o.region        || '',
        p_town:           o.town          || '',
        p_description:    safeDesc,
        p_started_at:     o.startedAt     || new Date().toISOString(),
        p_area:           o.area          || '',
        p_severity:       o.severity      || 'medium',
        p_reporter:       o.reporter      || '',
        p_phone:          o.phone         || '',
        p_email:          o.email         || '',
        p_status:         o.status        || 'active',
        p_lat:            o.lat           ?? null,
        p_lng:            o.lng           ?? null,
        p_affected_homes: o.affectedHomes ?? 100,
        p_token:          token,
      })

      if (error) {
        console.error('[migration] failed for outage', o.id, ':', error.message)
        allOk = false
      } else if (data?.[0]) {
        _saveToken(String(data[0].outage_id), data[0].reporter_token)
      }
    }

    if (allOk) {
      localStorage.setItem(MIGRATION_KEY, 'done')
      localStorage.removeItem(LEGACY_KEY)
    } else {
      localStorage.setItem(MIGRATION_KEY, 'error')
      console.error('[migration] Some outages could not be migrated. Original localStorage data preserved in', LEGACY_KEY)
    }
  } catch (err) {
    console.error('[migration] Unexpected error:', err)
    localStorage.setItem(MIGRATION_KEY, 'error')
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useOutages() {
  const [outages, setOutages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const channelRef = useRef(null)

  const fetchAll = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('outages')
      .select('*')
      .order('timestamp', { ascending: false })
    if (err) {
      console.error('[useOutages] fetch error:', err.message)
      setError('Could not load outages. Check your connection and try again.')
    } else {
      setOutages((data || []).map(mapRow))
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    async function init() {
      await migrateFromLocalStorage()
      if (active) await fetchAll()
    }
    init()

    // Realtime subscription.
    // INSERT: dedup by ID — skips if the optimistic temp record was already replaced.
    // UPDATE: idempotent replace by ID — safe whether local or from another client.
    channelRef.current = supabase
      .channel('outages-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outages' },
        payload => {
          if (!active) return
          if (payload.eventType === 'INSERT') {
            const incoming = mapRow(payload.new)
            setOutages(prev =>
              prev.some(o => o.id === incoming.id) ? prev : [incoming, ...prev]
            )
          }
          if (payload.eventType === 'UPDATE') {
            const incoming = mapRow(payload.new)
            setOutages(prev => prev.map(o => o.id === incoming.id ? incoming : o))
          }
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            setOutages(prev => prev.filter(o => o.id !== String(payload.old.id)))
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [fetchAll])

  // ── addOutage ─────────────────────────────────────────────────────────────
  // Async. Generates reporter token, optimistically inserts, calls create_outage().
  // Stores returned token in localStorage. Returns real outage from Supabase.
  // Throws on RPC failure (caller handles error display).
  const addOutage = useCallback(async (formData) => {
    const reporterToken = crypto.randomUUID()
    const tempId = 'temp_' + crypto.randomUUID()
    const affectedHomes = Math.floor(Math.random() * 800) + 50

    const optimistic = {
      id:            tempId,
      region:        formData.region,
      town:          formData.town,
      area:          formData.area          || '',
      severity:      formData.severity      || SEVERITY.MEDIUM,
      description:   formData.description,
      reporter:      formData.reporter      || '',
      phone:         formData.phone         || '',
      email:         formData.email         || '',
      startedAt:     formData.startedAt,
      resolvedAt:    null,
      status:        STATUS.ACTIVE,
      timestamp:     new Date().toISOString(),
      lat:           null,
      lng:           null,
      affectedHomes,
      duration:      computeDuration(formData.startedAt),
    }
    setOutages(prev => [optimistic, ...prev])

    const { data, error: rpcErr } = await supabase.rpc('create_outage', {
      p_region:         formData.region,
      p_town:           formData.town,
      p_description:    formData.description,
      p_started_at:     formData.startedAt,
      p_area:           formData.area          || '',
      p_severity:       formData.severity      || SEVERITY.MEDIUM,
      p_reporter:       formData.reporter      || '',
      p_phone:          formData.phone         || '',
      p_email:          formData.email         || '',
      p_status:         STATUS.ACTIVE,
      p_lat:            null,
      p_lng:            null,
      p_affected_homes: affectedHomes,
      p_token:          reporterToken,
    })

    if (rpcErr || !data?.[0]) {
      setOutages(prev => prev.filter(o => o.id !== tempId))
      throw new Error(rpcErr?.message || 'Failed to submit outage report. Please try again.')
    }

    const { outage_id, reporter_token } = data[0]
    _saveToken(String(outage_id), reporter_token)

    // Fetch real row to replace temp record (Realtime dedup will skip the duplicate)
    const { data: row, error: fetchErr } = await supabase
      .from('outages')
      .select('*')
      .eq('id', outage_id)
      .single()

    const real = (!fetchErr && row)
      ? mapRow(row)
      : { ...optimistic, id: String(outage_id) }

    setOutages(prev => prev.map(o => o.id === tempId ? real : o))
    return real
  }, [])

  // ── resolveOutage ─────────────────────────────────────────────────────────
  // Async. Reads stored reporter token — throws immediately if not the reporter.
  // Optimistically updates state. Calls resolve_outage() RPC.
  // Rolls back and throws on RPC error or token mismatch (data === false).
  const resolveOutage = useCallback(async (id) => {
    const token = getToken(id)
    if (!token) {
      throw new Error('You are not the original reporter of this outage.')
    }

    const now = new Date().toISOString()
    setOutages(prev => prev.map(o => {
      if (o.id !== id || o.status !== STATUS.ACTIVE) return o
      return {
        ...o,
        status:     STATUS.RESOLVED,
        resolvedAt: now,
        duration:   computeDuration(o.startedAt, now),
      }
    }))

    const { data, error: rpcErr } = await supabase.rpc('resolve_outage', {
      p_outage_id: Number(id),
      p_token:     token,
    })

    if (rpcErr) {
      setOutages(prev => prev.map(o =>
        o.id === id ? { ...o, status: STATUS.ACTIVE, resolvedAt: null } : o
      ))
      throw new Error(rpcErr.message || 'Failed to resolve outage. Please try again.')
    }

    if (data === false) {
      setOutages(prev => prev.map(o =>
        o.id === id ? { ...o, status: STATUS.ACTIVE, resolvedAt: null } : o
      ))
      throw new Error('Invalid reporter token. Only the original reporter can resolve this outage.')
    }
    // data === true — Realtime UPDATE will arrive with the authoritative server timestamp
  }, [])

  const active = outages.filter(o => o.status === STATUS.ACTIVE)

  const stats = useMemo(() => ({
    total:           outages.length,
    active:          active.length,
    resolved:        outages.filter(o => o.status === STATUS.RESOLVED).length,
    scheduled:       outages.filter(o => o.status === STATUS.SCHEDULED).length,
    critical:        outages.filter(o => o.severity === SEVERITY.CRITICAL && o.status === STATUS.ACTIVE).length,
    regionsAffected: new Set(active.map(o => o.region)).size,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [outages])

  return { outages, addOutage, resolveOutage, stats, loading, error }
}
