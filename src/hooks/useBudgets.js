/**
 * useBudgets.js — Strict Server-Truth Architecture
 *
 * Follows the same mutation contract as useTransactions.js:
 *   1. await Supabase DB operation
 *   2. await invalidateCache() — waits for full refetch cycle
 *
 * NO setQueryData. NO cache injection. Server truth only.
 */

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { invalidateQueryFamilies } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'

export const BUDGET_INVALIDATION_KEYS = [['budgets']]

/**
 * Invalidates all budget queries and awaits the full refetch cycle.
 * Always await this inside mutations.
 */
async function invalidateBudgetCache() {
  await invalidateQueryFamilies(BUDGET_INVALIDATION_KEYS)
}

export function useBudgets() {
  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      try {
        const userId = getAuthUserId()
        const { data: rows, error } = await supabase
          .from('budgets')
          .select('category, amount')
          .eq('user_id', userId)
        if (error) throw error
        return Object.fromEntries((rows || []).map(r => [r.category, +r.amount]))
      } catch (err) {
        console.error('[Kosha] budgets query failed', err)
        throw err
      }
    },
  })

  /**
   * Set or update a budget for a category.
   *
   * Strict Await Chain:
   *   1. await Supabase upsert
   *   2. await invalidateBudgetCache() — active queries refetch before resolve
   *
   * The calling component must await this and keep isSaving=true until it
   * resolves to ensure the UI reflects the confirmed server state.
   */
  const setBudget = useCallback(async (category, amount) => {
    try {
      const userId = getAuthUserId()
      const { error } = await supabase
        .from('budgets')
        .upsert({ user_id: userId, category, amount }, { onConflict: 'user_id,category' })
      if (error) throw error

      // STRICT AWAIT: the budget bar in CategorySpendingChart must not update
      // until the server confirms the write AND the query has refetched.
      await invalidateBudgetCache()
    } catch (err) {
      console.error('[Kosha] setBudget failed', err)
      throw err
    }
  }, [])

  /**
   * Remove a budget for a category.
   *
   * Same strict await contract.
   */
  const removeBudget = useCallback(async (category) => {
    try {
      const userId = getAuthUserId()
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('category', category)
        .eq('user_id', userId)
      if (error) throw error

      await invalidateBudgetCache()
    } catch (err) {
      console.error('[Kosha] removeBudget failed', err)
      throw err
    }
  }, [])

  return { budgets: budgets || {}, loading: isLoading, setBudget, removeBudget }
}
