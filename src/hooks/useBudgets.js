import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, invalidateQueryFamilies } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'

export const BUDGET_INVALIDATION_KEYS = [['budgets']]

async function invalidateBudgetCache() {
  await invalidateQueryFamilies(BUDGET_INVALIDATION_KEYS)
}

export function useBudgets(options = {}) {
  const { enabled = true } = options
  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    enabled,
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

  const removeBudget = useCallback(async (category) => {
    const prevBudgets = queryClient.getQueryData(['budgets'])
    if (prevBudgets && category in prevBudgets) {
      const next = { ...prevBudgets }
      delete next[category]
      // Optimistically update the cache to remove the budget immediately.
      queryClient.setQueryData(['budgets'], next)
    }

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
      if (prevBudgets) {
        // Rollback the optimistic update on error.
        queryClient.setQueryData(['budgets'], prevBudgets)
      }
      console.error('[Kosha] removeBudget failed', err)
      throw err
    }
  }, [])

  return { budgets: budgets || {}, loading: isLoading, setBudget, removeBudget }
}
