import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  optimisticallyInsertSplitGroup,
  optimisticallyDeleteSplitGroup,
  optimisticallyDeleteSplitExpense,
  optimisticallyInsertSplitExpense,
  optimisticallyDeleteSplitSettlement,
  optimisticallyInsertSplitSettlement,
} from '../../../../src/hooks/useSplitwise'
import { queryClient } from '../../../../src/lib/queryClient'

vi.mock('../../../../src/lib/queryClient', () => ({
  queryClient: {
    setQueryData: vi.fn(),
  },
  evictSwCacheEntries: vi.fn(),
}))

describe('useSplitwise optimistic updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('optimisticallyInsertSplitGroup', () => {
    it('does nothing if no userId is provided', () => {
      optimisticallyInsertSplitGroup({ id: '1' }, null)
      expect(queryClient.setQueryData).not.toHaveBeenCalled()
    })

    it('inserts a new group if cache is empty', () => {
      optimisticallyInsertSplitGroup({ id: '1', name: 'Test' }, 'user1')
      const [[key, updater]] = queryClient.setQueryData.mock.calls
      expect(key).toEqual(['splitwise', 'groups', 'user1'])
      const updated = updater(undefined) // simulate empty cache
      expect(updated).toEqual([{ id: '1', name: 'Test' }])
    })

    it('prepends a new group to existing cache', () => {
      optimisticallyInsertSplitGroup({ id: '2', name: 'Test 2' }, 'user1')
      const [[, updater]] = queryClient.setQueryData.mock.calls
      const updated = updater([{ id: '1', name: 'Test 1' }])
      expect(updated).toEqual([{ id: '2', name: 'Test 2' }, { id: '1', name: 'Test 1' }])
    })

    it('does not duplicate groups if they already exist', () => {
      optimisticallyInsertSplitGroup({ id: '1', name: 'Test' }, 'user1')
      const [[, updater]] = queryClient.setQueryData.mock.calls
      const existing = [{ id: '1', name: 'Test' }]
      const updated = updater(existing)
      expect(updated).toBe(existing) // returns same array ref
    })
  })

  describe('optimisticallyDeleteSplitGroup', () => {
    it('removes a group from cache', () => {
      optimisticallyDeleteSplitGroup('1', 'user1')
      const [[, updater]] = queryClient.setQueryData.mock.calls
      const existing = [{ id: '1' }, { id: '2' }]
      const updated = updater(existing)
      expect(updated).toEqual([{ id: '2' }])
    })

    it('handles empty cache gracefully', () => {
      optimisticallyDeleteSplitGroup('1', 'user1')
      const [[, updater]] = queryClient.setQueryData.mock.calls
      const updated = updater(undefined)
      expect(updated).toEqual([])
    })
  })

  describe('optimisticallyInsertSplitExpense', () => {
    it('inserts expense', () => {
      optimisticallyInsertSplitExpense('group1', { id: 'exp1' })
      const [[key, updater]] = queryClient.setQueryData.mock.calls
      expect(key).toEqual(['splitwise', 'expenses', 'group1'])
      
      const updatedEmpty = updater(undefined)
      expect(updatedEmpty).toEqual([{ id: 'exp1' }])

      const updatedPrepend = updater([{ id: 'exp2' }])
      expect(updatedPrepend).toEqual([{ id: 'exp1' }, { id: 'exp2' }])

      const updatedReplace = updater([{ id: 'exp1', old: true }])
      expect(updatedReplace).toEqual([{ id: 'exp1' }])
    })
  })

  describe('optimisticallyDeleteSplitExpense', () => {
    it('deletes expense', () => {
      optimisticallyDeleteSplitExpense('group1', 'exp1')
      const [[key, updater]] = queryClient.setQueryData.mock.calls
      expect(key).toEqual(['splitwise', 'expenses', 'group1'])
      
      const updated = updater([{ id: 'exp1' }, { id: 'exp2' }])
      expect(updated).toEqual([{ id: 'exp2' }])
    })
  })

  describe('optimisticallyInsertSplitSettlement', () => {
    it('inserts settlement', () => {
      optimisticallyInsertSplitSettlement('group1', { id: 'set1' })
      const [[key, updater]] = queryClient.setQueryData.mock.calls
      expect(key).toEqual(['splitwise', 'settlements', 'group1'])
      
      const updated = updater([{ id: 'set2' }])
      expect(updated).toEqual([{ id: 'set1' }, { id: 'set2' }])
    })
  })

  describe('optimisticallyDeleteSplitSettlement', () => {
    it('deletes settlement', () => {
      optimisticallyDeleteSplitSettlement('group1', 'set1')
      const [[key, updater]] = queryClient.setQueryData.mock.calls
      expect(key).toEqual(['splitwise', 'settlements', 'group1'])
      
      const updated = updater([{ id: 'set1' }])
      expect(updated).toEqual([])
    })
  })
})
