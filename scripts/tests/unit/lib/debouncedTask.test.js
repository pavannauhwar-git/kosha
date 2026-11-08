import { describe, it, expect, vi, afterEach } from 'vitest'
import { createDebouncedTask } from '../../../../src/lib/debouncedTask'

describe('createDebouncedTask', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('runs once and resolves every caller', async () => {
    vi.useFakeTimers()
    const task = vi.fn().mockResolvedValue(undefined)
    const schedule = createDebouncedTask(task, 50)
    const settled = []
    schedule().then(() => settled.push('a'))
    schedule().then(() => settled.push('b'))
    schedule().then(() => settled.push('c'))
    await vi.advanceTimersByTimeAsync(60)
    expect(task).toHaveBeenCalledTimes(1)
    expect(settled.sort()).toEqual(['a', 'b', 'c'])
  })

  it('still resolves callers when the task throws', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const schedule = createDebouncedTask(() => Promise.reject(new Error('boom')), 10)
    let done = false
    schedule().then(() => { done = true })
    await vi.advanceTimersByTimeAsync(20)
    expect(done).toBe(true)
  })
})
