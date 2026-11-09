import { describe, it, expect, beforeEach, vi } from 'vitest'
import { queryClient } from '../../../../src/lib/queryClient'
import { setAuthUser } from '../../../../src/lib/authStore'
import { MUTATION_RETRY } from '../../../../src/lib/mutationRetry'
import { addLiabilityMutation, LIABILITY_PENDING_QUERY_KEY } from '../../../../src/hooks/useLiabilities'

const UID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  queryClient.clear()
  setAuthUser({ id: UID })
  queryClient.setQueryData(['kosha-active-wallet'], UID)
  queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY(UID), [])
})

describe('addLiabilityMutation', () => {
  it('sends the optimistic id as the row id so a retried insert cannot create a second bill', async () => {
    const addLiability = vi.fn(async (payload, clientId) => ({ ...payload, id: clientId, paid: false }))
    const created = await addLiabilityMutation(
      { description: 'Internet', amount: 999, due_date: '2026-01-20' },
      { addLiability, invalidateLiabilityCache: vi.fn() },
    )
    const clientId = addLiability.mock.calls[0][1]
    expect(clientId).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.id).toBe(clientId)
    const pending = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY(UID))
    expect(pending.map((row) => row.id)).toEqual([clientId])
  })
})

describe('MUTATION_RETRY', () => {
  it('never retries the double-tap guard', () => {
    expect(MUTATION_RETRY(0, new Error('OPTIMISTIC_BUSY'))).toBe(false)
  })

  it('never retries a Postgres constraint error', () => {
    expect(MUTATION_RETRY(0, { code: '23505', message: 'duplicate key' })).toBe(false)
  })

  it('retries a plain network failure once more', () => {
    expect(MUTATION_RETRY(0, new TypeError('Failed to fetch'))).toBe(true)
    expect(MUTATION_RETRY(2, new TypeError('Failed to fetch'))).toBe(false)
  })
})
