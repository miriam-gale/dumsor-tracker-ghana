/**
 * Unit tests for the reporter-token helpers in useOutages.js.
 *
 * Covers the corrupt-store and storage-failure handling required by the C2
 * migration fixes: a corrupt token store must never be silently treated as empty
 * nor overwritten, and a failed write must fall back to memory instead of throwing.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

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

import { getToken, persistReporterToken } from '../useOutages.js'

const TOKENS_KEY = 'dumsor_tokens_v1'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getToken', () => {
  it('returns null when no token store exists', () => {
    expect(getToken('1')).toBeNull()
  })

  it('returns the stored token for a known outage id', () => {
    localStorage.setItem(TOKENS_KEY, JSON.stringify({ '42': 'tok-42' }))
    expect(getToken('42')).toBe('tok-42')
    expect(getToken(42)).toBe('tok-42')   // numeric id is coerced to string
  })

  it('returns null (does not throw) when the store is corrupt JSON', () => {
    localStorage.setItem(TOKENS_KEY, 'not json {{')
    expect(() => getToken('42')).not.toThrow()
    expect(getToken('42')).toBeNull()
  })

  it('returns null when the store is valid JSON but not an object', () => {
    localStorage.setItem(TOKENS_KEY, '"just a string"')
    expect(getToken('42')).toBeNull()
  })
})

describe('persistReporterToken', () => {
  it('writes the token to localStorage and reports persisted:true', () => {
    const { persisted } = persistReporterToken('7', 'tok-7')
    expect(persisted).toBe(true)
    expect(JSON.parse(localStorage.getItem(TOKENS_KEY))['7']).toBe('tok-7')
    expect(getToken('7')).toBe('tok-7')
  })

  it('merges into an existing token map without dropping other entries', () => {
    localStorage.setItem(TOKENS_KEY, JSON.stringify({ '1': 'a' }))
    persistReporterToken('2', 'b')
    const map = JSON.parse(localStorage.getItem(TOKENS_KEY))
    expect(map).toEqual({ '1': 'a', '2': 'b' })
  })

  it('does NOT overwrite a corrupt store, reports persisted:false, keeps token in memory', () => {
    localStorage.setItem(TOKENS_KEY, 'not json {{')
    const { persisted } = persistReporterToken('9', 'tok-9')

    expect(persisted).toBe(false)
    // Corrupt data must be preserved, not clobbered.
    expect(localStorage.getItem(TOKENS_KEY)).toBe('not json {{')
    // Token is recoverable this session via the in-memory fallback.
    expect(getToken('9')).toBe('tok-9')
  })

  it('reports persisted:false and falls back to memory when setItem throws (quota)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    const { persisted } = persistReporterToken('5', 'tok-5')

    expect(persisted).toBe(false)
    spy.mockRestore()
    // After storage recovers, the in-memory token is still resolvable.
    expect(getToken('5')).toBe('tok-5')
  })

  it('does not throw even when storage is completely unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })

    expect(() => persistReporterToken('3', 'tok-3')).not.toThrow()
    expect(persistReporterToken('3', 'tok-3').persisted).toBe(false)
  })
})
