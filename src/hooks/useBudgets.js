/**
 * useBudgets
 *
 * Manages per-category monthly spend limits.
 * Budgets are stored once and apply to every month — set it, forget it.
 *
 * Returns: { budgets: { [categoryId]: amount }, loading, setBudget, removeBudget }
 *
 * setBudget(category, amount) — upserts via Supabase ON CONFLICT
 * removeBudget(category)      — deletes the row for that category
 */

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

// ── Session helper ────────────────────────────────────────────────────────
async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

function invalidate() {
  queryClient.invalidateQueries({ queryKey: ['budgets'] })
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useBudgets() {
  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('budgets')
        .select('category, amount')
      if (error) throw error
      return Object.fromEntries((rows || []).map(r => [r.category, +r.amount]))
    },
  })

  // ── setBudget: upsert a category budget ───────────────────────────────
  const setBudget = useCallback(async (category, amount) => {
    const user_id = await getUserId()
    const { error } = await supabase
      .from('budgets')
      .upsert({ user_id, category, amount }, { onConflict: 'user_id,category' })
    if (error) throw error
    invalidate()
  }, [])

  // ── removeBudget: delete a category budget ────────────────────────────
  const removeBudget = useCallback(async (category) => {
    const user_id = await getUserId()
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('category', category)
      .eq('user_id', user_id)
    if (error) throw error
    invalidate()
  }, [])

  return { budgets: budgets || {}, loading: isLoading, setBudget, removeBudget }
}
