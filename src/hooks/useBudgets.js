import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { traceQuery } from '../lib/queryTrace'

const BUDGET_QUERY_KEY = ['categoryBudgets']
const BUDGET_COLUMNS = 'id, category, monthly_limit, created_at'

export function useBudgets({ enabled = true } = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: BUDGET_QUERY_KEY,
    enabled,
    queryFn: () =>
      traceQuery('categoryBudgets', async () => {
        const userId = getAuthUserId()
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
  const userId = getAuthUserId()

  // Optimistic update
  const prev = queryClient.getQueryData(BUDGET_QUERY_KEY)
  if (prev) {
    const idx = prev.findIndex((b) => b.category === category)
    const optimistic = idx >= 0
      ? prev.map((b, i) => i === idx ? { ...b, monthly_limit: monthlyLimit } : b)
      : [...prev, { id: `temp-${category}`, category, monthly_limit: monthlyLimit, created_at: new Date().toISOString() }]
    queryClient.setQueryData(BUDGET_QUERY_KEY, optimistic)
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

    queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEY })
    return data
  } catch (e) {
    if (prev) queryClient.setQueryData(BUDGET_QUERY_KEY, prev)
    throw e
  }
}

export async function deleteBudget(id) {
  const userId = getAuthUserId()

  // Optimistic update
  const prev = queryClient.getQueryData(BUDGET_QUERY_KEY)
  if (prev) {
    queryClient.setQueryData(BUDGET_QUERY_KEY, prev.filter((b) => b.id !== id))
  }

  try {
    const { error } = await supabase
      .from('category_budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error

    queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEY })
    return true
  } catch (e) {
    if (prev) queryClient.setQueryData(BUDGET_QUERY_KEY, prev)
    throw e
  }
}
