/**
 * useBudgets
 *
 * Manages per-category monthly spend limits.
 * Budgets are stored once and apply to every month — set it, forget it.
 *
 * Returns: { budgets: { [categoryId]: amount }, loading, setBudget, removeBudget }
 */

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, invalidateQueryFamilies } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'

export const BUDGET_INVALIDATION_KEYS = [['budgets']]

// FIX (defect 2.1, 2.2): Removed getUserId() which called getSession().
// All functions now use getAuthUserId() — synchronous, no race window.

function invalidate() {
  return invalidateQueryFamilies(BUDGET_INVALIDATION_KEYS)
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

  const setBudget = useCallback(async (category, amount) => {
    try {
      const userId = getAuthUserId()
      const { error } = await supabase
        .from('budgets')
        .upsert({ user_id: userId, category, amount }, { onConflict: 'user_id,category' })
      if (error) throw error

      // FIX (defect 1.2): inject into cache immediately so the budget bar
      // updates the instant the sheet closes, without waiting for a refetch
      queryClient.setQueryData(['budgets'], (old) => {
        if (!old) return { [category]: amount }
        return { ...old, [category]: amount }
      })

      // FIX (defect 1.1): no await — background only
      invalidate()
    } catch (err) {
      console.error('[Kosha] setBudget failed', err)
      throw err
    }
  }, [])

  const removeBudget = useCallback(async (category) => {
    try {
      const userId = getAuthUserId()
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('category', category)
        .eq('user_id', userId)
      if (error) throw error

      // Remove from cache immediately
      queryClient.setQueryData(['budgets'], (old) => {
        if (!old) return {}
        const next = { ...old }
        delete next[category]
        return next
      })

      // Background invalidation — no await
      invalidate()
    } catch (err) {
      console.error('[Kosha] removeBudget failed', err)
      throw err
    }
  }, [])

  return { budgets: budgets || {}, loading: isLoading, setBudget, removeBudget }
}
