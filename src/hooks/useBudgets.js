import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { getActiveWalletUserId, useActiveWallet } from '../lib/walletStore'
import { withOptimisticGuard } from '../lib/mutationGuard'
import { traceQuery } from '../lib/queryTrace'
import { hapticSuccess } from '../lib/haptics'

const budgetQueryKey = (userId) => ['categoryBudgets', userId]
const BUDGET_COLUMNS = 'id, category, monthly_limit, created_at'

export function useBudgets({ enabled = true } = {}) {
  const activeUserId = useActiveWallet()
  const { data, isLoading, error } = useQuery({
    queryKey: budgetQueryKey(activeUserId),
    enabled: enabled && !!activeUserId,
    queryFn: () =>
      traceQuery('categoryBudgets', async () => {
        const userId = activeUserId
        const { data: rows, error: queryError } = await supabase
          .from('category_budgets')
          .select(BUDGET_COLUMNS)
          .eq('user_id', userId)
          .order('category', { ascending: true })

        if (queryError) throw queryError
        return rows || []
      }),
    placeholderData: (previousData) => previousData,
  })

  return {
    budgets: data || [],
    loading: isLoading,
    error,
  }
}

export function budgetMap(budgets) {
  const map = new Map()
  for (const b of budgets) {
    map.set(b.category, b)
  }
  return map
}

export async function upsertBudget(category, monthlyLimit) {
  const authUserId = getAuthUserId()
  const userId = getActiveWalletUserId()
  
  if (userId !== authUserId) {
    throw new Error('Shared wallets are view-only. You cannot modify budgets here.')
  }

  const key = budgetQueryKey(userId)

  return withOptimisticGuard(key, async (tempId) => {
    // Optimistic update
    const prev = queryClient.getQueryData(key)
    if (prev) {
      const idx = prev.findIndex((b) => b.category === category)
      const optimistic = idx >= 0
        ? prev.map((b, i) => i === idx ? { ...b, monthly_limit: monthlyLimit } : b)
        : [...prev, { id: tempId, category, monthly_limit: monthlyLimit, created_at: new Date().toISOString() }]
      queryClient.setQueryData(key, optimistic)
    }

    try {
      const { data, error } = await supabase
        .from('category_budgets')
        .upsert(
          { user_id: userId, category, monthly_limit: monthlyLimit },
          { onConflict: 'user_id,category' }
        )
        .select(BUDGET_COLUMNS)
        .single()

      if (error) throw error

      hapticSuccess()
      queryClient.invalidateQueries({ queryKey: key })
      return data
    } catch (e) {
      if (prev) queryClient.setQueryData(key, prev)
      throw e
    }
  })
}

export async function deleteBudget(id) {
  const authUserId = getAuthUserId()
  const userId = getActiveWalletUserId()

  if (userId !== authUserId) {
    throw new Error('Shared wallets are view-only. You cannot delete budgets here.')
  }

  const key = budgetQueryKey(userId)

  return withOptimisticGuard(key, async () => {
    // Optimistic update
    const prev = queryClient.getQueryData(key)
    if (prev) {
      queryClient.setQueryData(key, prev.filter((b) => b.id !== id))
    }

    try {
      const { error } = await supabase
        .from('category_budgets')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      hapticSuccess()
      queryClient.invalidateQueries({ queryKey: key })
      return true
    } catch (e) {
      if (prev) queryClient.setQueryData(key, prev)
      throw e
    }
  })
}
