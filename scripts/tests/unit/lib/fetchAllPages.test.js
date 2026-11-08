import { describe, it, expect } from 'vitest'
import { fetchAllPages } from '../../../../src/lib/fetchAllPages'

function fakeQuery(total) {
  const all = Array.from({ length: total }, (_, i) => i)
  const calls = []
  const build = () => ({
    range: async (from, to) => {
      calls.push([from, to])
      return { data: all.slice(from, to + 1), error: null }
    },
  })
  return { build, calls }
}

describe('fetchAllPages', () => {
  it('collects every page', async () => {
    const { build, calls } = fakeQuery(2500)
    const rows = await fetchAllPages(build)
    expect(rows).toHaveLength(2500)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('stops after a short page when the total is an exact multiple', async () => {
    const { build, calls } = fakeQuery(2000)
    expect(await fetchAllPages(build)).toHaveLength(2000)
    expect(calls).toHaveLength(3)
  })

  it('throws the query error', async () => {
    const build = () => ({ range: async () => ({ data: null, error: new Error('nope') }) })
    await expect(fetchAllPages(build)).rejects.toThrow('nope')
  })
})
