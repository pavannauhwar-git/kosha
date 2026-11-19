import { describe, it, expect } from 'vitest'
import { retryWhileBusy } from '../../../../src/lib/mutationRetry'

const busy = () => new Error('OPTIMISTIC_BUSY')

describe('retryWhileBusy', () => {
  it('waits out the optimistic lock and then commits', async () => {
    let calls = 0
    const result = await retryWhileBusy(async () => {
      calls += 1
      if (calls < 3) throw busy()
      return 'done'
    }, { delayMs: 1 })
    expect(result).toBe('done')
    expect(calls).toBe(3)
  })

  it('gives up after the last attempt', async () => {
    let calls = 0
    await expect(retryWhileBusy(async () => { calls += 1; throw busy() }, { attempts: 2, delayMs: 1 }))
      .rejects.toThrow('OPTIMISTIC_BUSY')
    expect(calls).toBe(2)
  })

  it('does not retry other errors', async () => {
    let calls = 0
    await expect(retryWhileBusy(async () => { calls += 1; throw new Error('boom') }, { delayMs: 1 }))
      .rejects.toThrow('boom')
    expect(calls).toBe(1)
  })
})
