/**
 * Hook-level tests for addOutage's partial-success contract (C2 Fix 1).
 *
 * The key guarantee: once create_outage() commits the outage server-side, a
 * failure to persist the reporter token must NOT surface as a failed submission
 * (that would push the user to resubmit and create a duplicate). Instead addOutage
 * resolves with tokenPersisted:false and keeps the token in memory.
 *
 * The hook is rendered with createElement (no JSX) because the project's vitest
 * config intentionally omits the React plugin — the other test files are JSX-free too.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'

// Fuller supabase mock than migration.test.js: addOutage reads back the row with
// .eq(...).single(), so the query builder needs those methods too.
vi.mock('../../lib/supabase.js', () => {
  const fromApi = {
    select: vi.fn().mockReturnThis(),
    order:  vi.fn().mockResolvedValue({ data: [], error: null }),
    eq:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { message: 'no row' } }),
  }
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn(() => fromApi),
      channel: vi.fn(() => ({
        on:        vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      })),
      removeChannel: vi.fn(),
    },
  }
})

import { useOutages, getToken } from '../useOutages.js'
import { supabase } from '../../lib/supabase.js'

const TOKENS_KEY = 'dumsor_tokens_v1'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const FORM = {
  region: 'Greater Accra',
  town: 'Madina',
  severity: 'medium',
  description: 'Power is out across the whole neighbourhood',
  startedAt: new Date(Date.now() - 3_600_000).toISOString(),
}

// Renders useOutages into a detached container and returns a live ref to its value.
async function renderUseOutages() {
  const ref = { current: null }
  function Probe() {
    ref.current = useOutages()
    return null
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(async () => { root.render(createElement(Probe)) })
  return { ref, unmount: () => act(() => root.unmount()) }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('addOutage — token persistence contract', () => {
  it('returns tokenPersisted:true and stores the token on a clean submission', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ outage_id: 101, reporter_token: 'tok-101' }],
      error: null,
    })

    const { ref, unmount } = await renderUseOutages()

    let result
    await act(async () => { result = await ref.current.addOutage(FORM) })

    expect(result.tokenPersisted).toBe(true)
    expect(result.town).toBe('Madina')
    expect(result.region).toBe('Greater Accra')
    expect(getToken('101')).toBe('tok-101')
    expect(JSON.parse(localStorage.getItem(TOKENS_KEY))['101']).toBe('tok-101')

    unmount()
  })

  it('resolves (does NOT throw) with tokenPersisted:false when the token write fails', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ outage_id: 202, reporter_token: 'tok-202' }],
      error: null,
    })

    // Fail only the reporter-token write; leave all other storage working.
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === TOKENS_KEY) throw new DOMException('QuotaExceededError')
      return realSetItem.call(this, key, value)
    })

    const { ref, unmount } = await renderUseOutages()

    let result
    let threw = false
    await act(async () => {
      try { result = await ref.current.addOutage(FORM) }
      catch { threw = true }
    })

    // The submission must be reported as a (partial) success, never a failure.
    expect(threw).toBe(false)
    expect(result).toBeDefined()
    expect(result.tokenPersisted).toBe(false)
    expect(result.town).toBe('Madina')

    // Token was not written to localStorage...
    expect(localStorage.getItem(TOKENS_KEY)).toBeNull()
    // ...but is recoverable in memory for this session.
    expect(getToken('202')).toBe('tok-202')

    unmount()
  })

  it('throws when the outage itself was not created (RPC error)', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'DB down' } })

    const { ref, unmount } = await renderUseOutages()

    await act(async () => {
      await expect(ref.current.addOutage(FORM)).rejects.toThrow(/DB down/)
    })

    unmount()
  })
})
