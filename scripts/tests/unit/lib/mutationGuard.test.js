import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { queryClient } from '../../../../src/lib/queryClient'
import { suppress, isSuppressed, withOptimisticGuard } from '../../../../src/lib/mutationGuard'

const UID = '11111111-1111-4111-8111-111111111111'
const realNow = Date.now

beforeEach(() => {
  queryClient.clear()
  queryClient.setQueryData(['kosha-active-wallet'], UID)
})

afterEach(() => {
  Date.now = realNow
})

describe('withOptimisticGuard', () => {
  it('rejects a second call on the same key while the first is running', async () => {
    let release
    const gate = new Promise((resolve) => { release = resolve })
    const first = withOptimisticGuard(['budgets', UID], () => gate)
    await expect(withOptimisticGuard(['budgets', UID], async () => 'second')).rejects.toThrow('OPTIMISTIC_BUSY')
    release('first')
    await expect(first).resolves.toBe('first')
  })

  it('does not block other keys and passes a UUID', async () => {
    let release
    const gate = new Promise((resolve) => { release = resolve })
    const first = withOptimisticGuard(['loans', UID], () => gate)
    const tempId = await withOptimisticGuard(['liabilities'], async (id) => id)
    expect(tempId).toMatch(/^[0-9a-f-]{36}$/)
    release()
    await first
  })

  it('releases the lock when the mutation fails', async () => {
    await expect(withOptimisticGuard(['transactions'], async () => { throw new Error('boom') })).rejects.toThrow('boom')
    await expect(withOptimisticGuard(['transactions'], async () => 'ok')).resolves.toBe('ok')
  })
})

describe('suppress and isSuppressed', () => {
  it('suppresses one table for the active wallet for 1.5 seconds', () => {
    const start = realNow()
    Date.now = () => start
    expect(isSuppressed('loans')).toBe(false)
    suppress('loans')
    expect(isSuppressed('loans')).toBe(true)
    expect(isSuppressed('transactions')).toBe(false)

    queryClient.setQueryData(['kosha-active-wallet'], 'someone-else')
    expect(isSuppressed('loans')).toBe(false)
    queryClient.setQueryData(['kosha-active-wallet'], UID)

    Date.now = () => start + 1501
    expect(isSuppressed('loans')).toBe(false)
  })
})
