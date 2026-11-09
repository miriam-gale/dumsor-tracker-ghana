/**
 * Integration tests for the localStorage→Supabase migration in useOutages.js.
 *
 * These tests import the real module (not a separate reimplementation).
 * supabase is mocked via vi.mock so no network calls are made.
 * localStorage is provided by the jsdom environment and reset between tests.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// vi.mock is hoisted before imports, so the mock is in place when useOutages.js loads.
vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    channel: vi.fn(() => ({
      on:        vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}))

import {
  migrateFromLocalStorage,
  classifyLegacyRecord,
  legacyRecordKey,
  getToken,
  persistReporterToken,
  _refreshMigrationLockFallback,
  _releaseMigrationLockFallback,
  _startMigrationHeartbeatFallback,
} from '../useOutages.js'
import { supabase } from '../../lib/supabase.js'

// ── Storage key constants (mirrors useOutages.js) ────────────────────────────
const LEGACY_KEY           = 'dumsor_outages_v1'
const MIGRATION_KEY        = 'dumsor_migrated_v1'
const MIGRATION_TOKENS_KEY = 'dumsor_migration_tokens_v1'
const MIGRATION_STATE_KEY  = 'dumsor_migration_state_v1'
const UNMIGRATABLE_KEY     = 'dumsor_unmigratable_v1'
const MIGRATION_LOCK_KEY   = 'dumsor_migration_lock_v1'
const TOKENS_KEY           = 'dumsor_tokens_v1'

// Minimal valid legacy record (passes classifyLegacyRecord with no reasons).
function validRecord(overrides = {}) {
  return {
    id:          'r1',
    region:      'Greater Accra',
    town:        'Madina',
    description: 'Power is out in most of the area',
    status:      'active',
    severity:    'medium',
    startedAt:   new Date(Date.now() - 3_600_000).toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

// ════════════════════════════════════════════════════════════════════════════
// classifyLegacyRecord
// ════════════════════════════════════════════════════════════════════════════

describe('classifyLegacyRecord', () => {
  it('returns no reasons for a fully valid record', () => {
    const { reasons, safeDesc } = classifyLegacyRecord(validRecord())
    expect(reasons).toEqual([])
    expect(safeDesc).toBe('Power is out in most of the area')
  })

  it('flags null as invalid_record_type', () => {
    const { reasons } = classifyLegacyRecord(null)
    expect(reasons).toContain('invalid_record_type')
  })

  it('flags an array as invalid_record_type', () => {
    const { reasons } = classifyLegacyRecord([])
    expect(reasons).toContain('invalid_record_type')
  })

  it('flags resolved status as unsupported_status', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ status: 'resolved' }))
    expect(reasons).toContain('unsupported_status')
  })

  it('flags unknown region', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ region: 'Mars' }))
    expect(reasons).toContain('unknown_region')
  })

  it('flags missing town', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ town: '   ' }))
    expect(reasons).toContain('missing_town')
  })

  it('flags description shorter than 10 chars', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ description: 'short' }))
    expect(reasons).toContain('description_too_short')
  })

  it('does NOT pad description — short description quarantined, not rewritten', () => {
    const { reasons, safeDesc } = classifyLegacyRecord(validRecord({ description: 'short' }))
    expect(reasons).toContain('description_too_short')
    expect(safeDesc).toBe('short')   // original trimmed value, no padding appended
  })

  it('flags missing startedAt', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ startedAt: null }))
    expect(reasons).toContain('missing_timestamp')
  })

  it('flags undefined startedAt', () => {
    const r = validRecord()
    delete r.startedAt
    const { reasons } = classifyLegacyRecord(r)
    expect(reasons).toContain('missing_timestamp')
  })

  it('flags an unparseable startedAt string', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ startedAt: 'not-a-date' }))
    expect(reasons).toContain('invalid_timestamp')
  })

  it('flags a future startedAt', () => {
    const future = new Date(Date.now() + 120_000).toISOString()
    const { reasons } = classifyLegacyRecord(validRecord({ startedAt: future }))
    expect(reasons).toContain('future_timestamp')
  })

  it('accepts a Date object as startedAt', () => {
    const { reasons } = classifyLegacyRecord(
      validRecord({ startedAt: new Date(Date.now() - 1000) })
    )
    expect(reasons).toEqual([])
  })

  it('flags lat without lng as lat_lng_mismatch', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ lat: 5.6, lng: null }))
    expect(reasons).toContain('lat_lng_mismatch')
  })

  it('accepts valid lat/lng pair', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ lat: 5.6, lng: -0.2 }))
    expect(reasons).toEqual([])
  })

  it('flags Infinity lat', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ lat: Infinity, lng: -0.2 }))
    expect(reasons).toContain('lat_not_finite')
  })

  it('flags negative affectedHomes', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ affectedHomes: -1 }))
    expect(reasons).toContain('negative_affected_homes')
  })

  it('accepts affectedHomes of 0', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ affectedHomes: 0 }))
    expect(reasons).toEqual([])
  })

  it('accepts a valid positive integer affectedHomes', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ affectedHomes: 1500 }))
    expect(reasons).toEqual([])
  })

  it('flags a decimal affectedHomes as affected_homes_not_integer', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ affectedHomes: 12.5 }))
    expect(reasons).toContain('affected_homes_not_integer')
    expect(reasons).not.toContain('negative_affected_homes')
  })

  it('flags NaN affectedHomes as invalid_affected_homes', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ affectedHomes: NaN }))
    expect(reasons).toContain('invalid_affected_homes')
  })

  it('flags Infinity affectedHomes as invalid_affected_homes (not silently accepted)', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ affectedHomes: Infinity }))
    expect(reasons).toContain('invalid_affected_homes')
  })

  it('flags a non-number affectedHomes as invalid_affected_homes', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ affectedHomes: '100' }))
    expect(reasons).toContain('invalid_affected_homes')
  })

  it('accepts affectedHomes at the int4 ceiling (2147483647)', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ affectedHomes: 2147483647 }))
    expect(reasons).toEqual([])
  })

  it('flags affectedHomes above the int4 ceiling as affected_homes_out_of_range', () => {
    const { reasons } = classifyLegacyRecord(validRecord({ affectedHomes: 2147483648 }))
    expect(reasons).toContain('affected_homes_out_of_range')
  })

  it('accumulates multiple reasons independently', () => {
    const { reasons } = classifyLegacyRecord(validRecord({
      region: 'Nowhere', town: '', description: 'x'
    }))
    expect(reasons).toContain('unknown_region')
    expect(reasons).toContain('missing_town')
    expect(reasons).toContain('description_too_short')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// legacyRecordKey
// ════════════════════════════════════════════════════════════════════════════

describe('legacyRecordKey', () => {
  it('uses id_ prefix for records with an id', () => {
    expect(legacyRecordKey({ id: 42 }, 0)).toBe('id_42')
  })

  it('uses pos_ prefix for non-objects', () => {
    expect(legacyRecordKey(null,  0)).toBe('pos_0')
    expect(legacyRecordKey('str', 1)).toBe('pos_1')
    expect(legacyRecordKey([],    2)).toBe('pos_2')
  })

  it('uses noid_ prefix for id-less objects', () => {
    const key = legacyRecordKey({ region: 'Greater Accra' }, 3)
    expect(key).toMatch(/^noid_3_/)
  })

  it('two identical id-less objects at different positions get different keys', () => {
    const o = { region: 'Greater Accra', town: 'Madina' }
    expect(legacyRecordKey(o, 0)).not.toBe(legacyRecordKey(o, 1))
  })

  it('is stable (same object + index → same key on repeat call)', () => {
    const o = { region: 'Ashanti', town: 'Kumasi', startedAt: '2025-01-01T00:00:00Z' }
    expect(legacyRecordKey(o, 5)).toBe(legacyRecordKey(o, 5))
  })
})

// ════════════════════════════════════════════════════════════════════════════
// migrateFromLocalStorage — fence guards
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — fence guards', () => {
  it('returns immediately when fence is "done"', async () => {
    localStorage.setItem(MIGRATION_KEY, 'done')
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    await migrateFromLocalStorage()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns immediately when fence is "partial"', async () => {
    localStorage.setItem(MIGRATION_KEY, 'partial')
    await migrateFromLocalStorage()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('retries when fence is "error"', async () => {
    localStorage.setItem(MIGRATION_KEY, 'error')
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 'tok' }], error: null })
    await migrateFromLocalStorage()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it('retries when fence is absent', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 'tok' }], error: null })
    await migrateFromLocalStorage()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it('sets fence to "done" and removes LEGACY_KEY when no LEGACY_KEY exists', async () => {
    await migrateFromLocalStorage()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// migrateFromLocalStorage — malformed legacy data
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — malformed legacy data', () => {
  it('sets fence to "error" and preserves LEGACY_KEY on unparseable JSON', async () => {
    localStorage.setItem(LEGACY_KEY, 'not json {{')
    await migrateFromLocalStorage()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('error')
    expect(localStorage.getItem(LEGACY_KEY)).toBe('not json {{')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('sets fence to "error" and preserves LEGACY_KEY when stored value is an object', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ foo: 'bar' }))
    await migrateFromLocalStorage()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('error')
    expect(localStorage.getItem(LEGACY_KEY)).toBeDefined()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('sets fence to "done" and removes LEGACY_KEY for an empty array', async () => {
    localStorage.setItem(LEGACY_KEY, '[]')
    await migrateFromLocalStorage()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('sets fence to "error" when MIGRATION_STATE_KEY is malformed', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    localStorage.setItem(MIGRATION_STATE_KEY, 'not-an-object')
    await migrateFromLocalStorage()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('error')
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('sets fence to "error" when UNMIGRATABLE_KEY contains stored null (≠ absent)', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    localStorage.setItem(UNMIGRATABLE_KEY, 'null')
    await migrateFromLocalStorage()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('error')
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// migrateFromLocalStorage — successful migration
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — successful migration', () => {
  it('migrates a valid record, sets fence to "done", removes LEGACY_KEY', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 99, reporter_token: 'tok-abc' }], error: null })

    await migrateFromLocalStorage()

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
    expect(localStorage.getItem(MIGRATION_STATE_KEY)).toBeNull()
    expect(localStorage.getItem(MIGRATION_TOKENS_KEY)).toBeNull()
  })

  it('passes p_started_at directly from the record — no timestamp fabrication', async () => {
    const ts = new Date(Date.now() - 7200_000).toISOString()
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord({ startedAt: ts })]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 't' }], error: null })

    await migrateFromLocalStorage()

    const call = supabase.rpc.mock.calls[0]
    expect(call[1].p_started_at).toBe(ts)
  })

  it('passes description as-is — no padding appended', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([
      validRecord({ description: 'Outage on main road' })  // exactly 19 chars, ≥10
    ]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 't' }], error: null })

    await migrateFromLocalStorage()

    const call = supabase.rpc.mock.calls[0]
    expect(call[1].p_description).toBe('Outage on main road')
  })

  it('stores the reporter token in TOKENS_KEY after success', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({
      data: [{ outage_id: 55, reporter_token: 'reporter-uuid' }],
      error: null,
    })

    await migrateFromLocalStorage()

    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}')
    expect(tokens['55']).toBe('reporter-uuid')
  })

  it('releases the migration lock after successful completion', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 'tok' }], error: null })

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_LOCK_KEY)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// migrateFromLocalStorage — quarantine
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — quarantine', () => {
  it('quarantines a record with missing timestamp, fence → "partial"', async () => {
    const r = validRecord({ startedAt: null })
    localStorage.setItem(LEGACY_KEY, JSON.stringify([r]))
    await migrateFromLocalStorage()

    expect(supabase.rpc).not.toHaveBeenCalled()
    const q = JSON.parse(localStorage.getItem(UNMIGRATABLE_KEY))
    const entry = Object.values(q)[0]
    expect(entry.reasons).toContain('missing_timestamp')
    expect(entry.original.town).toBe('Madina')
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('partial')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('quarantines an invalid record and migrates the valid sibling', async () => {
    const bad  = validRecord({ startedAt: null, id: 'bad1' })
    const good = validRecord({ id: 'good1' })
    localStorage.setItem(LEGACY_KEY, JSON.stringify([bad, good]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 7, reporter_token: 'x' }], error: null })

    await migrateFromLocalStorage()

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    const q = JSON.parse(localStorage.getItem(UNMIGRATABLE_KEY))
    expect(Object.values(q).some(e => e.reasons.includes('missing_timestamp'))).toBe(true)
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('partial')
  })

  it('preserves an existing quarantine entry across runs (idempotent merge)', async () => {
    const existing = {
      'id_old': { reasons: ['missing_timestamp'], original: { id: 'old' }, ts: '2025-01-01T00:00:00Z' }
    }
    localStorage.setItem(UNMIGRATABLE_KEY, JSON.stringify(existing))
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord({ id: 'new1' })]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 8, reporter_token: 'y' }], error: null })

    await migrateFromLocalStorage()

    const q = JSON.parse(localStorage.getItem(UNMIGRATABLE_KEY))
    expect(q['id_old']).toBeDefined()
    expect(q['id_old'].original.id).toBe('old')
  })

  it('sets fence to "partial" (not "done") when existing quarantine is non-empty', async () => {
    localStorage.setItem(UNMIGRATABLE_KEY, JSON.stringify({
      'id_x': { reasons: ['missing_timestamp'], original: {}, ts: '' }
    }))
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 9, reporter_token: 'z' }], error: null })

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_KEY)).toBe('partial')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// migrateFromLocalStorage — token idempotency (retry with stable token)
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — token idempotency', () => {
  it('reuses the same token on retry after RPC error', async () => {
    const rec = validRecord()
    localStorage.setItem(LEGACY_KEY, JSON.stringify([rec]))

    // First run: RPC fails
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
    await migrateFromLocalStorage()

    const tokensAfterRun1 = JSON.parse(localStorage.getItem(MIGRATION_TOKENS_KEY))
    const key = Object.keys(tokensAfterRun1)[0]
    const savedToken = tokensAfterRun1[key]

    // Reset fence so retry runs
    localStorage.removeItem(MIGRATION_KEY)

    // Second run: RPC succeeds
    supabase.rpc.mockResolvedValueOnce({ data: [{ outage_id: 10, reporter_token: 'r' }], error: null })
    await migrateFromLocalStorage()

    const call2 = supabase.rpc.mock.calls[1]
    expect(call2[1].p_token).toBe(savedToken)
  })

  it('does not call RPC again for a record already in MIGRATION_STATE_KEY', async () => {
    const rec = validRecord()
    const key = legacyRecordKey(rec, 0)
    localStorage.setItem(LEGACY_KEY, JSON.stringify([rec]))
    // Both old-format string and new-format object should be recognised as migrated.
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify({
      [key]: { status: 'migrated', outageId: '5', reporterToken: 'prev-token' }
    }))
    // Pre-save the token so the flush step succeeds immediately
    localStorage.setItem(TOKENS_KEY, JSON.stringify({ '5': 'prev-token' }))

    await migrateFromLocalStorage()

    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
  })

  it('recognises the legacy "migrated" string format as already-processed', async () => {
    const rec = validRecord()
    const key = legacyRecordKey(rec, 0)
    localStorage.setItem(LEGACY_KEY, JSON.stringify([rec]))
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify({ [key]: 'migrated' }))

    await migrateFromLocalStorage()

    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
  })

  it('calls RPC again (same token) when MIGRATION_STATE_KEY write failed on a prior run — documents B2 dependency', async () => {
    // This test documents the failure mode where create_outage succeeded but the
    // subsequent MIGRATION_STATE_KEY write threw (storage full). The next retry
    // DOES call create_outage again because MIGRATION_STATE_KEY has no record to
    // skip on. The client sends the same p_token. Preventing a duplicate database
    // row in this case requires the B2 server-side p_token uniqueness constraint.
    const rec = validRecord()
    const key = legacyRecordKey(rec, 0)
    const prePersistedToken = crypto.randomUUID()

    // State after MIGRATION_STATE_KEY write failure:
    //   - Fence = 'error' (allOk was set false by the state-write catch block)
    //   - LEGACY_KEY intact (not yet removed)
    //   - MIGRATION_TOKENS_KEY has the stable token (delete was skipped by continue)
    //   - MIGRATION_STATE_KEY absent (write failed)
    //   - TOKENS_KEY absent (_saveToken was also skipped by continue)
    localStorage.setItem(MIGRATION_KEY, 'error')
    localStorage.setItem(LEGACY_KEY, JSON.stringify([rec]))
    localStorage.setItem(MIGRATION_TOKENS_KEY, JSON.stringify({ [key]: prePersistedToken }))
    // MIGRATION_STATE_KEY intentionally absent
    // TOKENS_KEY intentionally absent

    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 50, reporter_token: 'new-tok' }], error: null })
    await migrateFromLocalStorage()

    // RPC must be called — the record is not in MIGRATION_STATE_KEY so it is not skipped
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    // The stable pre-persisted token must be reused — NOT a freshly generated UUID
    expect(supabase.rpc.mock.calls[0][1].p_token).toBe(prePersistedToken)
    // After successful retry the fence advances and LEGACY_KEY is removed
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// migrateFromLocalStorage — RPC / network failures
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — RPC failures', () => {
  it('sets fence to "error" when RPC returns an error, preserves LEGACY_KEY', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'DB down' } })

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_KEY)).toBe('error')
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })

  it('sets fence to "error" when RPC returns no data row, preserves LEGACY_KEY', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [], error: null })

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_KEY)).toBe('error')
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })

  it('sets fence to "error" when RPC rejects (promise rejects)', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockRejectedValue(new Error('network failure'))

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_KEY)).toBe('error')
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })

  it('continues other records when one RPC call fails', async () => {
    const r1 = validRecord({ id: 'r1' })
    const r2 = validRecord({ id: 'r2' })
    localStorage.setItem(LEGACY_KEY, JSON.stringify([r1, r2]))

    supabase.rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'fail r1' } })
      .mockResolvedValueOnce({ data: [{ outage_id: 2, reporter_token: 't' }], error: null })

    await migrateFromLocalStorage()

    expect(supabase.rpc).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('error')
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })

  it('releases the migration lock even when an RPC fails', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'DB down' } })

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_LOCK_KEY)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Fix 1 — cross-tab migration coordination
// ════════════════════════════════════════════════════════════════════════════

// These tests exercise the localStorage advisory-lock fallback path.
// jsdom does not implement navigator.locks, so _withMigrationLock automatically
// falls through to _acquireMigrationLockFallback / _releaseMigrationLockFallback.
describe('migrateFromLocalStorage — localStorage advisory lock (fallback)', () => {
  it('does not run migration when another tab holds the lock', async () => {
    const otherId = crypto.randomUUID()
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: otherId, ts: Date.now() }))
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))

    await migrateFromLocalStorage()

    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull()
    const lock = JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY))
    expect(lock.id).toBe(otherId)
  })

  it('runs migration when the lock is expired (> 30 s old)', async () => {
    const expiredTs = Date.now() - 31_000
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: crypto.randomUUID(), ts: expiredTs }))
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 'tok' }], error: null })

    await migrateFromLocalStorage()

    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
  })

  it('releases the lock after a successful run', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 'tok' }], error: null })

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_LOCK_KEY)).toBeNull()
  })

  it('releases the lock even when the outer try throws (promise reject)', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockRejectedValue(new Error('fatal'))

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_LOCK_KEY)).toBeNull()
  })

  it('does not overwrite lock held by another tab during cleanup', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 'tok' }], error: null })
    await migrateFromLocalStorage()

    // Another tab now holds the lock
    const otherId = crypto.randomUUID()
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: otherId, ts: Date.now() }))

    // Fence is 'done' → _retryCleanup runs → must not touch the other tab's lock
    await migrateFromLocalStorage()

    const lock = JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY))
    expect(lock.id).toBe(otherId)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Fix 1 — Web Locks API path
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — Web Locks API path', () => {
  // Install a mock navigator.locks before each test, remove it after so
  // subsequent tests continue using the localStorage fallback (jsdom default).
  function installWebLocksMock(grantLock = true) {
    const request = vi.fn(async (_name, _opts, cb) =>
      cb(grantLock ? { name: _name } : null)
    )
    Object.defineProperty(navigator, 'locks', {
      value: { request },
      configurable: true,
      writable: true,
    })
    return request
  }

  afterEach(() => {
    // Remove mock so navigator.locks is undefined again for other suites
    try {
      Object.defineProperty(navigator, 'locks', {
        value: undefined, configurable: true, writable: true,
      })
    } catch { /* already undefined */ }
  })

  it('calls navigator.locks.request with the correct lock name and ifAvailable', async () => {
    const request = installWebLocksMock(true)
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 'tok' }], error: null })

    await migrateFromLocalStorage()

    expect(request).toHaveBeenCalledWith(
      'dumsor-migration-v1',
      { ifAvailable: true },
      expect.any(Function)
    )
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
  })

  it('backs off (no RPC) when Web Locks returns null (lock held by another tab)', async () => {
    installWebLocksMock(false)
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))

    await migrateFromLocalStorage()

    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem(MIGRATION_KEY)).toBeNull()
  })

  it('does not write MIGRATION_LOCK_KEY when Web Locks API is available', async () => {
    installWebLocksMock(true)
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 'tok' }], error: null })

    await migrateFromLocalStorage()

    // The Web Locks path must never touch the localStorage fallback lock key
    expect(localStorage.getItem(MIGRATION_LOCK_KEY)).toBeNull()
  })

  it('sets fence to "error" and does not rethrow when RPC rejects under Web Locks', async () => {
    installWebLocksMock(true)
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockRejectedValue(new Error('network down'))

    await expect(migrateFromLocalStorage()).resolves.toBeUndefined()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('error')
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull()
  })

  it('re-checks fence inside the lock and skips work when another tab already finished', async () => {
    // Simulate: outer fence check sees 'absent', then another tab sets it to 'done'
    // before we enter the lock. The inner re-check should short-circuit.
    const request = vi.fn(async (_name, _opts, cb) => {
      // Simulate another tab completing migration just before we enter
      localStorage.setItem(MIGRATION_KEY, 'done')
      await cb({ name: _name })
    })
    Object.defineProperty(navigator, 'locks', {
      value: { request }, configurable: true, writable: true,
    })
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))

    await migrateFromLocalStorage()

    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Fix 2 — reporter-token persistence and recovery
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — token persistence and recovery (Fix 2)', () => {
  it('stores outageId and reporterToken in MIGRATION_STATE_KEY after RPC success', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({
      data: [{ outage_id: 77, reporter_token: 'rich-token' }],
      error: null,
    })

    await migrateFromLocalStorage()

    // After a clean run MIGRATION_STATE_KEY is cleaned up.
    // To inspect the intermediate state, we run a second record that fails
    // so the state is preserved — or we just verify the token was saved.
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}')
    expect(tokens['77']).toBe('rich-token')
  })

  it('recovers reporter token from MIGRATION_STATE_KEY on retry when _saveToken failed', async () => {
    // Simulate a state where the RPC succeeded and the rich state was written,
    // but _saveToken failed (storage was full) so fence stayed 'error'.
    const rec = validRecord()
    const key = legacyRecordKey(rec, 0)

    localStorage.setItem(MIGRATION_KEY, 'error')
    localStorage.setItem(LEGACY_KEY, JSON.stringify([rec]))
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify({
      [key]: { status: 'migrated', outageId: '42', reporterToken: 'recovery-token' }
    }))
    // TOKENS_KEY deliberately absent — simulates the failed _saveToken

    await migrateFromLocalStorage()

    // Token should be saved now
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}')
    expect(tokens['42']).toBe('recovery-token')
    // Migration should be complete — RPC was not called again
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('does not advance fence to "done" when MIGRATION_STATE_KEY has unsaved token and record has no matching TOKENS_KEY entry', async () => {
    // The record is already in MIGRATION_STATE_KEY (RPC succeeded in a prior run),
    // but TOKENS_KEY was never written (storage was full in the prior run).
    // On retry the token flush loop should write the token; if that succeeds,
    // fence advances to 'done'. This test verifies RPC is NOT called a second time.
    const rec = validRecord()
    const key = legacyRecordKey(rec, 0)

    localStorage.setItem(MIGRATION_KEY, 'error')
    localStorage.setItem(LEGACY_KEY, JSON.stringify([rec]))
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify({
      [key]: { status: 'migrated', outageId: '77', reporterToken: 'retry-token' }
    }))
    // TOKENS_KEY absent — simulates the original _saveToken failure

    await migrateFromLocalStorage()

    // RPC must NOT be called again; the server already processed this record
    expect(supabase.rpc).not.toHaveBeenCalled()
    // Token must now be persisted (flush succeeded this time)
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}')
    expect(tokens['77']).toBe('retry-token')
    // Fence advances because flush succeeded and no more valid records remain
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
  })

  it('retries _saveToken when the token only exists in memory (never persisted to TOKENS_KEY)', async () => {
    // Regression: the recovery loop previously used getToken(), which also reads
    // the in-memory fallback. A token that reached memory but was never written to
    // TOKENS_KEY looked "recovered", so migration completed and the record was
    // dropped — then the in-memory copy was lost on reload. The loop must check
    // TOKENS_KEY directly and re-persist.
    const rec = validRecord()
    const key = legacyRecordKey(rec, 0)
    const outageId = '88'
    const token = 'memory-only-token'

    // Simulate the prior run's failed _saveToken: setItem throws, so the token
    // lands in the in-memory fallback only.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    persistReporterToken(outageId, token)
    spy.mockRestore()

    // getToken reports it as present (via memory) even though TOKENS_KEY is empty.
    expect(getToken(outageId)).toBe(token)
    expect(localStorage.getItem(TOKENS_KEY)).toBeNull()

    localStorage.setItem(MIGRATION_KEY, 'error')
    localStorage.setItem(LEGACY_KEY, JSON.stringify([rec]))
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify({
      [key]: { status: 'migrated', outageId, reporterToken: token }
    }))

    await migrateFromLocalStorage()

    // Recovery must have written the token durably to TOKENS_KEY.
    const tokens = JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}')
    expect(tokens[outageId]).toBe(token)
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('does not rewrite a token that is already persisted in TOKENS_KEY', async () => {
    // The correct token is already durable. The recovery loop must detect this via
    // the direct TOKENS_KEY check and skip the write entirely.
    const rec = validRecord()
    const key = legacyRecordKey(rec, 0)
    const outageId = '99'
    const token = 'persisted-token'

    localStorage.setItem(MIGRATION_KEY, 'error')
    localStorage.setItem(LEGACY_KEY, JSON.stringify([rec]))
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify({
      [key]: { status: 'migrated', outageId, reporterToken: token }
    }))
    localStorage.setItem(TOKENS_KEY, JSON.stringify({ [outageId]: token }))

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    await migrateFromLocalStorage()

    // No write to TOKENS_KEY: the token was already persisted, so it is untouched.
    const tokenWrites = setItemSpy.mock.calls.filter(([k]) => k === TOKENS_KEY)
    expect(tokenWrites).toEqual([])
    setItemSpy.mockRestore()

    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
    expect(JSON.parse(localStorage.getItem(TOKENS_KEY))[outageId]).toBe(token)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Fix 3 — retryable LEGACY_KEY cleanup
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — retryable cleanup (Fix 3)', () => {
  it('removes orphaned LEGACY_KEY on next call when fence is already "done"', async () => {
    localStorage.setItem(MIGRATION_KEY, 'done')
    // Simulate: fence was written but removeItem(LEGACY_KEY) failed previously
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))

    await migrateFromLocalStorage()

    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('removes orphaned MIGRATION_STATE_KEY on next call when fence is "done"', async () => {
    localStorage.setItem(MIGRATION_KEY, 'done')
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify({ 'id_x': 'migrated' }))

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_STATE_KEY)).toBeNull()
  })

  it('removes orphaned MIGRATION_TOKENS_KEY on next call when fence is "partial"', async () => {
    localStorage.setItem(MIGRATION_KEY, 'partial')
    localStorage.setItem(MIGRATION_TOKENS_KEY, JSON.stringify({ 'id_x': 'some-uuid' }))

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_TOKENS_KEY)).toBeNull()
  })

  it('does not run migration (no RPC call) when cleanup runs during "done" fence', async () => {
    localStorage.setItem(MIGRATION_KEY, 'done')
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify({ 'id_r1': 'migrated' }))

    await migrateFromLocalStorage()

    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem(MIGRATION_KEY)).toBe('done')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// migrateFromLocalStorage — repeated initialization (idempotent fence)
// ════════════════════════════════════════════════════════════════════════════

describe('migrateFromLocalStorage — repeated initialization', () => {
  it('does not run twice in the same session if "done"', async () => {
    localStorage.setItem(MIGRATION_KEY, 'done')
    await migrateFromLocalStorage()
    await migrateFromLocalStorage()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('is safe to call many times concurrently — each call resolves without throwing', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 't' }], error: null })
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))

    await expect(
      Promise.all([
        migrateFromLocalStorage(),
        migrateFromLocalStorage(),
        migrateFromLocalStorage(),
      ])
    ).resolves.not.toThrow()
  })

  it('cleans up MIGRATION_STATE_KEY and MIGRATION_TOKENS_KEY after "done"', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
    supabase.rpc.mockResolvedValue({ data: [{ outage_id: 3, reporter_token: 't' }], error: null })

    await migrateFromLocalStorage()

    expect(localStorage.getItem(MIGRATION_STATE_KEY)).toBeNull()
    expect(localStorage.getItem(MIGRATION_TOKENS_KEY)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Fallback migration lock — heartbeat (keeps a live-but-slow holder's ts fresh)
// ════════════════════════════════════════════════════════════════════════════

describe('fallback migration lock — _refreshMigrationLockFallback', () => {
  it('re-stamps the ts while we still own the lock', () => {
    const oldTs = Date.now() - 20_000
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: 'me', ts: oldTs }))

    const ok = _refreshMigrationLockFallback('me')

    expect(ok).toBe(true)
    const after = JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY))
    expect(after.id).toBe('me')
    expect(after.ts).toBeGreaterThan(oldTs)
  })

  it('refuses to overwrite a lock owned by another tab', () => {
    const otherTs = Date.now()
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: 'other', ts: otherTs }))

    const ok = _refreshMigrationLockFallback('me')

    expect(ok).toBe(false)
    const after = JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY))
    expect(after.id).toBe('other')   // untouched
    expect(after.ts).toBe(otherTs)   // ts not bumped
  })

  it('returns false when the lock is absent (never recreates it)', () => {
    expect(_refreshMigrationLockFallback('me')).toBe(false)
    expect(localStorage.getItem(MIGRATION_LOCK_KEY)).toBeNull()
  })

  it('returns false (no crash) when localStorage.setItem throws', () => {
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: 'me', ts: Date.now() }))
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    expect(() => _refreshMigrationLockFallback('me')).not.toThrow()
    expect(_refreshMigrationLockFallback('me')).toBe(false)

    spy.mockRestore()
  })
})

describe('fallback migration lock — _startMigrationHeartbeatFallback', () => {
  it('periodically refreshes the lock and stops when stop() is called', () => {
    vi.useFakeTimers()
    try {
      const baseTs = Date.now() - 25_000
      localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: 'me', ts: baseTs }))
      const stop = _startMigrationHeartbeatFallback('me')

      // One interval tick re-stamps the ts.
      vi.advanceTimersByTime(10_000)
      const afterTick = JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY))
      expect(afterTick.id).toBe('me')
      expect(afterTick.ts).toBeGreaterThan(baseTs)

      // After stop(), the interval is cleared: no further writes occur.
      stop()
      const tsAfterStop = JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY)).ts
      vi.advanceTimersByTime(60_000)
      expect(JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY)).ts).toBe(tsAfterStop)
    } finally {
      vi.useRealTimers()
    }
  })

  it('warns once and stops refreshing after ownership is lost', () => {
    vi.useFakeTimers()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: 'me', ts: Date.now() }))
      const stop = _startMigrationHeartbeatFallback('me')

      // Still ours → refresh succeeds silently.
      vi.advanceTimersByTime(10_000)
      expect(warnSpy).not.toHaveBeenCalled()

      // Another tab takes over the lock.
      const otherTs = Date.now()
      localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: 'other', ts: otherTs }))

      // Next tick → ownership lost → warns once and clears the interval.
      vi.advanceTimersByTime(10_000)
      expect(warnSpy).toHaveBeenCalledTimes(1)
      // Must not have overwritten the other tab's lock.
      expect(JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY)).id).toBe('other')
      expect(JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY)).ts).toBe(otherTs)

      // Further ticks are no-ops (interval cleared): no extra warnings or writes.
      vi.advanceTimersByTime(30_000)
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY)).id).toBe('other')

      stop()
    } finally {
      warnSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('stops the heartbeat and releases the lock when migration finishes', async () => {
    vi.useFakeTimers()
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify([validRecord()]))
      supabase.rpc.mockResolvedValue({ data: [{ outage_id: 1, reporter_token: 'tok' }], error: null })

      await migrateFromLocalStorage()

      // finally block cleared the heartbeat interval and released the lock.
      expect(clearSpy).toHaveBeenCalled()
      expect(localStorage.getItem(MIGRATION_LOCK_KEY)).toBeNull()

      // No lingering interval: advancing time must not resurrect the lock key.
      vi.advanceTimersByTime(60_000)
      expect(localStorage.getItem(MIGRATION_LOCK_KEY)).toBeNull()
    } finally {
      clearSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})

describe('fallback migration lock — _releaseMigrationLockFallback ownership', () => {
  it('removes the lock when we own it', () => {
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: 'me', ts: Date.now() }))
    _releaseMigrationLockFallback('me')
    expect(localStorage.getItem(MIGRATION_LOCK_KEY)).toBeNull()
  })

  it('leaves a lock owned by another tab untouched', () => {
    const otherTs = Date.now()
    localStorage.setItem(MIGRATION_LOCK_KEY, JSON.stringify({ id: 'other', ts: otherTs }))

    _releaseMigrationLockFallback('me')

    const after = JSON.parse(localStorage.getItem(MIGRATION_LOCK_KEY))
    expect(after.id).toBe('other')
    expect(after.ts).toBe(otherTs)
  })
})
