import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS, SEVERITY, REGIONS } from '../data/outages'

// ── Storage keys ──────────────────────────────────────────────────────────────
const LEGACY_KEY           = 'dumsor_outages_v1'    // original per-device data
const MIGRATION_KEY        = 'dumsor_migrated_v1'   // fence: 'done'|'partial'|'error'|absent
const TOKENS_KEY           = 'dumsor_tokens_v1'     // { [outageId]: uuid }
const DEVICE_KEY           = 'dumsor_device_id'     // stable anonymous device UUID
const MIGRATION_TOKENS_KEY = 'dumsor_migration_tokens_v1' // { [recordKey]: uuid }
const MIGRATION_STATE_KEY  = 'dumsor_migration_state_v1'
// { [recordKey]: { status: 'migrated', outageId: string, reporterToken: string } | 'migrated' }
const UNMIGRATABLE_KEY     = 'dumsor_unmigratable_v1'
// { [recordKey]: { reasons: string[], original: unknown, ts: string } }
const MIGRATION_LOCK_KEY   = 'dumsor_migration_lock_v1' // cross-tab coordination

// ── Reporter token helpers ────────────────────────────────────────────────────
// Reporter tokens prove this device created an outage, so it may later resolve
// it. They live in localStorage (TOKENS_KEY) with an in-memory fallback for when
// storage is unavailable or corrupt.

// Thrown when the token store exists but is unreadable / unparseable / not a
// plain object. Distinct from "absent" so _saveToken never silently clobbers
// corrupt data and callers never treat corruption as an empty store.
class TokenStoreError extends Error {}

// In-memory fallback for tokens that could not be written to localStorage (quota
// exceeded, corrupt store, private-mode throw). Lets the reporter still resolve
// their outage within the current session. Cleared on reload — by then a fresh
// report (or, for migrated records, MIGRATION_STATE_KEY recovery) is the backstop.
const _memoryTokens = new Map()

function _rememberTokenInMemory(outageId, token) {
  _memoryTokens.set(String(outageId), token)
}

// Reads the reporter→token map. Returns {} only when the key is genuinely absent.
// Throws (TokenStoreError, or the DOMException from a blocked read) otherwise, so
// corruption is never mistaken for "no tokens" and is never overwritten.
function _getTokenMap() {
  const raw = localStorage.getItem(TOKENS_KEY)
  if (raw === null) return {}
  let parsed
  try { parsed = JSON.parse(raw) }
  catch { throw new TokenStoreError('reporter token store is not valid JSON') }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new TokenStoreError('reporter token store is not a plain object')
  return parsed
}

// Persists a single token. Throws rather than overwriting a corrupt store, and
// propagates quota / storage errors from setItem — callers decide how to recover.
function _saveToken(outageId, token) {
  const map = _getTokenMap()
  map[String(outageId)] = token
  localStorage.setItem(TOKENS_KEY, JSON.stringify(map))
}

// Non-throwing wrapper used by addOutage and migration. On any storage failure it
// keeps the token in the in-memory fallback and reports persisted:false instead of
// throwing, so a committed outage is never reported as a failed submission.
// Exported for unit testing.
export function persistReporterToken(outageId, token) {
  try {
    _saveToken(outageId, token)
    return { persisted: true }
  } catch (err) {
    _rememberTokenInMemory(outageId, token)
    return { persisted: false, error: err }
  }
}

// Returns the reporter token for an outage, or null. Reads localStorage first,
// falling back to the in-memory map. A corrupt / unreadable store is treated as a
// miss for this id (never throws, never clobbers). Exported so FeedPage can check
// whether the current device is the reporter.
export function getToken(outageId) {
  const id = String(outageId)
  try {
    const stored = _getTokenMap()[id]
    if (stored != null) return stored
  } catch { /* corrupt / unreadable store — fall back to in-memory */ }
  return _memoryTokens.get(id) ?? null
}

// Returns true only when TOKENS_KEY (localStorage, not the in-memory fallback)
// durably holds exactly `token` for `outageId`. Migration token recovery needs
// this instead of getToken(): getToken() also consults _memoryTokens, so a token
// that only ever reached the in-memory fallback — and would be lost on reload —
// would be mistaken for one that was persisted, letting migration complete and
// drop the record before the token was ever written. A corrupt / unreadable store
// counts as "not persisted" so recovery retries the write rather than skipping it.
function _isTokenPersisted(outageId, token) {
  try {
    return _getTokenMap()[String(outageId)] === token
  } catch {
    return false
  }
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
// phone and email are stored server-side for ECG follow-up but are never
// fetched to the client — they are omitted from the SELECT column list.
function mapRow(row) {
  return {
    id:            String(row.id),
    region:        row.region,
    town:          row.town,
    area:          row.area            ?? '',
    severity:      row.severity,
    description:   row.description,
    reporter:      row.reporter        ?? '',
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

// ── Migration helpers (exported for unit testing) ─────────────────────────────

// Sentinel values for store loaders; distinct from any stored data.
const LOAD_ABSENT    = Symbol('absent')
const LOAD_MALFORMED = Symbol('malformed')

// Derive a stable key for a legacy record, used consistently across retries.
// LEGACY_KEY is not modified until migration completes, so array order is stable.
//
//   id_<v>           records with a non-null id field (preferred)
//   pos_<i>          non-object entries (null, array, primitive)
//   noid_<i>_<hash>  objects without id — content + position tiebreaker
//
// The position suffix means two structurally identical records at different
// array positions always receive different keys.
export function legacyRecordKey(o, index) {
  if (o == null || typeof o !== 'object' || Array.isArray(o))
    return `pos_${index}`
  if (o.id != null)
    return `id_${String(o.id)}`
  const ts   = typeof o.startedAt   === 'string' ? o.startedAt.slice(0, 24) : ''
  const reg  = typeof o.region      === 'string' ? o.region                  : ''
  const town = typeof o.town        === 'string' ? o.town.slice(0, 20)       : ''
  const desc = typeof o.description === 'string' ? o.description.slice(0, 30): ''
  const raw  = `${index}|${ts}|${reg}|${town}|${desc}`
  return `noid_${index}_${btoa(encodeURIComponent(raw)).slice(0, 32)}`
}

// Load a keyed store. Returns LOAD_ABSENT if the key was never written,
// LOAD_MALFORMED if the value is corrupt or the wrong type, or the object.
// Never silently coerces malformed data to {}.
function loadKeyedStore(storageKey) {
  const raw = localStorage.getItem(storageKey)
  if (raw === null) return LOAD_ABSENT
  try {
    const v = JSON.parse(raw)
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return LOAD_MALFORMED
    return v
  } catch {
    return LOAD_MALFORMED
  }
}

// Load UNMIGRATABLE_KEY. Distinguishes absent (key never written) from stored
// null (LOAD_MALFORMED — null was explicitly written, not the same as absent).
// Also handles the legacy array format: every entry is preserved, including
// malformed ones (which get a fallback key rather than being dropped).
function loadQuarantineStore() {
  const raw = localStorage.getItem(UNMIGRATABLE_KEY)
  if (raw === null) return LOAD_ABSENT
  try {
    const v = JSON.parse(raw)
    if (v === null) return LOAD_MALFORMED
    if (Array.isArray(v)) {
      const obj = {}
      v.forEach((entry, i) => {
        if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
          const k = entry.original?.id != null ? `id_${entry.original.id}` : `legacy_arr_${i}`
          obj[k] = entry
        } else {
          obj[`legacy_arr_malformed_${i}`] = {
            reasons: ['malformed_quarantine_entry'],
            original: entry,
            ts: new Date().toISOString(),
          }
        }
      })
      return obj
    }
    if (typeof v !== 'object') return LOAD_MALFORMED
    return v
  } catch {
    return LOAD_MALFORMED
  }
}

// PostgreSQL `integer` (int4) upper bound. affected_homes is stored as int4, so
// values above this overflow the column server-side and must be quarantined.
const PG_INT4_MAX = 2147483647

// Classify one legacy record against every server-side validation rule.
// Returns { reasons: string[], safeDesc: string }.
// reasons is empty when the record is safe to submit to create_outage().
// Never throws. Never modifies the record. safeDesc is only meaningful when
// reasons is empty — no padding, no timestamp substitution, no rewriting.
// Must stay in sync with the B2 validation block in create_outage().
export function classifyLegacyRecord(o) {
  if (o == null || typeof o !== 'object' || Array.isArray(o))
    return { reasons: ['invalid_record_type'], safeDesc: '' }

  const reasons = []

  if (typeof o.status !== 'string' ||
      (o.status !== STATUS.ACTIVE && o.status !== STATUS.SCHEDULED))
    reasons.push('unsupported_status')

  if (typeof o.region !== 'string' || !REGIONS.includes(o.region))
    reasons.push('unknown_region')

  if (typeof o.town !== 'string') {
    reasons.push('missing_town')
  } else {
    const t = o.town.trim()
    if (!t)               reasons.push('missing_town')
    else if (t.length > 100) reasons.push('town_too_long')
  }

  if (o.area != null) {
    if (typeof o.area !== 'string') reasons.push('area_not_string')
    else if (o.area.trim().length > 100) reasons.push('area_too_long')
  }

  // No description padding: missing, non-string, too-short → quarantine.
  let safeDesc = ''
  if (typeof o.description !== 'string') {
    reasons.push('missing_description')
  } else {
    safeDesc = o.description.trim()
    if (safeDesc.length === 0)    reasons.push('missing_description')
    else if (safeDesc.length < 10)  reasons.push('description_too_short')
    else if (safeDesc.length > 500) reasons.push('description_too_long')
  }

  if (o.reporter != null) {
    if (typeof o.reporter !== 'string') reasons.push('reporter_not_string')
    else if (o.reporter.trim().length > 100) reasons.push('reporter_too_long')
  }
  if (o.phone != null) {
    if (typeof o.phone !== 'string') reasons.push('phone_not_string')
    else if (o.phone.trim().length > 30) reasons.push('phone_too_long')
  }
  if (o.email != null) {
    if (typeof o.email !== 'string') reasons.push('email_not_string')
    else if (o.email.trim().length > 254) reasons.push('email_too_long')
  }

  const effectiveSev = (typeof o.severity === 'string' && o.severity) ? o.severity : 'medium'
  if (!Object.values(SEVERITY).includes(effectiveSev))
    reasons.push('unknown_severity')

  // startedAt is required. null/undefined/absent → quarantine.
  // No fallback to the current time without an explicit operator decision.
  if (o.startedAt == null) {
    reasons.push('missing_timestamp')
  } else if (typeof o.startedAt !== 'string' && !(o.startedAt instanceof Date)) {
    reasons.push('invalid_timestamp')
  } else {
    const dt = new Date(o.startedAt)
    if (isNaN(dt.getTime()))                     reasons.push('invalid_timestamp')
    else if (dt.getTime() > Date.now() + 60_000) reasons.push('future_timestamp')
  }

  const hasLat = o.lat != null
  const hasLng = o.lng != null
  if (hasLat !== hasLng) {
    reasons.push('lat_lng_mismatch')
  } else if (hasLat) {
    if (typeof o.lat !== 'number')      reasons.push('lat_not_finite')
    else if (!Number.isFinite(o.lat))   reasons.push('lat_not_finite')
    else if (o.lat < -90 || o.lat > 90) reasons.push('lat_out_of_range')
    if (typeof o.lng !== 'number')        reasons.push('lng_not_finite')
    else if (!Number.isFinite(o.lng))     reasons.push('lng_not_finite')
    else if (o.lng < -180 || o.lng > 180) reasons.push('lng_out_of_range')
  }

  // affected_homes is a PostgreSQL `integer` (int4) column: a non-negative whole
  // number ≤ 2 147 483 647. Reject non-finite (Infinity/NaN slipped past the old
  // isNaN-only check), decimals, negatives and anything above the int4 ceiling so
  // the client rejects exactly what the server-side B2 validation rejects.
  if (o.affectedHomes != null) {
    if (typeof o.affectedHomes !== 'number' || !Number.isFinite(o.affectedHomes))
      reasons.push('invalid_affected_homes')
    else if (!Number.isInteger(o.affectedHomes))
      reasons.push('affected_homes_not_integer')
    else if (o.affectedHomes < 0)
      reasons.push('negative_affected_homes')
    else if (o.affectedHomes > PG_INT4_MAX)
      reasons.push('affected_homes_out_of_range')
  }

  return { reasons, safeDesc }
}

// ── Cross-tab coordination ────────────────────────────────────────────────────
// Two-tier strategy for restricting migration to one tab at a time.
//
// Tier 1 — Web Locks API (Chrome 69+, Firefox 96+, Safari 15.4+, Edge 79+):
//   Truly exclusive. The browser's lock manager ensures only one tab executes
//   the migration callback at a time across all same-origin frames.
//   { ifAvailable: true } makes the call non-blocking: when the lock is already
//   held the callback is invoked with null and we back off immediately.
//
// Tier 2 — localStorage advisory lock (Firefox Private Browsing and browsers
//   that do not support Web Locks):
//   NOT exclusive. The write-then-read pattern narrows the overlap window but
//   cannot close it: two tabs that both read "no lock present" before either
//   writes can both pass the read-back check. Per-record idempotency
//   (MIGRATION_STATE_KEY skip-check + stable pre-persisted tokens) prevents
//   data loss, but cannot prevent a duplicate Supabase row for the same legacy
//   record. True deduplication in that case requires the B2 server-side
//   p_token uniqueness constraint (not yet deployed).

const LOCK_EXPIRY_MS      = 30_000
const LOCK_HEARTBEAT_MS   = 10_000                 // fallback-lock refresh interval
const MIGRATION_LOCK_NAME = 'dumsor-migration-v1'  // Web Locks resource name

// Runs fn under an exclusive lock (Web Locks) or an advisory lock (fallback).
// Returns true if fn ran, false if we backed off because another tab holds it.
// Exceptions from fn propagate after the lock is released.
async function _withMigrationLock(fn) {
  if (typeof navigator !== 'undefined' &&
      typeof navigator.locks?.request === 'function') {
    let ran = false
    await navigator.locks.request(
      MIGRATION_LOCK_NAME,
      { ifAvailable: true },
      async lock => {
        if (lock === null) {
          console.warn('[migration] Web Locks: another tab holds the migration lock.')
          return
        }
        ran = true
        await fn()   // lock is held until this promise settles (including on throw)
      }
    )
    return ran
  }

  // Web Locks unavailable — best-effort advisory lock, NOT exclusive.
  const lockId = _acquireMigrationLockFallback()
  if (lockId === null) {
    console.warn('[migration] Advisory lock held by another tab. Will retry on next init.')
    return false
  }
  // Heartbeat keeps the lock's ts fresh so a live-but-slow migration (many RPC
  // calls, slow network) is not mistaken for a crashed tab and evicted after
  // LOCK_EXPIRY_MS. Stopped in finally, before releasing the lock.
  const stopHeartbeat = _startMigrationHeartbeatFallback(lockId)
  try {
    await fn()
    return true
  } finally {
    stopHeartbeat()
    _releaseMigrationLockFallback(lockId)
  }
}

function _acquireMigrationLockFallback() {
  const lockId = crypto.randomUUID()
  const existing = loadKeyedStore(MIGRATION_LOCK_KEY)
  if (existing !== LOAD_ABSENT && existing !== LOAD_MALFORMED) {
    if (typeof existing.ts === 'number' && Date.now() - existing.ts < LOCK_EXPIRY_MS) {
      return null
    }
  }
  try {
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: lockId, ts: Date.now() }))
  } catch { return null }
  const claimed = loadKeyedStore(MIGRATION_LOCK_KEY)
  if (claimed === LOAD_ABSENT || claimed === LOAD_MALFORMED || claimed.id !== lockId) {
    return null
  }
  return lockId
}

export function _releaseMigrationLockFallback(lockId) {
  if (!lockId) return
  const current = loadKeyedStore(MIGRATION_LOCK_KEY)
  if (current !== LOAD_ABSENT && current !== LOAD_MALFORMED && current.id === lockId) {
    try { localStorage.removeItem(MIGRATION_LOCK_KEY) } catch { /* storage unavailable */ }
  }
}

// Re-stamp the fallback lock's ts, but ONLY while we still own it. Returns true
// on success, false if ownership was lost (lock absent/malformed, or a different
// tab's id) or storage threw. Never overwrites a lock owned by another tab.
export function _refreshMigrationLockFallback(lockId) {
  if (!lockId) return false
  const current = loadKeyedStore(MIGRATION_LOCK_KEY)
  if (current === LOAD_ABSENT || current === LOAD_MALFORMED || current.id !== lockId) {
    return false
  }
  try {
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: lockId, ts: Date.now() }))
    return true
  } catch {
    return false   // storage unavailable — treat as a failed refresh, do not crash
  }
}

// Periodically refresh the fallback lock while migration runs. Returns a stop()
// that clears the interval. If a refresh ever finds ownership lost, it warns once
// and stops refreshing so we never re-stamp a lock another tab has taken over.
// NOTE: a lost heartbeat does NOT prevent a concurrent tab's duplicate migration
// RPC calls — server-side p_token deduplication remains the authoritative guard.
export function _startMigrationHeartbeatFallback(lockId) {
  if (!lockId || typeof setInterval !== 'function') return () => {}
  let warned = false
  const handle = setInterval(() => {
    if (!_refreshMigrationLockFallback(lockId) && !warned) {
      warned = true
      console.warn('[migration] Advisory lock ownership lost during migration ' +
        '(expired and taken over by another tab, or storage unavailable). ' +
        'Heartbeat stopped. This does NOT prevent duplicate migration RPC calls — ' +
        'server-side p_token deduplication is still required.')
      clearInterval(handle)
    }
  }, LOCK_HEARTBEAT_MS)
  // Don't keep a host process alive solely for this timer (no-op in browsers).
  if (handle && typeof handle === 'object' && typeof handle.unref === 'function') {
    handle.unref()
  }
  return () => { try { clearInterval(handle) } catch { /* already cleared */ } }
}

// ── Migration state helpers (Fix 2) ───────────────────────────────────────────
// True for both the legacy string format ('migrated') and the new object format
// ({ status: 'migrated', outageId, reporterToken }).
function _isMigratedEntry(val) {
  return val === 'migrated' ||
    (val != null && typeof val === 'object' && !Array.isArray(val) && val.status === 'migrated')
}

// ── Retryable cleanup (Fix 3) ─────────────────────────────────────────────────
// Called on the next init after fence='done'/'partial'. Retries removal of keys
// whose localStorage.removeItem() call failed (e.g. storage was full at that moment).
// By the time we reach this path, all data is safely committed to Supabase and
// UNMIGRATABLE_KEY/TOKENS_KEY, so removing the auxiliary migration keys is safe.
function _retryCleanup() {
  if (localStorage.getItem(LEGACY_KEY) !== null)
    try { localStorage.removeItem(LEGACY_KEY) } catch { /* storage unavailable */ }
  if (localStorage.getItem(MIGRATION_STATE_KEY) !== null)
    try { localStorage.removeItem(MIGRATION_STATE_KEY) } catch { /* storage unavailable */ }
  if (localStorage.getItem(MIGRATION_TOKENS_KEY) !== null)
    try { localStorage.removeItem(MIGRATION_TOKENS_KEY) } catch { /* storage unavailable */ }
}

// ── One-time localStorage → Supabase migration ───────────────────────────────
// Exported for integration testing.
//
// Fence values:
//   'done'    — all records migrated, no quarantine; LEGACY_KEY removed
//   'partial' — all records processed, some unmigratable; LEGACY_KEY removed
//   'error'   — transient failure; LEGACY_KEY preserved; retry on next init
//   absent    — migration has not run yet
//
// Idempotency guarantee:
//   1. A stable token is persisted to MIGRATION_TOKENS_KEY before every RPC call.
//   2. The same token is reused on retry; after write, we re-read to converge
//      with any concurrent tab that may have written a different token.
//   3. MIGRATION_STATE_KEY stores { status:'migrated', outageId, reporterToken }
//      per confirmed record so the reporter token can be recovered if _saveToken
//      failed during that run.
//
// LEGACY_KEY is removed only after every record in saved[] is either confirmed
// in MIGRATION_STATE_KEY or confirmed in UNMIGRATABLE_KEY, and the fence write
// itself has succeeded.
export async function migrateFromLocalStorage() {
  try {
    const fence = localStorage.getItem(MIGRATION_KEY)
    if (fence === 'done' || fence === 'partial') {
      _retryCleanup()
      return
    }

    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) {
      try { localStorage.setItem(MIGRATION_KEY, 'done') } catch { /* storage unavailable */ }
      return
    }

    let saved
    try   { saved = JSON.parse(raw) }
    catch {
      // Unparseable — preserve LEGACY_KEY; operator must clear manually
      try { localStorage.setItem(MIGRATION_KEY, 'error') } catch { /* storage unavailable */ }
      return
    }

    // Non-array JSON (object, number, string, null) — do NOT remove LEGACY_KEY.
    if (!Array.isArray(saved)) {
      try { localStorage.setItem(MIGRATION_KEY, 'error') } catch { /* storage unavailable */ }
      return
    }
    if (saved.length === 0) {
      try { localStorage.setItem(MIGRATION_KEY, 'done') } catch { /* storage unavailable */ }
      try { localStorage.removeItem(LEGACY_KEY) } catch { /* storage unavailable */ }
      return
    }

    const didRun = await _withMigrationLock(async () => {
      // Re-check fence under the lock. Another tab may have completed migration
      // between our check above and when we acquired the lock.
      const fenceNow = localStorage.getItem(MIGRATION_KEY)
      if (fenceNow === 'done' || fenceNow === 'partial') {
        _retryCleanup()
        return
      }

      // Load per-record stores inside the lock so we see the latest state.
      // LOAD_MALFORMED stops migration safely rather than silently treating
      // a corrupt store as empty.
      const stateResult      = loadKeyedStore(MIGRATION_STATE_KEY)
      const tokensResult     = loadKeyedStore(MIGRATION_TOKENS_KEY)
      const quarantineResult = loadQuarantineStore()

      if (stateResult      === LOAD_MALFORMED ||
          tokensResult     === LOAD_MALFORMED ||
          quarantineResult === LOAD_MALFORMED) {
        console.error('[migration] One or more migration stores are malformed. ' +
          'LEGACY_KEY preserved. Inspect and clear the malformed store to retry.')
        try { localStorage.setItem(MIGRATION_KEY, 'error') } catch { /* storage unavailable */ }
        return
      }

      const migrationState     = stateResult      === LOAD_ABSENT ? {} : stateResult
      const migrationTokens    = tokensResult      === LOAD_ABSENT ? {} : tokensResult
      const existingQuarantine = quarantineResult  === LOAD_ABSENT ? {} : quarantineResult

      // Flush reporter tokens that couldn't be saved in a previous run.
      // Stored as { status:'migrated', outageId, reporterToken } in MIGRATION_STATE_KEY.
      // Fence stays 'error' until all tokens are saved.
      let tokenFlushOk = true
      for (const entry of Object.values(migrationState)) {
        if (typeof entry === 'object' && _isMigratedEntry(entry) &&
            entry.outageId && entry.reporterToken &&
            !_isTokenPersisted(entry.outageId, entry.reporterToken)) {
          try {
            _saveToken(entry.outageId, entry.reporterToken)
          } catch {
            _rememberTokenInMemory(entry.outageId, entry.reporterToken)
            console.error('[migration] Reporter token recovery failed for outage',
              entry.outageId, '— kept in memory; will retry on next init')
            tokenFlushOk = false
          }
        }
      }

      // ── Phase 1: classify ALL records ───────────────────────────────────────
      const validRecords     = []
      const quarantineBuffer = {}

      for (let i = 0; i < saved.length; i++) {
        const o   = saved[i]
        const key = legacyRecordKey(o, i)

        if (_isMigratedEntry(migrationState[key]) || key in existingQuarantine)
          continue

        const { reasons, safeDesc } = classifyLegacyRecord(o)

        if (reasons.length > 0)
          quarantineBuffer[key] = { reasons, original: o, ts: new Date().toISOString() }
        else
          validRecords.push({ o, safeDesc, key })
      }

      // ── Phase 2: migrate valid records ──────────────────────────────────────
      let allOk = tokenFlushOk
      for (const { o, safeDesc, key } of validRecords) {
        // Stable token is persisted to MIGRATION_TOKENS_KEY before the RPC call
        // so it survives a page reload between write and response. Same token is
        // reused on every retry for idempotent server-side deduplication.
        let token = migrationTokens[key]
        if (!token) {
          token = crypto.randomUUID()
          migrationTokens[key] = token
          try {
            localStorage.setItem(MIGRATION_TOKENS_KEY, JSON.stringify(migrationTokens))
          } catch (err) {
            console.error('[migration] Token persist failed for', o.id,
              '— skipping to preserve idempotency:', err.message)
            allOk = false
            continue
          }
          // Re-read after write. On the localStorage fallback path, a concurrent
          // tab may have written its own token for this key between our write and
          // this read; adopting their value means both tabs submit the same token.
          // (Under Web Locks this re-read is a no-op since no other tab can be here.)
          const freshTokens = loadKeyedStore(MIGRATION_TOKENS_KEY)
          if (freshTokens !== LOAD_ABSENT && freshTokens !== LOAD_MALFORMED && freshTokens[key]) {
            token = freshTokens[key]
            migrationTokens[key] = token
          }
        }

        // startedAt is guaranteed valid and non-null by classifyLegacyRecord.
        const startedAt = o.startedAt instanceof Date ? o.startedAt.toISOString() : o.startedAt

        const { data, error: rpcError } = await supabase.rpc('create_outage', {
          p_region:         o.region,
          p_town:           o.town,
          p_description:    safeDesc,
          p_started_at:     startedAt,
          p_area:           o.area          ?? '',
          p_severity:       o.severity      || 'medium',
          p_reporter:       o.reporter      ?? '',
          p_phone:          o.phone         ?? '',
          p_email:          o.email         ?? '',
          p_status:         o.status,
          p_lat:            o.lat           ?? null,
          p_lng:            o.lng           ?? null,
          p_affected_homes: o.affectedHomes ?? 0,
          p_token:          token,
        })

        if (rpcError) {
          console.error('[migration] RPC error for outage', o.id, ':', rpcError.message)
          allOk = false
          continue
        }

        if (!data?.[0]) {
          console.error('[migration] RPC returned no data for outage', o.id)
          allOk = false
          continue
        }

        // Persist outageId + reporterToken in MIGRATION_STATE_KEY before saving
        // the token to TOKENS_KEY. If _saveToken fails, the next retry reads this
        // record, skips the RPC (already migrated), and flushes the token.
        migrationState[key] = {
          status:        'migrated',
          outageId:      String(data[0].outage_id),
          reporterToken: data[0].reporter_token,
        }
        try {
          localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(migrationState))
        } catch (stateErr) {
          console.error('[migration] State write failed for outage', o.id,
            '— retry reuses same token; server deduplicates:', stateErr.message)
          allOk = false
          continue
        }

        delete migrationTokens[key]
        try { localStorage.setItem(MIGRATION_TOKENS_KEY, JSON.stringify(migrationTokens)) }
        catch { /* stale entry is harmless */ }

        // Token-save failure sets allOk=false so fence stays 'error' and the
        // flush loop at the top of the next run recovers the token.
        try { _saveToken(String(data[0].outage_id), data[0].reporter_token) }
        catch {
          _rememberTokenInMemory(String(data[0].outage_id), data[0].reporter_token)
          console.error('[migration] Reporter token save failed for outage', o.id,
            '— stored in MIGRATION_STATE_KEY and memory; will recover on next run')
          allOk = false
        }
      }

      // ── Phase 3: write quarantine ────────────────────────────────────────────
      // Merge by key — same key overwrites on retry, no duplicates.
      let quarantineOk = true
      if (Object.keys(quarantineBuffer).length > 0) {
        try {
          localStorage.setItem(
            UNMIGRATABLE_KEY,
            JSON.stringify({ ...existingQuarantine, ...quarantineBuffer })
          )
          try { localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(migrationState)) }
          catch { /* best-effort; UNMIGRATABLE_KEY is the authoritative record */ }
        } catch (storageErr) {
          console.error('[migration] Quarantine write failed — storage full?', storageErr.message)
          quarantineOk = false
          allOk = false
        }
      }

      // ── Phase 4: fence and LEGACY_KEY ───────────────────────────────────────
      // LEGACY_KEY is removed only after the fence write succeeds.
      // If the fence write itself throws we return immediately — LEGACY_KEY intact.
      // _retryCleanup() on the next init will remove it once the fence is stable.
      const anyQuarantined =
        Object.keys(existingQuarantine).length > 0 ||
        (quarantineOk && Object.keys(quarantineBuffer).length > 0)

      if (allOk && !anyQuarantined) {
        try { localStorage.setItem(MIGRATION_KEY, 'done') }
        catch { return }
        try { localStorage.removeItem(LEGACY_KEY) }           catch { /* storage unavailable */ }
        try { localStorage.removeItem(MIGRATION_STATE_KEY) }  catch { /* storage unavailable */ }
        try { localStorage.removeItem(MIGRATION_TOKENS_KEY) } catch { /* storage unavailable */ }
      } else if (allOk && quarantineOk) {
        try { localStorage.setItem(MIGRATION_KEY, 'partial') }
        catch { return }
        try { localStorage.removeItem(LEGACY_KEY) }           catch { /* storage unavailable */ }
        try { localStorage.removeItem(MIGRATION_STATE_KEY) }  catch { /* storage unavailable */ }
        try { localStorage.removeItem(MIGRATION_TOKENS_KEY) } catch { /* storage unavailable */ }
      } else {
        try { localStorage.setItem(MIGRATION_KEY, 'error') } catch { /* storage unavailable */ }
      }
    })

    if (!didRun) {
      console.warn('[migration] Another tab is running migration. Will retry on next init.')
    }
  } catch (err) {
    console.error('[migration] Unexpected error:', err)
    try { localStorage.setItem(MIGRATION_KEY, 'error') } catch { /* storage unavailable */ }
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
      .select('id, region, town, area, severity, description, reporter, started_at, resolved_at, status, timestamp, lat, lng, affected_homes')
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
  // Returns the real outage from Supabase augmented with { tokenPersisted }:
  //   tokenPersisted === true  — reporter token saved to localStorage
  //   tokenPersisted === false — outage committed, but the token could not be
  //                              persisted (kept in memory for this session only).
  // Throws ONLY when the outage was not created (RPC failure). A token-save
  // failure is a partial success, never a throw — the caller must not treat it as
  // a failed submission, or the user would resubmit and create a duplicate.
  //
  // NOTE: create_outage() does not yet deduplicate repeated p_token values (that
  // is the pending B2 server-side constraint). addOutage therefore does NOT retry
  // the RPC on its own; retries are only safe once B2 is deployed and verified.
  const addOutage = useCallback(async (formData) => {
    const reporterToken = crypto.randomUUID()
    const tempId = 'temp_' + crypto.randomUUID()

    const optimistic = {
      id:            tempId,
      region:        formData.region,
      town:          formData.town,
      area:          formData.area          || '',
      severity:      formData.severity      || SEVERITY.MEDIUM,
      description:   formData.description,
      reporter:      formData.reporter      || '',
      startedAt:     formData.startedAt,
      resolvedAt:    null,
      status:        STATUS.ACTIVE,
      timestamp:     new Date().toISOString(),
      lat:           null,
      lng:           null,
      affectedHomes: 0,
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
      p_affected_homes: 0,
      p_token:          reporterToken,
    })

    if (rpcErr || !data?.[0]) {
      setOutages(prev => prev.filter(o => o.id !== tempId))
      throw new Error(rpcErr?.message || 'Failed to submit outage report. Please try again.')
    }

    // The outage is now committed server-side. Persisting the reporter token is
    // best-effort: persistReporterToken never throws, so a storage failure here
    // cannot turn a successful submission into a reported failure. It keeps the
    // token in memory (so the reporter can still resolve it this session) and we
    // relay persisted:false to the caller via tokenPersisted for a partial-success UI.
    const { outage_id, reporter_token } = data[0]
    const { persisted: tokenPersisted } = persistReporterToken(outage_id, reporter_token)
    if (!tokenPersisted) {
      console.error('[addOutage] Reporter token could not be persisted for outage',
        outage_id, '— kept in memory for this session only; the reporter may be',
        'unable to resolve this outage after a reload.')
    }

    // Promote the temp ID to the real ID before the next await.  The realtime
    // INSERT event arrives during the fetch below; promoting the ID first means
    // the dedup check (prev.some o.id === realId) will find a match and skip it,
    // preventing the temp→real replacement from creating a duplicate entry.
    const realId = String(outage_id)
    setOutages(prev => prev.map(o => o.id === tempId ? { ...o, id: realId } : o))

    // Fetch real row to fill in server-computed fields (timestamp, lat/lng, etc.)
    const { data: row, error: fetchErr } = await supabase
      .from('outages')
      .select('id, region, town, area, severity, description, reporter, started_at, resolved_at, status, timestamp, lat, lng, affected_homes')
      .eq('id', outage_id)
      .single()

    const real = (!fetchErr && row)
      ? mapRow(row)
      : { ...optimistic, id: realId }

    setOutages(prev => prev.map(o => o.id === realId ? real : o))
    // Return a copy carrying tokenPersisted; the object stored in state stays clean.
    return { ...real, tokenPersisted }
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
